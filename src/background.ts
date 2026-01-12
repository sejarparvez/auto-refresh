import { initLogger, log, warn } from "./logger";
import { fromStorage, getDefaultInterval, getTabCount, toStorageState } from "./state";
import type { Message, TabState } from "./types";

initLogger();

export function isMessage(msg: unknown): msg is Message {
	if (typeof msg !== "object" || msg === null || !("action" in msg)) return false;
	const m = msg as Record<string, unknown>;
	if (m.action === "start") return typeof m.interval === "number" && typeof m.tabId === "number";
	if (m.action === "stop" || m.action === "pause" || m.action === "resume")
		return typeof m.tabId === "number";
	return false;
}

const MIN_INTERVAL = 60;

// Returns a jittered value within ±30% of base, never below MIN_INTERVAL.
// With ±10% on a 60s base the swing is only ±6s and the lower half gets
// clamped away — barely noticeable. ±30% gives a 42–78s range on 60s base.
export function jitteredInterval(base: number): number {
	const jitter = base * 0.3;
	const value = base + (Math.random() * 2 - 1) * jitter;
	const result = Math.max(MIN_INTERVAL, Math.round(value));
	log(`jitter: base=${base}s  jittered=${result}s`);
	return result;
}

function getAlarmName(tabId: number): string {
	return `autoRefresh-${tabId}`;
}

// Schedule an alarm.
// Fixed mode  → periodInMinutes  (browser repeats automatically)
// Random mode → delayInMinutes   (one-shot; we reschedule after each fire
//                                 with a fresh jittered value)
function scheduleAlarm(alarmName: string, intervalSecs: number, randomize: boolean): Promise<void> {
	log(`scheduleAlarm name=${alarmName} interval=${intervalSecs}s randomize=${randomize}`);
	return browser.alarms.clear(alarmName).then(() => {
		if (randomize) {
			browser.alarms.create(alarmName, { delayInMinutes: intervalSecs / 60 });
		} else {
			browser.alarms.create(alarmName, { periodInMinutes: intervalSecs / 60 });
		}
	});
}

export function handleMessage(
	msg: unknown,
): Promise<{ actualInterval: number } | { remaining: number }> | undefined {
	if (!isMessage(msg)) return;

	if (msg.action === "start") {
		const { interval, tabId, randomize: msgRandomize } = msg;
		const clampedInterval = Math.max(MIN_INTERVAL, interval);

		return browser.storage.local
			.get(["randomize", "tabStates", "defaultInterval"])
			.then(async (data) => {
				// msgRandomize (from popup) takes precedence over stored value
				const randomize =
					typeof msgRandomize === "boolean"
						? msgRandomize
						: typeof data.randomize === "boolean"
							? data.randomize
							: false;

				log(`start tab=${tabId} interval=${clampedInterval}s randomize=${randomize}`);

				const count = getTabCount(data, tabId);
				const alarmName = getAlarmName(tabId);
				const actualInterval = randomize ? jitteredInterval(clampedInterval) : clampedInterval;

				const status = fromStorage(data, tabId);
				status.state = "ACTIVE";
				status.tabId = tabId;
				status.interval = clampedInterval;
				status.count = count;
				status.randomize = randomize;
				status.actualInterval = actualInterval;

				const defaultInterval = getDefaultInterval(data);

				// Persist — includes tabState.randomize so handleAlarm can read it
				browser.storage.local
					.set(toStorageState(status, defaultInterval, data.tabStates))
					.catch((err) => console.warn("[AutoRefresh]", err));

				browser.action.setBadgeText({ text: "ON", tabId });
				browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
				browser.tabs
					.sendMessage(tabId, { showCountdown: actualInterval })
					.catch((err) => console.warn("[AutoRefresh]", err));

				// Await alarm creation so errors propagate
				await scheduleAlarm(alarmName, actualInterval, randomize).catch((err) =>
					console.warn("[AutoRefresh]", err),
				);

				return { actualInterval };
			})
			.catch((err) => {
				console.warn("[AutoRefresh]", err);
				return { actualInterval: clampedInterval };
			});
	}

	if (msg.action === "stop") {
		const tabId = msg.tabId;
		log("Stopping auto-refresh for tab:", tabId);

		browser.action.setBadgeText({ text: "", tabId });
		browser.tabs
			.sendMessage(tabId, { hideCountdown: true })
			.catch((err) => console.warn("[AutoRefresh]", err));
		browser.alarms.clear(getAlarmName(tabId));

		browser.storage.local
			.get(["tabStates", "defaultInterval"])
			.then((data) => {
				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				delete tabStates[tabId];
				const hasActive = Object.values(tabStates).some((s) => !s.paused);
				browser.storage.local
					.set({ active: hasActive, tabStates })
					.catch((err) => console.warn("[AutoRefresh]", err));
			})
			.catch((err) => console.warn("[AutoRefresh]", err));
	}

	if (msg.action === "pause") {
		const tabId = msg.tabId;
		log("Pausing auto-refresh for tab:", tabId);

		return browser.storage.local.get(["tabStates", "defaultInterval"]).then(async (data) => {
			const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
			if (!tabStates[tabId]) {
				log("No tab state found for pause");
				return { remaining: 0 };
			}

			const alarm = await browser.alarms.get(getAlarmName(tabId));
			let remaining = tabStates[tabId].interval;
			if (alarm) {
				const ms = alarm.scheduledTime - Date.now();
				remaining = Math.max(1, Math.ceil(ms / 1000));
				await browser.alarms.clear(getAlarmName(tabId));
			}

			tabStates[tabId].paused = true;
			tabStates[tabId].remaining = remaining;

			browser.storage.local
				.set({ active: true, tabStates })
				.catch((err) => console.warn("[AutoRefresh]", err));
			browser.action.setBadgeText({ text: "II", tabId });
			browser.tabs
				.sendMessage(tabId, { hideCountdown: true })
				.catch((err) => console.warn("[AutoRefresh]", err));

			return { remaining };
		});
	}

	if (msg.action === "resume") {
		const tabId = msg.tabId;
		log("Resuming auto-refresh for tab:", tabId);

		return browser.storage.local.get(["tabStates", "defaultInterval"]).then(async (data) => {
			const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
			const tabState = tabStates[tabId];
			if (!tabState) {
				log("No tab state found for resume");
				return { actualInterval: 60 };
			}

			tabState.paused = false;
			const baseInterval = tabState.interval;
			const remaining = tabState.remaining ?? baseInterval;
			const randomize = tabState.randomize ?? false;
			const alarmName = getAlarmName(tabId);
			const actualInterval = randomize ? jitteredInterval(baseInterval) : baseInterval;

			tabState.remaining = null;
			tabState.actualInterval = actualInterval;

			browser.storage.local
				.set({ active: true, tabStates })
				.catch((err) => console.warn("[AutoRefresh]", err));
			browser.action.setBadgeText({ text: "ON", tabId });
			browser.action.setBadgeBackgroundColor({ color: "#16a34a" });

			await browser.alarms.clear(alarmName);
			if (randomize) {
				browser.alarms.create(alarmName, { delayInMinutes: remaining / 60 });
			} else {
				browser.alarms.create(alarmName, {
					delayInMinutes: remaining / 60,
					periodInMinutes: baseInterval / 60,
				});
			}

			browser.tabs
				.sendMessage(tabId, { showCountdown: remaining })
				.catch((err) => console.warn("[AutoRefresh]", err));

			return { actualInterval };
		});
	}
}

export function handleAlarm(alarm: browser.alarms.Alarm): void {
	if (!alarm.name.startsWith("autoRefresh-")) return;

	const tabId = Number(alarm.name.split("-")[1]);
	log(`alarm fired for tab=${tabId}`);

	browser.storage.local
		.get(["tabStates", "defaultInterval"])
		.then((data) => {
			const tabState = data.tabStates?.[tabId];
			if (!tabState) {
				log("No tab state found, clearing alarm");
				browser.alarms.clear(alarm.name);
				return;
			}

			const randomize = typeof tabState.randomize === "boolean" ? tabState.randomize : false;
			const baseInterval = tabState.interval ?? data.defaultInterval ?? MIN_INTERVAL;
			const currentCount = tabState.count ?? 0;

			// Compute the next interval BEFORE reloading the tab so it's
			// ready to write to storage and send to popup immediately after reload.
			const nextInterval = randomize ? jitteredInterval(baseInterval) : baseInterval;
			log(`next interval=${nextInterval}s randomize=${randomize}`);

			browser.tabs
				.reload(tabId)
				.then(() => {
					const newCount = currentCount + 1;
					const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
					if (tabStates[tabId]) {
						tabStates[tabId].count = newCount;
						tabStates[tabId].actualInterval = nextInterval;
					}
					browser.storage.local
						.set({ tabStates })
						.catch((err) => console.warn("[AutoRefresh]", err));

					// Send next countdown to content script overlay
					browser.tabs
						.sendMessage(tabId, { showCountdown: nextInterval })
						.catch((err) => console.warn("[AutoRefresh]", err));

					// Fixed alarms repeat automatically via periodInMinutes.
					// Randomized alarms are one-shot — schedule the next one now.
					if (randomize) {
						scheduleAlarm(alarm.name, nextInterval, true).catch((err) =>
							console.warn("[AutoRefresh]", err),
						);
					}
				})
				.catch((err) => {
					warn("Tab reload failed, stopping:", err);
					browser.alarms.clear(getAlarmName(tabId));
					browser.storage.local
						.get("tabStates")
						.then((d) => {
							const tabStates: Record<number, TabState> = { ...(d.tabStates || {}) };
							delete tabStates[tabId];
							const hasActive = Object.values(tabStates).some((s) => !s.paused);
							browser.storage.local
								.set({ active: hasActive, tabStates })
								.catch((err) => console.warn("[AutoRefresh]", err));
						})
						.catch((err) => console.warn("[AutoRefresh]", err));
					browser.action
						.setBadgeText({ text: "", tabId })
						.catch((err) => console.warn("[AutoRefresh]", err));
				});
		})
		.catch((err) => console.warn("[AutoRefresh]", err));
}

browser.runtime.onMessage.addListener(handleMessage);
browser.alarms.onAlarm.addListener(handleAlarm);

export async function handleStartup(): Promise<void> {
	log("Extension startup: clearing stale alarms and state");
	const allAlarms = await browser.alarms.getAll();
	for (const alarm of allAlarms) {
		if (alarm.name.startsWith("autoRefresh-")) {
			await browser.alarms.clear(alarm.name);
		}
	}
	await browser.storage.local
		.set({ active: false })
		.catch((err) => console.warn("[AutoRefresh]", err));
}

browser.runtime.onStartup.addListener(handleStartup);

browser.commands.onCommand.addListener((command) => {
	if (command !== "toggle-refresh") return;
	browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
		if (!tab?.id) return;
		browser.storage.local.get(["tabStates", "defaultInterval", "randomize"]).then((data) => {
			const isActive =
				data.active === true && tab.id !== undefined && tab.id in (data.tabStates ?? {});
			if (isActive) {
				handleMessage({ action: "stop", tabId: tab.id });
			} else {
				handleMessage({
					action: "start",
					interval: data.defaultInterval ?? MIN_INTERVAL,
					tabId: tab.id,
					randomize: data.randomize ?? false,
				});
			}
		});
	});
});

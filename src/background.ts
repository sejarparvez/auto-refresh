import { initLogger, log, warn } from "./logger";
import { fromStorage, getDefaultInterval, getTabCount, toStorageState } from "./state";
import type { Message, TabState } from "./types";

initLogger();

export function isMessage(msg: unknown): msg is Message {
	return typeof msg === "object" && msg !== null && "action" in msg;
}

const MIN_INTERVAL = 60;

// Returns a jittered value within ±30% of base, never below MIN_INTERVAL.
// With ±10% on a 60s base the swing is only ±6s and the lower half gets
// clamped away — barely noticeable. ±30% gives a 42–78s range on 60s base.
export function jitteredInterval(base: number): number {
	const jitter = base * 0.3;
	const value = base + (Math.random() * 2 - 1) * jitter;
	const result = Math.max(MIN_INTERVAL, Math.round(value));
	console.log(`[AutoRefresh] jitter: base=${base}s  jittered=${result}s`);
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
	console.log(
		`[AutoRefresh] scheduleAlarm name=${alarmName} interval=${intervalSecs}s randomize=${randomize}`,
	);
	return browser.alarms.clear(alarmName).then(() => {
		if (randomize) {
			browser.alarms.create(alarmName, { delayInMinutes: intervalSecs / 60 });
		} else {
			browser.alarms.create(alarmName, { periodInMinutes: intervalSecs / 60 });
		}
	});
}

export function handleMessage(msg: unknown): Promise<{ actualInterval: number }> | undefined {
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

				console.log(
					`[AutoRefresh] start tab=${tabId} interval=${clampedInterval}s randomize=${randomize}`,
				);

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
					.catch(() => {});

				browser.action.setBadgeText({ text: "ON", tabId });
				browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
				browser.tabs.sendMessage(tabId, { showCountdown: actualInterval }).catch(() => {});

				// Await alarm creation so errors propagate
				await scheduleAlarm(alarmName, actualInterval, randomize).catch(() => {});

				return { actualInterval };
			})
			.catch(() => ({ actualInterval: clampedInterval }));
	}

	if (msg.action === "stop") {
		const tabId = msg.tabId;
		log("Stopping auto-refresh for tab:", tabId);

		browser.action.setBadgeText({ text: "", tabId });
		browser.tabs.sendMessage(tabId, { hideCountdown: true }).catch(() => {});
		browser.alarms.clear(getAlarmName(tabId));

		browser.storage.local
			.get(["tabStates", "defaultInterval"])
			.then((data) => {
				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				delete tabStates[tabId];
				const hasActive = Object.values(tabStates).some((s) => !s.paused);
				browser.storage.local.set({ active: hasActive, tabStates }).catch(() => {});
			})
			.catch(() => {});
	}
}

export function handleAlarm(alarm: browser.alarms.Alarm): void {
	if (!alarm.name.startsWith("autoRefresh-")) return;

	const tabId = Number(alarm.name.split("-")[1]);
	console.log(`[AutoRefresh] alarm fired for tab=${tabId}`);

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
			console.log(`[AutoRefresh] next interval=${nextInterval}s randomize=${randomize}`);

			browser.tabs
				.reload(tabId)
				.then(() => {
					const newCount = currentCount + 1;
					const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
					if (tabStates[tabId]) {
						tabStates[tabId].count = newCount;
						tabStates[tabId].actualInterval = nextInterval;
					}
					browser.storage.local.set({ tabStates }).catch(() => {});

					// Send next countdown to content script overlay
					browser.tabs.sendMessage(tabId, { showCountdown: nextInterval }).catch(() => {});

					// Fixed alarms repeat automatically via periodInMinutes.
					// Randomized alarms are one-shot — schedule the next one now.
					if (randomize) {
						scheduleAlarm(alarm.name, nextInterval, true).catch(() => {});
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
							browser.storage.local.set({ active: hasActive, tabStates }).catch(() => {});
						})
						.catch(() => {});
					browser.action.setBadgeText({ text: "", tabId }).catch(() => {});
				});
		})
		.catch(() => {});
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
	await browser.storage.local.set({ active: false }).catch(() => {});
}

browser.runtime.onStartup.addListener(handleStartup);

browser.commands.onCommand.addListener((command) => {
	if (command !== "toggle-refresh") return;
	browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
		if (!tab?.id) return;
		browser.storage.local.get(["tabStates", "defaultInterval", "randomize"]).then((data) => {
			const isActive = data.active === true && data.currentTabId === tab.id;
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

import { initLogger, log, warn } from "./logger";
import { fromStorage, getDefaultInterval, getTabCount, toStorageState } from "./state";
import type { Message, TabState } from "./types";

initLogger();

export function isMessage(msg: unknown): msg is Message {
	if (typeof msg !== "object" || msg === null || !("action" in msg)) return false;
	const m = msg as Record<string, unknown>;
	if (m.action === "start") return typeof m.interval === "number" && typeof m.tabId === "number";
	if (
		m.action === "stop" ||
		m.action === "pause" ||
		m.action === "resume" ||
		m.action === "resetCount"
	)
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

function formatBadge(secs: number): string {
	if (secs >= 3600) return `${Math.round(secs / 3600)}h`;
	if (secs >= 60) return `${Math.round(secs / 60)}m`;
	return `${secs}s`;
}

function isRestrictedUrl(url: string | undefined): boolean {
	if (!url) return true;
	const restricted = ["about:", "view-source:", "file://", "moz-extension://", "chrome:", "data:"];
	return restricted.some((prefix) => url.startsWith(prefix));
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
	existingData?: Record<string, unknown>,
): Promise<{ actualInterval: number } | { remaining: number }> | undefined {
	if (!isMessage(msg)) return;

	if (msg.action === "start") {
		const { interval, tabId, randomize: msgRandomize, maxRefreshes: msgMaxRefreshes } = msg;
		const clampedInterval = Math.max(MIN_INTERVAL, interval);

		const storagePromise =
			existingData && "tabStates" in existingData
				? Promise.resolve(existingData)
				: browser.storage.local.get(["randomize", "tabStates", "defaultInterval"]);

		return storagePromise
			.then(async (data) => {
				// msgRandomize (from popup) takes precedence over stored value
				const randomize =
					typeof msgRandomize === "boolean"
						? msgRandomize
						: typeof data.randomize === "boolean"
							? data.randomize
							: false;

				log(`start tab=${tabId} interval=${clampedInterval}s randomize=${randomize}`);

				const tabInfo = await browser.tabs.get(tabId);
				if (isRestrictedUrl(tabInfo.url)) {
					warn(`cannot start on restricted URL: ${tabInfo.url}`);
					return { actualInterval: clampedInterval };
				}

				const maxRefreshes = typeof msgMaxRefreshes === "number" ? msgMaxRefreshes : null;

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
				status.url = tabInfo.url ?? null;
				status.maxRefreshes = maxRefreshes;
				status.bypassCache = msg.bypassCache ?? false;

				const defaultInterval = getDefaultInterval(data);

				// Persist — includes tabState.randomize so handleAlarm can read it
				browser.storage.local
					.set(toStorageState(status, defaultInterval, data.tabStates))
					.catch((err) => console.warn("[AutoRefresh]", err));

				browser.action.setBadgeText({ text: formatBadge(actualInterval), tabId });
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
			browser.action.setBadgeText({ text: formatBadge(actualInterval), tabId });
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

	if (msg.action === "resetCount") {
		const tabId = msg.tabId;
		log("Resetting count for tab:", tabId);
		browser.storage.local
			.get(["tabStates", "defaultInterval"])
			.then((data) => {
				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				if (tabStates[tabId]) {
					tabStates[tabId].count = 0;
					browser.storage.local
						.set({ tabStates })
						.catch((err) => console.warn("[AutoRefresh]", err));
				}
			})
			.catch((err) => console.warn("[AutoRefresh]", err));
		return;
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

			// Max refreshes check
			const maxRefreshes = typeof tabState.maxRefreshes === "number" ? tabState.maxRefreshes : null;
			if (maxRefreshes !== null && currentCount >= maxRefreshes) {
				log(`max refreshes (${maxRefreshes}) reached for tab=${tabId}, stopping`);
				browser.alarms.clear(alarm.name);
				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				delete tabStates[tabId];
				const hasActive = Object.values(tabStates).some((s) => !s.paused);
				browser.storage.local
					.set({ active: hasActive, tabStates })
					.catch((err) => console.warn("[AutoRefresh]", err));
				browser.action
					.setBadgeText({ text: "", tabId })
					.catch((err) => console.warn("[AutoRefresh]", err));
				return;
			}

			// Verify tab is still at a refreshable URL before reloading
			browser.tabs
				.get(tabId)
				.then((tab) => {
					if (isRestrictedUrl(tab.url)) {
						warn(`tab ${tabId} now has restricted URL, stopping`);
						browser.alarms.clear(alarm.name);
						const ts: Record<number, TabState> = { ...(data.tabStates || {}) };
						delete ts[tabId];
						const hasActive = Object.values(ts).some((s) => !s.paused);
						browser.storage.local
							.set({ active: hasActive, tabStates: ts })
							.catch((err) => console.warn("[AutoRefresh]", err));
						browser.action
							.setBadgeText({ text: "", tabId })
							.catch((err) => console.warn("[AutoRefresh]", err));
						return;
					}

					const tabStateForReload = data.tabStates?.[tabId];
					browser.tabs
						.reload(tabId, { bypassCache: tabStateForReload?.bypassCache === true })
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

							browser.runtime
								.sendMessage({
									type: "countdownUpdate",
									tabId,
									count: newCount,
									actualInterval: nextInterval,
									maxRefreshes: tabState.maxRefreshes ?? null,
								})
								.catch(() => {});

							browser.tabs
								.sendMessage(tabId, { showCountdown: nextInterval })
								.catch((err) => console.warn("[AutoRefresh]", err));
							browser.action
								.setBadgeText({ text: formatBadge(nextInterval), tabId })
								.catch((err) => console.warn("[AutoRefresh]", err));

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
		})
		.catch((err) => console.warn("[AutoRefresh]", err));
}

browser.runtime.onMessage.addListener((msg, _sender, _sendResponse) => handleMessage(msg));
browser.alarms.onAlarm.addListener(handleAlarm);

export async function handleStartup(): Promise<void> {
	log("Extension startup: re-attaching active tab states");
	const data = await browser.storage.local
		.get(["tabStates", "defaultInterval", "randomize"])
		.catch((err) => {
			console.warn("[AutoRefresh]", err);
			return { tabStates: {}, defaultInterval: 60, randomize: false };
		});

	const tabStates: Record<number, TabState> = data.tabStates || {};
	if (Object.keys(tabStates).length === 0) {
		log("No stored tab states to restore");
		await browser.storage.local
			.set({ active: false })
			.catch((err) => console.warn("[AutoRefresh]", err));
		return;
	}

	const allAlarms = await browser.alarms.getAll();
	const existingAlarmNames = new Set(allAlarms.map((a) => a.name));

	const tabs = await browser.tabs.query({});
	let hasActive = false;

	for (const [storedTabIdStr, tabState] of Object.entries(tabStates)) {
		const storedTabId = Number(storedTabIdStr);

		// Try to match by tabId first (survives extension reload), then by URL (survives browser restart)
		let matchingTab = tabs.find((t) => t.id === storedTabId);
		if (!matchingTab && tabState.url) {
			matchingTab = tabs.find((t) => t.url === tabState.url);
		}

		if (matchingTab && matchingTab.id !== undefined) {
			const newTabId = matchingTab.id;
			const paused = tabState.paused ?? false;
			const baseInterval = tabState.interval;
			const randomize = tabState.randomize ?? false;
			const alarmName = getAlarmName(newTabId);

			if (!paused && !isRestrictedUrl(matchingTab.url)) {
				const actualInterval = randomize ? jitteredInterval(baseInterval) : baseInterval;

				// Migrate tab state if tabId changed
				if (newTabId !== storedTabId) {
					delete tabStates[storedTabId];
				}
				tabStates[newTabId] = { ...tabState, paused: false, actualInterval };

				if (!existingAlarmNames.has(alarmName)) {
					await scheduleAlarm(alarmName, actualInterval, randomize).catch((err) =>
						console.warn("[AutoRefresh]", err),
					);
				}

				browser.action
					.setBadgeText({ text: formatBadge(actualInterval), tabId: newTabId })
					.catch((err) => console.warn("[AutoRefresh]", err));
				browser.action
					.setBadgeBackgroundColor({ color: "#16a34a", tabId: newTabId })
					.catch((err) => console.warn("[AutoRefresh]", err));

				hasActive = true;
			} else if (!paused) {
				// Restricted URL — mark as paused instead of losing state
				tabStates[storedTabId] = { ...tabState, paused: true };
			}
		} else {
			// Tab no longer exists — clean up
			delete tabStates[storedTabId];
		}
	}

	await browser.storage.local
		.set({ active: hasActive, tabStates, currentTabId: null })
		.catch((err) => console.warn("[AutoRefresh]", err));

	log(`Startup complete: ${hasActive ? "active tabs restored" : "no active tabs"}`);
}

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleStartup);

// Stop refresh when user navigates away from the stored URL
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (!changeInfo.url) return;
	browser.storage.local
		.get("tabStates")
		.then((data) => {
			const tabState = data.tabStates?.[tabId];
			if (tabState?.url && tabState.url !== changeInfo.url && !tabState.paused) {
				log(`tab ${tabId} navigated from ${tabState.url} to ${changeInfo.url}, stopping`);
				handleMessage({ action: "stop", tabId });
			}
		})
		.catch((err) => console.warn("[AutoRefresh]", err));
});

export function handleToggleCommand(command: string): void {
	if (command !== "toggle-refresh") return;
	browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
		if (!tab?.id || !tab.url) return;
		if (isRestrictedUrl(tab.url)) return;
		browser.storage.local.get(["tabStates", "defaultInterval", "randomize"]).then((data) => {
			const isActive =
				data.active === true && tab.id !== undefined && tab.id in (data.tabStates ?? {});
			if (isActive) {
				handleMessage({ action: "stop", tabId: tab.id });
			} else {
				handleMessage(
					{
						action: "start",
						interval: data.defaultInterval ?? MIN_INTERVAL,
						tabId: tab.id,
						randomize: data.randomize ?? false,
					},
					data,
				);
			}
		});
	});
}

browser.commands.onCommand.addListener(handleToggleCommand);

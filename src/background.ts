import { initLogger, log, warn } from "./logger";
import { fromStorage, getDefaultInterval, getTabCount, toStorageState } from "./state";
import type { Message, TabState } from "./types";

initLogger();

export function isMessage(msg: unknown): msg is Message {
	return typeof msg === "object" && msg !== null && "action" in msg;
}

const MIN_INTERVAL = 60; // Firefox minimum for periodInMinutes is 1

// Apply ±10% jitter to an interval, clamped to MIN_INTERVAL
export function jitteredInterval(base: number): number {
	const jitter = base * 0.1;
	return Math.max(MIN_INTERVAL, Math.round(base + (Math.random() * 2 - 1) * jitter));
}

function getAlarmName(tabId: number): string {
	return `autoRefresh-${tabId}`;
}

export function handleMessage(msg: unknown): void {
	if (!isMessage(msg)) return;

	if (msg.action === "start") {
		const { interval, tabId } = msg;

		const clampedInterval = Math.max(60, interval);

		log("Starting auto-refresh:", { interval: clampedInterval, tabId });

		browser.storage.local
			.get(["randomize", "tabStates", "defaultInterval"])
			.then((data) => {
				const randomize = typeof data.randomize === "boolean" ? data.randomize : false;
				const count = getTabCount(data, tabId);

				const alarmName = getAlarmName(tabId);

				const status = fromStorage(data, tabId);
				status.state = "ACTIVE";
				status.tabId = tabId;
				status.interval = clampedInterval;
				status.count = count;
				status.randomize = randomize;

				const defaultInterval = getDefaultInterval(data);

				browser.storage.local
					.set(toStorageState(status, defaultInterval, data.tabStates))
					.catch(() => {});

				browser.action.setBadgeText({ text: "ON", tabId });
				browser.action.setBadgeBackgroundColor({ color: "#16a34a" });

				browser.tabs.sendMessage(tabId, { showCountdown: clampedInterval }).catch(() => {});

				browser.alarms.clear(alarmName).then(() => {
					const actualInterval = randomize ? jitteredInterval(clampedInterval) : clampedInterval;
					browser.alarms.create(alarmName, {
						periodInMinutes: actualInterval / 60,
					});
				});
			})
			.catch(() => {});
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
				browser.storage.local
					.set({
						active: hasActive,
						tabStates,
					})
					.catch(() => {});
			})
			.catch(() => {});
	}

	if (msg.action === "pause") {
		const tabId = msg.tabId;
		log("Pausing auto-refresh for tab:", tabId);

		const alarmName = getAlarmName(tabId);

		browser.storage.local
			.get(["tabStates", "defaultInterval"])
			.then((data) => {
				browser.alarms
					.get(alarmName)
					.then((alarm) => {
						let remainingSec: number | null = null;
						if (alarm) {
							const remainingMs = alarm.scheduledTime - Date.now();
							remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
						}

						const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
						if (tabStates[tabId]) {
							tabStates[tabId].paused = true;
							if (remainingSec !== null) {
								tabStates[tabId].remaining = remainingSec;
							}
						}

						browser.storage.local.set({ tabStates }).catch(() => {});
						browser.alarms.clear(alarmName);
						browser.action.setBadgeText({ text: "PAUSED", tabId });
						browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
						browser.tabs.sendMessage(tabId, { hideCountdown: true }).catch(() => {});
					})
					.catch(() => {});
			})
			.catch(() => {});
	}

	if (msg.action === "resume") {
		const tabId = msg.tabId;
		log("Resuming auto-refresh for tab:", tabId);

		const alarmName = getAlarmName(tabId);

		browser.storage.local
			.get(["tabStates", "defaultInterval"])
			.then((data) => {
				const tabState = data.tabStates?.[tabId];
				const interval = tabState?.interval ?? data.defaultInterval ?? 60;
				const remaining = tabState?.remaining ?? interval;

				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				if (tabStates[tabId]) {
					tabStates[tabId].paused = false;
					tabStates[tabId].remaining = null;
				}

				browser.storage.local.set({ tabStates }).catch(() => {});

				browser.action.setBadgeText({ text: "ON", tabId });
				browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
				browser.tabs
					.sendMessage(tabId, { showCountdown: remaining < 60 ? remaining : interval })
					.catch(() => {});

				browser.alarms.clear(alarmName).then(() => {
					if (remaining < 60) {
						browser.alarms.create(alarmName, {
							delayInMinutes: remaining / 60,
						});
					} else {
						browser.alarms.create(alarmName, {
							periodInMinutes: interval / 60,
						});
					}
				});
			})
			.catch(() => {});
	}
}

export function handleAlarm(alarm: browser.alarms.Alarm): void {
	if (alarm.name.startsWith("autoRefresh-")) {
		const tabId = Number(alarm.name.split("-")[1]);
		log("Alarm triggered for tab:", tabId);

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
				const baseInterval = tabState.interval ?? data.defaultInterval ?? 60;
				const currentCount = tabState.count ?? 0;

				browser.tabs
					.reload(tabId)
					.then(() => {
						const newCount = currentCount + 1;
						const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
						if (tabStates[tabId]) {
							tabStates[tabId].count = newCount;
						}
						browser.storage.local.set({ tabStates }).catch(() => {});
						log("Tab reloaded, count:", newCount);

						const alarmName = getAlarmName(tabId);
						const nextInterval = randomize ? jitteredInterval(baseInterval) : baseInterval;
						browser.tabs.sendMessage(tabId, { showCountdown: nextInterval }).catch(() => {});

						if (randomize) {
							browser.alarms.clear(alarmName).then(() => {
								browser.alarms.create(alarmName, {
									periodInMinutes: nextInterval / 60,
								});
							});
						}
					})
					.catch((err) => {
						warn("Tab reload failed, stopping:", err);
						browser.alarms.clear(getAlarmName(tabId));
						browser.storage.local
							.get("tabStates")
							.then((data) => {
								const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
								delete tabStates[tabId];
								const hasActive = Object.values(tabStates).some((s) => !s.paused);
								browser.storage.local
									.set({
										active: hasActive,
										tabStates,
									})
									.catch(() => {});
							})
							.catch(() => {});
						browser.action.setBadgeText({ text: "", tabId }).catch(() => {});
					});
			})
			.catch(() => {});
	}
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

// Clear any stale alarms on extension startup
browser.runtime.onStartup.addListener(handleStartup);

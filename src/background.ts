import type { Message } from "./types";
import { log, warn, error } from "./logger";
import {
	isActive,
	isPaused,
	toStorageState,
	fromStorage,
	isTabActive,
	isTabPaused,
	getDefaultInterval,
	getTabCount,
} from "./state";

export function isMessage(msg: unknown): msg is Message {
	return typeof msg === "object" && msg !== null && "action" in msg;
}

// Apply ±10% jitter to an interval
export function jitteredInterval(base: number): number {
	const jitter = base * 0.1;
	return Math.round(base + (Math.random() * 2 - 1) * jitter);
}

// Clear any stale alarms on extension startup
browser.runtime.onStartup.addListener(() => {
	log("Extension startup: clearing stale alarms and state");
	browser.alarms.clearAll();
	browser.storage.local.set({
		active: false,
		currentTabId: null,
	});
});

browser.runtime.onMessage.addListener((msg: unknown) => {
	if (!isMessage(msg)) return;

	if (msg.action === "start") {
		const { interval, tabId } = msg;

		// Clamp to 60s minimum — Firefox alarms require periodInMinutes >= 1
		const clampedInterval = Math.max(60, interval);

		log("Starting auto-refresh:", { interval: clampedInterval, tabId });

		browser.storage.local.get(["randomize", "tabStates", "defaultInterval"]).then((data) => {
			const randomize = typeof data.randomize === "boolean" ? data.randomize : false;
			const count = getTabCount(data, tabId);

			const status = fromStorage(data, tabId);
			status.state = "ACTIVE";
			status.tabId = tabId;
			status.interval = clampedInterval;
			status.count = count;
			status.randomize = randomize;

			const defaultInterval = getDefaultInterval(data);

			browser.storage.local.set(toStorageState(status, defaultInterval, data.tabStates));

			// Set badge on the specific tab
			browser.action.setBadgeText({ text: "ON", tabId });
			browser.action.setBadgeBackgroundColor({ color: "#16a34a" });

			// Notify content script to show countdown
			browser.tabs.sendMessage(tabId, { showCountdown: clampedInterval }).catch(() => {
				// Content script might not be ready, that's ok
			});

			browser.alarms.clear("autoRefresh").then(() => {
				const actualInterval = randomize
					? jitteredInterval(clampedInterval)
					: clampedInterval;
				browser.alarms.create("autoRefresh", {
					periodInMinutes: actualInterval / 60,
				});
			});
		});
	}

	if (msg.action === "stop") {
		log("Stopping auto-refresh");
		browser.storage.local.get(["currentTabId", "tabStates", "defaultInterval"]).then((data) => {
			const tabId = data.currentTabId;
			if (tabId !== null) {
				browser.action.setBadgeText({ text: "", tabId });
				// Notify content script to hide countdown
				browser.tabs.sendMessage(tabId, { hideCountdown: true }).catch(() => {});
			}
			browser.alarms.clear("autoRefresh");
			browser.storage.local.set({
				active: false,
				currentTabId: null,
				tabStates: data.tabStates || {},
			});
		});
	}

	if (msg.action === "pause") {
		log("Pausing auto-refresh");
		browser.storage.local.get(["currentTabId", "tabStates", "defaultInterval"]).then((data) => {
			const tabId = data.currentTabId;
			if (tabId !== null) {
				browser.alarms.get("autoRefresh").then((alarm) => {
					let remainingSec: number | null = null;
					if (alarm) {
						const remainingMs = alarm.scheduledTime - Date.now();
						remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
					}

					const tabStates: Record<number, any> = { ...(data.tabStates || {}) };
					if (tabStates[tabId]) {
						tabStates[tabId].paused = true;
						if (remainingSec !== null) {
							tabStates[tabId].remaining = remainingSec;
						}
					}

					browser.storage.local.set({ tabStates });

					browser.alarms.clear("autoRefresh");
					browser.action.setBadgeText({ text: "PAUSED", tabId });
					browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
					// Notify content script to hide countdown
					browser.tabs.sendMessage(tabId, { hideCountdown: true }).catch(() => {});
				});
			}
		});
	}

	if (msg.action === "resume") {
		log("Resuming auto-refresh");
		browser.storage.local.get(["currentTabId", "tabStates", "defaultInterval"]).then((data) => {
			const tabId = data.currentTabId;
			if (tabId === null) return;

			const tabState = data.tabStates?.[tabId];
			const interval = tabState?.interval ?? data.defaultInterval ?? 60;
			const remaining = tabState?.remaining ?? interval;

			const tabStates: Record<number, any> = { ...(data.tabStates || {}) };
			if (tabStates[tabId]) {
				tabStates[tabId].paused = false;
				tabStates[tabId].remaining = null;
			}

			browser.storage.local.set({ tabStates });

			// Set badge back to ON
			browser.action.setBadgeText({ text: "ON", tabId });
			browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
			// Notify content script to show countdown
			browser.tabs
				.sendMessage(tabId, { showCountdown: remaining < 60 ? remaining : interval })
				.catch(() => {});

			// Create alarm with remaining time if paused mid-interval
			browser.alarms.clear("autoRefresh").then(() => {
				if (remaining < 60) {
					browser.alarms.create("autoRefresh", {
						delayInMinutes: remaining / 60,
					});
				} else {
					browser.alarms.create("autoRefresh", {
						periodInMinutes: interval / 60,
					});
				}
			});
		});
	}
});

browser.alarms.onAlarm.addListener((alarm: browser.alarms.Alarm) => {
	if (alarm.name === "autoRefresh") {
		log("Alarm triggered");
		browser.storage.local
			.get(["currentTabId", "tabStates", "defaultInterval", "randomize"])
			.then((data) => {
				const tabId = data.currentTabId;
				if (tabId === null) {
					log("No currentTabId found, stopping");
					return;
				}

				const tabState = data.tabStates?.[tabId];
				const randomize =
					typeof data.randomize === "boolean" ? data.randomize : false;
				const baseInterval = tabState?.interval ?? data.defaultInterval ?? 60;
				const currentCount = tabState?.count ?? 0;

				browser.tabs
					.reload(tabId)
					.then(() => {
						// Only increment count after a successful reload
						const newCount = currentCount + 1;
						const tabStates: Record<number, any> = { ...(data.tabStates || {}) };
						if (tabStates[tabId]) {
							tabStates[tabId].count = newCount;
						}
						browser.storage.local.set({ tabStates });
						log("Tab reloaded, count:", newCount);

						// Notify content script of new countdown
						const nextInterval = randomize
							? jitteredInterval(baseInterval)
							: baseInterval;
						browser.tabs
							.sendMessage(tabId, { showCountdown: nextInterval })
							.catch(() => {});

						// Re-create alarm with jittered interval if randomize is on
						if (randomize) {
							browser.alarms.clear("autoRefresh").then(() => {
								browser.alarms.create("autoRefresh", {
									periodInMinutes: nextInterval / 60,
								});
							});
						}
					})
					.catch((err) => {
						warn("Tab reload failed, stopping:", err);
						// Tab was closed — stop everything
						browser.alarms.clear("autoRefresh");
						browser.storage.local.set({
							active: false,
							currentTabId: null,
						});
						// Clear badge
						browser.action.setBadgeText({ text: "", tabId }).catch(() => {});
					});
			});
	}
});

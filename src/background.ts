import type { Message, StorageState } from "./types";

function isMessage(msg: unknown): msg is Message {
	return typeof msg === "object" && msg !== null && "action" in msg;
}

// Clear any stale alarms on extension startup
	browser.runtime.onStartup.addListener(() => {
		browser.alarms.clearAll();
		browser.storage.local.set({
			active: false,
			tabId: null,
		});
	});

browser.runtime.onMessage.addListener((msg: unknown) => {
	if (!isMessage(msg)) return;

	if (msg.action === "start") {
		const { interval, tabId } = msg;

		// Clamp to 60s minimum — Firefox alarms require periodInMinutes >= 1
		const clampedInterval = Math.max(60, interval);

		browser.storage.local.set({
			interval: clampedInterval,
			active: true,
			tabId,
		});

		browser.alarms.clear("autoRefresh").then(() => {
			browser.alarms.create("autoRefresh", {
				periodInMinutes: clampedInterval / 60,
			});
		});
	}

	if (msg.action === "stop") {
		browser.alarms.clear("autoRefresh");
		browser.storage.local.set({
			active: false,
			tabId: null,
		});
	}
});

browser.alarms.onAlarm.addListener((alarm: browser.alarms.Alarm) => {
	if (alarm.name === "autoRefresh") {
		browser.storage.local.get(["tabId", "count"]).then((data) => {
			const tabId = typeof data.tabId === "number" ? data.tabId : null;
			if (tabId === null) return;

			browser.tabs
				.reload(tabId)
				.then(() => {
					// Only increment count after a successful reload
					const currentCount = typeof data.count === "number" ? data.count : 0;
					const newCount = currentCount + 1;
					browser.storage.local.set({ count: newCount });
				})
				.catch(() => {
					// Tab was closed — stop everything
					browser.alarms.clear("autoRefresh");
					browser.storage.local.set({ active: false, tabId: null });
				});
		});
	}
});

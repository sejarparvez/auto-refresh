import type { Message, StorageState } from "./types";

browser.runtime.onMessage.addListener((msg: Message) => {
	if (msg.action === "start") {
		const { interval, tabId } = msg;

		browser.storage.local.set({
			interval,
			active: true,
			tabId,
		} as StorageState);

		browser.alarms.clear("autoRefresh").then(() => {
			browser.alarms.create("autoRefresh", {
				periodInMinutes: interval / 60,
			});
		});
	}

	if (msg.action === "stop") {
		browser.alarms.clear("autoRefresh");
		browser.storage.local.set({
			active: false,
			tabId: null,
		} as Partial<StorageState>);
	}
});

browser.alarms.onAlarm.addListener((alarm: browser.alarms.Alarm) => {
	if (alarm.name === "autoRefresh") {
		browser.storage.local.get("tabId").then((data) => {
			const tabId = data.tabId as number | null;
			if (tabId !== null && tabId !== undefined) {
				browser.tabs.reload(tabId).catch(() => {
					// Tab was closed — stop the alarm
					browser.alarms.clear("autoRefresh");
					browser.storage.local.set({ active: false, tabId: null });
				});
			}
		});
	}
});

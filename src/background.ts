import type { Message, StorageState } from "./types";

function isMessage(msg: unknown): msg is Message {
	return typeof msg === "object" && msg !== null && "action" in msg;
}

// Clear any stale alarms on extension startup
browser.runtime.onStartup.addListener(() => {
	browser.alarms.clearAll();
	browser.storage.local.set({
		active: false,
		paused: false,
		tabId: null,
	});
});

browser.runtime.onMessage.addListener((msg: unknown) => {
	if (!isMessage(msg)) return;

		if (msg.action === "start") {
		const { interval, tabId } = msg;

		// Clamp to 60s minimum — Firefox alarms require periodInMinutes >= 1
		const clampedInterval = Math.max(60, interval);

		browser.storage.local.get("randomize").then((data) => {
			const randomize = typeof data.randomize === "boolean" ? data.randomize : false;

			browser.storage.local.set({
				interval: clampedInterval,
				active: true,
				paused: false,
				tabId,
				remaining: null,
			});

			// Set badge on the specific tab
			browser.action.setBadgeText({ text: "ON", tabId });
			browser.action.setBadgeBackgroundColor({ color: "#16a34a" });

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
		browser.storage.local.get("tabId").then((data) => {
			const tabId = typeof data.tabId === "number" ? data.tabId : null;
			if (tabId !== null) {
				browser.action.setBadgeText({ text: "", tabId });
			}
		});
		browser.alarms.clear("autoRefresh");
		browser.storage.local.set({
			active: false,
			paused: false,
			tabId: null,
			remaining: null,
		});
	}

	if (msg.action === "pause") {
		browser.alarms.get("autoRefresh").then((alarm) => {
			if (alarm) {
				const remainingMs = alarm.scheduledTime - Date.now();
				const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
				browser.storage.local.set({ paused: true, remaining: remainingSec });
			} else {
				browser.storage.local.set({ paused: true });
			}
			browser.alarms.clear("autoRefresh");
			browser.storage.local.get("tabId").then((data) => {
				const tabId = typeof data.tabId === "number" ? data.tabId : null;
				if (tabId !== null) {
					browser.action.setBadgeText({ text: "PAUSED", tabId });
					browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
				}
			});
		});
	}

	if (msg.action === "resume") {
		browser.storage.local.get(["interval", "remaining"]).then((data) => {
			const interval = typeof data.interval === "number" ? data.interval : 60;
			const remaining = typeof data.remaining === "number" ? data.remaining : interval;

			browser.storage.local.set({ paused: false, remaining: null });

			// Set badge back to ON
			browser.storage.local.get("tabId").then((d) => {
				const tabId = typeof d.tabId === "number" ? d.tabId : null;
				if (tabId !== null) {
					browser.action.setBadgeText({ text: "ON", tabId });
					browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
				}
			});

			// Create alarm with remaining time if paused mid-interval
			browser.alarms.clear("autoRefresh").then(() => {
				if (remaining < 60) {
					// Use delayInMinutes for sub-minute remaining time
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

// Apply ±10% jitter to an interval
function jitteredInterval(base: number): number {
	const jitter = base * 0.1;
	return Math.round(base + (Math.random() * 2 - 1) * jitter);
}

browser.alarms.onAlarm.addListener((alarm: browser.alarms.Alarm) => {
	if (alarm.name === "autoRefresh") {
		browser.storage.local.get(["tabId", "count", "interval", "randomize"]).then((data) => {
			const tabId = typeof data.tabId === "number" ? data.tabId : null;
			if (tabId === null) return;

			const randomize = typeof data.randomize === "boolean" ? data.randomize : false;
			const baseInterval = typeof data.interval === "number" ? data.interval : 60;

			browser.tabs
				.reload(tabId)
				.then(() => {
					// Only increment count after a successful reload
					const currentCount = typeof data.count === "number" ? data.count : 0;
					const newCount = currentCount + 1;
					browser.storage.local.set({ count: newCount });

					// Re-create alarm with jittered interval if randomize is on
					if (randomize) {
						const nextInterval = jitteredInterval(baseInterval);
						browser.alarms.clear("autoRefresh").then(() => {
							browser.alarms.create("autoRefresh", {
								periodInMinutes: nextInterval / 60,
							});
						});
					}
				})
				.catch(() => {
					// Tab was closed — stop everything
					browser.alarms.clear("autoRefresh");
					browser.storage.local.set({ active: false, paused: false, tabId: null, remaining: null });
					// Clear badge
					browser.storage.local.get("tabId").then((d) => {
						const tid = typeof d.tabId === "number" ? d.tabId : null;
						if (tid !== null) {
							browser.action.setBadgeText({ text: "", tabId: tid });
						}
					});
				});
		});
	}
});

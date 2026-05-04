import type { Message, StorageState } from "./types";

const toggleWrap = document.getElementById("toggleWrap")!;
const toggleTrack = document.getElementById("toggleTrack")!;
const spinIcon = document.getElementById("spinIcon")!;
const hSub = document.getElementById("hSub")!;
const ringNum = document.getElementById("ringNum")!;
const progressArc = document.getElementById("progressArc")!;
const statInterval = document.getElementById("statInterval")!;
const statCount = document.getElementById("statCount")!;
const sVal = document.getElementById("sVal") as HTMLInputElement;
const tabName = document.getElementById("tabName")!;
const tabBadge = document.getElementById("tabBadge")!;
const refreshNow = document.getElementById("refreshNow") as HTMLButtonElement;

const CIRC = 251.2;
const MIN_INTERVAL = 60; // Firefox alarm minimum is 1 minute

let active = false;
let interval = MIN_INTERVAL;
let remaining = MIN_INTERVAL;
let count = 0;
let currentTabId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

// Helper to avoid repeating slice(0, 30) everywhere
function truncateTitle(title: string, maxLength = 30): string {
	return title.slice(0, maxLength);
}

function formatInterval(secs: number): string {
	return secs >= 60 ? secs / 60 + "m" : secs + "s";
}

function setRing(rem: number, total: number) {
	const pct = total > 0 ? rem / total : 0;
	progressArc.setAttribute("stroke-dashoffset", (CIRC * (1 - pct)).toFixed(1));
	ringNum.textContent = active ? rem + "s" : "—";
}

function syncPresets() {
	document.querySelectorAll<HTMLButtonElement>(".p-btn").forEach((b) => {
		b.classList.toggle("active", parseInt(b.dataset.v!) === interval);
	});
	statInterval.textContent = formatInterval(interval);
}

// Sync the popup countdown with the actual alarm's scheduled time
function syncTimerWithAlarm() {
	browser.alarms.get("autoRefresh").then((alarm) => {
		if (alarm) {
			const remainingMs = alarm.scheduledTime - Date.now();
			remaining = Math.max(1, Math.ceil(remainingMs / 1000));
		} else {
			remaining = interval;
		}
		setRing(remaining, interval);
	});
}

function startTimer() {
	if (timer) clearInterval(timer);

	// Sync with real alarm time instead of resetting to full interval
	syncTimerWithAlarm();

	timer = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			// Background handles the actual reload + count increment;
			// we just reset the visual countdown here.
			// Pull the latest count from storage to stay in sync.
			browser.storage.local.get("count").then((data) => {
				count = typeof data.count === "number" ? data.count : count;
				statCount.textContent = String(count);
			});
			remaining = interval;
		}
		setRing(remaining, interval);
	}, 1000);
}

function stopTimer() {
	if (timer) clearInterval(timer);
	timer = null;
	progressArc.setAttribute("stroke-dashoffset", String(CIRC));
	ringNum.textContent = "—";
}

function updateBadge(tabId: number | null = currentTabId) {
	if (active && tabId !== null) {
		browser.action.setBadgeText({ text: "ON", tabId });
		browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
	} else if (tabId !== null) {
		browser.action.setBadgeText({ text: "", tabId });
	}
}

function setActive(on: boolean, tabId: number | null = currentTabId) {
	active = on;
	toggleTrack.classList.toggle("on", on);
	spinIcon.classList.toggle("spinning", on);
	hSub.textContent = on ? "every " + formatInterval(interval) : "inactive";
	tabBadge.textContent = on ? "on · " + formatInterval(interval) : "off";
	tabBadge.className = "tab-badge " + (on ? "on" : "off");
	refreshNow.disabled = !on;
	updateBadge(tabId);
	if (on) startTimer();
	else stopTimer();
}

function applyInterval(val: number) {
	interval = Math.max(MIN_INTERVAL, val);
	sVal.value = String(interval);
	syncPresets();
	if (active && currentTabId !== null) {
		browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId: currentTabId,
		});
		browser.storage.local.set({ interval });
		startTimer();
	}
}

toggleWrap.addEventListener("click", () => {
	const next = !active;

		if (next) {
			browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
				const tabId = tabs[0]?.id;
				if (tabId === undefined) return;

				currentTabId = tabId;

				if (tabs[0]?.title) {
					tabName.textContent = truncateTitle(tabs[0].title);
				}

				setActive(true);
				browser.runtime.sendMessage({
					action: "start",
					interval,
					tabId,
				});
				browser.storage.local.set({
					active: true,
					interval,
					tabId,
				});
			});
	} else {
		const oldTabId = currentTabId;
		currentTabId = null;
		setActive(false, oldTabId);
		browser.runtime.sendMessage({ action: "stop" });
		browser.storage.local.set({
			active: false,
			tabId: null,
		});
	}
});

document
	.getElementById("sInc")!
	.addEventListener("click", () => applyInterval(interval + 1));
document
	.getElementById("sDec")!
	.addEventListener("click", () => applyInterval(interval - 1));

sVal.addEventListener("input", () => {
	const v = parseInt(sVal.value);
	if (isNaN(v) || v < 1) return;
	applyInterval(v);
});

document.querySelectorAll<HTMLButtonElement>(".p-btn").forEach((b) => {
	b.addEventListener("click", () => applyInterval(parseInt(b.dataset.v!)));
});

refreshNow.addEventListener("click", () => {
	if (currentTabId !== null) {
		browser.tabs.reload(currentTabId).then(() => {
			// Increment count immediately on manual refresh
			browser.storage.local.get("count").then((data) => {
				const newCount = (typeof data.count === "number" ? data.count : 0) + 1;
				browser.storage.local.set({ count: newCount });
				count = newCount;
				statCount.textContent = String(count);
			});
			// Reset the visual countdown
			remaining = interval;
			setRing(remaining, interval);
		});
	}
});

// Initial tab title
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
	if (tabs[0]?.title) tabName.textContent = truncateTitle(tabs[0].title);
});

// Restore state from storage on popup open
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
	const currentTab = tabs[0];
	if (!currentTab?.id) return;
	const currentTabIdNum: number = currentTab.id;

	if (currentTab.title) tabName.textContent = truncateTitle(currentTab.title);

	browser.storage.local
		.get(["interval", "active", "count", "tabId"])
		.then((data: Partial<StorageState>) => {
			if (data.interval) {
				interval = data.interval;
				sVal.value = String(interval);
			}
			if (data.count) {
				count = data.count;
				statCount.textContent = String(count);
			}

			syncPresets();

			// Check if auto-refresh is active for THIS specific tab
			const isThisTabActive = data.active && data.tabId === currentTabIdNum;

			if (isThisTabActive) {
				currentTabId = currentTabIdNum;
				setActive(true, currentTabIdNum);
			} else {
				// Not active for this tab - show inactive state
				active = false;
				currentTabId = null;
				toggleTrack.classList.remove("on");
				spinIcon.classList.remove("spinning");
				hSub.textContent = "inactive";
				tabBadge.textContent = "off";
				tabBadge.className = "tab-badge off";
				refreshNow.disabled = true;
				stopTimer();
				// Don't touch badge - it's managed by background script
			}
		});
});

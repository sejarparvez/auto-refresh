import type { Message, StorageState, TabState } from "./types";

const toggleWrap = document.getElementById("toggleWrap")!;
const toggleTrack = document.getElementById("toggleTrack")!;
const spinIcon = document.getElementById("spinIcon")!;
const hSub = document.getElementById("hSub")!;
const ringNum = document.getElementById("ringNum")!;
const progressArc = document.getElementById("progressArc")!;
const statInterval = document.getElementById("statInterval")!;
const statCount = document.getElementById("statCount")!;
const tabName = document.getElementById("tabName")!;
const tabBadge = document.getElementById("tabBadge")!;
const actionBtn = document.getElementById("actionBtn") as HTMLButtonElement;
const randomizeToggle = document.getElementById(
	"randomizeToggle",
) as HTMLInputElement;

let paused = false;

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
	progressArc.setAttribute(
		"stroke-dashoffset",
		(CIRC * (1 - pct)).toFixed(1),
	);
	ringNum.textContent = active ? rem + "s" : "—";
}

function syncPresets() {
	document
		.querySelectorAll<HTMLButtonElement>(".p-btn")
		.forEach((b) => {
			b.classList.toggle(
				"active",
				parseInt(b.dataset.v!) === interval,
			);
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
			browser.storage.local
				.get(["tabStates", "currentTabId"])
				.then((data) => {
					if (currentTabId !== null && data.tabStates?.[currentTabId]) {
						count = data.tabStates[currentTabId].count ?? count;
					}
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
	if (active && !paused && tabId !== null) {
		browser.action.setBadgeText({ text: "ON", tabId });
		browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
	} else if (active && paused && tabId !== null) {
		browser.action.setBadgeText({ text: "PAUSED", tabId });
		browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
	} else if (tabId !== null) {
		browser.action.setBadgeText({ text: "", tabId });
	}
}

function updateActionButton() {
	if (!active) {
		actionBtn.textContent = "Start";
		actionBtn.className = "action-btn primary";
		actionBtn.style.display = "block";
	} else if (paused) {
		actionBtn.textContent = "Resume";
		actionBtn.className = "action-btn secondary";
		actionBtn.style.display = "block";
	} else {
		actionBtn.textContent = "Pause";
		actionBtn.className = "action-btn primary";
		actionBtn.style.display = "block";
	}
}

function setActive(on: boolean, tabId: number | null = currentTabId) {
	active = on;
	paused = false;
	toggleTrack.classList.toggle("on", on);
	spinIcon.classList.toggle("spinning", on);
	hSub.textContent = on
		? "every " + formatInterval(interval)
		: "inactive";
	tabBadge.textContent = on
		? "on · " + formatInterval(interval)
		: "off";
	tabBadge.className = "tab-badge " + (on ? "on" : "off");
	updateActionButton();
	updateBadge(tabId);
	if (on) startTimer();
	else stopTimer();
}

function applyInterval(val: number) {
	interval = Math.max(MIN_INTERVAL, val);
	syncPresets();
	if (active && currentTabId !== null) {
		browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId: currentTabId,
		});
		browser.storage.local.set({
			tabStates: {
				[currentTabId]: { interval, count, paused: false, remaining: null, randomize: randomizeToggle.checked },
			},
		});
		startTimer();
	}
}

randomizeToggle.addEventListener("change", () => {
	const randomize = randomizeToggle.checked;
	browser.storage.local.set({ randomize });
	if (active && currentTabId !== null) {
		// Restart with new randomize setting
		browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId: currentTabId,
		});
	}
});

toggleWrap.addEventListener("click", () => {
	const next = !active;

	if (next) {
		browser.tabs
			.query({ active: true, currentWindow: true })
			.then((tabs) => {
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
					currentTabId,
					tabStates: {},
				});
			});
	} else {
		const oldTabId = currentTabId;
		currentTabId = null;
		setActive(false, oldTabId);
		browser.runtime.sendMessage({ action: "stop" });
		browser.storage.local.set({
			active: false,
			currentTabId: null,
		});
	}
});

document
	.querySelectorAll<HTMLButtonElement>(".p-btn")
	.forEach((b) => {
		b.addEventListener("click", () =>
			applyInterval(parseInt(b.dataset.v!)),
		);
	});

actionBtn.addEventListener("click", () => {
	if (!active) {
		// Start
		toggleWrap.click();
	} else if (paused) {
		// Resume
		paused = false;
		browser.runtime.sendMessage({ action: "resume" });
		startTimer();
		updateBadge();
		updateActionButton();
	} else {
		// Pause
		paused = true;
		browser.runtime.sendMessage({ action: "pause" });
		stopTimer();
		updateBadge();
		updateActionButton();
	}
});

// Keyboard shortcut handler
browser.commands?.onCommand.addListener((command) => {
	if (command === "toggle-refresh") {
		// Simulate toggle click
		toggleWrap.click();
	}
});

// Restore state from storage on popup open
browser.tabs
	.query({ active: true, currentWindow: true })
	.then((tabs) => {
		const currentTab = tabs[0];
		if (!currentTab?.id) return;
		const currentTabIdNum: number = currentTab.id;

		if (currentTab.title)
			tabName.textContent = truncateTitle(currentTab.title);

		browser.storage.local
			.get([
				"defaultInterval",
				"active",
				"currentTabId",
				"tabStates",
				"randomize",
			])
			.then(
				(
					data: Partial<StorageState> & {
						defaultInterval?: number;
						currentTabId?: number;
						tabStates?: Record<number, TabState>;
					},
				) => {
					// Get default interval or use stored one
					if (data.defaultInterval) {
						interval = data.defaultInterval;
					}

					// Get per-tab interval if it exists
					if (
						data.tabStates?.[currentTabIdNum]?.interval
					) {
						interval =
							data.tabStates[currentTabIdNum].interval;
					}

					// Get count from per-tab state
					if (data.tabStates?.[currentTabIdNum]?.count) {
						count = data.tabStates[currentTabIdNum].count;
						statCount.textContent = String(count);
					}

					if (typeof data.randomize === "boolean") {
						randomizeToggle.checked = data.randomize;
					}

					syncPresets();

					// Check if auto-refresh is active for THIS specific tab
					const isThisTabActive =
						data.active &&
						data.currentTabId === currentTabIdNum;

					if (isThisTabActive) {
						currentTabId = currentTabIdNum;
						paused =
							data.tabStates?.[currentTabIdNum]
								?.paused || false;
						setActive(true, currentTabIdNum);
						if (paused) {
							spinIcon.classList.remove("spinning");
							hSub.textContent = "paused";
							tabBadge.textContent = "paused";
							updateActionButton();
						}
					} else {
						// Not active for this tab - show inactive state
						active = false;
						currentTabId = null;
						paused = false;
						toggleTrack.classList.remove("on");
						spinIcon.classList.remove("spinning");
						hSub.textContent = "inactive";
						tabBadge.textContent = "off";
						tabBadge.className = "tab-badge off";
						updateActionButton();
						stopTimer();
						// Don't touch badge - it's managed by background script
					}
				},
			);
	});

import type { Message, StorageState, TabState } from "./types";

const toggleWrap = document.getElementById("toggleWrap") as HTMLDivElement;
const toggleTrack = document.getElementById("toggleTrack") as HTMLDivElement;
const spinIcon = document.getElementById("spinIcon") as HTMLDivElement;
const hSub = document.getElementById("hSub") as HTMLSpanElement;
const ringNum = document.getElementById("ringNum") as HTMLSpanElement;
const progressArc = document.getElementById("progressArc") as unknown as SVGCircleElement;
const statInterval = document.getElementById("statInterval") as HTMLSpanElement;
const statCount = document.getElementById("statCount") as HTMLSpanElement;
const tabName = document.getElementById("tabName") as HTMLSpanElement;
const tabBadge = document.getElementById("tabBadge") as HTMLSpanElement;
const actionBtn = document.getElementById("actionBtn") as HTMLButtonElement;
const randomizeToggle = document.getElementById("randomizeToggle") as HTMLInputElement;
const customInterval = document.getElementById("customInterval") as HTMLInputElement;
const stepDown = document.getElementById("stepDown") as HTMLButtonElement;
const stepUp = document.getElementById("stepUp") as HTMLButtonElement;

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
export function truncateTitle(title: string, maxLength = 30): string {
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength)}...`;
}

export function formatInterval(secs: number): string {
	return secs >= 60 ? `${secs / 60}m` : `${secs}s`;
}

export function setRing(rem: number, total: number) {
	const pct = total > 0 ? rem / total : 0;
	progressArc.setAttribute("stroke-dashoffset", (CIRC * (1 - pct)).toFixed(1));
	ringNum.textContent = active ? `${rem}s` : "—";
}

function syncPresets() {
	const buttons = document.querySelectorAll<HTMLButtonElement>(".p-btn");
	for (const b of buttons) {
		b.classList.toggle("active", Number.parseInt(b.dataset.v ?? "0") === interval);
	}
	customInterval.value = String(interval);
	statInterval.textContent = formatInterval(interval);
}

function syncTimerWithAlarm() {
	if (currentTabId === null) return;
	browser.alarms.get(`autoRefresh-${currentTabId}`).then((alarm) => {
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
			const tabId = currentTabId;
			browser.storage.local
				.get(["tabStates", "currentTabId"])
				.then((data) => {
					if (tabId !== null && data.tabStates?.[tabId]) {
						count = data.tabStates[tabId].count ?? count;
					}
					statCount.textContent = String(count);
				})
				.catch(() => {});
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
	hSub.textContent = on ? `every ${formatInterval(interval)}` : "inactive";
	tabBadge.textContent = on ? `on · ${formatInterval(interval)}` : "off";
	tabBadge.className = `tab-badge ${on ? "on" : "off"}`;
	updateActionButton();
	updateBadge(tabId);
	if (on) startTimer();
	else stopTimer();
}

function applyInterval(val: number) {
	interval = Math.max(MIN_INTERVAL, val);
	syncPresets();
	const tabId = currentTabId;
	if (active && tabId !== null) {
		browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId,
		});
		browser.storage.local
			.get("tabStates")
			.then((data) => {
				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				tabStates[tabId] = {
					interval,
					count,
					paused: false,
					remaining: null,
					randomize: randomizeToggle.checked,
				};
				browser.storage.local.set({ tabStates }).catch(() => {});
			})
			.catch(() => {});
		startTimer();
	}
}

randomizeToggle.addEventListener("change", () => {
	const randomize = randomizeToggle.checked;
	browser.storage.local.set({ randomize }).catch(() => {});
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
			browser.storage.local
				.get("tabStates")
				.then((data) => {
					const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
					if (!tabStates[tabId]) {
						tabStates[tabId] = {
							interval,
							count: 0,
							paused: false,
							remaining: null,
							randomize: randomizeToggle.checked,
						};
					}
					browser.storage.local
						.set({
							active: true,
							currentTabId: tabId,
							tabStates,
						})
						.catch(() => {});
				})
				.catch(() => {});
		});
	} else {
		const oldTabId = currentTabId;
		currentTabId = null;
		setActive(false, oldTabId);
		if (oldTabId !== null) {
			browser.runtime.sendMessage({ action: "stop", tabId: oldTabId });
			const removedTabId = oldTabId;
			browser.storage.local
				.get("tabStates")
				.then((data) => {
					const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
					delete tabStates[removedTabId];
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
	}
});

const presetButtons = document.querySelectorAll<HTMLButtonElement>(".p-btn");
for (const b of presetButtons) {
	b.addEventListener("click", () => applyInterval(Number.parseInt(b.dataset.v ?? "0")));
}

customInterval.addEventListener("change", () => {
	const val = Number.parseInt(customInterval.value);
	if (!Number.isNaN(val) && val >= MIN_INTERVAL) {
		applyInterval(val);
	}
});

customInterval.addEventListener("focus", () => customInterval.select());

stepDown.addEventListener("click", () => {
	const val = Number.parseInt(customInterval.value) || MIN_INTERVAL;
	const next = Math.max(MIN_INTERVAL, val - 30);
	customInterval.value = String(next);
	applyInterval(next);
});

stepUp.addEventListener("click", () => {
	const val = Number.parseInt(customInterval.value) || MIN_INTERVAL;
	const next = val + 30;
	customInterval.value = String(next);
	applyInterval(next);
});

actionBtn.addEventListener("click", () => {
	if (!active) {
		toggleWrap.click();
	} else if (paused) {
		paused = false;
		if (currentTabId !== null) {
			browser.runtime.sendMessage({ action: "resume", tabId: currentTabId });
		}
		startTimer();
		updateBadge();
		updateActionButton();
	} else {
		paused = true;
		if (currentTabId !== null) {
			browser.runtime.sendMessage({ action: "pause", tabId: currentTabId });
		}
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
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
	const currentTab = tabs[0];
	if (!currentTab?.id) return;
	const currentTabIdNum: number = currentTab.id;

	if (currentTab.title) tabName.textContent = truncateTitle(currentTab.title);

	browser.storage.local
		.get(["defaultInterval", "active", "currentTabId", "tabStates", "randomize"])
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
				if (data.tabStates?.[currentTabIdNum]?.interval) {
					interval = data.tabStates[currentTabIdNum].interval;
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
				const isThisTabActive = data.active && data.currentTabId === currentTabIdNum;

				if (isThisTabActive) {
					currentTabId = currentTabIdNum;
					paused = data.tabStates?.[currentTabIdNum]?.paused || false;
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

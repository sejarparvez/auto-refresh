import type { StorageState, TabState } from "./types";

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

const CIRC = 251.2;
const MIN_INTERVAL = 60;

let active = false;
let interval = MIN_INTERVAL; // base interval chosen by user
let remaining = MIN_INTERVAL; // seconds left in current cycle
let totalInterval = MIN_INTERVAL; // actual cycle length (may be jittered)
let count = 0;
let currentTabId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function truncateTitle(title: string, maxLength = 30): string {
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength)}...`;
}

export function formatInterval(secs: number): string {
	if (secs >= 3600) return `${Math.round(secs / 3600)}h`;
	if (secs >= 60) return `${Math.round(secs / 60)}m`;
	return `${secs}s`;
}

function setRing(rem: number, total: number) {
	const pct = total > 0 ? Math.min(1, rem / total) : 0;
	progressArc.setAttribute("stroke-dashoffset", (CIRC * (1 - pct)).toFixed(1));
	ringNum.textContent = active ? `${rem}s` : "—";
}

function syncPresets() {
	for (const b of document.querySelectorAll<HTMLButtonElement>(".p-btn")) {
		b.classList.toggle("active", Number.parseInt(b.dataset.v ?? "0") === interval);
	}
	customInterval.value = String(interval);
	statInterval.textContent = formatInterval(interval);
}

// ─── Timer ────────────────────────────────────────────────────────────────────
//
// Design: the setInterval ticks once per second and just decrements remaining.
// When it reaches 0 we STOP the interval immediately (no more ticks), then do
// a one-shot async reset. Once we have the new remaining/totalInterval from the
// alarm we start a fresh interval. This prevents multiple concurrent alarm
// queries and the "stuck at 1s" symptom they cause.

function stopTimer() {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	progressArc.setAttribute("stroke-dashoffset", String(CIRC));
	ringNum.textContent = "—";
}

// Called once the alarm has fired and we know the next cycle's values.
// Sets remaining + totalInterval then starts a fresh countdown.
function resetAndStartTimer(newRemaining: number, newTotal: number) {
	remaining = newRemaining;
	totalInterval = newTotal;
	startTimer();
}

function startTimer() {
	// Always clear any existing timer first
	if (timer) clearInterval(timer);

	// Render immediately so the ring is correct before the first tick
	setRing(remaining, totalInterval);

	timer = setInterval(() => {
		remaining -= 1;

		if (remaining > 0) {
			setRing(remaining, totalInterval);
			return;
		}

		// remaining has hit 0 — stop ticking RIGHT NOW so this branch
		// only runs once and no further ticks pile up while we await the alarm.
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		clearInterval(timer!);
		timer = null;
		setRing(0, totalInterval);

		if (currentTabId === null) return;

		// Poll until the alarm reappears with its new scheduledTime.
		// The background reloads the tab then recreates the alarm, so there
		// is a small window where get() returns undefined. We retry up to
		// ~3 seconds before giving up and using totalInterval as a fallback.
		let attempts = 0;
		const MAX_ATTEMPTS = 6;
		const RETRY_MS = 500;

		function tryGetAlarm() {
			const tabId = currentTabId;
			if (tabId === null) return; // stopped while waiting

			browser.alarms
				.get(`autoRefresh-${tabId}`)
				.then((alarm) => {
					if (alarm) {
						const ms = alarm.scheduledTime - Date.now();
						const newRemaining = Math.max(1, Math.ceil(ms / 1000));
						// periodInMinutes is only set for fixed (non-randomized) alarms.
						// Randomized alarms are one-shot (delayInMinutes), so we read
						// the updated actualInterval from storage instead.
						const newTotal = alarm.periodInMinutes
							? Math.round(alarm.periodInMinutes * 60)
							: newRemaining; // newRemaining already reflects the jittered delay

						// Refresh count display while we're here
						browser.storage.local
							.get("tabStates")
							.then((data) => {
								if (currentTabId !== null && data.tabStates?.[currentTabId]) {
									count = data.tabStates[currentTabId].count ?? count;
									statCount.textContent = String(count);
									// Update header to show the current cycle's actual interval
									const actual = data.tabStates[currentTabId].actualInterval;
									if (actual) {
										hSub.textContent = `every ${formatInterval(actual)}`;
										tabBadge.textContent = `on · ${formatInterval(actual)}`;
									}
								}
							})
							.catch(() => {});

						resetAndStartTimer(newRemaining, newTotal);
					} else {
						attempts += 1;
						if (attempts < MAX_ATTEMPTS) {
							setTimeout(tryGetAlarm, RETRY_MS);
						} else {
							// Alarm never came back — fall back to full interval
							resetAndStartTimer(totalInterval, totalInterval);
						}
					}
				})
				.catch(() => {
					attempts += 1;
					if (attempts < MAX_ATTEMPTS) {
						setTimeout(tryGetAlarm, RETRY_MS);
					} else {
						resetAndStartTimer(totalInterval, totalInterval);
					}
				});
		}

		// Give the background a brief head-start before the first query
		// (it needs to reload the tab and recreate the alarm)
		setTimeout(tryGetAlarm, 300);
	}, 1000);
}

// ─── UI state ─────────────────────────────────────────────────────────────────

function updateActionButton() {
	actionBtn.textContent = active ? "Stop" : "Start";
	actionBtn.className = active ? "action-btn secondary" : "action-btn primary";
}

function setActiveUI(on: boolean, actualSecs?: number) {
	active = on;
	toggleTrack.classList.toggle("on", on);
	spinIcon.classList.toggle("spinning", on);
	const displayInterval = actualSecs ?? interval;
	hSub.textContent = on ? `every ${formatInterval(displayInterval)}` : "inactive";
	tabBadge.textContent = on ? `on · ${formatInterval(displayInterval)}` : "off";
	tabBadge.className = `tab-badge ${on ? "on" : "off"}`;
	updateActionButton();
	if (!on) stopTimer();
}

// ─── Start / Stop ─────────────────────────────────────────────────────────────

async function startRefresh(tabId: number, tabTitle?: string) {
	currentTabId = tabId;
	if (tabTitle) tabName.textContent = truncateTitle(tabTitle);

	setActiveUI(true);

	// Wait for background to return the actual (possibly jittered) interval
	// before we touch remaining/totalInterval or call startTimer.
	let actualInterval = interval;
	try {
		const response = (await browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId,
			randomize: randomizeToggle.checked,
		})) as { actualInterval: number } | undefined;

		if (response?.actualInterval) actualInterval = response.actualInterval;
	} catch {
		/* background cold-start — fall back to base interval */
	}

	totalInterval = actualInterval;
	remaining = actualInterval;
	// Update the header to show the actual (possibly jittered) interval
	hSub.textContent = `every ${formatInterval(actualInterval)}`;
	tabBadge.textContent = `on · ${formatInterval(actualInterval)}`;
	startTimer(); // called exactly once, after values are final

	// Persist correct actualInterval to storage
	try {
		const data = await browser.storage.local.get("tabStates");
		const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
		tabStates[tabId] = {
			interval,
			count,
			paused: false,
			remaining: null,
			randomize: randomizeToggle.checked,
			actualInterval: totalInterval,
		};
		await browser.storage.local.set({ active: true, currentTabId: tabId, tabStates });
	} catch {
		/* non-fatal */
	}
}

function stopRefresh() {
	const oldTabId = currentTabId;
	currentTabId = null;
	active = false;
	setActiveUI(false);

	if (oldTabId !== null) {
		browser.action.setBadgeText({ text: "", tabId: oldTabId }).catch(() => {});
		browser.runtime.sendMessage({ action: "stop", tabId: oldTabId }).catch(() => {});
		browser.storage.local
			.get("tabStates")
			.then((data) => {
				const tabStates: Record<number, TabState> = { ...(data.tabStates || {}) };
				delete tabStates[oldTabId];
				browser.storage.local.set({ active: false, currentTabId: null, tabStates }).catch(() => {});
			})
			.catch(() => {});
	}
}

// ─── Event listeners ──────────────────────────────────────────────────────────

async function handleToggle() {
	if (!active) {
		const tabs = await browser.tabs.query({ active: true, currentWindow: true });
		const tab = tabs[0];
		if (tab?.id !== undefined) await startRefresh(tab.id, tab.title);
	} else {
		stopRefresh();
	}
}

toggleWrap.addEventListener("click", handleToggle);
actionBtn.addEventListener("click", handleToggle);

async function applyInterval(val: number) {
	interval = Math.max(MIN_INTERVAL, val);
	syncPresets();

	if (active && currentTabId !== null) {
		let actualInterval = interval;
		try {
			const response = (await browser.runtime.sendMessage({
				action: "start",
				interval,
				tabId: currentTabId,
				randomize: randomizeToggle.checked,
			})) as { actualInterval: number } | undefined;
			if (response?.actualInterval) actualInterval = response.actualInterval;
		} catch {
			/* ignore */
		}

		totalInterval = actualInterval;
		remaining = actualInterval;
		startTimer();
	}
}

for (const b of document.querySelectorAll<HTMLButtonElement>(".p-btn")) {
	b.addEventListener("click", () => applyInterval(Number.parseInt(b.dataset.v ?? "0")));
}

customInterval.addEventListener("change", () => {
	const val = Number.parseInt(customInterval.value);
	if (!Number.isNaN(val) && val >= MIN_INTERVAL) applyInterval(val);
});

customInterval.addEventListener("focus", () => customInterval.select());

stepDown.addEventListener("click", () => {
	const val = Number.parseInt(customInterval.value) || MIN_INTERVAL;
	applyInterval(Math.max(MIN_INTERVAL, val - 30));
});

stepUp.addEventListener("click", () => {
	const val = Number.parseInt(customInterval.value) || MIN_INTERVAL;
	applyInterval(val + 30);
});

randomizeToggle.addEventListener("change", async () => {
	const randomize = randomizeToggle.checked;
	browser.storage.local.set({ randomize }).catch(() => {});

	if (active && currentTabId !== null) {
		let actualInterval = interval;
		try {
			const response = (await browser.runtime.sendMessage({
				action: "start",
				interval,
				tabId: currentTabId,
				randomize,
			})) as { actualInterval: number } | undefined;
			if (response?.actualInterval) actualInterval = response.actualInterval;
		} catch {
			/* ignore */
		}

		totalInterval = actualInterval;
		remaining = actualInterval;
		startTimer();
	}
});

browser.commands?.onCommand.addListener((command) => {
	if (command === "toggle-refresh") handleToggle();
});

// ─── Restore state on popup open ──────────────────────────────────────────────

(async () => {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const currentTab = tabs[0];
	if (!currentTab?.id) return;
	const tabId: number = currentTab.id;

	if (currentTab.title) tabName.textContent = truncateTitle(currentTab.title);

	type StorageData = Partial<StorageState> & {
		defaultInterval?: number;
		currentTabId?: number;
		tabStates?: Record<number, TabState>;
	};

	const data = (await browser.storage.local.get([
		"defaultInterval",
		"active",
		"currentTabId",
		"tabStates",
		"randomize",
	])) as StorageData;

	if (data.defaultInterval) interval = data.defaultInterval;
	if (data.tabStates?.[tabId]?.interval) interval = data.tabStates[tabId].interval;

	totalInterval = data.tabStates?.[tabId]?.actualInterval ?? interval;

	count = data.tabStates?.[tabId]?.count ?? 0;
	statCount.textContent = String(count);

	if (typeof data.randomize === "boolean") randomizeToggle.checked = data.tabStates?.[tabId]?.randomize ?? data.randomize;

	syncPresets();

	const isThisTabActive = data.active === true && data.currentTabId === tabId;

	if (isThisTabActive) {
		currentTabId = tabId;
		active = true;

		toggleTrack.classList.add("on");
		spinIcon.classList.add("spinning");
		hSub.textContent = `every ${formatInterval(totalInterval)}`;
		tabBadge.textContent = `on · ${formatInterval(totalInterval)}`;
		tabBadge.className = "tab-badge on";
		updateActionButton();

		// Read the live alarm for the precise time remaining
		const alarm = await browser.alarms.get(`autoRefresh-${tabId}`).catch(() => undefined);

		if (alarm) {
			const ms = alarm.scheduledTime - Date.now();
			remaining = Math.max(1, Math.ceil(ms / 1000));
			// periodInMinutes only exists for fixed alarms. Randomized alarms use
			// delayInMinutes (one-shot), so totalInterval stays as the stored
			// actualInterval which the background already updated.
			if (alarm.periodInMinutes) {
				totalInterval = Math.round(alarm.periodInMinutes * 60);
			}
		} else {
			remaining = totalInterval;
		}

		startTimer();
	} else {
		active = false;
		currentTabId = null;
		toggleTrack.classList.remove("on");
		spinIcon.classList.remove("spinning");
		hSub.textContent = "inactive";
		tabBadge.textContent = "off";
		tabBadge.className = "tab-badge off";
		updateActionButton();
		stopTimer();
	}
})();

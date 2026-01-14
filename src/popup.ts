import type { StorageState, TabState } from "./types";
import {
	CIRC,
	MAX_INTERVAL,
	MIN_INTERVAL,
	STEP,
	computeRingOffset,
	debounce,
	formatInterval,
	formatRemaining,
	snapInterval,
} from "./utils";

const toggleWrap = document.getElementById("toggleWrap") as HTMLDivElement;
const toggleTrack = document.getElementById("toggleTrack") as HTMLDivElement;
const statusDot = document.getElementById("statusDot") as HTMLDivElement;
const hSub = document.getElementById("hSub") as HTMLSpanElement;
const ringNum = document.getElementById("ringNum") as HTMLSpanElement;
const progressArc = document.getElementById("progressArc") as unknown as SVGCircleElement;
const statInterval = document.getElementById("statInterval") as HTMLSpanElement;
const statCount = document.getElementById("statCount") as HTMLSpanElement;
const statNext = document.getElementById("statNext") as HTMLSpanElement;
const tabName = document.getElementById("tabName") as HTMLSpanElement;
const tabBadge = document.getElementById("tabBadge") as HTMLSpanElement;
const actionBtn = document.getElementById("actionBtn") as HTMLButtonElement;
const RESTRICTED_URL = [
	"about:",
	"view-source:",
	"file://",
	"moz-extension://",
	"chrome:",
	"data:",
];

const randomizeToggle = document.getElementById("randomizeToggle") as HTMLInputElement;
const bypassCacheToggle = document.getElementById("bypassCacheToggle") as HTMLInputElement;
const maxRefreshesInput = document.getElementById("maxRefreshesInput") as HTMLInputElement;
const resetCountBtn = document.getElementById("resetCountBtn") as HTMLButtonElement;
const countdownAnnounce = document.getElementById("countdownAnnounce") as HTMLDivElement;
const stepDown = document.getElementById("stepDown") as HTMLButtonElement;
const stepUp = document.getElementById("stepUp") as HTMLButtonElement;
const timeMins = document.getElementById("timeMins") as HTMLSpanElement;
const timeSecs = document.getElementById("timeSecs") as HTMLSpanElement;

let active = false;
let paused = false;
let interval = MIN_INTERVAL;
let remaining = MIN_INTERVAL;
let totalInterval = MIN_INTERVAL;
let count = 0;
let maxRefreshes: number | null = null;
let currentTabId: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

// ─── Listen for countdown updates from background ────────────────────────────

browser.runtime.onMessage.addListener((msg: unknown) => {
	if (typeof msg !== "object" || msg === null) return;
	const update = msg as Record<string, unknown>;
	if (update.type !== "countdownUpdate" || typeof update.tabId !== "number") return;
	if (update.tabId !== currentTabId) return;

	if (typeof update.count === "number") {
		count = update.count;
		statCount.textContent = String(count);
	}
	if (typeof update.actualInterval === "number") {
		const actual = update.actualInterval;
		hSub.textContent = `every ${formatInterval(actual)}`;
		tabBadge.textContent = `on · ${formatInterval(actual)}`;
	}
	const tabMax = update.maxRefreshes;
	maxRefreshes = typeof tabMax === "number" ? tabMax : null;
	maxRefreshesInput.value = maxRefreshes !== null ? String(maxRefreshes) : "";
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateTimeDisplay(secs: number) {
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	timeMins.textContent = String(m);
	timeSecs.textContent = String(s).padStart(2, "0");
}

function syncStepperButtons() {
	stepDown.disabled = interval <= MIN_INTERVAL;
	stepUp.disabled = interval >= MAX_INTERVAL;
}

function syncPresets() {
	for (const b of document.querySelectorAll<HTMLButtonElement>(".p-btn")) {
		b.classList.toggle("active", Number.parseInt(b.dataset.v ?? "0") === interval);
	}
	updateTimeDisplay(interval);
	syncStepperButtons();
	statInterval.textContent = active ? formatInterval(interval) : "—";
}

// ─── Ring ─────────────────────────────────────────────────────────────────────

function setRing(rem: number, total: number) {
	progressArc.setAttribute("stroke-dashoffset", computeRingOffset(rem, total));
	const text = active ? formatRemaining(rem) : "—";
	ringNum.textContent = text;
	statNext.textContent = text;
	if (active) {
		countdownAnnounce.textContent = `Next refresh in ${text}`;
	}
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function stopTimer() {
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
	progressArc.setAttribute("stroke-dashoffset", String(CIRC));
	ringNum.textContent = "—";
	statNext.textContent = "—";
}

function resetAndStartTimer(newRemaining: number, newTotal: number) {
	remaining = newRemaining;
	totalInterval = newTotal;
	startTimer();
}

function startTimer() {
	if (timer) clearTimeout(timer);
	const startedAt = Date.now();
	const startRemaining = remaining;
	const startTotal = totalInterval;

	setRing(startRemaining, startTotal);

	function tick() {
		const elapsed = Math.floor((Date.now() - startedAt) / 1000);
		const currentRemaining = Math.max(0, startRemaining - elapsed);

		if (currentRemaining > 0) {
			setRing(currentRemaining, startTotal);
			timer = setTimeout(tick, 1000);
			return;
		}

		timer = null;
		setRing(0, startTotal);

		if (currentTabId === null) return;

		let attempts = 0;
		const MAX_ATTEMPTS = 6;
		const RETRY_MS = 500;

		function tryGetAlarm() {
			const tabId = currentTabId;
			if (tabId === null) return;

			browser.alarms
				.get(`autoRefresh-${tabId}`)
				.then((alarm) => {
					if (alarm) {
						const ms = alarm.scheduledTime - Date.now();
						const newRemaining = Math.max(1, Math.ceil(ms / 1000));
						const newTotal = alarm.periodInMinutes
							? Math.round(alarm.periodInMinutes * 60)
							: newRemaining;

						resetAndStartTimer(newRemaining, newTotal);
					} else {
						attempts += 1;
						if (attempts < MAX_ATTEMPTS) {
							setTimeout(tryGetAlarm, RETRY_MS);
						} else {
							resetAndStartTimer(startTotal, startTotal);
						}
					}
				})
				.catch(() => {
					attempts += 1;
					if (attempts < MAX_ATTEMPTS) {
						setTimeout(tryGetAlarm, RETRY_MS);
					} else {
						resetAndStartTimer(startTotal, startTotal);
					}
				});
		}

		setTimeout(tryGetAlarm, 300);
	}

	timer = setTimeout(tick, 1000);
}

// ─── UI state ─────────────────────────────────────────────────────────────────

function updateActionButton() {
	if (active && paused) {
		actionBtn.textContent = "Resume";
		actionBtn.className = "action-btn";
	} else if (active) {
		actionBtn.textContent = "Pause";
		actionBtn.className = "action-btn";
	} else {
		actionBtn.textContent = "Start refreshing";
		actionBtn.className = "action-btn";
	}
}

function setActiveUI(on: boolean, actualSecs?: number) {
	active = on;
	if (!on) paused = false;
	toggleWrap.setAttribute("aria-checked", String(on));
	toggleTrack.classList.toggle("on", on);
	statusDot.classList.toggle("on", on);
	statusDot.setAttribute("aria-label", on ? "Active" : "Inactive");
	const displayInterval = actualSecs ?? interval;
	hSub.textContent = on ? `every ${formatInterval(displayInterval)}` : "inactive";
	tabBadge.textContent = on ? `on · ${formatInterval(displayInterval)}` : "off";
	tabBadge.className = `tab-badge ${on ? "on" : ""}`;
	statInterval.textContent = on ? formatInterval(interval) : "—";
	updateActionButton();
	if (!on) stopTimer();
}

// ─── Start / Stop ─────────────────────────────────────────────────────────────

async function startRefresh(tabId: number, tabTitle?: string) {
	paused = false;
	currentTabId = tabId;
	if (tabTitle) {
		tabName.textContent = tabTitle;
		tabName.title = tabTitle;
	}

	const tabUrl = (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.url;
	if (tabUrl && RESTRICTED_URL.some((p) => tabUrl.startsWith(p))) {
		console.warn("[AutoRefresh] cannot start on restricted URL");
		return;
	}

	setActiveUI(true);

	const maxVal = maxRefreshesInput.value;
	maxRefreshes = maxVal ? Number.parseInt(maxVal, 10) || null : null;

	let actualInterval = interval;
	try {
		const response = (await browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId,
			randomize: randomizeToggle.checked,
			maxRefreshes,
			bypassCache: bypassCacheToggle.checked,
		})) as { actualInterval: number } | undefined;

		if (response?.actualInterval) actualInterval = response.actualInterval;
	} catch (err) {
		console.warn("[AutoRefresh]", err);
	}

	totalInterval = actualInterval;
	remaining = actualInterval;
	hSub.textContent = `every ${formatInterval(actualInterval)}`;
	tabBadge.textContent = `on · ${formatInterval(actualInterval)}`;
	startTimer();
}

function stopRefresh() {
	const oldTabId = currentTabId;
	currentTabId = null;
	active = false;
	setActiveUI(false);

	if (oldTabId !== null) {
		browser.action
			.setBadgeText({ text: "", tabId: oldTabId })
			.catch((err) => console.warn("[AutoRefresh]", err));
		browser.runtime
			.sendMessage({ action: "stop", tabId: oldTabId })
			.catch((err) => console.warn("[AutoRefresh]", err));
	}
}

// ─── Interval application ─────────────────────────────────────────────────────

async function applyInterval(val: number) {
	interval = snapInterval(val);
	syncPresets();

	if (active && currentTabId !== null) {
		const maxVal = maxRefreshesInput.value;
		maxRefreshes = maxVal ? Number.parseInt(maxVal, 10) || null : null;

		let actualInterval = interval;
		try {
			const response = (await browser.runtime.sendMessage({
				action: "start",
				interval,
				tabId: currentTabId,
				randomize: randomizeToggle.checked,
				maxRefreshes,
			})) as { actualInterval: number } | undefined;
			if (response?.actualInterval) actualInterval = response.actualInterval;
		} catch (err) {
			console.warn("[AutoRefresh]", err);
		}

		totalInterval = actualInterval;
		remaining = actualInterval;
		startTimer();
	}
}

// ─── Pause / Resume ──────────────────────────────────────────────────────────

async function togglePause() {
	if (!active) {
		const tabs = await browser.tabs.query({ active: true, currentWindow: true });
		const tab = tabs[0];
		if (tab?.id !== undefined) await startRefresh(tab.id, tab.title);
		return;
	}

	const tabId = currentTabId;
	if (tabId === null) return;

	if (paused) {
		try {
			const response = (await browser.runtime.sendMessage({
				action: "resume",
				tabId,
			})) as { actualInterval: number } | undefined;

			paused = false;
			if (response?.actualInterval) {
				totalInterval = response.actualInterval;
			}
			startTimer();
			updateActionButton();
		} catch (err) {
			console.warn("[AutoRefresh]", err);
		}
	} else {
		try {
			const response = (await browser.runtime.sendMessage({
				action: "pause",
				tabId,
			})) as { remaining: number } | undefined;

			paused = true;
			if (response?.remaining) {
				remaining = response.remaining;
			}
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
			setRing(remaining, totalInterval);
			updateActionButton();
		} catch (err) {
			console.warn("[AutoRefresh]", err);
		}
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
actionBtn.addEventListener("click", togglePause);

// Preset buttons
for (const b of document.querySelectorAll<HTMLButtonElement>(".p-btn")) {
	b.addEventListener("click", () => applyInterval(Number.parseInt(b.dataset.v ?? "0")));
}

// Stepper buttons — step by 30s, clamped by applyInterval → snapInterval
const debouncedApply = debounce((val: number) => applyInterval(val), 100);
stepDown.addEventListener("click", () => debouncedApply(interval - STEP));
stepUp.addEventListener("click", () => debouncedApply(interval + STEP));

// Randomize toggle
randomizeToggle.addEventListener("change", async () => {
	const randomize = randomizeToggle.checked;
	browser.storage.local.set({ randomize }).catch((err) => console.warn("[AutoRefresh]", err));

	if (active && currentTabId !== null) {
		const maxVal = maxRefreshesInput.value;
		maxRefreshes = maxVal ? Number.parseInt(maxVal, 10) || null : null;

		let actualInterval = interval;
		try {
			const response = (await browser.runtime.sendMessage({
				action: "start",
				interval,
				tabId: currentTabId,
				randomize,
				maxRefreshes,
				bypassCache: bypassCacheToggle.checked,
			})) as { actualInterval: number } | undefined;
			if (response?.actualInterval) actualInterval = response.actualInterval;
		} catch (err) {
			console.warn("[AutoRefresh]", err);
		}

		totalInterval = actualInterval;
		remaining = actualInterval;
		startTimer();
	}
});

// ─── Reset count ──────────────────────────────────────────────────────────────

resetCountBtn.addEventListener("click", () => {
	if (currentTabId !== null) {
		browser.runtime.sendMessage({ action: "resetCount", tabId: currentTabId }).catch(() => {});
		count = 0;
		statCount.textContent = "0";
	}
});

// ─── Restore state on popup open ──────────────────────────────────────────────

(async () => {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const currentTab = tabs[0];
	if (!currentTab?.id) return;
	const tabId: number = currentTab.id;

	if (currentTab.title) {
		tabName.textContent = currentTab.title;
		tabName.title = currentTab.title;
	}

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

	if (data.defaultInterval) interval = snapInterval(data.defaultInterval);
	if (data.tabStates?.[tabId]?.interval) interval = snapInterval(data.tabStates[tabId].interval);

	totalInterval = data.tabStates?.[tabId]?.actualInterval ?? interval;

	count = data.tabStates?.[tabId]?.count ?? 0;
	statCount.textContent = String(count);

	maxRefreshes = data.tabStates?.[tabId]?.maxRefreshes ?? null;
	maxRefreshesInput.value = maxRefreshes !== null ? String(maxRefreshes) : "";

	if (typeof data.randomize === "boolean") {
		randomizeToggle.checked = data.tabStates?.[tabId]?.randomize ?? data.randomize;
	}

	// Check for restricted URL
	const tabUrl = currentTab?.url;
	if (tabUrl && RESTRICTED_URL.some((p) => tabUrl.startsWith(p))) {
		active = false;
		paused = false;
		currentTabId = null;
		setActiveUI(false);
		return;
	}

	syncPresets();

	const isThisTabActive = data.active === true && data.currentTabId === tabId;

	if (isThisTabActive) {
		currentTabId = tabId;
		active = true;
		paused = data.tabStates?.[tabId]?.paused ?? false;

		toggleTrack.classList.add("on");
		statusDot.classList.add("on");
		hSub.textContent = `every ${formatInterval(totalInterval)}`;
		tabBadge.textContent = `on · ${formatInterval(totalInterval)}`;
		tabBadge.className = "tab-badge on";
		statInterval.textContent = formatInterval(interval);
		updateActionButton();

		if (paused) {
			// biome-ignore lint/style/noNonNullAssertion: this is fine
			remaining = data.tabStates![tabId].remaining ?? totalInterval;
			setRing(remaining, totalInterval);
		} else {
			const alarm = await browser.alarms.get(`autoRefresh-${tabId}`).catch((err) => {
				console.warn("[AutoRefresh]", err);
				return undefined;
			});

			if (alarm) {
				const ms = alarm.scheduledTime - Date.now();
				remaining = Math.max(1, Math.ceil(ms / 1000));
				if (alarm.periodInMinutes) {
					totalInterval = Math.round(alarm.periodInMinutes * 60);
				}
			} else {
				remaining = totalInterval;
			}

			startTimer();
		}
	} else {
		active = false;
		paused = false;
		currentTabId = null;
		toggleTrack.classList.remove("on");
		statusDot.classList.remove("on");
		hSub.textContent = "inactive";
		tabBadge.textContent = "off";
		tabBadge.className = "tab-badge";
		updateActionButton();
		stopTimer();
	}
})();

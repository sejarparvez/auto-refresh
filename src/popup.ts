import type { StorageState, TabState } from "./types";
import {
	CIRC,
	MAX_INTERVAL,
	MIN_INTERVAL,
	STEP,
	computeRingOffset,
	formatInterval,
	formatRemaining,
	snapInterval,
	truncateTitle,
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
const randomizeToggle = document.getElementById("randomizeToggle") as HTMLInputElement;
const stepDown = document.getElementById("stepDown") as HTMLButtonElement;
const stepUp = document.getElementById("stepUp") as HTMLButtonElement;
const timeMins = document.getElementById("timeMins") as HTMLSpanElement;
const timeSecs = document.getElementById("timeSecs") as HTMLSpanElement;

let active = false;
let interval = MIN_INTERVAL;
let remaining = MIN_INTERVAL;
let totalInterval = MIN_INTERVAL;
let count = 0;
let currentTabId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

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
	ringNum.textContent = active ? formatRemaining(rem) : "—";
	statNext.textContent = active ? formatRemaining(rem) : "—";
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function stopTimer() {
	if (timer) {
		clearInterval(timer);
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
	if (timer) clearInterval(timer);

	setRing(remaining, totalInterval);

	timer = setInterval(() => {
		remaining -= 1;

		if (remaining > 0) {
			setRing(remaining, totalInterval);
			return;
		}

		// biome-ignore lint/style/noNonNullAssertion: cleared immediately
		clearInterval(timer!);
		timer = null;
		setRing(0, totalInterval);

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

						browser.storage.local
							.get("tabStates")
							.then((data) => {
								if (currentTabId !== null && data.tabStates?.[currentTabId]) {
									count = data.tabStates[currentTabId].count ?? count;
									statCount.textContent = String(count);
									const actual = data.tabStates[currentTabId].actualInterval;
									if (actual) {
										hSub.textContent = `every ${formatInterval(actual)}`;
										tabBadge.textContent = `on · ${formatInterval(actual)}`;
									}
								}
							})
							.catch((err) => console.warn("[AutoRefresh]", err));

						resetAndStartTimer(newRemaining, newTotal);
					} else {
						attempts += 1;
						if (attempts < MAX_ATTEMPTS) {
							setTimeout(tryGetAlarm, RETRY_MS);
						} else {
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

		setTimeout(tryGetAlarm, 300);
	}, 1000);
}

// ─── UI state ─────────────────────────────────────────────────────────────────

function updateActionButton() {
	actionBtn.textContent = active ? "Stop refreshing" : "Start refreshing";
	actionBtn.className = active ? "action-btn stop" : "action-btn";
}

function setActiveUI(on: boolean, actualSecs?: number) {
	active = on;
	toggleTrack.classList.toggle("on", on);
	statusDot.classList.toggle("on", on);
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
	currentTabId = tabId;
	if (tabTitle) tabName.textContent = truncateTitle(tabTitle);

	setActiveUI(true);

	let actualInterval = interval;
	try {
		const response = (await browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId,
			randomize: randomizeToggle.checked,
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
		let actualInterval = interval;
		try {
			const response = (await browser.runtime.sendMessage({
				action: "start",
				interval,
				tabId: currentTabId,
				randomize: randomizeToggle.checked,
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

// Preset buttons
for (const b of document.querySelectorAll<HTMLButtonElement>(".p-btn")) {
	b.addEventListener("click", () => applyInterval(Number.parseInt(b.dataset.v ?? "0")));
}

// Stepper buttons — step by 30s, clamped by applyInterval → snapInterval
stepDown.addEventListener("click", () => applyInterval(interval - STEP));
stepUp.addEventListener("click", () => applyInterval(interval + STEP));

// Randomize toggle
randomizeToggle.addEventListener("change", async () => {
	const randomize = randomizeToggle.checked;
	browser.storage.local.set({ randomize }).catch((err) => console.warn("[AutoRefresh]", err));

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
		} catch (err) {
			console.warn("[AutoRefresh]", err);
		}

		totalInterval = actualInterval;
		remaining = actualInterval;
		startTimer();
	}
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

	if (data.defaultInterval) interval = snapInterval(data.defaultInterval);
	if (data.tabStates?.[tabId]?.interval) interval = snapInterval(data.tabStates[tabId].interval);

	totalInterval = data.tabStates?.[tabId]?.actualInterval ?? interval;

	count = data.tabStates?.[tabId]?.count ?? 0;
	statCount.textContent = String(count);

	if (typeof data.randomize === "boolean") {
		randomizeToggle.checked = data.tabStates?.[tabId]?.randomize ?? data.randomize;
	}

	syncPresets();

	const isThisTabActive = data.active === true && data.currentTabId === tabId;

	if (isThisTabActive) {
		currentTabId = tabId;
		active = true;

		toggleTrack.classList.add("on");
		statusDot.classList.add("on");
		hSub.textContent = `every ${formatInterval(totalInterval)}`;
		tabBadge.textContent = `on · ${formatInterval(totalInterval)}`;
		tabBadge.className = "tab-badge on";
		statInterval.textContent = formatInterval(interval);
		updateActionButton();

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
	} else {
		active = false;
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

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

const CIRC = 251.2;
let active = false;
let interval = 30;
let remaining = 30;
let count = 0;
let currentTabId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function setRing(rem: number, total: number) {
	const pct = total > 0 ? rem / total : 0;
	progressArc.setAttribute("stroke-dashoffset", (CIRC * (1 - pct)).toFixed(1));
	ringNum.textContent = active ? rem + "s" : "—";
}

function syncPresets() {
	document.querySelectorAll<HTMLButtonElement>(".p-btn").forEach((b) => {
		b.classList.toggle("active", parseInt(b.dataset.v!) === interval);
	});
	statInterval.textContent =
		interval >= 60 ? interval / 60 + "m" : interval + "s";
}

function startTimer() {
	if (timer) clearInterval(timer);
	remaining = interval;
	setRing(remaining, interval);
	timer = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			count++;
			statCount.textContent = String(count);
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

function setActive(on: boolean) {
	active = on;
	toggleTrack.classList.toggle("on", on);
	spinIcon.classList.toggle("spinning", on);
	hSub.textContent = on
		? "every " + (interval >= 60 ? interval / 60 + "m" : interval + "s")
		: "inactive";
	tabBadge.textContent = on
		? "on · " + (interval >= 60 ? interval / 60 + "m" : interval + "s")
		: "off";
	tabBadge.className = "tab-badge " + (on ? "on" : "off");
	if (on) startTimer();
	else stopTimer();
}

function applyInterval(val: number) {
	interval = Math.max(1, val);
	sVal.value = String(interval);
	syncPresets();
	if (active && currentTabId !== null) {
		browser.runtime.sendMessage({
			action: "start",
			interval,
			tabId: currentTabId,
		} as Message);
		browser.storage.local.set({ interval } as Partial<StorageState>);
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
				tabName.textContent = tabs[0].title.slice(0, 30);
			}

			setActive(true);
			browser.runtime.sendMessage({
				action: "start",
				interval,
				tabId,
			} as Message);
			browser.storage.local.set({
				active: true,
				interval,
				tabId,
			} as StorageState);
		});
	} else {
		currentTabId = null;
		setActive(false);
		browser.runtime.sendMessage({ action: "stop" } as Message);
		browser.storage.local.set({
			active: false,
			tabId: null,
		} as Partial<StorageState>);
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
	if (!isNaN(v) && v >= 1) applyInterval(v);
});

document.querySelectorAll<HTMLButtonElement>(".p-btn").forEach((b) => {
	b.addEventListener("click", () => applyInterval(parseInt(b.dataset.v!)));
});

browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
	if (tabs[0]?.title) tabName.textContent = tabs[0].title.slice(0, 30);
});

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
		if (data.tabId) {
			currentTabId = data.tabId;
			browser.tabs
				.get(data.tabId)
				.then((tab) => {
					if (tab?.title) tabName.textContent = tab.title.slice(0, 30);
				})
				.catch(() => {
					browser.storage.local.set({ active: false, tabId: null });
				});
		}
		syncPresets();
		if (data.active) setActive(true);
	});

import { initLogger, log } from "./logger";

await initLogger();

let overlay: HTMLDivElement | null = null;
let countdownValue: HTMLSpanElement | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let stylesInjected = false;

// Drag state
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isDragging = false;

const OVERLAY_CLASSES = "auto-refresh-overlay";
const COUNTDOWN_CLASS = "auto-refresh-countdown";

function injectStyles(): void {
	if (stylesInjected) return;
	const style = document.createElement("style");
	style.id = "auto-refresh-styles";
	style.textContent = `
    .${OVERLAY_CLASSES} {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: grab;
      user-select: none;
      transition: opacity 0.3s;
    }
    .${OVERLAY_CLASSES}.dragging {
      cursor: grabbing;
      transition: none;
    }
    .${COUNTDOWN_CLASS} {
      font-weight: bold;
    }
  `;
	document.documentElement.appendChild(style);
	stylesInjected = true;
}

export function createOverlay(): HTMLDivElement {
	injectStyles();

	const el = document.createElement("div");
	el.className = OVERLAY_CLASSES;

	const text = document.createElement("span");
	text.textContent = "Auto-refresh in ";
	el.appendChild(text);

	countdownValue = document.createElement("span");
	countdownValue.className = COUNTDOWN_CLASS;
	el.appendChild(countdownValue);

	const secondsText = document.createElement("span");
	secondsText.textContent = "s";
	el.appendChild(secondsText);

	makeDraggable(el);

	return el;
}

function makeDraggable(el: HTMLDivElement): void {
	el.addEventListener("mousedown", (e) => {
		if (e.button !== 0) return;
		isDragging = false;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		el.classList.add("dragging");
	});

	document.addEventListener("mousemove", (e) => {
		if (!el.classList.contains("dragging")) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
			isDragging = true;
		}
		if (isDragging) {
			dragOffsetX += dx;
			dragOffsetY += dy;
			el.style.transform = `translate(${dragOffsetX}px, ${dragOffsetY}px)`;
		}
		dragStartX = e.clientX;
		dragStartY = e.clientY;
	});

	document.addEventListener("mouseup", () => {
		if (!el.classList.contains("dragging")) return;
		el.classList.remove("dragging");
		isDragging = false;
	});
}

export function showCountdown(initialSeconds: number) {
	log("Showing countdown overlay:", initialSeconds);

	if (!overlay) {
		if (!document.body) {
			log("No document.body available, skipping overlay");
			return;
		}
		overlay = createOverlay();
		document.body.appendChild(overlay);
	}

	let seconds = initialSeconds;

	if (countdownValue) {
		countdownValue.textContent = String(seconds);
	}

	if (countdownInterval) clearInterval(countdownInterval);

	countdownInterval = setInterval(() => {
		seconds--;
		if (countdownValue) {
			countdownValue.textContent = String(seconds);
		}
		if (seconds <= 0) {
			if (countdownInterval) clearInterval(countdownInterval);
			hideCountdown();
		}
	}, 1000);
}

export function hideCountdown() {
	log("Hiding countdown overlay");
	if (countdownInterval) {
		clearInterval(countdownInterval);
		countdownInterval = null;
	}
	if (overlay) {
		overlay.remove();
		overlay = null;
		countdownValue = null;
	}
}

// Listen for messages from background script
interface BackgroundMessage {
	showCountdown?: number;
	hideCountdown?: boolean;
}

browser.runtime.onMessage.addListener((msg: unknown, sender) => {
	if (sender.id !== browser.runtime.id) return;
	if (typeof msg !== "object" || msg === null) return;

	const message = msg as BackgroundMessage;

	if (message.showCountdown !== undefined && typeof message.showCountdown === "number") {
		showCountdown(message.showCountdown);
	}

	if (message.hideCountdown === true) {
		hideCountdown();
	}
});

log("Content script loaded");

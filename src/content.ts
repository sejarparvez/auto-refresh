import { log } from "./logger";

// Content script for Auto Refresh Tab extension
// Runs in the context of the web page

let overlay: HTMLDivElement | null = null;
let countdownValue: HTMLSpanElement | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function createOverlay(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "auto-refresh-overlay";
  el.style.cssText = `
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
    transition: opacity 0.3s;
  `;

  const text = document.createElement("span");
  text.textContent = "Auto-refresh in ";
  el.appendChild(text);

  countdownValue = document.createElement("span");
  countdownValue.style.fontWeight = "bold";
  el.appendChild(countdownValue);

  const secondsText = document.createElement("span");
  secondsText.textContent = "s";
  el.appendChild(secondsText);

  return el;
}

function showCountdown(seconds: number) {
  log("Showing countdown overlay:", seconds);

  if (!overlay) {
    overlay = createOverlay();
    document.body.appendChild(overlay);
  }

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

function hideCountdown() {
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
browser.runtime.onMessage.addListener((msg: unknown) => {
  if (typeof msg !== "object" || msg === null) return;

  if ("showCountdown" in msg && typeof (msg as any).showCountdown === "number") {
    showCountdown((msg as any).showCountdown);
  }

  if ("hideCountdown" in msg && (msg as any).hideCountdown === true) {
    hideCountdown();
  }
});

log("Content script loaded");

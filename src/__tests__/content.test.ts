import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Mock browser before importing content module (also needed by logger)
// @ts-ignore
globalThis.browser = {
	storage: {
		local: {
			get: mock(async () => ({ debug: false })),
			set: mock(async () => {}),
		},
		onChanged: {
			addListener: mock(() => {}),
		},
	},
	runtime: {
		onMessage: { addListener: mock(() => {}) },
	},
};

// Now import the content module functions
const contentModule = await import("../content");
const { createOverlay, showCountdown, hideCountdown } = contentModule;

function countdownSpan(el: HTMLElement): HTMLElement | null {
	return (el.querySelector(".auto-refresh-countdown") as HTMLElement) ?? null;
}

describe("createOverlay", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	test("creates overlay element with correct class", () => {
		const el = createOverlay();
		expect(el.className).toBe("auto-refresh-overlay");
	});

	test("contains countdown display element", () => {
		const el = createOverlay();
		const span = countdownSpan(el);
		expect(span).not.toBeNull();
	});

	test("creates overlay with descriptive text", () => {
		const el = createOverlay();
		expect(el.textContent).toContain("Auto-refresh in");
	});

	test("creates unique overlay each call", () => {
		const el1 = createOverlay();
		const el2 = createOverlay();
		expect(el1).not.toBe(el2);
	});
});

describe("showCountdown and hideCountdown", () => {
	beforeEach(() => {
		hideCountdown();
		document.body.innerHTML = "";
	});

	test("showCountdown appends overlay to body", () => {
		showCountdown(30);
		const overlay = document.querySelector(".auto-refresh-overlay");
		expect(overlay).not.toBeNull();
	});

	test("showCountdown displays initial seconds", () => {
		showCountdown(42);
		const countdown = document.querySelector(".auto-refresh-countdown");
		expect(countdown?.textContent).toBe("42");
	});

	test("hideCountdown removes overlay from DOM", () => {
		showCountdown(10);
		expect(document.querySelector(".auto-refresh-overlay")).not.toBeNull();
		hideCountdown();
		expect(document.querySelector(".auto-refresh-overlay")).toBeNull();
	});

	test("calling showCountdown twice replaces previous overlay", () => {
		showCountdown(10);
		showCountdown(20);
		const countdown = document.querySelector(".auto-refresh-countdown");
		expect(countdown?.textContent).toBe("20");
	});
});

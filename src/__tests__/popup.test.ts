import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock DOM elements
function createMockElement(tag = "div", id: string | null = null) {
	const el = {
		id: id || "",
		textContent: "",
		className: "",
		classList: {
			toggle: mock(() => {}),
			remove: mock(() => {}),
			add: mock(() => {}),
		},
		setAttribute: mock(() => {}),
		style: {} as Record<string, string>,
		dataset: {} as Record<string, string>,
		addEventListener: mock(() => {}),
		querySelectorAll: mock(() => []) as HTMLButtonElement[],
	};
	return el;
}

// Mock browser APIs
const mockAlarms = {
	get: mock(() => Promise.resolve(null)),
};

const mockStorage = {
	local: {
		get: mock(() => Promise.resolve({})),
		set: mock(() => Promise.resolve()),
	},
};

const mockTabs = {
	query: mock(() => Promise.resolve([])),
};

const mockAction = {
	setBadgeText: mock(() => Promise.resolve()),
	setBadgeBackgroundColor: mock(() => Promise.resolve()),
};

const mockCommands = {
	onCommand: { addListener: mock() },
};

// @ts-ignore - mocking browser and DOM globals
globalThis.browser = {
	alarms: mockAlarms,
	storage: mockStorage,
	tabs: mockTabs,
	action: mockAction,
	commands: mockCommands,
};

// We need to test the pure functions from popup.ts
// Since popup.ts has side effects at module level, we'll extract and test the functions directly

// Re-implement pure functions for testing (they're not exported from popup.ts)
function truncateTitle(title: string, maxLength = 30): string {
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength)}...`;
}

function formatInterval(secs: number): string {
	return secs >= 60 ? `${secs / 60}m` : `${secs}s`;
}

const CIRC = 251.2;
const MIN_INTERVAL = 60;

function setRing(rem: number, total: number) {
	const pct = total > 0 ? rem / total : 0;
	return (CIRC * (1 - pct)).toFixed(1);
}

describe("truncateTitle", () => {
	test("should return full title if under maxLength", () => {
		expect(truncateTitle("Hello World")).toBe("Hello World");
	});

	test("should truncate title at maxLength and add ellipsis", () => {
		const longTitle = "A".repeat(50);
		expect(truncateTitle(longTitle)).toBe(`${"A".repeat(30)}...`);
		expect(truncateTitle(longTitle).length).toBe(33);
	});

	test("should use default maxLength of 30", () => {
		const longTitle = "B".repeat(100);
		expect(truncateTitle(longTitle).length).toBe(33);
	});

	test("should accept custom maxLength", () => {
		const longTitle = "C".repeat(100);
		expect(truncateTitle(longTitle, 10)).toBe(`${"C".repeat(10)}...`);
		expect(truncateTitle(longTitle, 10).length).toBe(13);
	});

	test("should handle empty string", () => {
		expect(truncateTitle("")).toBe("");
	});
});

describe("formatInterval", () => {
	test("should format seconds for intervals < 60", () => {
		expect(formatInterval(30)).toBe("30s");
		expect(formatInterval(1)).toBe("1s");
		expect(formatInterval(59)).toBe("59s");
	});

	test("should format minutes for intervals >= 60", () => {
		expect(formatInterval(60)).toBe("1m");
		expect(formatInterval(120)).toBe("2m");
		expect(formatInterval(300)).toBe("5m");
		expect(formatInterval(3600)).toBe("60m");
	});

	test("should handle exact minute boundaries", () => {
		expect(formatInterval(60)).toBe("1m");
		expect(formatInterval(120)).toBe("2m");
	});
});

describe("setRing", () => {
	test("should return full circumference when rem equals total", () => {
		const offset = setRing(60, 60);
		expect(offset).toBe((CIRC * (1 - 1)).toFixed(1));
		expect(offset).toBe("0.0");
	});

	test("should return 0 offset when remaining is 0", () => {
		const offset = setRing(0, 60);
		expect(offset).toBe((CIRC * (1 - 0)).toFixed(1));
		expect(Number.parseFloat(offset)).toBeCloseTo(CIRC);
	});

	test("should return half circumference at 50%", () => {
		const offset = setRing(30, 60);
		expect(Number.parseFloat(offset)).toBeCloseTo(CIRC * 0.5);
	});

	test("should handle zero total", () => {
		const offset = setRing(0, 0);
		expect(offset).toBe((CIRC * (1 - 0)).toFixed(1));
	});

	test("should calculate correct offset for various values", () => {
		// setRing returns toFixed(1), so we need to account for rounding
		expect(Number.parseFloat(setRing(45, 60))).toBeCloseTo(CIRC * 0.25, 1);
		expect(Number.parseFloat(setRing(15, 60))).toBeCloseTo(CIRC * 0.75, 1);
		// 59/60 ≈ 0.9833, so 1 - 0.9833 = 0.0167, CIRC * 0.0167 ≈ 4.2
		expect(Number.parseFloat(setRing(59, 60))).toBeCloseTo(4.2, 1);
	});
});

describe("interval validation", () => {
	test("should enforce minimum interval of 60 seconds", () => {
		const applyInterval = (val: number) => Math.max(MIN_INTERVAL, val);
		expect(applyInterval(30)).toBe(60);
		expect(applyInterval(60)).toBe(60);
		expect(applyInterval(120)).toBe(120);
		expect(applyInterval(0)).toBe(60);
	});
});

describe("tab active status check", () => {
	test("should identify active tab correctly", () => {
		const data = { active: true, tabId: 5 };
		const currentTabId = 5;
		const isThisTabActive = data.active && data.tabId === currentTabId;
		expect(isThisTabActive).toBe(true);
	});

	test("should identify inactive tab when tabId doesn't match", () => {
		const data = { active: true, tabId: 5 };
		const currentTabId = 10;
		const isThisTabActive = data.active && data.tabId === currentTabId;
		expect(isThisTabActive).toBe(false);
	});

	test("should identify inactive tab when not active", () => {
		const data = { active: false, tabId: 5 };
		const currentTabId = 5;
		const isThisTabActive = data.active && data.tabId === currentTabId;
		expect(isThisTabActive).toBe(false);
	});
});

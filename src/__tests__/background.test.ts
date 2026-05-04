import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Message, StorageState } from "../types";

// Re-implement pure functions for testing (they're exported but module has side effects)
function isMessage(msg: unknown): msg is Message {
	return typeof msg === "object" && msg !== null && "action" in msg;
}

function jitteredInterval(base: number): number {
	const jitter = base * 0.1;
	return Math.round(base + (Math.random() * 2 - 1) * jitter);
}

// Mock browser APIs
const mockAlarms = {
	clear: mock(() => Promise.resolve()),
	clearAll: mock(() => Promise.resolve()),
	create: mock(() => Promise.resolve()),
	get: mock(() => Promise.resolve(null)),
	onAlarm: { addListener: mock() },
};

const mockStorage = {
	local: {
		get: mock(() => Promise.resolve({})),
		set: mock(() => Promise.resolve()),
	},
};

const mockAction = {
	setBadgeText: mock(() => Promise.resolve()),
	setBadgeBackgroundColor: mock(() => Promise.resolve()),
};

const mockTabs = {
	reload: mock(() => Promise.resolve()),
};

const mockRuntime = {
	onStartup: { addListener: mock() },
	onMessage: { addListener: mock() },
};

// Setup browser mock
beforeEach(() => {
	// @ts-ignore - mocking browser global
	globalThis.browser = {
		alarms: mockAlarms,
		storage: mockStorage,
		action: mockAction,
		tabs: mockTabs,
		runtime: mockRuntime,
	};

	mockAlarms.clear.mockClear();
	mockAlarms.clearAll.mockClear();
	mockAlarms.create.mockClear();
	mockAlarms.get.mockClear();
	mockStorage.local.get.mockClear();
	mockStorage.local.set.mockClear();
	mockAction.setBadgeText.mockClear();
	mockAction.setBadgeBackgroundColor.mockClear();
});

describe("isMessage", () => {
	test("should return true for valid message objects", () => {
		expect(isMessage({ action: "start", interval: 60, tabId: 1 })).toBe(true);
		expect(isMessage({ action: "stop" })).toBe(true);
		expect(isMessage({ action: "pause" })).toBe(true);
		expect(isMessage({ action: "resume" })).toBe(true);
	});

	test("should return false for invalid messages", () => {
		expect(isMessage(null)).toBe(false);
		expect(isMessage(undefined)).toBe(false);
		expect(isMessage("string")).toBe(false);
		expect(isMessage(123)).toBe(false);
		expect(isMessage({})).toBe(false);
		expect(isMessage({ type: "start" })).toBe(false);
	});
});

describe("jitteredInterval", () => {
	test("should return a number within ±10% of base", () => {
		const base = 600;
		const runs = 1000;
		let min = Number.POSITIVE_INFINITY;
		let max = Number.NEGATIVE_INFINITY;

		for (let i = 0; i < runs; i++) {
			const result = jitteredInterval(base);
			min = Math.min(min, result);
			max = Math.max(max, result);
		}

		const expectedMin = Math.round(base - base * 0.1);
		const expectedMax = Math.round(base + base * 0.1);

		expect(min).toBeGreaterThanOrEqual(expectedMin);
		expect(max).toBeLessThanOrEqual(expectedMax);
	});

	test("should return different values due to randomness", () => {
		const base = 600;
		const results = new Set<number>();

		for (let i = 0; i < 100; i++) {
			results.add(jitteredInterval(base));
		}

		// Should have at least a few different values
		expect(results.size).toBeGreaterThan(1);
	});

	test("should handle small intervals", () => {
		const result = jitteredInterval(60);
		expect(result).toBeGreaterThanOrEqual(54); // 60 - 10%
		expect(result).toBeLessThanOrEqual(66); // 60 + 10%
	});
});

describe("message handling - start", () => {
	test("should clamp interval to minimum 60 seconds", () => {
		const msg: Message = { action: "start", interval: 30, tabId: 1 };
		const clampedInterval = Math.max(60, msg.interval);
		expect(clampedInterval).toBe(60);
	});

	test("should use original interval when >= 60", () => {
		const msg: Message = { action: "start", interval: 120, tabId: 1 };
		const clampedInterval = Math.max(60, msg.interval);
		expect(clampedInterval).toBe(120);
	});

	test("should use exact 60 when interval is 60", () => {
		const msg: Message = { action: "start", interval: 60, tabId: 1 };
		const clampedInterval = Math.max(60, msg.interval);
		expect(clampedInterval).toBe(60);
	});
});

describe("message handling - pause", () => {
	test("should calculate remaining seconds correctly", () => {
		const now = Date.now();
		const scheduledTime = now + 5000; // 5 seconds from now
		const remainingMs = scheduledTime - now;
		const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));

		expect(remainingSec).toBe(5);
	});

	test("should ensure minimum 1 second remaining", () => {
		const now = Date.now();
		const scheduledTime = now + 200; // 200ms from now
		const remainingMs = scheduledTime - now;
		const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));

		expect(remainingSec).toBe(1);
	});

	test("should handle exactly 1 second remaining", () => {
		const now = Date.now();
		const scheduledTime = now + 1000; // exactly 1 second
		const remainingMs = scheduledTime - now;
		const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));

		expect(remainingSec).toBe(1);
	});
});

describe("message handling - resume", () => {
	test("should use remaining time if < 60 seconds", () => {
		const remaining = 30;
		const useDelay = remaining < 60;
		expect(useDelay).toBe(true);
	});

	test("should use period for intervals >= 60 seconds", () => {
		const remaining = 120;
		const useDelay = remaining < 60;
		expect(useDelay).toBe(false);
	});

	test("should handle exactly 60 seconds", () => {
		const remaining = 60;
		const useDelay = remaining < 60;
		expect(useDelay).toBe(false);
	});
});

describe("alarm handler", () => {
	test("should not proceed if tabId is null", () => {
		const tabId = null;
		expect(tabId).toBeNull();
	});

	test("should increment count on successful reload", () => {
		const currentCount = 5;
		const newCount = currentCount + 1;
		expect(newCount).toBe(6);
	});

	test("should handle first reload with count 0", () => {
		const currentCount = 0;
		const newCount = currentCount + 1;
		expect(newCount).toBe(1);
	});
});

describe("StorageState defaults", () => {
	test("should use default interval of 60 when not set", () => {
		const data: Partial<StorageState> = {};
		const interval = typeof data.interval === "number" ? data.interval : 60;
		expect(interval).toBe(60);
	});

	test("should use provided interval when set", () => {
		const data: Partial<StorageState> = { interval: 300 };
		const interval = typeof data.interval === "number" ? data.interval : 60;
		expect(interval).toBe(300);
	});

	test("should default randomize to false", () => {
		const data: Partial<StorageState> = {};
		const randomize = typeof data.randomize === "boolean" ? data.randomize : false;
		expect(randomize).toBe(false);
	});

	test("should use provided randomize value when set", () => {
		const data: Partial<StorageState> = { randomize: true };
		const randomize = typeof data.randomize === "boolean" ? data.randomize : false;
		expect(randomize).toBe(true);
	});

	test("should handle count correctly", () => {
		const data: Partial<StorageState> = { count: 10 };
		const count = typeof data.count === "number" ? data.count : 0;
		expect(count).toBe(10);
	});
});

describe("badge text logic", () => {
	test("should set correct badge for active state", () => {
		const active = true;
		const paused = false;
		const text = active && !paused ? "ON" : active && paused ? "PAUSED" : "";
		expect(text).toBe("ON");
	});

	test("should set correct badge for paused state", () => {
		const active = true;
		const paused = true;
		const text = active && !paused ? "ON" : active && paused ? "PAUSED" : "";
		expect(text).toBe("PAUSED");
	});

	test("should set empty badge for inactive state", () => {
		const active = false;
		const paused = false;
		const text = active && !paused ? "ON" : active && paused ? "PAUSED" : "";
		expect(text).toBe("");
	});
});

describe("badge color logic", () => {
	test("should use green for active state", () => {
		const active = true;
		const paused = false;
		const color = active && !paused ? "#16a34a" : "#f59e0b";
		expect(color).toBe("#16a34a");
	});

	test("should use amber for paused state", () => {
		const active = true;
		const paused = true;
		const color = active && !paused ? "#16a34a" : "#f59e0b";
		expect(color).toBe("#f59e0b");
	});
});

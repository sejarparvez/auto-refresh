import { describe, expect, test } from "bun:test";
import {
	fromStorage,
	getDefaultInterval,
	getTabCount,
	isActive,
	isPaused,
	isStopped,
	isTabActive,
	isTabPaused,
	toStorageState,
} from "../state";
import type { StorageState, TabState } from "../types";

describe("isActive", () => {
	test("should return true for ACTIVE state", () => {
		expect(
			isActive({
				state: "ACTIVE",
				tabId: 1,
				interval: 60,
				count: 0,
				remaining: null,
				randomize: false,
			}),
		).toBe(true);
	});

	test("should return true for PAUSED state", () => {
		expect(
			isActive({
				state: "PAUSED",
				tabId: 1,
				interval: 60,
				count: 0,
				remaining: 30,
				randomize: false,
			}),
		).toBe(true);
	});

	test("should return false for STOPPED state", () => {
		expect(
			isActive({
				state: "STOPPED",
				tabId: null,
				interval: 60,
				count: 0,
				remaining: null,
				randomize: false,
			}),
		).toBe(false);
	});
});

describe("isPaused", () => {
	test("should return true for PAUSED state", () => {
		expect(
			isPaused({
				state: "PAUSED",
				tabId: 1,
				interval: 60,
				count: 0,
				remaining: 30,
				randomize: false,
			}),
		).toBe(true);
	});

	test("should return false for ACTIVE state", () => {
		expect(
			isPaused({
				state: "ACTIVE",
				tabId: 1,
				interval: 60,
				count: 0,
				remaining: null,
				randomize: false,
			}),
		).toBe(false);
	});
});

describe("isStopped", () => {
	test("should return true for STOPPED state", () => {
		expect(
			isStopped({
				state: "STOPPED",
				tabId: null,
				interval: 60,
				count: 0,
				remaining: null,
				randomize: false,
			}),
		).toBe(true);
	});

	test("should return false for ACTIVE state", () => {
		expect(
			isStopped({
				state: "ACTIVE",
				tabId: 1,
				interval: 60,
				count: 0,
				remaining: null,
				randomize: false,
			}),
		).toBe(false);
	});
});

describe("toStorageState", () => {
	test("should store per-tab state", () => {
		const status = {
			state: "ACTIVE" as const,
			tabId: 5,
			interval: 120,
			count: 10,
			remaining: null,
			randomize: true,
		};
		const storage = toStorageState(status, 60);
		expect(storage.active).toBe(true);
		expect(storage.currentTabId).toBe(5);
		expect(storage.tabStates[5]).toBeDefined();
		expect(storage.tabStates[5].interval).toBe(120);
		expect(storage.tabStates[5].count).toBe(10);
		expect(storage.tabStates[5].randomize).toBe(true);
		expect(storage.defaultInterval).toBe(60);
	});

	test("should merge with existing tabStates", () => {
		const existing: Record<number, TabState> = {
			3: { interval: 300, count: 5, paused: false, remaining: null, randomize: false },
		};
		const status = {
			state: "ACTIVE" as const,
			tabId: 5,
			interval: 120,
			count: 10,
			remaining: null,
			randomize: true,
		};
		const storage = toStorageState(status, 60, existing);
		expect(storage.tabStates[3].interval).toBe(300);
		expect(storage.tabStates[5].interval).toBe(120);
	});

	test("should set paused=true when state is PAUSED", () => {
		const status = {
			state: "PAUSED" as const,
			tabId: 5,
			interval: 120,
			count: 10,
			remaining: 30,
			randomize: false,
		};
		const storage = toStorageState(status, 60);
		expect(storage.tabStates[5].paused).toBe(true);
		expect(storage.tabStates[5].remaining).toBe(30);
	});

	test("should handle STOPPED state", () => {
		const status = {
			state: "STOPPED" as const,
			tabId: null,
			interval: 60,
			count: 0,
			remaining: null,
			randomize: false,
		};
		const storage = toStorageState(status, 60);
		expect(storage.active).toBe(false);
		expect(storage.currentTabId).toBeNull();
		expect(storage.tabStates).toEqual({}); // no tab state when tabId is null
	});

	test("should set global randomize from status", () => {
		const status = {
			state: "ACTIVE" as const,
			tabId: 1,
			interval: 60,
			count: 0,
			remaining: null,
			randomize: true,
		};
		const storage = toStorageState(status, 60);
		expect(storage.randomize).toBe(true);
	});
});

describe("fromStorage", () => {
	test("should restore ACTIVE state from storage", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: {
				5: { interval: 120, count: 10, paused: false, remaining: null, randomize: true },
			},
			defaultInterval: 60,
			randomize: true,
		};
		const status = fromStorage(data, 5);
		expect(status.state).toBe("ACTIVE");
		expect(status.tabId).toBe(5);
		expect(status.interval).toBe(120);
		expect(status.count).toBe(10);
		expect(status.randomize).toBe(true);
	});

	test("should restore PAUSED state from storage", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: {
				5: { interval: 120, count: 10, paused: true, remaining: 45, randomize: false },
			},
			defaultInterval: 60,
		};
		const status = fromStorage(data, 5);
		expect(status.state).toBe("PAUSED");
		expect(status.remaining).toBe(45);
	});

	test("should return STOPPED if tabId is null", () => {
		const status = fromStorage(
			{ active: true, currentTabId: 5, tabStates: {}, defaultInterval: 60, randomize: false },
			null,
		);
		expect(status.state).toBe("STOPPED");
	});

	test("should return STOPPED if not active", () => {
		const status = fromStorage(
			{ active: false, currentTabId: null, tabStates: {}, defaultInterval: 60, randomize: false },
			5,
		);
		expect(status.state).toBe("STOPPED");
	});

	test("should use default interval if tab not in tabStates", () => {
		const status = fromStorage(
			{ active: true, currentTabId: 5, tabStates: {}, defaultInterval: 300, randomize: false },
			5,
		);
		expect(status.interval).toBe(300);
	});
});

describe("round-trip: toStorageState → fromStorage", () => {
	test("should preserve all fields for ACTIVE state", () => {
		const original = {
			state: "ACTIVE" as const,
			tabId: 5,
			interval: 120,
			count: 10,
			remaining: null,
			randomize: true,
		};
		const storage = toStorageState(original, 60);
		const restored = fromStorage(storage, 5);
		expect(restored.state).toBe("ACTIVE");
		expect(restored.tabId).toBe(5);
		expect(restored.interval).toBe(120);
		expect(restored.count).toBe(10);
		expect(restored.randomize).toBe(true);
	});

	test("should preserve all fields for PAUSED state", () => {
		const original = {
			state: "PAUSED" as const,
			tabId: 5,
			interval: 120,
			count: 10,
			remaining: 45,
			randomize: false,
		};
		const storage = toStorageState(original, 60);
		const restored = fromStorage(storage, 5);
		expect(restored.state).toBe("PAUSED");
		expect(restored.remaining).toBe(45);
	});
});

describe("global vs per-tab randomize", () => {
	test("fromStorage should use per-tab randomize over global", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: {
				5: { interval: 120, count: 0, paused: false, remaining: null, randomize: true },
			},
			defaultInterval: 60,
			randomize: false, // global says false
		};
		const status = fromStorage(data, 5);
		expect(status.randomize).toBe(true); // per-tab wins
	});

	test("unrelated tab should not affect current tab's state", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: {
				3: { interval: 999, count: 99, paused: true, remaining: 10, randomize: true },
				5: { interval: 120, count: 10, paused: false, remaining: null, randomize: false },
			},
			defaultInterval: 60,
		};
		const status = fromStorage(data, 5);
		expect(status.interval).toBe(120);
		expect(status.count).toBe(10);
		expect(status.randomize).toBe(false);
	});
});

describe("getDefaultInterval", () => {
	test("should return stored default interval", () => {
		expect(getDefaultInterval({ defaultInterval: 300 })).toBe(300);
	});

	test("should return 60 as default", () => {
		expect(getDefaultInterval({})).toBe(60);
	});
});

describe("getTabCount", () => {
	test("should return count for specific tab", () => {
		const data: Partial<StorageState> = {
			tabStates: {
				1: { interval: 60, count: 5, paused: false, remaining: null, randomize: false },
			},
		};
		expect(getTabCount(data, 1)).toBe(5);
	});

	test("should return 0 if tab not found", () => {
		expect(getTabCount({}, 999)).toBe(0);
	});

	test("should return 0 if tabStates is undefined", () => {
		expect(getTabCount({}, 1)).toBe(0);
	});
});

describe("isTabActive", () => {
	test("should return true if tab is active and matches currentTabId", () => {
		expect(isTabActive({ active: true, currentTabId: 5 }, 5)).toBe(true);
	});

	test("should return false if tabId doesn't match", () => {
		expect(isTabActive({ active: true, currentTabId: 5 }, 10)).toBe(false);
	});

	test("should return false if not active", () => {
		expect(isTabActive({ active: false, currentTabId: 5 }, 5)).toBe(false);
	});
});

describe("isTabPaused", () => {
	test("should return true if tab is paused", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: { 5: { interval: 60, count: 0, paused: true, remaining: 30, randomize: false } },
		};
		expect(isTabPaused(data, 5)).toBe(true);
	});

	test("should return false if tab is active but not paused", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: {
				5: { interval: 60, count: 0, paused: false, remaining: null, randomize: false },
			},
		};
		expect(isTabPaused(data, 5)).toBe(false);
	});

	test("should return false if tab is not the current tab", () => {
		const data: Partial<StorageState> = {
			active: true,
			currentTabId: 5,
			tabStates: { 5: { interval: 60, count: 0, paused: true, remaining: 30, randomize: false } },
		};
		expect(isTabPaused(data, 10)).toBe(false);
	});
});

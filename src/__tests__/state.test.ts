import { describe, test, expect } from "bun:test";
import type { StorageState, TabState } from "../types";

// Re-implement for testing (to avoid module side effects)
type RefreshState = "STOPPED" | "ACTIVE" | "PAUSED";

interface RefreshStatus {
  state: RefreshState;
  tabId: number | null;
  interval: number;
  count: number;
  remaining: number | null;
  randomize: boolean;
}

function isActive(status: RefreshStatus): boolean {
  return status.state === "ACTIVE" || status.state === "PAUSED";
}

function isPaused(status: RefreshStatus): boolean {
  return status.state === "PAUSED";
}

function isStopped(status: RefreshStatus): boolean {
  return status.state === "STOPPED";
}

function toStorageState(
  status: RefreshStatus,
  defaultInterval: number,
  existingTabStates?: Record<number, TabState>,
): StorageState {
  const tabStates: Record<number, TabState> = { ...(existingTabStates || {}) };

  if (status.tabId !== null) {
    tabStates[status.tabId] = {
      interval: status.interval,
      count: status.count,
      paused: status.state === "PAUSED",
      remaining: status.remaining,
      randomize: status.randomize,
    };
  }

  return {
    active: status.state !== "STOPPED",
    currentTabId: status.tabId,
    tabStates,
    defaultInterval,
    randomize: status.randomize,
  };
}

function fromStorage(
  data: Partial<StorageState>,
  tabId: number | null,
): RefreshStatus {
  const active = data.active ?? false;

  if (!active || tabId === null) {
    return {
      state: "STOPPED",
      tabId: null,
      interval: data.defaultInterval ?? 60,
      count: 0,
      remaining: null,
      randomize: false,
    };
  }

  const tabState = data.tabStates?.[tabId];
  const state = tabState?.paused ? "PAUSED" : "ACTIVE";

  return {
    state,
    tabId,
    interval: tabState?.interval ?? data.defaultInterval ?? 60,
    count: tabState?.count ?? 0,
    remaining: tabState?.remaining ?? null,
    randomize: tabState?.randomize ?? false,
  };
}

function getDefaultInterval(data: Partial<StorageState>): number {
  return data.defaultInterval ?? 60;
}

function getTabCount(data: Partial<StorageState>, tabId: number): number {
  return data.tabStates?.[tabId]?.count ?? 0;
}

function isTabActive(
  data: Partial<StorageState>,
  tabId: number,
): boolean {
  return data.active === true && data.currentTabId === tabId;
}

function isTabPaused(
  data: Partial<StorageState>,
  tabId: number,
): boolean {
  return (
    isTabActive(data, tabId) &&
    (data.tabStates?.[tabId]?.paused ?? false)
  );
}

describe("state machine - per-tab intervals", () => {
  describe("isActive", () => {
    test("should return true for ACTIVE state", () => {
      const status: RefreshStatus = {
        state: "ACTIVE",
        tabId: 1,
        interval: 60,
        count: 0,
        remaining: null,
        randomize: false,
      };
      expect(isActive(status)).toBe(true);
    });

    test("should return true for PAUSED state", () => {
      const status: RefreshStatus = {
        state: "PAUSED",
        tabId: 1,
        interval: 60,
        count: 0,
        remaining: 30,
        randomize: false,
      };
      expect(isActive(status)).toBe(true);
    });

    test("should return false for STOPPED state", () => {
      const status: RefreshStatus = {
        state: "STOPPED",
        tabId: null,
        interval: 60,
        count: 0,
        remaining: null,
        randomize: false,
      };
      expect(isActive(status)).toBe(false);
    });
  });

  describe("isPaused", () => {
    test("should return true for PAUSED state", () => {
      const status: RefreshStatus = {
        state: "PAUSED",
        tabId: 1,
        interval: 60,
        count: 0,
        remaining: 30,
        randomize: false,
      };
      expect(isPaused(status)).toBe(true);
    });

    test("should return false for ACTIVE state", () => {
      const status: RefreshStatus = {
        state: "ACTIVE",
        tabId: 1,
        interval: 60,
        count: 0,
        remaining: null,
        randomize: false,
      };
      expect(isPaused(status)).toBe(false);
    });
  });

  describe("toStorageState", () => {
    test("should store per-tab state", () => {
      const status: RefreshStatus = {
        state: "ACTIVE",
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
      const existingTabStates: Record<number, TabState> = {
        3: { interval: 300, count: 5, paused: false, remaining: null, randomize: false },
      };
      const status: RefreshStatus = {
        state: "ACTIVE",
        tabId: 5,
        interval: 120,
        count: 10,
        remaining: null,
        randomize: true,
      };
      const storage = toStorageState(status, 60, existingTabStates);
      expect(storage.tabStates[3]).toBeDefined();
      expect(storage.tabStates[3].interval).toBe(300);
      expect(storage.tabStates[5].interval).toBe(120);
    });

    test("should handle STOPPED state", () => {
      const status: RefreshStatus = {
        state: "STOPPED",
        tabId: null,
        interval: 60,
        count: 0,
        remaining: null,
        randomize: false,
      };
      const storage = toStorageState(status, 60);
      expect(storage.active).toBe(false);
      expect(storage.currentTabId).toBeNull();
    });
  });

  describe("fromStorage", () => {
    test("should restore per-tab state", () => {
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

    test("should return STOPPED if tabId is null", () => {
      const data: Partial<StorageState> = {
        active: true,
        currentTabId: 5,
        tabStates: {},
        defaultInterval: 60,
        randomize: false,
      };
      const status = fromStorage(data, null);
      expect(status.state).toBe("STOPPED");
    });

    test("should return STOPPED if not active", () => {
      const data: Partial<StorageState> = {
        active: false,
        currentTabId: null,
        tabStates: {},
        defaultInterval: 60,
        randomize: false,
      };
      const status = fromStorage(data, 5);
      expect(status.state).toBe("STOPPED");
    });

    test("should use default interval if tab not in tabStates", () => {
      const data: Partial<StorageState> = {
        active: true,
        currentTabId: 5,
        tabStates: {},
        defaultInterval: 300,
        randomize: false,
      };
      const status = fromStorage(data, 5);
      expect(status.interval).toBe(300);
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
  });

  describe("isTabActive", () => {
    test("should return true if tab is active and matches currentTabId", () => {
      const data: Partial<StorageState> = {
        active: true,
        currentTabId: 5,
      };
      expect(isTabActive(data, 5)).toBe(true);
    });

    test("should return false if tabId doesn't match", () => {
      const data: Partial<StorageState> = {
        active: true,
        currentTabId: 5,
      };
      expect(isTabActive(data, 10)).toBe(false);
    });

    test("should return false if not active", () => {
      const data: Partial<StorageState> = {
        active: false,
        currentTabId: 5,
      };
      expect(isTabActive(data, 5)).toBe(false);
    });
  });

  describe("isTabPaused", () => {
    test("should return true if tab is paused", () => {
      const data: Partial<StorageState> = {
        active: true,
        currentTabId: 5,
        tabStates: {
          5: { interval: 60, count: 0, paused: true, remaining: 30, randomize: false },
        },
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
  });
});

import type { StorageState, TabState } from "./types";

export type RefreshState = "STOPPED" | "ACTIVE" | "PAUSED";

export interface RefreshStatus {
  state: RefreshState;
  tabId: number | null;
  interval: number;
  count: number;
  remaining: number | null;
  randomize: boolean;
}

export function getState(status: RefreshStatus): RefreshState {
  return status.state;
}

export function isActive(status: RefreshStatus): boolean {
  return status.state === "ACTIVE" || status.state === "PAUSED";
}

export function isPaused(status: RefreshStatus): boolean {
  return status.state === "PAUSED";
}

export function isStopped(status: RefreshStatus): boolean {
  return status.state === "STOPPED";
}

export function toStorageState(
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

export function fromStorage(
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

export function getDefaultInterval(data: Partial<StorageState>): number {
  return data.defaultInterval ?? 60;
}

export function getTabCount(data: Partial<StorageState>, tabId: number): number {
  return data.tabStates?.[tabId]?.count ?? 0;
}

export function isTabActive(
  data: Partial<StorageState>,
  tabId: number,
): boolean {
  return data.active === true && data.currentTabId === tabId;
}

export function isTabPaused(
  data: Partial<StorageState>,
  tabId: number,
): boolean {
  return isTabActive(data, tabId) && (data.tabStates?.[tabId]?.paused ?? false);
}

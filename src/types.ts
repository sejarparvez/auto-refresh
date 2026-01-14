export type Message =
	| {
			action: "start";
			interval: number;
			tabId: number;
			randomize?: boolean;
			maxRefreshes?: number | null;
			bypassCache?: boolean;
	  }
	| { action: "stop"; tabId: number }
	| { action: "pause"; tabId: number }
	| { action: "resume"; tabId: number }
	| { action: "resetCount"; tabId: number };

export interface TabState {
	interval: number;
	count: number;
	paused: boolean;
	remaining: number | null;
	randomize: boolean;
	actualInterval?: number;
	url?: string | null;
	maxRefreshes?: number | null;
	bypassCache?: boolean;
}

export interface StorageState {
	active: boolean;
	currentTabId: number | null;
	tabStates: Record<number, TabState>;
	defaultInterval: number;
	randomize: boolean;
}

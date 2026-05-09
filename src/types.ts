export type Message =
	| { action: "start"; interval: number; tabId: number; randomize?: boolean }
	| { action: "stop"; tabId: number }
	| { action: "pause"; tabId: number }
	| { action: "resume"; tabId: number };

export interface TabState {
	interval: number;
	count: number;
	paused: boolean;
	remaining: number | null;
	randomize: boolean;
	actualInterval?: number;
}

export interface StorageState {
	active: boolean;
	currentTabId: number | null;
	tabStates: Record<number, TabState>;
	defaultInterval: number;
	randomize: boolean;
}

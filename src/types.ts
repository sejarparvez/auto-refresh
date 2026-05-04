export type Message =
	| { action: "start"; interval: number; tabId: number }
	| { action: "stop" }
	| { action: "pause" }
	| { action: "resume" };

export interface TabState {
	interval: number;
	count: number;
	paused: boolean;
	remaining: number | null;
	randomize: boolean;
}

export interface StorageState {
	active: boolean;
	currentTabId: number | null;
	tabStates: Record<number, TabState>;
	defaultInterval: number;
	randomize: boolean;
}

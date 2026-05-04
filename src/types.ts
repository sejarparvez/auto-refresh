export type Message =
	| { action: "start"; interval: number; tabId: number }
	| { action: "stop" }
	| { action: "pause" }
	| { action: "resume" };

export interface StorageState {
	interval: number;
	active: boolean;
	paused: boolean;
	tabId: number | null;
	count: number;
	remaining: number | null;
	randomize: boolean;
}

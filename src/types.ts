export type Message =
	| { action: "start"; interval: number; tabId: number }
	| { action: "stop" };

export interface StorageState {
	interval: number;
	active: boolean;
	tabId: number | null;
	count: number;
}

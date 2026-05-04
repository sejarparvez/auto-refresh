const DEBUG = false;

export function log(...args: unknown[]): void {
	if (DEBUG) console.log("[AutoRefresh]", ...args);
}

export function warn(...args: unknown[]): void {
	if (DEBUG) console.warn("[AutoRefresh]", ...args);
}

export function error(...args: unknown[]): void {
	if (DEBUG) console.error("[AutoRefresh]", ...args);
}

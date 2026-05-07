let DEBUG = false;

export async function initLogger(): Promise<void> {
	try {
		const data = await browser.storage.local.get("debug");
		DEBUG = data.debug === true;
	} catch {
		DEBUG = false;
	}
	try {
		browser.storage.onChanged.addListener((changes) => {
			if (changes.debug !== undefined) {
				DEBUG = changes.debug.newValue === true;
			}
		});
	} catch {
		// storage.onChanged not available in all contexts
	}
}

export function setDebug(enabled: boolean): void {
	DEBUG = enabled;
}

export function log(...args: unknown[]): void {
	if (DEBUG) console.log("[AutoRefresh]", ...args);
}

export function warn(...args: unknown[]): void {
	if (DEBUG) console.warn("[AutoRefresh]", ...args);
}

export function error(...args: unknown[]): void {
	if (DEBUG) console.error("[AutoRefresh]", ...args);
}

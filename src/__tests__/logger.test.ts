import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

// Track storage listener
let onChangedCallback: ((changes: Record<string, { newValue?: unknown }>) => void) | null = null;
// Hold spy refs for cleanup
let logSpy: ReturnType<typeof spyOn> | null = null;
let warnSpy: ReturnType<typeof spyOn> | null = null;

// Mock browser before importing logger
// @ts-ignore
globalThis.browser = {
	storage: {
		local: {
			get: mock(async () => {
				return { debug: false };
			}),
		},
		onChanged: {
			addListener: mock((cb: typeof onChangedCallback) => {
				onChangedCallback = cb;
			}),
		},
	},
};

const { initLogger, log, warn } = await import("../logger");

describe("initLogger", () => {
	beforeEach(() => {
		(browser.storage.local.get as ReturnType<typeof mock>).mockClear();
		(browser.storage.onChanged.addListener as ReturnType<typeof mock>).mockClear();
		onChangedCallback = null;
	});

	test("calls storage.local.get with 'debug'", async () => {
		await initLogger();
		expect(browser.storage.local.get).toHaveBeenCalledWith("debug");
	});

	test("registers onChanged listener", async () => {
		await initLogger();
		expect(browser.storage.onChanged.addListener).toHaveBeenCalled();
	});
});

describe("log", () => {
	beforeEach(() => {
		logSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy?.mockRestore();
	});

	test("does not call console.log when DEBUG is false", async () => {
		(browser.storage.local.get as ReturnType<typeof mock>).mockResolvedValue({ debug: false });
		await initLogger();
		log("test");
		expect(console.log).not.toHaveBeenCalled();
	});

	test("calls console.log when DEBUG is true", async () => {
		(browser.storage.local.get as ReturnType<typeof mock>).mockResolvedValue({ debug: true });
		await initLogger();
		log("test message");
		expect(console.log).toHaveBeenCalledWith("[AutoRefresh]", "test message");
	});
});

describe("warn", () => {
	beforeEach(() => {
		warnSpy = spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy?.mockRestore();
	});

	test("does not call console.warn when DEBUG is false", async () => {
		(browser.storage.local.get as ReturnType<typeof mock>).mockResolvedValue({ debug: false });
		await initLogger();
		warn("test");
		expect(console.warn).not.toHaveBeenCalled();
	});

	test("calls console.warn when DEBUG is true", async () => {
		(browser.storage.local.get as ReturnType<typeof mock>).mockResolvedValue({ debug: true });
		await initLogger();
		warn("test warning");
		expect(console.warn).toHaveBeenCalledWith("[AutoRefresh]", "test warning");
	});
});

import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockAlarms = {
	clear: mock(() => Promise.resolve()),
	clearAll: mock(() => Promise.resolve()),
	create: mock(() => Promise.resolve()),
	get: mock(() => Promise.resolve(null)),
	getAll: mock(() => Promise.resolve([])),
	onAlarm: { addListener: mock() },
};

const mockStorage = {
	local: {
		get: mock(() => Promise.resolve({})),
		set: mock(() => Promise.resolve()),
	},
};

const mockAction = {
	setBadgeText: mock(() => Promise.resolve()),
	setBadgeBackgroundColor: mock(() => Promise.resolve()),
};

const mockTabs = {
	reload: mock(() => Promise.resolve()),
	sendMessage: mock(() => Promise.resolve()),
};

const mockRuntime = {
	onStartup: { addListener: mock() },
	onMessage: { addListener: mock() },
};

function setupBrowserMock() {
	globalThis.browser = {
		alarms: mockAlarms,
		storage: mockStorage,
		action: mockAction,
		tabs: mockTabs,
		runtime: mockRuntime,
	};
}

function clearAllMocks() {
	for (const m of [
		mockAlarms.clear,
		mockAlarms.clearAll,
		mockAlarms.create,
		mockAlarms.get,
		mockAlarms.getAll,
		mockStorage.local.get,
		mockStorage.local.set,
		mockAction.setBadgeText,
		mockAction.setBadgeBackgroundColor,
		mockTabs.reload,
		mockTabs.sendMessage,
	]) {
		m.mockClear();
	}
	mockTabs.reload.mockImplementation(() => Promise.resolve());
}

beforeEach(() => {
	setupBrowserMock();
	clearAllMocks();
});

async function flush(): Promise<void> {
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
}

// -------------------------------------------------------------------------
// isMessage
// -------------------------------------------------------------------------
describe("isMessage", () => {
	test("valid start message", async () => {
		const { isMessage } = await import("../background");
		expect(isMessage({ action: "start", interval: 60, tabId: 1 })).toBe(true);
	});

	test("valid stop message with tabId", async () => {
		const { isMessage } = await import("../background");
		expect(isMessage({ action: "stop", tabId: 5 })).toBe(true);
	});

	test("valid pause message with tabId", async () => {
		const { isMessage } = await import("../background");
		expect(isMessage({ action: "pause", tabId: 5 })).toBe(true);
	});

	test("valid resume message with tabId", async () => {
		const { isMessage } = await import("../background");
		expect(isMessage({ action: "resume", tabId: 5 })).toBe(true);
	});

	test("null/undefined/primitives", async () => {
		const { isMessage } = await import("../background");
		expect(isMessage(null)).toBe(false);
		expect(isMessage(undefined)).toBe(false);
		expect(isMessage("string")).toBe(false);
		expect(isMessage(123)).toBe(false);
	});

	test("empty object or missing action key", async () => {
		const { isMessage } = await import("../background");
		expect(isMessage({})).toBe(false);
		expect(isMessage({ type: "start" })).toBe(false);
	});
});

// -------------------------------------------------------------------------
// jitteredInterval
// -------------------------------------------------------------------------
describe("jitteredInterval", () => {
	test("within ±30% of base", async () => {
		const { jitteredInterval } = await import("../background");
		let min = Number.POSITIVE_INFINITY;
		let max = Number.NEGATIVE_INFINITY;
		for (let i = 0; i < 1000; i++) {
			const r = jitteredInterval(600);
			min = Math.min(min, r);
			max = Math.max(max, r);
		}
		expect(min).toBeGreaterThanOrEqual(420);
		expect(max).toBeLessThanOrEqual(780);
	});

	test("produces varying results", async () => {
		const { jitteredInterval } = await import("../background");
		const s = new Set<number>();
		for (let i = 0; i < 100; i++) s.add(jitteredInterval(600));
		expect(s.size).toBeGreaterThan(1);
	});

	test("handles 60s interval", async () => {
		const { jitteredInterval } = await import("../background");
		const r = jitteredInterval(60);
		expect(r).toBeGreaterThanOrEqual(60);
		expect(r).toBeLessThanOrEqual(78);
	});

	test("returns integer", async () => {
		const { jitteredInterval } = await import("../background");
		for (let i = 0; i < 100; i++) {
			expect(Number.isInteger(jitteredInterval(600))).toBe(true);
		}
	});
});

// -------------------------------------------------------------------------
// handleMessage — start
// -------------------------------------------------------------------------
describe("handleMessage — start", () => {
	test("clamps to 60s", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			randomize: false,
			tabStates: {},
			defaultInterval: 60,
		});
		handleMessage({ action: "start", interval: 30, tabId: 1 });
		await flush();
		expect(mockAlarms.create).toHaveBeenCalledWith("autoRefresh-1", { periodInMinutes: 1 });
		expect(mockAction.setBadgeText).toHaveBeenCalledWith({ text: "ON", tabId: 1 });
	});

	test("preserves interval >= 60", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			randomize: false,
			tabStates: {},
			defaultInterval: 60,
		});
		handleMessage({ action: "start", interval: 120, tabId: 1 });
		await flush();
		expect(mockAlarms.create).toHaveBeenCalledWith("autoRefresh-1", { periodInMinutes: 2 });
	});

	test("saves state to storage", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			randomize: false,
			tabStates: {},
			defaultInterval: 60,
		});
		handleMessage({ action: "start", interval: 120, tabId: 5 });
		await flush();
		const call = mockStorage.local.set.mock.calls[0][0];
		expect(call.active).toBe(true);
		expect(call.currentTabId).toBe(5);
	});

	test("notifies content script", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			randomize: false,
			tabStates: {},
			defaultInterval: 60,
		});
		handleMessage({ action: "start", interval: 120, tabId: 1 });
		await flush();
		expect(mockTabs.sendMessage).toHaveBeenCalledWith(1, { showCountdown: 120 });
	});

	test("uses jittered interval when randomize is on", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			randomize: true,
			tabStates: {},
			defaultInterval: 60,
		});
		handleMessage({ action: "start", interval: 600, tabId: 1 });
		await flush();
		const [name, opts] = mockAlarms.create.mock.calls[0];
		expect(name).toBe("autoRefresh-1");
		expect(opts.delayInMinutes).toBeGreaterThanOrEqual(7);
		expect(opts.delayInMinutes).toBeLessThanOrEqual(13);
	});

	test("ignores non-valid messages", async () => {
		const { handleMessage } = await import("../background");
		handleMessage({ type: "start" });
		await flush();
		expect(mockStorage.local.set).not.toHaveBeenCalled();
	});
});

// -------------------------------------------------------------------------
// handleMessage — stop
// -------------------------------------------------------------------------
describe("handleMessage — stop", () => {
	test("clears alarm and badge", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({ tabStates: {}, defaultInterval: 60 });
		handleMessage({ action: "stop", tabId: 5 });
		await flush();
		expect(mockAlarms.clear).toHaveBeenCalledWith("autoRefresh-5");
		expect(mockAction.setBadgeText).toHaveBeenCalledWith({ text: "", tabId: 5 });
	});

	test("marks state inactive when last tab", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({ tabStates: {}, defaultInterval: 60 });
		handleMessage({ action: "stop", tabId: 5 });
		await flush();
		const call = mockStorage.local.set.mock.calls[0][0];
		expect(call.active).toBe(false);
	});

	test("hides countdown", async () => {
		const { handleMessage } = await import("../background");
		mockStorage.local.get.mockResolvedValue({ tabStates: {}, defaultInterval: 60 });
		handleMessage({ action: "stop", tabId: 5 });
		await flush();
		expect(mockTabs.sendMessage).toHaveBeenCalledWith(5, { hideCountdown: true });
	});
});

// -------------------------------------------------------------------------
// handleAlarm
// -------------------------------------------------------------------------
describe("handleAlarm", () => {
	test("reloads tab and increments count", async () => {
		const { handleAlarm } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			tabStates: {
				5: { interval: 120, count: 5, paused: false, remaining: null, randomize: false },
			},
			defaultInterval: 60,
		});
		handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 2 });
		await flush();
		expect(mockTabs.reload).toHaveBeenCalledWith(5);
	});

	test("ignores non-autoRefresh alarms", async () => {
		const { handleAlarm } = await import("../background");
		handleAlarm({ name: "otherAlarm", scheduledTime: Date.now(), periodInMinutes: 1 });
		await flush();
		expect(mockTabs.reload).not.toHaveBeenCalled();
	});

	test("handles tab closed gracefully", async () => {
		const { handleAlarm } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			tabStates: {
				5: { interval: 120, count: 5, paused: false, remaining: null, randomize: false },
			},
			defaultInterval: 60,
		});
		mockTabs.reload.mockRejectedValue(new Error("Tab closed"));
		handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 2 });
		await flush();
		expect(mockAlarms.clear).toHaveBeenCalledWith("autoRefresh-5");
	});

	test("skips reload if no tab state", async () => {
		const { handleAlarm } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			tabStates: {},
			defaultInterval: 60,
		});
		handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 2 });
		await flush();
		expect(mockTabs.reload).not.toHaveBeenCalled();
	});
});

// -------------------------------------------------------------------------
// handleAlarm — randomize integration
// -------------------------------------------------------------------------
describe("handleAlarm — randomize integration", () => {
	test("applies jitter when randomize is on", async () => {
		const { handleAlarm } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			tabStates: {
				5: { interval: 600, count: 5, paused: false, remaining: null, randomize: true },
			},
			defaultInterval: 60,
		});
		handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 10 });
		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1));
		}
		expect(mockAlarms.clear).toHaveBeenCalledWith("autoRefresh-5");
		expect(mockAlarms.create).toHaveBeenCalled();
		const [name, opts] = mockAlarms.create.mock.calls[0];
		expect(name).toBe("autoRefresh-5");
		expect(opts.delayInMinutes).toBeGreaterThanOrEqual(7);
		expect(opts.delayInMinutes).toBeLessThanOrEqual(13);
	});

	test("does NOT re-create alarm when randomize is off", async () => {
		const { handleAlarm } = await import("../background");
		mockStorage.local.get.mockResolvedValue({
			tabStates: {
				5: { interval: 600, count: 5, paused: false, remaining: null, randomize: false },
			},
			defaultInterval: 60,
		});
		handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 10 });
		await flush();
		expect(mockAlarms.create).not.toHaveBeenCalled();
	});
});

// -------------------------------------------------------------------------
// handleStartup
// -------------------------------------------------------------------------
describe("handleStartup", () => {
	test("clears autoRefresh alarms and resets state", async () => {
		mockAlarms.getAll.mockResolvedValue([
			{ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 2 },
			{ name: "autoRefresh-3", scheduledTime: Date.now(), periodInMinutes: 5 },
			{ name: "otherAlarm", scheduledTime: Date.now(), periodInMinutes: 1 },
		]);
		const { handleStartup } = await import("../background");
		await handleStartup();
		expect(mockAlarms.clear).toHaveBeenCalledTimes(2);
		expect(mockAlarms.clear).toHaveBeenCalledWith("autoRefresh-5");
		expect(mockAlarms.clear).toHaveBeenCalledWith("autoRefresh-3");
		expect(mockAlarms.clearAll).not.toHaveBeenCalled();
		expect(mockStorage.local.set).toHaveBeenCalledWith({ active: false });
	});
});

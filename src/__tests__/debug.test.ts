import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockAlarms = {
	clear: mock(() => Promise.resolve()),
	clearAll: mock(() => Promise.resolve()),
	create: mock(() => Promise.resolve()),
	get: mock(() => Promise.resolve(null)),
	onAlarm: { addListener: mock() },
};

const mockStorage = { local: { get: mock(() => Promise.resolve({})), set: mock(() => Promise.resolve()) } };
const mockAction = { setBadgeText: mock(() => Promise.resolve()), setBadgeBackgroundColor: mock(() => Promise.resolve()) };
const mockTabs = { reload: mock(() => Promise.resolve()), sendMessage: mock(() => Promise.resolve()) };
const mockRuntime = { onStartup: { addListener: mock() }, onMessage: { addListener: mock() } };

function clearAllMocks() {
	for (const m of [mockAlarms.clear, mockAlarms.clearAll, mockAlarms.create, mockAlarms.get,
		mockStorage.local.get, mockStorage.local.set,
		mockAction.setBadgeText, mockAction.setBadgeBackgroundColor,
		mockTabs.reload, mockTabs.sendMessage]) m.mockClear();
}

beforeEach(() => {
	globalThis.browser = { alarms: mockAlarms, storage: mockStorage, action: mockAction, tabs: mockTabs, runtime: mockRuntime };
	clearAllMocks();
});

// Run a handleAlarm false first (like the real test order)
test("handleAlarm false", async () => {
	const bg = await import("../background");
	mockStorage.local.get.mockResolvedValue({
		currentTabId: 5,
		tabStates: { 5: { interval: 120, count: 5, paused: false, remaining: null, randomize: false } },
		defaultInterval: 60, randomize: false,
	});
	await bg.handleAlarm({ name: "autoRefresh", scheduledTime: Date.now(), periodInMinutes: 2 });
});

test("handleAlarm true", async () => {
	const bg = await import("../background");
	mockStorage.local.get.mockResolvedValue({
		currentTabId: 5,
		tabStates: { 5: { interval: 600, count: 5, paused: false, remaining: null, randomize: true } },
		defaultInterval: 60, randomize: true,
	});
	bg.handleAlarm({ name: "autoRefresh", scheduledTime: Date.now(), periodInMinutes: 10 });
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
	expect(mockAlarms.create).toHaveBeenCalled();
});

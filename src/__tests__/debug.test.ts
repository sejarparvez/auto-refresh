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
	local: { get: mock(() => Promise.resolve({})), set: mock(() => Promise.resolve()) },
};
const mockAction = {
	setBadgeText: mock(() => Promise.resolve()),
	setBadgeBackgroundColor: mock(() => Promise.resolve()),
};
const mockTabs = {
	reload: mock(() => Promise.resolve()),
	sendMessage: mock(() => Promise.resolve()),
};
const mockRuntime = { onStartup: { addListener: mock() }, onMessage: { addListener: mock() } };
const mockCommands = { onCommand: { addListener: mock() } };

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
	])
		m.mockClear();
}

beforeEach(() => {
	globalThis.browser = {
		alarms: mockAlarms,
		storage: mockStorage,
		action: mockAction,
		tabs: mockTabs,
		runtime: mockRuntime,
		commands: mockCommands,
	};
	clearAllMocks();
});

test("handleAlarm false", async () => {
	const bg = await import("../background");
	mockStorage.local.get.mockResolvedValue({
		tabStates: { 5: { interval: 120, count: 5, paused: false, remaining: null, randomize: false } },
		defaultInterval: 60,
	});
	await bg.handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 2 });
});

test("handleAlarm true", async () => {
	const bg = await import("../background");
	mockStorage.local.get.mockResolvedValue({
		tabStates: { 5: { interval: 600, count: 5, paused: false, remaining: null, randomize: true } },
		defaultInterval: 60,
	});
	bg.handleAlarm({ name: "autoRefresh-5", scheduledTime: Date.now(), periodInMinutes: 10 });
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
	expect(mockAlarms.create).toHaveBeenCalled();
});

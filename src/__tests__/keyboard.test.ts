import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

function setupBrowser(overrides: Record<string, unknown> = {}) {
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
			get: mock(async () => ({
				tabStates: {},
				defaultInterval: 60,
				randomize: false,
				active: true,
				...overrides,
			})),
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
		get: mock(() => Promise.resolve({ id: 1, url: "https://example.com" })),
		query: mock(async () => [{ id: 1, url: "https://example.com" }]),
		onUpdated: { addListener: mock() },
	};
	const mockRuntime = {
		onStartup: { addListener: mock() },
		onInstalled: { addListener: mock() },
		onMessage: { addListener: mock() },
	};
	const mockCommands = { onCommand: { addListener: mock() } };

	globalThis.browser = {
		alarms: mockAlarms,
		storage: mockStorage,
		action: mockAction,
		tabs: mockTabs,
		runtime: mockRuntime,
		commands: mockCommands,
	};

	return { mockAlarms, mockStorage, mockAction, mockTabs, mockRuntime, mockCommands };
}

let handleToggleCommand: (command: string) => void;

beforeEach(async () => {
	setupBrowser();
	// Need fresh import each time — bust cache with query param
	const mod = await import(`../background?${Date.now()}`);
	handleToggleCommand = mod.handleToggleCommand;
});

describe("keyboard shortcut", () => {
	test("toggle-refresh triggers start on inactive tab", async () => {
		setupBrowser({ active: false });
		const mod = await import(`../background?${Date.now()}`);
		mod.handleToggleCommand("toggle-refresh");

		for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
		// biome-ignore lint/suspicious/noExplicitAny: <browser mock type is implicit>
		expect((globalThis.browser as any).tabs.query).toHaveBeenCalledWith({
			active: true,
			currentWindow: true,
		});
	});

	test("toggle-refresh triggers stop on active tab", async () => {
		setupBrowser({ active: true });
		const mod = await import(`../background?${Date.now()}`);
		mod.handleToggleCommand("toggle-refresh");

		for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
		// biome-ignore lint/suspicious/noExplicitAny: <browser mock type is implicit>
		expect((globalThis.browser as any).tabs.query).toHaveBeenCalledWith({
			active: true,
			currentWindow: true,
		});
	});

	test("ignores unknown commands", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: <browser mock type is implicit>
		const browser2 = globalThis.browser as any;
		browser2.tabs.query.mockClear();
		browser2.storage.local.get.mockClear();

		handleToggleCommand("some-other-command");

		for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
		expect(browser2.tabs.query).not.toHaveBeenCalled();
	});

	test("ignores toggle on restricted url", async () => {
		setupBrowser({ active: false });
		// biome-ignore lint/suspicious/noExplicitAny: <browser mock type is implicit>
		const browser2 = globalThis.browser as any;
		browser2.tabs.query.mockResolvedValue([{ id: 1, url: "about:blank" }]);

		const mod = await import(`../background?${Date.now()}`);
		mod.handleToggleCommand("toggle-refresh");

		for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 1));
		expect(browser2.tabs.query).toHaveBeenCalled();
	});
});

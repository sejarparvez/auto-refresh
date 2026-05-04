import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// We need to test the logger module
// Since DEBUG is false by default, we test that it doesn't throw

describe("logger", () => {
	test("should export log function", () => {
		const { log } = require("../../src/logger");
		expect(typeof log).toBe("function");
	});

	test("should export warn function", () => {
		const { warn } = require("../../src/logger");
		expect(typeof warn).toBe("function");
	});

	test("should export error function", () => {
		const { error } = require("../../src/logger");
		expect(typeof error).toBe("function");
	});

	test("should not throw when calling log with DEBUG=false", () => {
		const { log } = require("../../src/logger");
		expect(() => log("test message")).not.toThrow();
	});

	test("should not throw when calling warn with DEBUG=false", () => {
		const { warn } = require("../../src/logger");
		expect(() => warn("test warning")).not.toThrow();
	});

	test("should not throw when calling error with DEBUG=false", () => {
		const { error } = require("../../src/logger");
		expect(() => error("test error")).not.toThrow();
	});
});

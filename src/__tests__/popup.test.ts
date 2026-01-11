import { describe, expect, test } from "bun:test";
import {
	CIRC,
	MIN_INTERVAL,
	computeRingOffset,
	formatInterval,
	formatRemaining,
	snapInterval,
	truncateTitle,
} from "../utils";

describe("truncateTitle", () => {
	test("returns full title if under maxLength", () => {
		expect(truncateTitle("Hello World")).toBe("Hello World");
	});

	test("truncates title at maxLength and adds ellipsis", () => {
		const longTitle = "A".repeat(50);
		expect(truncateTitle(longTitle)).toBe(`${"A".repeat(30)}...`);
		expect(truncateTitle(longTitle).length).toBe(33);
	});

	test("uses default maxLength of 30", () => {
		const longTitle = "B".repeat(100);
		expect(truncateTitle(longTitle).length).toBe(33);
	});

	test("accepts custom maxLength", () => {
		const longTitle = "C".repeat(100);
		expect(truncateTitle(longTitle, 10)).toBe(`${"C".repeat(10)}...`);
		expect(truncateTitle(longTitle, 10).length).toBe(13);
	});

	test("handles empty string", () => {
		expect(truncateTitle("")).toBe("");
	});
});

describe("formatInterval", () => {
	test("formats seconds for intervals < 60", () => {
		expect(formatInterval(30)).toBe("30s");
		expect(formatInterval(1)).toBe("1s");
		expect(formatInterval(59)).toBe("59s");
	});

	test("formats minutes for intervals >= 60 and < 3600", () => {
		expect(formatInterval(60)).toBe("1m");
		expect(formatInterval(120)).toBe("2m");
		expect(formatInterval(300)).toBe("5m");
		expect(formatInterval(3540)).toBe("59m");
	});

	test("rounds minutes for non-exact minute intervals", () => {
		expect(formatInterval(90)).toBe("2m");
		expect(formatInterval(150)).toBe("3m");
		expect(formatInterval(119)).toBe("2m");
	});

	test("formats hours for intervals >= 3600", () => {
		expect(formatInterval(3600)).toBe("1h");
		expect(formatInterval(7200)).toBe("2h");
	});

	test("formats hours and minutes when remainder", () => {
		expect(formatInterval(3660)).toBe("1h 1m");
		expect(formatInterval(4500)).toBe("1h 15m");
		expect(formatInterval(7260)).toBe("2h 1m");
	});
});

describe("formatRemaining", () => {
	test("formats seconds for < 60", () => {
		expect(formatRemaining(30)).toBe("30s");
		expect(formatRemaining(1)).toBe("1s");
		expect(formatRemaining(59)).toBe("59s");
	});

	test("formats minutes and seconds for >= 60", () => {
		expect(formatRemaining(60)).toBe("1m 0s");
		expect(formatRemaining(61)).toBe("1m 1s");
		expect(formatRemaining(120)).toBe("2m 0s");
		expect(formatRemaining(3661)).toBe("61m 1s");
	});
});

describe("computeRingOffset", () => {
	test("returns 0.0 when rem equals total", () => {
		expect(computeRingOffset(60, 60)).toBe("0.0");
	});

	test("returns full circumference when remaining is 0", () => {
		const offset = computeRingOffset(0, 60);
		expect(Number.parseFloat(offset)).toBe(CIRC);
	});

	test("returns half circumference at 50%", () => {
		const offset = computeRingOffset(30, 60);
		expect(Number.parseFloat(offset)).toBeCloseTo(CIRC * 0.5, 1);
	});

	test("handles zero total", () => {
		const offset = computeRingOffset(0, 0);
		expect(Number.parseFloat(offset)).toBe(CIRC);
	});

	test("calculates correct offset for various values", () => {
		expect(Number.parseFloat(computeRingOffset(45, 60))).toBeCloseTo(CIRC * 0.25, 1);
		expect(Number.parseFloat(computeRingOffset(15, 60))).toBeCloseTo(CIRC * 0.75, 1);
	});

	test("clamps at 1.0 when rem > total", () => {
		expect(computeRingOffset(100, 60)).toBe("0.0");
	});
});

describe("snapInterval", () => {
	test("snaps to nearest 30s step", () => {
		expect(snapInterval(45)).toBe(MIN_INTERVAL);
		expect(snapInterval(75)).toBe(90);
		expect(snapInterval(90)).toBe(90);
		expect(snapInterval(105)).toBe(120);
	});

	test("clamps to MIN_INTERVAL", () => {
		expect(snapInterval(0)).toBe(MIN_INTERVAL);
		expect(snapInterval(30)).toBe(MIN_INTERVAL);
		expect(snapInterval(59)).toBe(MIN_INTERVAL);
	});

	test("clamps to MAX_INTERVAL", () => {
		expect(snapInterval(7200)).toBe(7200);
		expect(snapInterval(7210)).toBe(7200);
	});
});

describe("interval validation", () => {
	test("enforces minimum interval of 60 seconds", () => {
		expect(snapInterval(30)).toBe(MIN_INTERVAL);
		expect(snapInterval(0)).toBe(MIN_INTERVAL);
	});
});

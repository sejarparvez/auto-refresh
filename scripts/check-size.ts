/**
 * Size budget enforcement script.
 *
 * Builds production bundles and fails if any file exceeds its budget.
 *
 * Usage:  bun run scripts/check-size.ts
 *
 * Budgets (gzipped, since that's what matters for extension store download):
 *   background.js  ≤ 5 KB
 *   popup.js       ≤ 4 KB
 *   content.js     ≤ 2 KB
 *   total          ≤ 10 KB
 */

import { gzipSync } from "node:zlib";
import { readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";

interface Budget {
	file: string;
	maxGzip: number;
	maxRaw: number;
}

const BUDGETS: Budget[] = [
	{ file: "background.js", maxGzip: 5_000, maxRaw: 15_000 },
	{ file: "popup.js", maxGzip: 4_000, maxRaw: 15_000 },
	{ file: "content.js", maxGzip: 2_000, maxRaw: 10_000 },
];

const TOTAL_MAX_GZIP = 10_000;
const TOTAL_MAX_RAW = 35_000;

const OUTDIR = "./dist-check";

function fmt(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtDelta(actual: number, budget: number): string {
	const over = actual - budget;
	if (over <= 0) return "✅";
	return `❌  (over by ${fmt(over)})`;
}

async function main() {
	if (existsSync(OUTDIR)) rmSync(OUTDIR, { recursive: true });
	mkdirSync(OUTDIR, { recursive: true });

	const result = await Bun.build({
		entrypoints: ["./src/background.ts", "./src/popup.ts", "./src/content.ts"],
		outdir: OUTDIR,
		target: "browser",
		minify: true,
	});

	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error("Build failed");
	}

	let totalGzip = 0;
	let totalRaw = 0;
	let allPass = true;

	console.log("Size budget check (production build, gzipped):\n");

	for (const budget of BUDGETS) {
		const artifact = result.outputs.find((o) => o.path.endsWith(`/${budget.file}`));
		if (!artifact) {
			console.error(`  ${budget.file}: not found`);
			allPass = false;
			continue;
		}

		const raw = readFileSync(artifact.path).length;
		const gzip = gzipSync(readFileSync(artifact.path)).length;
		totalRaw += raw;
		totalGzip += gzip;

		const rawOk = raw <= budget.maxRaw ? "✅" : `❌  (${fmt(raw)} > ${fmt(budget.maxRaw)})`;
		const gzipOk = gzip <= budget.maxGzip
			? "✅"
			: `❌  (${fmt(gzip)} > ${fmt(budget.maxGzip)})`;

		const status = raw <= budget.maxRaw && gzip <= budget.maxGzip ? "✅" : "❌";
		if (status === "❌") allPass = false;

		console.log(
			`  ${budget.file.padEnd(20)} ` +
			`raw: ${fmt(raw).padStart(7)} / ${fmt(budget.maxRaw).padStart(7)}  ${rawOk}`,
		);
		console.log(
			`  ${"".padEnd(20)} ` +
			`gzip: ${fmt(gzip).padStart(6)} / ${fmt(budget.maxGzip).padStart(6)}  ${gzipOk}`,
		);
		console.log("");
	}

	// Totals
	const totalOk = totalRaw <= TOTAL_MAX_RAW && totalGzip <= TOTAL_MAX_GZIP;
	if (!totalOk) allPass = false;

	console.log("  " + "─".repeat(50));
	console.log(
		`  ${"Total".padEnd(20)} ` +
		`raw: ${fmt(totalRaw).padStart(7)} / ${fmt(TOTAL_MAX_RAW).padStart(7)}  ${totalRaw <= TOTAL_MAX_RAW ? "✅" : "❌"}`,
	);
	console.log(
		`  ${"".padEnd(20)} ` +
		`gzip: ${fmt(totalGzip).padStart(6)} / ${fmt(TOTAL_MAX_GZIP).padStart(6)}  ${totalGzip <= TOTAL_MAX_GZIP ? "✅" : "❌"}`,
	);
	console.log("");

	rmSync(OUTDIR, { recursive: true });

	if (!allPass) {
		console.error("❌ Size budget exceeded!");
		process.exit(1);
	}

	console.log("✅ All size budgets met.");
}

main().catch((err) => {
	console.error("Size check failed:", err);
	process.exit(1);
});

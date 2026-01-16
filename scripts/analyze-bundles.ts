import { gzipSync, brotliCompressSync } from "node:zlib";
import { readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";

const TMP_DIR = "./dist-analysis";
const ENTRYPOINTS = ["./src/background.ts", "./src/popup.ts", "./src/content.ts"] as const;

interface BundleInfo {
	name: string;
	devRaw: number;
	devGzip: number;
	devBrotli: number;
	prodRaw: number;
	prodGzip: number;
	prodBrotli: number;
	inlined: string;
}

function fmt(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtPct(pct: number): string {
	return `${(pct * 100).toFixed(1)}%`;
}

async function buildProd(entrypoints: readonly string[], outdir: string) {
	const result = await Bun.build({
		entrypoints,
		outdir,
		target: "browser",
		minify: true,
		sourcemap: undefined,
	});
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error("Prod build failed");
	}
	return result;
}

async function buildDev(entrypoints: readonly string[], outdir: string) {
	const result = await Bun.build({
		entrypoints,
		outdir,
		target: "browser",
		minify: false,
		sourcemap: "external",
	});
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error("Dev build failed");
	}
	return result;
}

function compressedSizes(filePath: string) {
	const raw = readFileSync(filePath);
	const gzip = gzipSync(raw).length;
	const brotli = brotliCompressSync(raw).length;
	return { raw: raw.length, gzip, brotli };
}

function moduleLabel(entry: string): string {
	return entry.replace("./src/", "").replace(".ts", ".js");
}

async function main() {
	// Clean and create temp dir
	if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
	mkdirSync(TMP_DIR, { recursive: true });

	// Source: count lines per module for reference
	const sourceFiles: Record<string, number> = {
		"background.ts": 536,
		"state.ts": 105,
		"logger.ts": 27,
		"types.ts": 34,
		"popup.ts": 558,
		"utils.ts": 45,
		"content.ts": 176,
	};

	const depGraph: Record<string, string[]> = {
		"background.js": ["background.ts (self)", "state.ts", "logger.ts", "types.ts (types)"],
		"popup.js": ["popup.ts (self)", "utils.ts", "types.ts (types)"],
		"content.js": ["content.ts (self)", "logger.ts", "types.ts (types)"],
	};

	// ── Build dev ────────────────────────────────────────────────────────────
	console.log("Building dev bundles...");
	const devDir = `${TMP_DIR}/dev`;
	mkdirSync(devDir, { recursive: true });
	const devResult = await buildDev(ENTRYPOINTS, devDir);

	// ── Build prod ───────────────────────────────────────────────────────────
	console.log("Building production bundles...");
	const prodDir = `${TMP_DIR}/prod`;
	mkdirSync(prodDir, { recursive: true });
	const prodResult = await buildProd(ENTRYPOINTS, prodDir);

	// ── Analyze each output ──────────────────────────────────────────────────
	const bundles: BundleInfo[] = [];

	for (const artifact of devResult.outputs) {
		const name = artifact.path.split("/").pop()!;
		if (!name.endsWith(".js")) continue; // skip sourcemaps

		const dev = compressedSizes(artifact.path);

		const prodArtifact = prodResult.outputs.find((a) => a.path.endsWith(`/${name}`));
		const prod = prodArtifact ? compressedSizes(prodArtifact.path) : { raw: 0, gzip: 0, brotli: 0 };

		bundles.push({
			name,
			devRaw: dev.raw,
			devGzip: dev.gzip,
			devBrotli: dev.brotli,
			prodRaw: prod.raw,
			prodGzip: prod.gzip,
			prodBrotli: prod.brotli,
			inlined: depGraph[name]?.join(", ") ?? "",
		});
	}

	// Sort: background, popup, content
	const sortOrder = ["background.js", "popup.js", "content.js"];
	bundles.sort((a, b) => sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name));

	// ── Print table ─────────────────────────────────────────────────────────
	console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("  Bundle Size Analysis");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("");
	console.log(
		`  ${"File".padEnd(20)} ${"Dev".padEnd(22)} ${"Prod".padEnd(22)} ${"Savings".padEnd(10)}`,
	);
	console.log(
		`  ${"".padEnd(20)} ${"Raw    Gzip   Br".padEnd(22)} ${"Raw    Gzip   Br".padEnd(22)} ${"(gzip)".padEnd(10)}`,
	);
	console.log("  " + "─".repeat(74));

	for (const b of bundles) {
		const savings = b.devGzip > 0 ? ((b.devGzip - b.prodGzip) / b.devGzip * 100).toFixed(1) : "-";
		console.log(
			`  ${b.name.padEnd(20)} ` +
			`${fmt(b.devRaw).padStart(6)} ${fmt(b.devGzip).padStart(6)} ${fmt(b.devBrotli).padStart(5)} ` +
			`${fmt(b.prodRaw).padStart(6)} ${fmt(b.prodGzip).padStart(6)} ${fmt(b.prodBrotli).padStart(5)} ` +
			`${savings !== "-" ? `${savings}%` : "-".padStart(5)}`,
		);
	}

	const totals = bundles.reduce(
		(acc, b) => ({
			devRaw: acc.devRaw + b.devRaw,
			devGzip: acc.devGzip + b.devGzip,
			devBrotli: acc.devBrotli + b.devBrotli,
			prodRaw: acc.prodRaw + b.prodRaw,
			prodGzip: acc.prodGzip + b.prodGzip,
			prodBrotli: acc.prodBrotli + b.prodBrotli,
		}),
		{ devRaw: 0, devGzip: 0, devBrotli: 0, prodRaw: 0, prodGzip: 0, prodBrotli: 0 },
	);

	const totalSavings = totals.devGzip > 0
		? ((totals.devGzip - totals.prodGzip) / totals.devGzip * 100).toFixed(1)
		: "-";

	console.log("  " + "─".repeat(74));
	console.log(
		`  ${"Total".padEnd(20)} ` +
		`${fmt(totals.devRaw).padStart(6)} ${fmt(totals.devGzip).padStart(6)} ${fmt(totals.devBrotli).padStart(5)} ` +
		`${fmt(totals.prodRaw).padStart(6)} ${fmt(totals.prodGzip).padStart(6)} ${fmt(totals.prodBrotli).padStart(5)} ` +
		`${totalSavings !== "-" ? `${totalSavings}%` : "-".padStart(5)}`,
	);
	console.log("");

	// ── Composition breakdown ──────────────────────────────────────────────
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("  Per-Bundle Composition (inlined modules)");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("");

	for (const b of bundles) {
		const prodPct = b.prodRaw / totals.prodRaw;
		console.log(`  ${b.name}  (${fmt(b.prodRaw)} prod, ${fmtPct(prodPct)} of total)`);
		console.log(`    Contains: ${b.inlined}`);
		console.log("");
	}

	// ── Summary ────────────────────────────────────────────────────────────
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("  Summary");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("");
	console.log(`  Total downloadable (prod, gzipped):  ${fmt(totals.prodGzip)}`);
	console.log(`  Total downloadable (prod, brotli):   ${fmt(totals.prodBrotli)}`);
	console.log(`  Total uncompressed (prod):           ${fmt(totals.prodRaw)}`);
	console.log(`  Minification savings (gzip):         ${totalSavings}%`);
	console.log("");

	// Check against icons
	const iconDir = "./icons";
	if (existsSync(iconDir)) {
		const iconFiles = ["icon-16.png", "icon-48.png", "icon-96.png", "icon-128.png"];
		let iconTotal = 0;
		for (const f of iconFiles) {
			const p = `${iconDir}/${f}`;
			if (existsSync(p)) {
				iconTotal += readFileSync(p).length;
			}
		}
		console.log(`  Icons (PNG):                        ${fmt(iconTotal)}`);
		console.log(`  Grand total (prod JS + icons):      ${fmt(totals.prodRaw + iconTotal)}`);
		console.log(`  Grand total (gzipped JS + icons):   ${fmt(totals.prodGzip + iconTotal)}`);
	}

	console.log("");

	// Cleanup temp
	rmSync(TMP_DIR, { recursive: true });
}

main().catch((err) => {
	console.error("Analysis failed:", err);
	process.exit(1);
});

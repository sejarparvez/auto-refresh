import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

const isProd = process.env.NODE_ENV === "production";
const generateSourceMaps = process.env.SOURCE_MAPS === "true" || !isProd;

// Minify inline CSS in popup.html for production.
// We save a backup beforehand and restore it after the build to avoid
// permanently modifying the source file.
if (isProd) {
	// Backup the original
	const originalHtml = readFileSync("./popup.html", "utf-8");
	const minified = originalHtml.replace(
		/<style>([\s\S]*?)<\/style>/,
		(_, css: string) =>
			`<style>${css
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/\s*([{}:;,])\s*/g, "$1")
				.replace(/;}/g, "}")
				.replace(/\s+/g, " ")
				.trim()}</style>`,
	);
	writeFileSync("./popup.html", minified, "utf-8");
	// Write backup after minifying so we can restore
	writeFileSync("./popup.html.bak", originalHtml, "utf-8");
	console.log("✅ CSS minified in popup.html");
}

// Clean dist directory before building to avoid stale files
rmSync("./dist", { recursive: true, force: true });

const result = await Bun.build({
	entrypoints: ["./src/background.ts", "./src/popup.ts", "./src/content.ts"],
	outdir: "./dist",
	target: "browser",
	minify: isProd,
	sourcemap: generateSourceMaps ? "external" : undefined,
});

if (!result.success) {
	console.error("❌ Build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Restore original popup.html
if (isProd) {
	const backup = readFileSync("./popup.html.bak", "utf-8");
	writeFileSync("./popup.html", backup, "utf-8");
	rmSync("./popup.html.bak");
	console.log("✅ Original popup.html restored");
}

console.log(`✅ Build complete! (${isProd ? "production" : "development"})`);

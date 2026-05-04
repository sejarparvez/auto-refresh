export {};

/// <reference types="bun" />

await Bun.build({
	entrypoints: ["./src/background.ts", "./src/popup.ts"],
	outdir: "./dist",
	target: "browser",
	minify: false,
});

console.log("✅ Build complete!");

import { rmSync } from "node:fs";

const isProd = process.env.NODE_ENV === "production";
const generateSourceMaps = process.env.SOURCE_MAPS === "true" || !isProd;

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

console.log(`✅ Build complete! (${isProd ? "production" : "development"})`);

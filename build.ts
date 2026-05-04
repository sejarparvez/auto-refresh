import { rmSync } from "fs";

export {};

// Clean dist directory before building to avoid stale files
rmSync("./dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./src/background.ts", "./src/popup.ts", "./src/content.ts"],
  outdir: "./dist",
  target: "browser",
  minify: false,
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("✅ Build complete!");

import { readFileSync, writeFileSync } from "fs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: bun run version:bump <patch|minor|major|1.2.3>");
  process.exit(1);
}

const manifestPath = "./manifest.json";
const packagePath = "./package.json";

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

const currentVersion = manifest.version;
const parts = currentVersion.split(".").map(Number);

let newVersion: string;

if (args[0] === "patch") {
  parts[2]++;
  newVersion = parts.join(".");
} else if (args[0] === "minor") {
  parts[1]++;
  parts[2] = 0;
  newVersion = parts.join(".");
} else if (args[0] === "major") {
  parts[0]++;
  parts[1] = 0;
  parts[2] = 0;
  newVersion = parts.join(".");
} else {
  newVersion = args[0];
}

manifest.version = newVersion;
pkg.version = newVersion;

writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
writeFileSync(packagePath, JSON.stringify(pkg, null, "\t") + "\n");

console.log(`✅ Version bumped: ${currentVersion} → ${newVersion}`);

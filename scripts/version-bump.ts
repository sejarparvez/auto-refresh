import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error("Usage: bun run release <patch|minor|major|1.2.3>");
	process.exit(1);
}

const bump = args[0];

// ── 1. Ensure working tree is clean ──────────────────────────────────────────

try {
	const status = execSync("git status --porcelain").toString().trim();
	if (status) {
		console.error("❌ Working tree is dirty. Commit or stash your changes first.");
		console.error(status);
		process.exit(1);
	}
} catch {
	console.error("❌ Failed to check git status.");
	process.exit(1);
}

// ── 2. Bump version (inlined — no subprocess) ─────────────────────────────────

const manifestPath = "./manifest.json";
const packagePath = "./package.json";

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

const currentVersion: string = manifest.version;
const parts = currentVersion.split(".").map(Number);

let newVersion: string;

if (bump === "patch") {
	parts[2]++;
	newVersion = parts.join(".");
} else if (bump === "minor") {
	parts[1]++;
	parts[2] = 0;
	newVersion = parts.join(".");
} else if (bump === "major") {
	parts[0]++;
	parts[1] = 0;
	parts[2] = 0;
	newVersion = parts.join(".");
} else {
	// Explicit version e.g. "2.0.0"
	newVersion = bump;
}

manifest.version = newVersion;
pkg.version = newVersion;

writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
writeFileSync(packagePath, JSON.stringify(pkg, null, "\t") + "\n");

console.log(`✅ Version bumped: ${currentVersion} → ${newVersion}`);

// ── 3. Commit, tag, push ──────────────────────────────────────────────────────

const tag = `v${newVersion}`;

console.log(`\n📦 Releasing ${tag}...`);

try {
	execSync("git add manifest.json package.json");
	execSync(`git commit -m "chore: release ${tag}"`);
	execSync(`git tag ${tag}`);
	execSync("git push");
	execSync("git push --tags");
} catch (err) {
	console.error("❌ Git operation failed:", err);
	process.exit(1);
}

console.log(`\n✅ Tagged and pushed ${tag}`);
console.log(`👉 Publish the release on GitHub to trigger the deploy workflow:`);
console.log(`   https://github.com/sejarparvez/auto-refresh/releases/tag/${tag}`);

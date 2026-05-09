import { execSync } from "child_process";
import { readFileSync } from "fs";

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error("Usage: bun run release <patch|minor|major|1.2.3>");
	process.exit(1);
}

const bump = args[0];

// Ensure working tree is clean before we touch anything
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

// Bump version in manifest.json + package.json
execSync(`bun run scripts/version-bump.ts ${bump}`, { stdio: "inherit" });

// Read the new version
const manifest = JSON.parse(readFileSync("./manifest.json", "utf-8"));
const version = manifest.version as string;
const tag = `v${version}`;

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
console.log(`👉 Now publish the release on GitHub to trigger the deploy workflow:`);
console.log(`   https://github.com/sejarparvez/auto-refresh/releases/tag/${tag}`);

import { execFileSync } from "node:child_process";
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
try {
  git("rev-parse", "--git-dir");
} catch {
  console.log("Not a Git checkout; commit hooks are not needed.");
  process.exit(0);
}
let current = "";
try {
  current = git("config", "--get", "core.hooksPath");
} catch {
  /* No existing hooks path. */
}
if (current && current !== ".githooks") {
  console.error(
    "A custom Git hooks path is configured. Add node scripts/version.mjs prepare to its pre-commit and pre-merge-commit hooks.",
  );
  process.exit(1);
}
git("config", "--local", "core.hooksPath", ".githooks");
console.log("Fitty version hooks installed for this checkout.");

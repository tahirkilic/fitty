import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  compareVersions,
  nextVersion,
  validateRelease,
  versionModule,
} from "../scripts/version.mjs";

function release(version) {
  return {
    "package.json": JSON.stringify({ version }),
    "package-lock.json": JSON.stringify({
      version,
      packages: { "": { version } },
    }),
    "dist/domain/app-version.js": versionModule(version),
    "dist/sw.js": `const CACHE = "fitty-shell-${version}";\n`,
  };
}
test("F01: semantic versions compare numerically and release files stay synchronized", () => {
  assert(compareVersions("0.1.10", "0.1.9") > 0);
  assert(compareVersions("1.0.0", "0.99.99") > 0);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(nextVersion("0.1.9"), "0.1.10");
  for (const invalid of [
    "1.0",
    "01.2.3",
    "1.2.3-beta",
    "-1.0.0",
    "1.0.99999999999999999",
  ])
    assert.throws(() => nextVersion(invalid));
  const files = release("0.1.10");
  assert.equal(
    validateRelease((path) => files[path]),
    "0.1.10",
  );
  for (const path of [
    "package-lock.json",
    "dist/domain/app-version.js",
    "dist/sw.js",
  ])
    assert.throws(() =>
      validateRelease((name) =>
        name === path ? release("0.1.9")[path] : files[name],
      ),
    );
});

test("F01: real Git hooks version every commit, preserve manual bumps and reject unsafe partial staging", () => {
  const directory = mkdtempSync(join(process.cwd(), ".version-test-"));
  const source = resolve("scripts/version.mjs");
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const node = (...args) =>
    execFileSync(process.execPath, args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const current = () =>
    JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).version;
  try {
    git("init");
    git("config", "user.name", "Version tests");
    git("config", "user.email", "version-tests@example.invalid");
    for (const path of ["dist/domain", "scripts", ".githooks"])
      mkdirSync(join(directory, path), { recursive: true });
    for (const [path, value] of Object.entries(release("0.1.0")))
      writeFileSync(join(directory, path), value);
    copyFileSync(source, join(directory, "scripts/version.mjs"));
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ version: "0.1.0", type: "module" }),
    );
    for (const hook of ["pre-commit", "pre-merge-commit"]) {
      copyFileSync(
        resolve(".githooks", hook),
        join(directory, ".githooks", hook),
      );
      chmodSync(join(directory, ".githooks", hook), 0o755);
    }
    git("add", ".");
    git("commit", "-m", "Fixture before version policy");
    const base = git("rev-parse", "HEAD");
    git("config", "core.hooksPath", ".githooks");
    writeFileSync(join(directory, "README.md"), "Documentation only\n");
    git("add", "README.md");
    git("commit", "-m", "Document something");
    assert.equal(current(), "0.1.1");
    node("scripts/version.mjs", "check");
    node("scripts/version.mjs", "bump");
    git("add", ".");
    git("commit", "-m", "Explicitly versioned commit");
    assert.equal(current(), "0.1.2");
    writeFileSync(join(directory, "README.md"), "Another documentation edit\n");
    git("add", "README.md");
    git("commit", "-m", "Another docs-only commit");
    assert.equal(current(), "0.1.3");
    node("scripts/version.mjs", "check-commits", base);
    const before = readFileSync(join(directory, "package.json"), "utf8");
    const unstaged = JSON.stringify({
      version: "0.1.3",
      type: "module",
      description: "Unstaged dependency metadata",
    });
    writeFileSync(join(directory, "package.json"), unstaged);
    writeFileSync(
      join(directory, "README.md"),
      "Staged docs with unstaged package\n",
    );
    git("add", "README.md");
    const failed = spawnSync("git", ["commit", "-m", "Should be blocked"], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /Stage your changes/);
    assert.equal(
      readFileSync(join(directory, "package.json"), "utf8"),
      unstaged,
    );
    writeFileSync(join(directory, "package.json"), before);
    git(
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Intentionally invalid version fixture",
    );
    const invalid = spawnSync(
      process.execPath,
      ["scripts/version.mjs", "check-commits", base],
      { cwd: directory, encoding: "utf8" },
    );
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /must increment the app version/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

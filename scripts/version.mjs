import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const versionFiles = [
  "package.json",
  "package-lock.json",
  "dist/domain/app-version.js",
  "dist/sw.js",
];
export function parseVersion(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
    throw new Error(
      `Expected a stable major.minor.patch app version, got ${value}`,
    );
  const parts = value.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger))
    throw new Error("Version is too large.");
  return parts;
}
export function compareVersions(left, right) {
  const a = parseVersion(left),
    b = parseVersion(right);
  for (let index = 0; index < 3; index++)
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}
export function nextVersion(version) {
  const [major, minor, patch] = parseVersion(version);
  const next = `${major}.${minor}.${patch + 1}`;
  parseVersion(next);
  return next;
}
export function versionModule(version) {
  parseVersion(version);
  return `// Generated from package.json by scripts/version.mjs.\nexport const APP_VERSION = "${version}";\nexport const SHELL_CACHE = "fitty-shell-${version}";\n`;
}
function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function read(path, ref) {
  return ref
    ? execFileSync(
        "git",
        ["show", ref === ":" ? `:${path}` : `${ref}:${path}`],
        { encoding: "utf8" },
      )
    : readFileSync(path, "utf8");
}
function appVersion(ref) {
  return JSON.parse(read("package.json", ref)).version;
}
export function validateRelease(readContent) {
  const version = JSON.parse(readContent("package.json")).version;
  parseVersion(version);
  const lock = JSON.parse(readContent("package-lock.json"));
  if (lock.version !== version || lock.packages[""].version !== version)
    throw new Error(
      "Package and lockfile versions must match. Run npm run version:bump.",
    );
  if (readContent("dist/domain/app-version.js") !== versionModule(version))
    throw new Error("App version module is stale. Run npm run version:bump.");
  if (
    !readContent("dist/sw.js").startsWith(
      `const CACHE = "fitty-shell-${version}";\n`,
    )
  )
    throw new Error(
      "Offline cache version is stale. Run npm run version:bump.",
    );
  return version;
}
function sync(version) {
  for (const file of ["package.json", "package-lock.json"]) {
    const value = JSON.parse(read(file));
    value.version = version;
    if (file === "package-lock.json") value.packages[""].version = version;
    writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
  }
  writeFileSync("dist/domain/app-version.js", versionModule(version));
  const worker = read("dist/sw.js");
  if (!/^const CACHE = "[^"]+";/m.test(worker))
    throw new Error("Cannot locate the offline cache version.");
  writeFileSync(
    "dist/sw.js",
    worker.replace(
      /^const CACHE = "[^"]+";/m,
      `const CACHE = "fitty-shell-${version}";`,
    ),
  );
}
function prepare() {
  // Never stage unrelated dependency edits or overwrite a partially staged file.
  if (git("diff", "--name-only", "--", ...versionFiles))
    throw new Error(
      "Stage your changes to the version-managed files before committing, then retry.",
    );
  const head = git("rev-parse", "HEAD");
  const parents = [head];
  const mergeHead = execFileSync(
    "git",
    ["rev-parse", "--git-path", "MERGE_HEAD"],
    { encoding: "utf8" },
  ).trim();
  try {
    parents.push(...readFileSync(mergeHead, "utf8").trim().split("\n"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const previous = parents.map(appVersion).sort(compareVersions).at(-1);
  const current = appVersion();
  const version =
    compareVersions(current, previous) > 0 ? current : nextVersion(previous);
  sync(version);
  git("add", "--", ...versionFiles);
  validateRelease((file) => read(file, ":"));
  console.log(`Fitty ${version}: version files staged for this commit.`);
}
export function checkCommits(base, head = "HEAD") {
  const commits = git("rev-list", "--reverse", `${base}..${head}`)
    .split("\n")
    .filter(Boolean);
  for (const commit of commits) {
    const version = validateRelease((file) => read(file, commit));
    const parents = git("show", "-s", "--format=%P", commit)
      .split(" ")
      .filter(Boolean);
    for (const parent of parents)
      if (compareVersions(version, appVersion(parent)) <= 0)
        throw new Error(
          `Commit ${commit.slice(0, 7)} must increment the app version above its parent (${appVersion(parent)}).`,
        );
  }
  console.log(
    `Version increase and synchronized release files verified for ${commits.length} commit(s).`,
  );
}
function historyBase() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  if (event.pull_request) return event.pull_request.base.sha;
  if (event.before && !/^0+$/.test(event.before)) return event.before;
  // A new branch has no before SHA. Check every commit introduced since main.
  return git("merge-base", "HEAD", "origin/main");
}
export function main([mode, base, head] = process.argv.slice(2)) {
  if (mode === "bump") {
    const version = nextVersion(appVersion());
    sync(version);
    console.log(`Fitty ${version}`);
  } else if (mode === "prepare") prepare();
  else if (mode === "check") {
    validateRelease((file) => read(file));
    console.log(
      "App, package, backup source and offline cache versions match.",
    );
  } else if (mode === "check-commits")
    checkCommits(base || historyBase(), head || "HEAD");
  else
    throw new Error(
      "Use bump, prepare, check, or check-commits [base] [head].",
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

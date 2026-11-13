import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const layers = {
  domain: [],
  application: ["domain"],
  infrastructure: ["domain"],
  presentation: ["domain", "application"],
};
for (const [layer, allowed] of Object.entries(layers))
  for (const file of await readdir(`dist/${layer}`)) {
    const path = `dist/${layer}/${file}`,
      text = await readFile(path, "utf8");
    assert.equal(spawnSync(process.execPath, ["--check", path]).status, 0);
    for (const match of text.matchAll(/from\s+['"]\.\.\/([^/]+)\//g))
      assert(
        allowed.includes(match[1]),
        `${layer} cannot depend on ${match[1]}`,
      );
    if (["domain", "application"].includes(layer))
      assert(
        !/\b(localStorage|document|window|navigator|Date\.now|crypto)\b/.test(
          text,
        ),
        `${layer} has browser dependency`,
      );
    assert(!/[ \t]+$/m.test(text), `Trailing whitespace: ${path}`);
  }
for (const file of ["dist/main.js", "dist/sw.js"])
  assert.equal(spawnSync(process.execPath, ["--check", file]).status, 0);
const sw = await readFile("dist/sw.js", "utf8");
for (const match of sw.matchAll(/'\.\/([^']+)'/g))
  await readFile(`dist/${match[1]}`);
console.log(
  "Syntax, architecture boundaries, side-effect isolation, whitespace and offline asset checks passed.",
);

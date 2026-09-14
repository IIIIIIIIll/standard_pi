#!/usr/bin/env node
//
// check-docs.mjs — verify that the docs/ usage layer still covers exactly what
// this harness ships.
//
//   node check-docs.mjs <repo>
//
// Positional:
//   <repo>   repository root; every path below is resolved against it
//
// Exit codes: 0 = the documented sets match, 1 = at least one mismatch or an
// unreadable input, 2 = usage error.
//
// Streams: the success line (with counts) goes to stdout; every problem goes to
// stderr, one per line, so `doctor.sh` can capture both with `2>&1` and indent.
//
// The heading convention is a contract, not styling. In `docs/plugins.md` and
// `docs/skills.md`, each entry is a heading of three hashes whose FIRST
// backtick-delimited token is the entry's id:
//
//   ### `npm:pi-lens`            -> id  npm:pi-lens
//   ### `pi-lens` / LSP feedback -> id  pi-lens
//
// Trailing text after the id is allowed. Lines inside fenced code blocks are
// ignored, so an example heading in a fence is never counted as an entry.
//
// The ids are compared as SETS against the single source of truth for each kind:
//
//   docs/plugins.md  vs  packages[] in pi-agent/settings.core.json  (spec strings)
//   docs/skills.md   vs  name in skills.json                        (skill names)
//
// Nothing here re-lists the packages. A hard-coded id set would be a second
// source of truth, which is the drift this check exists to catch.
//
import fs from "node:fs";
import path from "node:path";

const [repoRoot] = process.argv.slice(2);
if (!repoRoot) {
  console.error("usage: check-docs.mjs <repo>");
  process.exit(2);
}

const root = path.resolve(repoRoot);
const problems = [];

// A missing or malformed input is a problem to report, never a silent skip.
const readJson = (relPath) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
  } catch (error) {
    const detail = String(error?.message ?? error).split("\n")[0];
    problems.push(
      `error    ${relPath} is unreadable or unparseable: ${detail}`,
    );
    return null;
  }
};

// Ids from entry headings, skipping fenced code blocks. First backtick pair only.
const documentedIds = (relPath) => {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) {
    problems.push(`missing  ${relPath} does not exist`);
    return [];
  }

  const ids = [];
  let fenced = false;
  for (const line of fs.readFileSync(abs, "utf8").split("\n")) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced || !line.startsWith("### ")) continue;
    const match = line.match(/`([^`]+)`/);
    if (match) ids.push(match[1]);
  }

  if (ids.length === 0) {
    problems.push(
      `error    ${relPath} has no entry headings (formatting drift, or the file was emptied)`,
    );
  }
  return ids;
};

const compare = (label, relDocs, expected, sourceLabel) => {
  const found = documentedIds(relDocs);
  const expectedSet = new Set(expected);

  for (const id of expected) {
    if (!found.includes(id))
      problems.push(`missing  ${relDocs} has no entry for ${id}`);
  }
  for (const id of found) {
    if (!expectedSet.has(id)) {
      problems.push(
        `error    ${relDocs} documents ${id}, which ${sourceLabel} does not ship`,
      );
    }
  }

  const seen = new Set();
  for (const id of found) {
    if (seen.has(id))
      problems.push(`error    ${relDocs} documents ${id} more than once`);
    seen.add(id);
  }

  return { label, found: new Set(found).size, expected: expectedSet.size };
};

const core = readJson("pi-agent/settings.core.json");
const skillsFile = readJson("skills.json");
const packages = core?.packages ?? [];
const skillNames = (skillsFile?.skills ?? []).map((entry) => entry.name);

if (core && packages.length === 0) {
  problems.push(
    "error    pi-agent/settings.core.json declares no packages[] to compare against",
  );
}
if (skillsFile && skillNames.length === 0) {
  problems.push("error    skills.json declares no skills[] to compare against");
}

const counts = [];
if (packages.length > 0) {
  counts.push(
    compare("plugins", "docs/plugins.md", packages, "settings.core.json"),
  );
}
if (skillNames.length > 0) {
  counts.push(compare("skills", "docs/skills.md", skillNames, "skills.json"));
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    `  error    docs coverage has ${problems.length} problem${problems.length === 1 ? "" : "s"}`,
  );
  process.exit(1);
}

console.log(
  `  ok       docs cover ${counts.map((c) => `${c.found} ${c.label}`).join(" and ")}`,
);

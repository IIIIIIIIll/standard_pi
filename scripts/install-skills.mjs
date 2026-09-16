#!/usr/bin/env node
//
// install-skills.mjs — install the skills listed in skills.json from their
// upstream sources, so the local copies never fall behind the remote.
//
// Nothing is vendored in this repo: each run clones the source at the
// configured ref (default: the source's default branch) and copies the skill
// directory into the agent skills directory, recording the resolved commit and
// a content digest of the tree it just installed in the provenance marker.
// Re-running is how you update.
//
//   node install-skills.mjs <repo> [--check]
//
//   --check   report what is installed vs. what the manifest asks for and
//             change nothing (no network). Each skill's tree is hashed and
//             compared against the digest the marker records for it, so a
//             stale or edited copy reads as drift rather than ok. missing and
//             drift exit 1; unrecorded means the marker carries no digest for
//             the skill — a note, since the next fetch records one — and is an
//             error only when the marker itself is gone.
//
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const checkOnly = process.argv.slice(3).includes("--check");

const manifestPath = path.join(repoRoot, "skills.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`no skills.json in ${repoRoot}`);
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const destRoot = process.env.AGENTS_SKILLS_DIR ?? path.join(os.homedir(), ".agents", "skills");
const statePath = path.join(path.dirname(destRoot), ".pi-setup-skills.json");

// Content digest of a skill tree: entries sorted by relative path, each file
// contributing "<rel>\0<byteLength>\0" + bytes and each directory "<rel>/".
// No mtimes, no absolute paths, "/" only — the same bytes hash the same on any
// machine. Hashes what is installed, not what was cloned.
function treeDigest(root) {
  const hash = crypto.createHash("sha256");
  const walk = (dir, prefix) => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        isDir: entry.isDirectory(),
        rel: prefix ? `${prefix}/${entry.name}` : entry.name,
      }))
      .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    for (const entry of entries) {
      const at = path.join(dir, entry.name);
      if (entry.isDir) {
        hash.update(`${entry.rel}/\0`);
        walk(at, entry.rel);
      } else {
        const bytes = fs.readFileSync(at);
        hash.update(`${entry.rel}\0${bytes.length}\0`);
        hash.update(bytes);
      }
    }
  };
  walk(root, "");
  return hash.digest("hex");
}

const problems = [];
let installed = 0;

if (checkOnly) {
  let marker = null;
  try {
    marker = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    marker = null; // absent or unreadable: nothing to compare against
  }

  for (const skill of manifest.skills) {
    const dir = path.join(destRoot, skill.name);
    const record = marker?.skills?.[skill.name];
    if (!fs.existsSync(path.join(dir, "SKILL.md"))) {
      console.log(`  ${"missing".padEnd(8)} ${skill.name}`);
      problems.push(skill.name);
    } else if (!record?.digest) {
      const why = marker
        ? `${statePath} has no digest — setup.sh records one on the next fetch`
        : `${statePath} is missing — run setup.sh`;
      console.log(`  ${"unrecorded".padEnd(8)} ${skill.name} (${why})`);
      if (!marker) problems.push(skill.name);
    } else if (record.source !== skill.source || record.path !== skill.path) {
      console.log(`  ${"drift".padEnd(8)} ${skill.name} (marker says ${record.source}/${record.path}, skills.json says ${skill.source}/${skill.path})`);
      problems.push(skill.name);
    } else {
      const digest = treeDigest(dir);
      if (digest === record.digest) {
        console.log(`  ${"ok".padEnd(8)} ${skill.name}`);
      } else {
        console.log(`  ${"drift".padEnd(8)} ${skill.name} (digest ${digest.slice(0, 12)} ≠ recorded ${record.digest.slice(0, 12)})`);
        problems.push(skill.name);
      }
    }
  }
  if (problems.length) {
    console.error(`\n${problems.length} skill(s) not ok — run setup.sh`);
    process.exit(1);
  }
  process.exit(0);
}

if (manifest.skills.length === 0) {
  console.log("  none     skills.json lists no skills");
  process.exit(0);
}

const bySource = new Map();
for (const skill of manifest.skills) {
  if (!bySource.has(skill.source)) bySource.set(skill.source, []);
  bySource.get(skill.source).push(skill);
}

const provenance = { installedAt: new Date().toISOString(), sources: {}, skills: {} };

for (const [sourceId, skills] of bySource) {
  const source = manifest.sources?.[sourceId];
  if (!source?.url) {
    console.error(`  error    unknown source "${sourceId}" (add it to skills.json sources)`);
    problems.push(sourceId);
    continue;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `pi-setup-${sourceId}-`));
  const cloneArgs = ["clone", "--depth", "1", "--quiet"];
  if (source.ref) cloneArgs.push("--branch", source.ref);
  cloneArgs.push(source.url, tmp);

  let commit;
  try {
    execFileSync("git", cloneArgs, { stdio: ["ignore", "ignore", "pipe"] });
    commit = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim().split("\n")[0];
    console.error(`  error    could not fetch ${source.url}: ${detail}`);
    problems.push(sourceId);
    fs.rmSync(tmp, { recursive: true, force: true });
    continue;
  }

  const describedRef = source.ref ?? "default branch";
  console.log(`  source   ${sourceId} (${describedRef}) @ ${commit.slice(0, 12)}`);
  provenance.sources[sourceId] = { url: source.url, ref: source.ref ?? null, commit };

  for (const skill of skills) {
    const from = path.join(tmp, skill.path);
    if (!fs.existsSync(path.join(from, "SKILL.md"))) {
      console.error(`  error    ${skill.name}: no SKILL.md at ${skill.path}`);
      problems.push(skill.name);
      continue;
    }
    const to = path.join(destRoot, skill.name);
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(to, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    const digest = treeDigest(to);
    console.log(`  install  ${skill.name}`);
    provenance.skills[skill.name] = { source: sourceId, path: skill.path, commit, digest };
    installed++;
  }

  fs.rmSync(tmp, { recursive: true, force: true });
}

fs.mkdirSync(destRoot, { recursive: true });
fs.writeFileSync(statePath, JSON.stringify(provenance, null, 2) + "\n");

if (problems.length) {
  console.error(`\n${problems.length} problem(s); ${installed} skill(s) installed`);
  process.exit(1);
}
console.log(`  done     ${installed} skill(s) in ${destRoot}`);

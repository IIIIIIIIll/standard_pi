#!/usr/bin/env node
//
// install-skills.mjs — install the skills listed in skills.json from their
// upstream sources, so the local copies never fall behind the remote.
//
// Nothing is vendored in this repo: each run clones the source at the
// configured ref (default: the source's default branch) and copies the skill
// directory into the agent skills directory. Re-running is how you update.
//
//   node install-skills.mjs <repo> [--check]
//
//   --check   report what is installed vs. what the manifest asks for and
//             change nothing (no network). Exit 1 if something is missing.
//
import fs from "node:fs";
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

const problems = [];
let installed = 0;

if (checkOnly) {
  for (const skill of manifest.skills) {
    const ok = fs.existsSync(path.join(destRoot, skill.name, "SKILL.md"));
    console.log(`  ${ok ? "ok      " : "missing "} ${skill.name}`);
    if (!ok) problems.push(skill.name);
  }
  if (problems.length) {
    console.error(`\n${problems.length} skill(s) missing — run setup.sh`);
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
    console.log(`  install  ${skill.name}`);
    provenance.skills[skill.name] = { source: sourceId, path: skill.path, commit };
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

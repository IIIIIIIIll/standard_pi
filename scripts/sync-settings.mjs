#!/usr/bin/env node
//
// sync-settings.mjs — fold the live ~/.pi/agent/settings.json back into
// pi-agent/settings.core.json, removing anything contributed by an enabled
// optional manifest so optional choices stay per-machine.
//
//   node sync-settings.mjs <repo> <live-settings> <state-file>
//
import fs from "node:fs";
import path from "node:path";

const [repoRoot, livePath, statePath] = process.argv.slice(2);
if (!repoRoot || !livePath || !statePath) {
  console.error("usage: sync-settings.mjs <repo> <live-settings> <state-file>");
  process.exit(2);
}

const corePath = path.join(repoRoot, "pi-agent", "settings.core.json");
const optionalDir = path.join(repoRoot, "optional");

if (!fs.existsSync(livePath)) {
  console.log("  skip     no live settings.json");
  process.exit(0);
}

const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
const enabled = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")).optionals ?? [] : [];

const out = structuredClone(live);

// Owned by Pi at runtime.
delete out.lastChangelogVersion;

// Strip everything an enabled optional contributes.
for (const name of enabled) {
  const manifestPath = path.join(optionalDir, name, "manifest.json");
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const pkg of manifest.packages ?? []) {
    out.packages = (out.packages ?? []).filter((p) => JSON.stringify(p) !== JSON.stringify(pkg));
  }
  for (const key of Object.keys(manifest.settings ?? {})) delete out[key];
}
if (Array.isArray(out.packages) && out.packages.length === 0) delete out.packages;

const next = JSON.stringify(out, null, 2) + "\n";
const previous = fs.existsSync(corePath) ? fs.readFileSync(corePath, "utf8") : null;

if (previous === next) {
  console.log(`  same     pi-agent/settings.core.json`);
} else {
  fs.writeFileSync(corePath, next);
  console.log(`  update   pi-agent/settings.core.json`);
}

#!/usr/bin/env node
//
// render-settings.mjs — build the live ~/.pi/agent/settings.json from
// pi-agent/settings.core.json plus any enabled optional plugin manifests.
//
//   node render-settings.mjs <repo> <live-settings> <state-file> [--with NAME ...] [--none] [--check]
//
// --with NAME  use exactly these optionals (repeatable)
// --none       use no optionals
// --check      report drift and change nothing (exit 1 if out of sync;
//              `packages` is a set, so its order alone is not drift)
// No selection flag: keep the saved state, or infer it from the live file.
//
// The live settings file is always a real file, never a symlink, because it is
// a per-machine artefact (core settings + that machine's optional choices).
//
import fs from "node:fs";
import path from "node:path";

const [repoRoot, livePath, statePath, ...rest] = process.argv.slice(2);
if (!repoRoot || !livePath || !statePath) {
  console.error(
    "usage: render-settings.mjs <repo> <live-settings> <state-file> [--with NAME ...]",
  );
  process.exit(2);
}

const withNames = [];
let explicit = false;
let checkOnly = false;
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (arg === "--with") {
    const value = rest[++i];
    if (value === undefined) {
      console.error("--with requires a name");
      process.exit(2);
    }
    withNames.push(value);
    explicit = true;
  } else if (arg === "--none") {
    withNames.length = 0;
    explicit = true;
  } else if (arg === "--check") {
    checkOnly = true;
  }
}

const corePath = path.join(repoRoot, "pi-agent", "settings.core.json");
const optionalDir = path.join(repoRoot, "optional");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const listOptionals = () =>
  fs.existsSync(optionalDir)
    ? fs
        .readdirSync(optionalDir)
        .filter(
          (n) =>
            !n.startsWith("_") &&
            fs.existsSync(path.join(optionalDir, n, "manifest.json")),
        )
    : [];

const core = readJson(corePath);

let previousLive = null;
if (fs.existsSync(livePath)) {
  try {
    previousLive = readJson(livePath);
  } catch {
    console.warn(
      `  warn     could not parse existing ${livePath}; it will be backed up and replaced`,
    );
  }
}

// Enabled set precedence: explicit --with/--none  >  saved state  >  inferred from live.
let enabled;
if (explicit) {
  enabled = withNames;
} else if (fs.existsSync(statePath)) {
  enabled = readJson(statePath).optionals ?? [];
} else {
  const livePkgs = new Set(previousLive?.packages ?? []);
  enabled = listOptionals().filter((name) => {
    const pkgs =
      readJson(path.join(optionalDir, name, "manifest.json")).packages ?? [];
    return pkgs.length > 0 && pkgs.every((p) => livePkgs.has(p));
  });
  if (enabled.length)
    console.log(
      `  infer    enabled from existing settings: ${enabled.join(", ")}`,
    );
}

for (const name of enabled) {
  if (!fs.existsSync(path.join(optionalDir, name, "manifest.json"))) {
    console.error(`  error    unknown optional "${name}" (see optional/)`);
    process.exit(1);
  }
}

// Compose.
const out = structuredClone(core);
const addPkg = (pkg) => {
  out.packages = out.packages ?? [];
  if (!out.packages.some((p) => JSON.stringify(p) === JSON.stringify(pkg)))
    out.packages.push(pkg);
};

for (const name of enabled) {
  const manifest = readJson(path.join(optionalDir, name, "manifest.json"));
  for (const pkg of manifest.packages ?? []) addPkg(pkg);
  Object.assign(out, manifest.settings ?? {});
}

// Runtime state owned by Pi itself — always carried over, never tracked.
if (previousLive?.lastChangelogVersion)
  out.lastChangelogVersion = previousLive.lastChangelogVersion;

const next = JSON.stringify(out, null, 2) + "\n";
const previousText = fs.existsSync(livePath)
  ? fs.readFileSync(livePath, "utf8")
  : null;

// `packages` is a set, not a sequence: two arrays with the same members in a
// different order are equal, because `pi install` appends while this script
// emits core first and the enabled optionals' packages last. For the drift
// check, compare sorted copies — duplicates preserved, so `[a, a, b]` still
// differs from the render's `[a, b]` and stays reported as drift. Sorted by the
// same serialisation the dedup above uses, so object specs keep working too.
// Scoped to the literal key `packages`: every other key, every value, and key
// order are compared exactly as serialised.
const canonical = (value) => {
  const copy = structuredClone(value);
  if (Array.isArray(copy.packages)) {
    copy.packages = [...copy.packages].sort((a, b) => {
      const x = JSON.stringify(a);
      const y = JSON.stringify(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }
  return JSON.stringify(copy, null, 2);
};

// Only `--check` accepts a set-equal `packages` array in any order. The write
// path below still counts it as a change, so `./setup.sh` keeps emitting the
// canonical order rather than skipping the rewrite.
const inSync =
  previousText === next ||
  (checkOnly &&
    previousLive !== null &&
    canonical(previousLive) === canonical(out));

if (inSync) {
  console.log(`  ok       ${livePath}`);
} else if (checkOnly) {
  console.error(`  drift    ${livePath} does not match the repo`);
  console.error(`           run ./setup.sh or scripts/sync.sh`);
  process.exit(1);
} else {
  if (previousText !== null) {
    const stamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
    const backup = `${livePath}.pre-render-${stamp}`;
    fs.writeFileSync(backup, previousText);
    console.log(`  backup   ${backup}`);
  }
  fs.mkdirSync(path.dirname(livePath), { recursive: true });
  fs.writeFileSync(livePath, next);
  console.log(`  render   ${livePath}`);
}

if (!checkOnly) {
  fs.writeFileSync(
    statePath,
    JSON.stringify({ optionals: enabled }, null, 2) + "\n",
  );
}
console.log(
  `  state    optionals: ${enabled.length ? enabled.join(", ") : "(none)"}`,
);

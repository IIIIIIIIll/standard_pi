# Node Guidelines

> How the `scripts/*.mjs` helpers are written. These are the only JavaScript in the repo.

---

## Constraints

- **ESM only, `.mjs` extension.** There is no `package.json` and no `node_modules`.
  Scripts are run directly by the Node that ships with Pi (Node 22 here):
  `node scripts/render-settings.mjs …`.
- **Zero dependencies.** Only `node:`-prefixed builtins: `node:fs`, `node:path`,
  `node:os`, `node:child_process`. Do not add an npm dependency to this repo —
  there is no install step that would resolve it.
- **Synchronous I/O.** Every file operation uses the `*Sync` API. These scripts
  are short-lived CLI one-shots; async plumbing would add nothing.
- **No TypeScript, no build step, no lint config.** `node --check` is the only
  static check available.

```js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
```

---

## File Shape

```js
#!/usr/bin/env node
//
// render-settings.mjs — build the live ~/.pi/agent/settings.json from
// pi-agent/settings.core.json plus any enabled optional plugin manifests.
//
//   node render-settings.mjs <repo> <live-settings> <state-file> [--with NAME ...] [--none] [--check]
//
// --with NAME  use exactly these optionals (repeatable)
// --none       use no optionals
// --check      report drift and change nothing (exit 1 if out of sync)
//
import fs from "node:fs";
```

The comment block is a contract document, not a summary. It contains the exact
invocation line and a definition for every flag. Update it in the same commit as
the flag — nothing generates `--help` for these files.

---

## Argument Contract

**Positional arguments come first, flags after.** Missing required positionals
print usage on stderr and exit `2`:

```js
const [repoRoot, livePath, statePath, ...rest] = process.argv.slice(2);
if (!repoRoot || !livePath || !statePath) {
  console.error("usage: render-settings.mjs <repo> <live-settings> <state-file> [--with NAME ...]");
  process.exit(2);
}
```

```js
const repoRoot = path.resolve(process.argv[2] ?? ".");
const checkOnly = process.argv.slice(3).includes("--check");
```

Two flag styles exist, both acceptable — match the file you are editing:

| Style | Used by | Shape |
|-------|---------|-------|
| `while`-less `for` loop with index | `render-settings.mjs` | needed for `--with NAME`, which consumes the next argument |
| `process.argv.slice(n).includes("--flag")` | `install-skills.mjs` | boolean flags only |

Value-taking flags consume the next token explicitly and validate it:

```js
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
```

Unknown flags are ignored rather than rejected — positional slots are the guard.
Do not add a strict unknown-flag error without checking every caller
(`setup.sh`, `optional.sh`, `sync.sh`, `doctor.sh` all call these helpers).

### Exit Codes

| Code | Meaning | Requirement |
|------|---------|-------------|
| `0` | Success, or a documented no-op (`sync-settings.mjs` has no live file to read) | |
| `1` | Operation failed, or `--check` found drift/problems | the caller branches on this |
| `2` | Usage error: wrong argument count, unknown required value | |

`--check` **always** exits `1` on drift and never writes. It is what
`doctor.sh` and `setup.sh` rely on, so keep it side-effect-free — including not
touching the state file.

```js
if (previousText === next) {
  console.log(`  ok       ${livePath}`);
} else if (checkOnly) {
  console.error(`  drift    ${livePath} does not match the repo`);
  console.error(`           run ./setup.sh or scripts/sync.sh`);
  process.exit(1);
}
```

---

## Output Format

Match the bash `say()` format exactly: two spaces, verb padded to 9 columns,
then the message. In JS that is a literal — `  ` plus the verb plus enough
spaces to reach column 11.

```js
console.log(`  ok       ${livePath}`);
console.error(`  error    unknown optional "${name}" (see optional/)`);
console.error(`  drift    ${livePath} does not match the repo`);
```

Continuation lines are indented 11 spaces so they align under the message column:

```js
console.error(`           run ./setup.sh or scripts/sync.sh`);
```

Canonical verbs: `ok`, `warn`, `error`, `drift`, `backup`, `render`, `state`,
`infer`, `skip`, `update`, `same`, `source`, `install`, `none`, `done`, `missing`.

Diagnostics use `console.error`; progress uses `console.log`. Nothing is written
to stdout in a machine-parseable format — these helpers are read by humans and by
exit codes, never by a parser. One deviation exists: the `--check` listing in
`install-skills.mjs` builds an 8-wide field (`` `ok      ` `` / `` `missing ` ``).
Match the surrounding file rather than reformatting it.

---

## JSON Write Discipline

Every write follows the same three-step shape. This is the most important
convention in this layer, because a bad write here silently breaks the user's
live harness.

**1. Read and compose without mutating the source object.**

```js
const core = readJson(corePath);

// Compose.
const out = structuredClone(core);
const addPkg = (pkg) => {
  out.packages = out.packages ?? [];
  if (!out.packages.some((p) => JSON.stringify(p) === JSON.stringify(pkg))) out.packages.push(pkg);
};
```

Use `structuredClone` rather than spreading: nested objects such as
`compaction` would otherwise be shared with the parsed source and mutated
in place. Package entries are plain strings today, but the dedup comparison is
deliberately `JSON.stringify`-based so it keeps working if they become objects.

**2. Compare before writing, so a no-op run is truly a no-op.**

```js
const next = JSON.stringify(out, null, 2) + "\n";
const previousText = fs.existsSync(livePath) ? fs.readFileSync(livePath, "utf8") : null;

if (previousText === next) {
  console.log(`  ok       ${livePath}`);
} else { /* write */ }
```

**3. Back up before overwriting an existing file.**

```js
if (previousText !== null) {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const backup = `${livePath}.pre-render-${stamp}`;
  fs.writeFileSync(backup, previousText);
  console.log(`  backup   ${backup}`);
}
fs.mkdirSync(path.dirname(livePath), { recursive: true });
fs.writeFileSync(livePath, next);
```

Formatting is always `JSON.stringify(value, null, 2) + "\n"` — two-space indent
and exactly one trailing newline. Files are hand-edited too, so any other
formatting produces spurious git diffs.

### Composability Rules

The core settings and the optional manifests must not overlap, because the two
directions are asymmetric:

- `render-settings.mjs` merges: `Object.assign(out, manifest.settings ?? {})` —
  an optional manifest **overrides** a core key.
- `sync-settings.mjs` strips: for every enabled optional it deletes
  `manifest.settings` keys and filters `manifest.packages` out of the live file
  before writing `settings.core.json`.

So a key present in both places is rendered from the manifest and then deleted
from core on the next `sync.sh` — silently losing it. Keep each key in exactly
one place. Runtime-owned keys are handled the same way: `lastChangelogVersion`
is carried over on render and deleted on sync, and is never tracked.

State files are always written as `JSON.stringify(value, null, 2) + "\n"`:

```js
fs.writeFileSync(statePath, JSON.stringify({ optionals: enabled }, null, 2) + "\n");
```

---

## Failure Handling

`install-skills.mjs` shows the error-collecting pattern for a multi-item
operation: accumulate into a `problems` array, continue with the remaining items,
and exit once at the end. Never throw out of a loop over user-configured items.

```js
const problems = [];
let installed = 0;

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
```

- Child processes use `execFileSync` (argv array, no shell). Nothing in this repo
  builds a shell string from configuration.
- `stdio: ["ignore", "ignore", "pipe"]` captures stderr for reporting while
  keeping it out of the user's terminal.
- Error text is reduced to its first line, because git writes multi-line advice.
- `fs.rmSync(tmp, { recursive: true, force: true })` runs on every path, including
  the failure path — `force: true` is what makes it safe to call unconditionally.
- The exit is deferred: `if (problems.length) { console.error(...); process.exit(1); }`
  after reporting the partial success count. A partial install is reported, never
  rolled back, because re-running is the recovery path.
- `mkdtempSync(path.join(os.tmpdir(), "pi-setup-<id>-"))` with a unique prefix is
  the temp-directory convention.

Skill directories are **replaced, not merged**, so that upstream deletions
propagate:

```js
const to = path.join(destRoot, skill.name);
fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(to, { recursive: true });
fs.cpSync(from, to, { recursive: true });
```

---

## Paths And Environment

- Paths are always built with `path.join`, rooted at the `repoRoot` argument —
  never at `process.cwd()` and never at `import.meta.url`.
- User-facing directories come from an environment variable with a `??` default,
  and the provenance/state file is a **sibling** of that directory:

```js
const destRoot = process.env.AGENTS_SKILLS_DIR ?? path.join(os.homedir(), ".agents", "skills");
const statePath = path.join(path.dirname(destRoot), ".pi-setup-skills.json");
```

- `listOptionals()` skips any directory starting with `_` and requires
  `manifest.json` — this must stay in sync with the `find` logic in
  `optional.sh` and `doctor.sh`.

```js
const listOptionals = () =>
  fs.existsSync(optionalDir)
    ? fs
        .readdirSync(optionalDir)
        .filter((n) => !n.startsWith("_") && fs.existsSync(path.join(optionalDir, n, "manifest.json")))
    : [];
```

---

## Anti-Patterns

- **Do not write JSON without comparing first.** An unconditional write makes
  `doctor.sh`'s drift check and `sync.sh`'s `same` report useless.
- **Do not overwrite a file without a `.pre-render-<stamp>` / `.bak-<stamp>` backup.**
- **Do not mutate the parsed source object.** `structuredClone` first.
- **Do not add an npm dependency.** There is no `npm install` in this repo.
- **Do not use `require()` or `.js`.** ESM `.mjs` only, `node:`-prefixed imports.
- **Do not print secret values.** `auth.json` is read by hand, never by these
  scripts; if you ever need to handle it, report presence and mode only.
- **Do not make `--check` write anything**, including the state file.
- **Do not add a fifth verb-format variant.** Follow the 9-column `%`-style
  literal already used in the file you are editing.

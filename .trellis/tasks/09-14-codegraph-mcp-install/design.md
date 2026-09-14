# Design — Install and register the codebase-memory MCP server

## Purpose

Record the technical decisions and their evidence for installing
`codebase-memory-mcp` and registering it in the machine-global MCP config, so the
implementing agent does not have to re-derive them and the checking agent has
something to check against.

The requirements live in [`prd.md`](./prd.md). This file owns the *how*.

---

## The Division Of Labour

The repo's stated split is **"bash decides and reports, Node reads and writes
JSON"** ([`scripts/index.md`](../../spec/scripts/index.md)). This change follows it
with two files, mirroring the existing `setup.sh` → `render-settings.mjs` pair.

| File | Runtime | Owns |
| --- | --- | --- |
| `scripts/install-mcp.sh` | bash | Binary presence and install; the `--force` / `--skip-mcp` flags; destinations; user-facing output; calling the helper |
| `scripts/register-mcp-server.mjs` | Node ESM | Reading, merging, comparing, backing up and writing the MCP config; `--check` |

Why not one script: bash cannot do this merge. The repo has no `jq`, and
[`shell-guidelines.md`](../../spec/scripts/shell-guidelines.md) forbids parsing
JSON in bash — a one-liner is only sanctioned for "a single field", and this is a
structured merge into a file whose other keys must survive. Why not one `.mjs`:
the install half is `curl | bash` plus `command -v`, which is bash's job and
matches `setup.sh`'s conventions.

---

## Surface Classification

`layout-and-surfaces.md` defines four surfaces — **Tracked**, **Symlinked**,
**Generated**, **Ignored** — and asks a new file to pick one. `~/.config/mcp/mcp.json`
is **not** a fifth surface: it is the existing **Generated, outside the repo**
category, the one `~/.agents/.pi-setup-skills.json` already occupies, and the
count stays four. The map in `layout-and-surfaces.md` carries it for that reason,
and the file is not a new kind of thing — only a second member of a category that
was already there.

Consequences, and they are the reason this change is small:

- It is **not** added to `PI_DIRS` or `PI_FILES`. It does not live under `PI_DST`.
- It is **not** added to `PI_NOT_SYNCED`, because those entries are
  `pi-agent/`-relative and `doctor.sh` checks them with
  `git -C "$REPO_DIR" check-ignore -- "pi-agent/$name"`. A path outside the repo
  cannot be expressed in that array.
- It gets **no `.gitignore` entry** — there is no repo path to ignore.
- `sync.sh` and `sync-settings.mjs` are **untouched**. They enumerate `PI_DST`
  contents; a file under `~/.config/` is never enumerated.

The alternative — tracking the config in the repo and rendering it — was rejected;
see [Alternatives Rejected](#alternatives-rejected).

---

## `scripts/lib.sh` Gains `MCP_CFG`

Both `install-mcp.sh` and `doctor.sh` need the config path. The repo's rule is a
single definition plus hand-maintained prose sites, not two copies in two scripts:

```bash
# Global MCP server config, shared by every MCP-aware tool on this machine.
# Outside PI_DST on purpose: it is not a Pi surface, so it appears in neither
# PI_DIRS/PI_FILES nor PI_NOT_SYNCED. Deliberately not `PI_`-prefixed — that
# prefix marks a harness path, and sync.sh must not consider this one.
#
# The path deliberately follows the READER's resolution, not the XDG standard:
# pi-mcp-adapter hardcodes join(homedir(), ".config", "mcp", "mcp.json")
# (dist/config.js:12) and ignores XDG_CONFIG_HOME, so honouring the variable here
# would register the server where the adapter never looks — and doctor.sh would
# read this same constant back and report green. doctor.sh warns when
# XDG_CONFIG_HOME is set to something else.
#
# Written by scripts/install-mcp.sh and checked by scripts/doctor.sh.
readonly MCP_CFG="$HOME/.config/mcp/mcp.json"
```

`readonly` for the same reason as the existing arrays: a re-declaration in a
consumer is rejected rather than silently replacing the value.

This widens `lib.sh`'s contract, which
[`shell-guidelines.md`](../../spec/scripts/shell-guidelines.md) currently states as
"`PI_DIRS`, `PI_FILES` and `PI_NOT_SYNCED` are the whole contract", and which
`lib.sh`'s own header repeats. Both must be updated in the same change — that is a
propagation site, not an optional tidy-up.

**Not** `PI_`-prefixed and **not** array-shaped on purpose: it is a single
destination with a different root and a different lifecycle from the harness path
lists, and naming it `PI_*` would imply `sync.sh` should consider it.

The value is `$HOME/.config/mcp/mcp.json`, not
`${XDG_CONFIG_HOME:-$HOME/.config}/mcp/mcp.json`. The XDG form was written first
and is wrong: `pi-mcp-adapter` hardcodes
`join(homedir(), ".config", "mcp", "mcp.json")` (`dist/config.js:12`) and never
consults `XDG_CONFIG_HOME`. On a machine with the variable set, the XDG form
registers the server at a path the adapter does not read, and `doctor.sh` —
reading the same constant back — reports green while nothing is reachable. This
is the one list here whose value tracks another program's resolver rather than the
environment, so `doctor.sh` warns when the two disagree.

---

## `scripts/register-mcp-server.mjs`

### Contract

```text
node scripts/register-mcp-server.mjs <config-path> <server-name> <command> [--check]
```

- Positional first, flags after ([`node-guidelines.md`](../../spec/scripts/node-guidelines.md)).
- Missing required positionals → usage on **stderr**, exit `2`.
- `--check` writes nothing, not even a backup, and exits `1` on drift.
- Exit `0` on success or on an already-correct file; `1` on any failure.
- Unknown flags are ignored, per the existing helpers — positional slots are the guard.

Three positionals rather than a hard-coded server table, so the helper stays
generic and reusable for the next MCP server. `<command>` is passed in rather than
derived, which is what lets the caller choose the PATH-resolved name.

### The entry

```js
const entry = { command, args: [], lifecycle: "lazy" };
```

`lifecycle: "lazy"` mirrors the adapter's own generated entry
(`config.ts:1154`, `buildRepoPromptEntry`) and means the server is not connected
until one of its tools is actually called. `command` is the bare
`codebase-memory-mcp`, never an absolute path — an absolute path is
machine-specific and the file is shared across every MCP-aware tool on the
machine, so it must not carry one.

### The merge

```js
let raw = {};
if (fs.existsSync(configPath)) {
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    refuse(`is not valid JSON: ${error.message}`, "refusing to overwrite it; fix or remove the file by hand");
  }
  if (!isPlainObject(raw)) {
    refuse(`is ${typeName(raw)}, not an object`, "refusing to overwrite it; fix or remove the file by hand");
  }
  if (raw["mcp-servers"] !== undefined && raw.mcpServers === undefined) {
    refuse(`uses the key "mcp-servers"; this helper writes "mcpServers"`, "rename it to \"mcpServers\" by hand first …");
  }
  if (raw.mcpServers !== undefined && !isPlainObject(raw.mcpServers)) {
    refuse(`has ${typeName(raw.mcpServers)} in "mcpServers", not an object`, "refusing to overwrite it; fix or remove the file by hand");
  }
}
const out = structuredClone(raw);
out.mcpServers = { ...(out.mcpServers ?? {}), [serverName]: entry };
```

`refuse(problem, remedy)` is one function so every rejection has the same
two-line shape and the same exit `1` — no write, no backup. Six rules, each of
which has a failure mode it prevents:

1. **An unparseable existing file is a hard error, never treated as empty.** This
   file is shared. Starting from `{}` on a parse failure would silently delete
   every other server configured on the machine.
2. **A root that is not an object is refused.** `JSON.parse` accepts `[]`,
   `"…"`, `null` and `42`, none of which can hold servers, and the array case is
   the dangerous one: `out.mcpServers = …` sets a property on an array,
   `JSON.stringify` drops it, the run prints `install` and a backup is written —
   while nothing is registered — and `--check` on the rewritten file then exits
   `0`. A silent false success on a shared file is the same class of damage as a
   parse-failure reset. Refuse before any write and name the type found.
3. **A non-object `mcpServers` value is refused.** The merge spreads
   `out.mcpServers`, so a string is rekeyed into `{"0":"o","1":"o",…}` and an
   array into `{"0":{…}}` — every other server destroyed, exit code `0`. This is
   the root check one level down, and it is the same hole.
4. **`structuredClone` before mutating.** The object returned by `JSON.parse` is
   the comparison basis; spreading is not enough, because nested entries would be
   shared and mutated in place.
5. **Spreading `mcpServers` preserves foreign entries.** The script owns exactly
   one key. `/mcp setup` is a documented writer of this file, so it may already
   hold servers this repo knows nothing about.
6. **A hyphenated `mcp-servers` key is refused, not merged.** The adapter's reader
   accepts `raw.mcpServers ?? raw["mcp-servers"] ?? {}` (`config.ts:1037`). If the
   file uses only the hyphenated form, writing `mcpServers` creates a second key
   that the adapter prefers — silently shadowing whatever was there. So: if
   `mcp-servers` exists and `mcpServers` does not, print an error naming both keys
   and exit `1`. Rewriting a key this repo did not create is the same class of
   mistake as overwriting a user's real file with a symlink.

Rules 1–3 and 6 are one refusal family: on a file this repo does not own, an
inability to merge safely is reported and nothing is touched.

### Compare, back up, write

Follows the three-step discipline verbatim:

```js
const next = JSON.stringify(out, null, 2) + "\n";
const previousText = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : null;

if (previousText === next) {
  console.log(`  ok       ${configPath}`);
  // exit 0, no write, no backup
} else if (checkOnly) {
  console.error(`  drift    ${configPath} does not register ${serverName}`);
  console.error(`           run ./setup.sh or scripts/install-mcp.sh`);
  process.exit(1);
} else {
  // backup as ${configPath}.bak-<YYYYMMDDHHMMSS>, then mkdirSync + writeFileSync
}
```

Two details that differ from `render-settings.mjs`, and why:

- **The backup suffix is `.bak-<stamp>`, not `.pre-render-<stamp>`.** The
  `pre-render` name belongs to `settings.json`'s render pipeline and that
  pipeline's `.gitignore` comment. This file is not rendered into the repo and
  has no `.gitignore` entry, so borrowing the name would imply a relationship that
  does not exist. `.bak-<stamp>` is the suffix `setup.sh::link()` already uses for
  "I am about to replace a real file".
- **`--check` must be side-effect-free across all paths**, including the backup —
  which is why the `checkOnly` branch returns before the backup call.

The text comparison `previousText === next` is what makes a second run a genuine
no-op: an already-correct file is byte-identical, so nothing is written and no
backup accumulates. A **reformatted** but semantically correct file *is* drift
here, unlike the deliberate `packages`-as-a-set exception in
`render-settings.mjs --check` — this file is machine-global and not
hand-maintained by the harness, so canonical formatting is the contract.

---

## `scripts/install-mcp.sh`

### Contract

```text
scripts/install-mcp.sh [--force] [--quiet]
```

- `--force` reinstalls even when the binary is present. This is the update path,
  because the repo's "re-running is how you update" convention would otherwise
  mean a 37.3 MB download (and a 293 MB binary on disk) on every `setup.sh`.
- `--quiet` suppresses the piped installer output. It never suppresses a
  *failure's* output: when the installer exits non-zero the captured log is
  printed either way, because the error line points at it.
- `-h` / `--help` prints the header comment and exits `0`.
- Unknown flag → usage on stderr, exit `2`.

Skeleton per [`shell-guidelines.md`](../../spec/scripts/shell-guidelines.md):
shebang, lone `#`, comment block, `set -euo pipefail`, `REPO_DIR` from
`BASH_SOURCE` one level up, `lib.sh` existence check then source, `node` preflight.

### Steps

1. `command -v codebase-memory-mcp` → present and not `--force`: `say keep`.
2. Absent or `--force`: pipe the upstream `install.sh` to `bash -s -- --skip-config`.
   `--skip-config` is the load-bearing flag — see [Open Risks](#open-risks).
3. Re-verify with `command -v`; a missing binary after install is fatal
   (`say error`, exit `1`). A silent failure here would leave `doctor.sh` to
   report a confusing pair of problems later.
4. Call the helper:
   `node "$REPO_DIR/scripts/register-mcp-server.mjs" "$MCP_CFG" codebase-memory-mcp codebase-memory-mcp`.

Output uses `say` with canonical verbs only — `keep`, `install`, `render`, `ok`,
`error`. No new synonyms.

### Failure policy

| Situation | Behaviour | Matches |
| --- | --- | --- |
| `node` absent | fatal, exit `1` | every script that needs Node |
| Binary install fails or the binary is still absent | fatal, exit `1` | "unknown optional" is fatal in `optional.sh` |
| Config unparseable, not an object, a non-object `mcpServers`, or a hyphenated key | fatal, exit `1` (from the helper) | `doctor.sh` treats bad registration as a problem |
| Binary already present | `say keep`, continue | `auth.json`'s `say keep` |
| Already registered and byte-identical | `ok`, no write | `render-settings.mjs` no-op path |

A partial outcome is never left unreported and never rolled back — re-running is
the recovery path, as with `install-skills.mjs`.

---

## `setup.sh` And `doctor.sh`

**`setup.sh`** gains step 6, between plugins (5) and verify (7):

```bash
echo "==> MCP servers"
if [ "$SKIP_MCP" = 1 ]; then
  say skip "install-mcp.sh (--skip-mcp)"
else
  "$REPO_DIR/scripts/install-mcp.sh" || note "MCP install had problems; see above"
fi
```

Non-fatal on failure, like skills and plugins: one unavailable MCP server must not
abort a setup run that has already rendered and linked the harness. The header
comment is the `--help` text, and the numbered list in it grows to 7 items —
keeping the block comment-only, because a single uncommented line truncates it.

**`doctor.sh`** gains an `==> MCP server  ($MCP_CFG)` section, placed after
`==> Optional bundles` and before `==> Symlinked resources`, using `ok` / `warn` /
`bad` with the existing counters and no `set -e`:

| Check | Verdict |
| --- | --- |
| `command -v codebase-memory-mcp` succeeds | `ok` |
| Binary absent | `warn` — not every machine has to want cbm |
| `$MCP_CFG` exists and the helper's `--check` exits `0` | `ok` |
| `$MCP_CFG` exists but `--check` exits `1` | `bad` — drift between what `setup.sh` produces and what is on disk |
| `$MCP_CFG` absent while the binary is present | `bad` — the binary is installed but unreachable |
| Binary absent *and* config absent | `warn` only, one line — a machine that never enabled cbm must not fail `doctor.sh` |
| `XDG_CONFIG_HOME` set to something other than `$HOME/.config` | `warn` — `pi-mcp-adapter` ignores the variable, so the registration lives at `$HOME/.config/mcp/mcp.json`; without the note the path in the section header looks like a bug |

The last row is the one that matters: `doctor.sh` must end in `All good.` on a
machine where `--skip-mcp` was used, so absence-of-both is a note, not a problem.

---

## Boundaries

- **This task does not touch `sync.sh`, `sync-settings.mjs`, `.gitignore`, or
  `PI_NOT_SYNCED`.** If an edit to any of them looks necessary, the surface
  decision has been misread — return to
  [Surface Classification](#surface-classification).
- **It does not modify `~/.pi/agent/mcp.json`.** That is the Pi-owned override
  layer; the global shared config was chosen deliberately.
- **It does not generate or reference `cbmem.ts`.** The pi extension route is out
  of scope and its upstream generator is broken against Pi 0.85.1.
- **It does not pin a version** and does not record one.
- **It does not uninstall.** Upstream's `codebase-memory-mcp uninstall` is the
  documented removal path if one is ever needed.

---

## Alternatives Rejected

**Track the config in the repo and render it, like `settings.json`.**
Rejected on cost and on correctness. Cost: nine propagation sites (`lib.sh`,
`.gitignore`, `PI_NOT_SYNCED`, `setup.sh`, `sync.sh`, `doctor.sh`, `README.md`,
two spec files) plus a new renderer, for a two-line file. Correctness: the config
is written by `rename(2)` (`config.ts:1029`), so it cannot be a symlink, and it is
not derived from anything in the repo — it is a single hand-authored entry. There
is no "input" for a renderer to read that is not the output itself.

**Symlink `~/.config/mcp/mcp.json` into the repo.**
Rejected: the atomic-rename trap `layout-and-surfaces.md` documents for
`auto-compact.json`. `rename(2)` replaces the symlink rather than its target, so
the first `/mcp` write disconnects the repo copy, and `setup.sh`'s `link()` then
moves the real file to a `.bak-<stamp>` and re-links the stale repo version —
discarding the just-written config.

**Register in `~/.pi/agent/mcp.json` instead of the global file.**
Rejected: Pi-only. The point of an MCP server available to a coding agent is that
every MCP-aware tool on the machine shares one entry, and the global layer is
precedence 1 of 6 while the Pi override is 4. It would also reintroduce the
`rename(2)` exposure through `ensureCompatibilityImports` (`config.ts:1214`).

**An `optional/codegraph-mcp/` bundle.**
Rejected on a schema gap as much as on intent: an optional manifest contributes
`packages` and `settings` keys to `settings.json`
([`optional-bundles.md`](../../spec/config/optional-bundles.md)). It has no way to
express an MCP server, which lives in a different file at a different path, so
this would need a schema extension for a bundle with one member.

**One bash script with an inline `node -e` merge.**
Rejected: `shell-guidelines.md` sanctions `node -e` for "a single field" only, and
this is a structural merge with backup and compare semantics. The two-file split
is also the existing convention.

**Always re-running the upstream installer on every `setup.sh`.**
Rejected: a 37.3 MB download (293 MB on disk) per run for a no-op, and it would
make `setup.sh`
network-dependent for a step that is usually already satisfied. `--force` gives
the update path explicitly.

---

## Open Risks

1. **`--skip-config` is upstream's flag and is not versioned here.** If upstream
   renames or removes it, the installer falls back to touching `~/.pi/agent`, and
   because `~/.pi/agent/extensions` is a symlink into this repo, a generated
   `cbmem.ts` lands in `pi-agent/extensions/`. Mitigation: after the install,
   `doctor.sh`'s existing symlink checks and a clean `git status --short` catch it
   on the next run. A cheap stronger guard — refusing to proceed if the installer
   wrote `pi-agent/extensions/cbmem.ts` — is worth considering in review.
2. **The config is shared with other tools, and this script is not the only
   writer.** `/mcp setup`, `/mcp enable`/`disable` and hand edits all reach it. The
   compare-before-write path tolerates all of them; a *reformatted* file reads as
   drift, which `doctor.sh` will report as a `bad`. Accepted: canonical formatting
   is the contract, and the fix is `./setup.sh`.
3. **`setup.sh` gains remote code execution.** `curl | bash` from a GitHub
   `main` branch, on every machine, unattended. This is the accepted cost of
   decision 3 in the PRD. A pinned commit or a checksum would reduce it and is
   explicitly out of scope here.
4. **`lifecycle: "lazy"` is an adapter-specific key.** A different MCP host may
   ignore it or require `type: "stdio"` instead. Unknown keys are harmless in
   every host examined; if the entry proves unusable elsewhere, the fix is additive.
5. **No unit coverage exists for these scripts.** There is no test suite in this
   repo; the verify chain in `implement.md` is the whole safety net, and it is why
   proving the failure modes before reverting them is a required step rather than
   an optional one.

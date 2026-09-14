# Implement Plan — Install and register the codebase-memory MCP server

Requirements: [`prd.md`](./prd.md). Technical decisions and their evidence:
[`design.md`](./design.md). This file is the ordered execution plan; where it and
`design.md` disagree about *how*, `design.md` wins, and a disagreement is itself a
finding to report.

---

## Ground rules

- **Read before writing.** Every file in the source list below, in full, before
  its first edit. The specs are not suggestions — the exact `say` format, exit
  codes, backup naming and `--check` side-effect rules are contracts that
  `doctor.sh` and the verify chain depend on.
- **`doctor.sh` never gains `set -e`** and never `exit`s early.
- **No JSON parsing in bash.** No `jq`. One `node -e` for a single field at most;
  anything structural goes in the helper.
- **`setup.sh`'s header comment stays comment-only** — it *is* the `--help` text,
  extracted by awk until the first non-comment line.
- **pi-lens rewrites `*.sh` and `*.md` on write.** It reflows `case` arms, expands
  `a; b` one-liners, and re-spaces Markdown tables. Never quote a snippet in a spec
  from memory — copy it out of the file after the write has settled.
- **Verify the helper against temp paths, not the live config.** All failure-mode
  and drift testing uses `/tmp/pi-mcp-<purpose>.$$/mcp.json`. Only Step 9 touches
  `$MCP_CFG` for real. This is the difference between a test and an outage.
- **A partial install is reported, never rolled back.** Re-running is the recovery
  path, as with `install-skills.mjs`.

## Source list (read these; do not guess at their contents)

| File | Why |
| --- | --- |
| `scripts/lib.sh` | the single-definition contract and the `readonly` convention |
| `scripts/render-settings.mjs` | the reference `.mjs`: header block, argv loop, `--check`, backup, no-op path |
| `scripts/install-skills.mjs` | the reference for network fetch, `execFileSync`, and the collect-problems failure pattern |
| `scripts/doctor.sh` | section shape, `ok`/`warn`/`bad` counters, where the new section slots in |
| `scripts/sync.sh` | confirm it needs no change (it enumerates `PI_DST` only) |
| `setup.sh` | the numbered header block, `usage()`, flag loop, `say`, `note`, step order |
| `scripts/optional.sh` | the subcommand-dispatch and `render()` call style |
| `.trellis/spec/scripts/shell-guidelines.md` | bash contracts |
| `.trellis/spec/scripts/node-guidelines.md` | Node contracts |
| `.trellis/spec/scripts/index.md` | layer inventory to update |
| `.trellis/spec/config/layout-and-surfaces.md` | the four surfaces and the decision tree |
| `.trellis/spec/config/pi-resources.md` | the `pi-mcp-adapter` paragraph to correct |
| `.trellis/spec/guides/change-propagation-guide.md` | the sites that must move together |
| `README.md` | the numbered setup list and the day-to-day table |

---

## Step 1 — `scripts/lib.sh`: the `MCP_CFG` definition

Add one `readonly` assignment and extend the header comment, which currently says
the arrays are the whole contract.

```bash
readonly MCP_CFG="$HOME/.config/mcp/mcp.json"
```

Placed after `PI_NOT_SYNCED`, with a comment naming the two consumers
(`install-mcp.sh`, `doctor.sh`), stating why it is not `PI_`-prefixed (it is not a
harness path, so `sync.sh` must not consider it), and stating that the path
follows the **reader's** resolution rather than the XDG standard. It is `$HOME`,
not `${XDG_CONFIG_HOME:-$HOME/.config}`: `pi-mcp-adapter` ignores
`XDG_CONFIG_HOME`, so a variable-honouring constant would register the server
where the adapter never looks — and `doctor.sh`, reading this same constant back,
would report green. `doctor.sh` gains a `warn` for that mismatch (Step 5).

**Do not** add it to any of the three arrays. If that looks necessary, the surface
classification in `design.md` has been misread.

Verify: `bash -n scripts/lib.sh`, then
`bash -c '. scripts/lib.sh; echo "$MCP_CFG"'` → `~/.config/mcp/mcp.json`-shaped
absolute path, and `XDG_CONFIG_HOME=/tmp/x bash -c '. scripts/lib.sh; echo "$MCP_CFG"'`
→ **the same homedir path**, not `/tmp/x/mcp/mcp.json`. The variable must not move
this constant: `pi-mcp-adapter` hardcodes `join(homedir(), ".config", "mcp",
"mcp.json")` (`dist/config.js:12`), so the XDG form would register the server
where the adapter never looks while `doctor.sh` reads the same constant back and
reports green.

## Step 2 — `scripts/register-mcp-server.mjs`

New file. Follow the `render-settings.mjs` file shape exactly: shebang, a `#`
separator, a comment block carrying the invocation line and every flag, then
imports.

Import surface, and nothing more:

```js
import fs from "node:fs";
import path from "node:path";
```

`path` is used only for `path.dirname` on the config path, so the helper does not
need `repoRoot`. Argument handling, the entry shape, the merge rules, the
refusal cases, the compare/backup/write sequence, the exit codes and the verb
format are all specified in
[`design.md` § `scripts/register-mcp-server.mjs`](./design.md#scriptsregister-mcp-servermjs).
Implement them as written; the six merge rules each prevent a named failure mode
and are not summarisable.

Three things easy to get wrong:

- The `mcp-servers` refusal must fire **before** any write, and its message must
  name both keys so the user knows what to change.
- The two **shape** refusals (`design.md` rules 2 and 3) are not optional polish:
  an array root serialises without an `mcpServers` property, so the run prints
  `install`, writes a backup, registers nothing, and `--check` on the rewritten
  file then exits `0`; and spreading a non-object `mcpServers` rekeys it
  (`{"mcpServers":"oops"}` → `{"0":"o","1":"o",…}`) and exits `0`. Both must
  refuse with exit `1` and name the type found.
- `--check` must return before the backup call, not after it. A backup file
  written during a check is a side effect, and the acceptance criteria test for
  its absence.

Verify: `node --check scripts/register-mcp-server.mjs`, then the four `--check`
cases, the two usage cases and the two shape refusals against temp paths — see
Step 6 for the exact commands. Nothing here may touch `$MCP_CFG`.

## Step 3 — `scripts/install-mcp.sh`

New file, mode `100755`. Skeleton, `REPO_DIR`, `lib.sh` existence check then
source, and the `node` preflight all follow
[`shell-guidelines.md`](../../spec/scripts/shell-guidelines.md) verbatim.

Skeleton order matters: `REPO_DIR` from `BASH_SOURCE` one level up, then the
`lib.sh` guard, then `. "$LIB"`, then the `node` preflight, then the flag loop.

Steps, flags and the failure policy are in
[`design.md` § `scripts/install-mcp.sh`](./design.md#scriptsinstall-mcpsh).

Three things easy to get wrong:

- The upstream installer's output goes to a `/tmp/pi-mcp-install.$$` file with
  `sed 's/^/  /'` prefixing, and `rm -f` runs unconditionally after the branch —
  the `setup.sh` plugin-refresh pattern.
- **Re-check `command -v` after the install.** A failed download that still exits
  `0` would otherwise be recorded as success, and `doctor.sh` would report a
  confusing binary-present/config-absent pair later. That re-check needs
  `~/.local/bin` on `PATH`, which is where the installer puts the binary — note
  the dependency in the comment block.
- **Mention the installer's side effects in the header comment** (which is the
  `--help` text): it appends a PATH line to `~/.bashrc` and leaves
  `~/.local/bin/install.sh`. `--skip-config` prevents neither, neither is visible
  to `git status` or `doctor.sh`, and this repo does not edit files it does not
  own, so they are documented rather than cleaned up. A `note` line after a
  successful install makes it visible in the run that caused it.

The install itself is 37.3 MB downloaded and 293 MB on disk per machine, which is
the number behind keeping `--force` explicit rather than re-installing every run.

Verify: `bash -n scripts/install-mcp.sh`, `ls -l` shows `-rwxr-xr-x`, and
`./scripts/install-mcp.sh --help` prints the header block via `--help` → exit `0`.

## Step 4 — `setup.sh` wiring

Three edits, all of which are separate hand-maintained sites:

1. The header comment's numbered list — insert MCP as step 6, renumber verify to
   7. Keep the block comment-only.
2. `SKIP_MCP=0` alongside the other `SKIP_*` defaults, and a `--skip-mcp` arm in
   the flag loop following the `--skip-skills` shape.
3. A new `==> MCP servers` section between the plugin refresh and the verify call,
   non-fatal on failure via `note`, and calling
   `"$REPO_DIR/scripts/install-mcp.sh"` by absolute path.

Verify: `bash -n setup.sh`, `./setup.sh --help` shows the 7-item list and
`--skip-mcp`, and `./setup.sh --skip-mcp` prints
`skip     install-mcp.sh (--skip-mcp)`.

## Step 5 — `doctor.sh` section

New `==> MCP server  ($MCP_CFG)` section, placed after `==> Optional bundles` and
before `==> Symlinked resources`. The verdict table is in
[`design.md` § `setup.sh` And `doctor.sh`](./design.md#setupsh-and-doctorsh).

The registration half calls the helper with `--check` and branches on its exit
code — never on parsed output, because nothing in this repo writes
machine-parseable stdout.

The one non-obvious requirement: **binary-absent is a `warn`, and binary-absent
*with* config-absent stays a single `warn`.** A machine that used `--skip-mcp`
must still reach `All good.`, so this section cannot emit a `bad` for the
legitimate "not enabled here" state.

Verify: `./scripts/doctor.sh` on the current machine (nothing installed yet) ends
in `All good.` with exactly one informational note from this section.

Also add the `XDG_CONFIG_HOME` note: when the variable is set to something other
than `$HOME/.config`, `warn` that `pi-mcp-adapter` ignores it and that the
registration is at `$MCP_CFG`. Without it the homedir path in the section header
looks like a bug on an XDG machine, and the whole point of `MCP_CFG` following the
reader is lost on the first machine that sets the variable.

## Step 6 — Prove the failure modes, then revert

There is no test suite. A check that has never failed is not evidence, so each of
these is run deliberately against a **temp** config and then undone. Use
`TMPD=/tmp/pi-mcp-check.$$ && mkdir -p "$TMPD"`.

| # | Setup | Expected |
| --- | --- | --- |
| 1 | `$TMPD/absent.json` does not exist; run the helper **without** `--check` | exit `0`; file created; parses; one entry identical to the design shape; one trailing newline |
| 2 | Re-run the same command | exit `0`; **no** `*.bak-*` beside the file; mtime unchanged |
| 3 | `--check` on the file from #1 | exit `0`; mtime unchanged; no backup |
| 4 | `--check` on `$TMPD/absent.json` when it does **not** exist | exit `1` |
| 5 | Add a foreign server (`{"other":{"command":"other","args":[]}}`) next to the entry, then run without `--check` | exit `0`; the foreign entry's **value** survives exactly (the whole file is re-serialised, so its original formatting is not preserved byte-for-byte); a `.bak-<stamp>` exists and holds the pre-merge text |
| 6 | Write `{invalid` into a file, run without `--check` | exit `1`; the file is **unchanged**; no backup; message names the parse failure |
| 7 | Write `{"mcp-servers":{}}` (hyphenated, no camelCase key), run without `--check` | exit `1`; file unchanged; message names both `mcp-servers` and `mcpServers` |
| 8 | `--check` with a deliberately wrong `command` (e.g. `/usr/bin/codebase-memory-mcp`) | exit `1` |
| 9 | Run with no positionals | usage on stderr, exit `2` |
| 10 | Run with two positionals | usage on stderr, exit `2` |
| 11 | Write `[]` (array root), run without `--check`, then `--check` the same file | both exit `1`; file byte-identical after each (sha); no backup; message names the type found (`an array`) |
| 12 | Write `{"mcpServers":"oops"}`, run without `--check`, then `--check` the same file | both exit `1`; file byte-identical (sha); no backup; message names the type found (`a string`) |

Then `rm -rf "$TMPD"`.

Cases 6 and 7 are the safety-critical pair, and 11 and 12 are the same pair one
step out: every refusal must **leave the file untouched**. If any of them writes,
the design has been violated and the implementation stops here — a shared config
that gets silently replaced or silently no-op'd is data loss, or worse, for every
other MCP server on the machine. Cases 11 and 12 are also the pair that used to
pass: an array root printed `install` and wrote a backup while registering
nothing, and `{"mcpServers":"oops"}` was rekeyed into `{"0":"o","1":"o",…}`, both
exiting `0`. Assert byte-identity with `sha256sum` rather than a spot check.

For the `doctor.sh` half, `MCP_CFG` follows `pi-mcp-adapter`'s hardcoded homedir
path, so `XDG_CONFIG_HOME` no longer redirects it — the drift verdicts are
exercised by moving `HOME` instead, and only the `==> MCP server` section is
asserted (a fake `HOME` makes every other section report its own problems by
design):

1. `HOME=$TMPD ./scripts/doctor.sh` with no binary and no config → in the MCP
   section, one `!` note and no `✗`.
2. Same, with `$TMPD/.config/mcp/mcp.json` holding a valid entry stamped with a
   wrong `command` → `✗` for registration in the MCP section (the script's own
   exit is `1` anyway under a fake `HOME`, because the other sections fail by
   design — assert the `✗`, not the exit code).
3. Same, with the correct entry → `✓` for registration (the binary check stays a
   note, since cbm is genuinely not installed).
4. `XDG_CONFIG_HOME=/tmp/x ./scripts/doctor.sh` with the real `HOME` → an extra
   `!` note saying `pi-mcp-adapter` ignores `XDG_CONFIG_HOME` and naming
   `$HOME/.config/mcp/mcp.json`. `MCP_CFG` itself must still be the homedir path.

Revert: nothing to revert — every case ran against `$TMPD` or a fake `HOME`.

## Step 7 — `README.md`

Four sites:

1. The numbered "does six things" list becomes seven, with the MCP step inserted
   before the verify step, and the count in the prose sentence corrected.
2. The `--skip-*` flag list gains `--skip-mcp`.
3. The day-to-day `| Command | What it does |` table gains a row for
   `scripts/install-mcp.sh`, and the plugin/command area gains whatever the
   existing prose shape needs so a reader can find the server they just installed.
4. The MCP section states what the server costs — **37.3 MB downloaded, 293 MB on
   disk** — and names the installer's side effects (the `~/.bashrc` PATH line and
   `~/.local/bin/install.sh`). A core package a reader did not ask for has to
   state its price where they will see it.

Do not restate `design.md`'s rationale in the README — the repo's convention is
that `README.md` is the front door and `.trellis/spec/` owns the reasoning.

Verify: `grep -n 'six things\|--skip-\|install-mcp' README.md` shows every site
updated and no stale count left.

## Step 8 — Spec updates

Six files, each with a specific correction rather than an append:

| File | Change |
| --- | --- |
| `spec/scripts/index.md` | runtime table lists `{render-settings,sync-settings,install-skills}.mjs` → add the new helper; "all four currently do" for the node preflight → five; the `100755` list gains `install-mcp.sh` |
| `spec/index.md` | line 15 states "three dependency-free Node ESM helpers" → four |
| `spec/scripts/shell-guidelines.md` | `lib.sh`'s contract is stated as `PI_DIRS`/`PI_FILES`/`PI_NOT_SYNCED` being "the whole contract" → widen it to include `MCP_CFG`; mirror in `lib.sh`'s own header comment. Also state that `MCP_CFG` follows the reader's resolution rather than `XDG_CONFIG_HOME`, and resync the `lib.sh` snippet with the `$HOME` form |
| `spec/config/pi-resources.md` | the `pi-mcp-adapter` paragraph ends "inert until an MCP config exists" → state the config path and that `setup.sh` now writes it; add a short section covering the **Generated, outside the repo** surface (not a fifth surface), the `XDG_CONFIG_HOME` divergence, the download/installed sizes, the installer side effects, and why no path list holds it |
| `spec/config/layout-and-surfaces.md` | add the map row for `~/.config/mcp/mcp.json` as **Generated, outside repo**, plus a line on why it takes no `PI_DIRS`/`PI_FILES`/`PI_NOT_SYNCED` entry. This file was missed in the first pass and is the one that defines the surface vocabulary the other two files quote |
| `spec/guides/change-propagation-guide.md` | new row in "Known Multi-Site Facts": the MCP config path and script names → `lib.sh` (single definition), `setup.sh` help text, `doctor.sh`, `README.md` (including its "not stored here" table), the two `spec/index.md` counts, `shell-guidelines.md`, `pi-resources.md`, and `layout-and-surfaces.md` |

Any verbatim snippet quoted in `shell-guidelines.md` or `node-guidelines.md` that
this change invalidates must be resynced from the real file in the same commit —
the files win, per that spec's own rule.

Verify: `grep -rn 'three dependency-free\|all four currently\|the whole contract' .trellis/`
returns nothing stale.

## Step 9 — Final battery

Run in order, from the repo root. This is the whole safety net.

```bash
bash -n setup.sh scripts/*.sh
node --check scripts/*.mjs

./setup.sh
./setup.sh                      # second run: same output, no new files
./scripts/sync.sh               # must report `same pi-agent/settings.core.json`
./scripts/doctor.sh             # must end `All good.`
git status --short              # clean, except the intended tracked edits
```

Then the two things no script checks:

```bash
ls -l ~/.pi/agent/extensions/cbmem.ts     # must not exist
ls ~/.pi/agent/AGENTS.md ~/.pi/agent/skills 2>&1   # must not exist
```

Both are the `--skip-config` guard: their presence means the upstream installer
touched the agent dir through the repo symlink, and the PRD's acceptance criteria
for a clean `git status` cannot hold.

End to end, in a **new** Pi session: `mcp({ search: "search_graph" })` must return
the codebase-memory tools. Report the tool count found.

## Rollback points

| After | Undo |
| --- | --- |
| Step 1 | `git checkout scripts/lib.sh` — nothing else reads `MCP_CFG` yet |
| Steps 2–3 | `git clean` the two untracked scripts; `rm "$MCP_CFG"` if it was created; `codebase-memory-mcp uninstall` if the binary was installed |
| Step 4 | `git checkout setup.sh` — the step is non-fatal, so a reverted call site cannot leave setup half-done |
| Step 5 | `git checkout scripts/doctor.sh` — a reporter with no side effects |
| Steps 7–8 | `git checkout README.md .trellis/spec/` |

The whole change reverts with `git checkout -- . && rm -f scripts/install-mcp.sh
scripts/register-mcp-server.mjs` plus removing the binary, since nothing is
symlinked and `settings.json` is regenerated. Note that `~/.config/mcp/mcp.json`
is **outside** the repo and is not covered by `git checkout` — remove it by hand
if a full teardown is wanted.

## Stop And Report

Stop and report rather than working around, if:

- The upstream installer writes anything into `pi-agent/` (the `--skip-config`
  guard has failed) — do not `git clean` it away silently, because the finding is
  the deliverable.
- Any Step 6 case writes when it must refuse, especially 6 or 7.
- `doctor.sh` cannot reach `All good.` on the binary-absent/config-absent path.
- `sync.sh` reports anything other than `same`.
- A spec file contradicts `design.md` in a way that changes the implementation.
- Registering the server requires adding a `.gitignore`, `PI_NOT_SYNCED`,
  `sync.sh` or `sync-settings.mjs` entry — that means the surface classification
  was wrong, and the surface decision is the thing to revisit, not the symptom.

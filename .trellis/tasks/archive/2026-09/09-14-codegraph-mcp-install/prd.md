# Install and register the codebase-memory MCP server

## Goal

Make the `codebase-memory-mcp` code-intelligence server a reproducible part of
this harness: one script installs the binary and registers it in the
machine-global MCP config, `setup.sh` calls it, and `doctor.sh` verifies it.

Today the harness has an MCP *client* and no MCP *servers*: `pi-mcp-adapter` is
installed and idle, and `mcp` reports `0/0 servers, 0 tools`. Setting a server up
by hand is a five-step ritual (download, guess at `--skip-config`, hand-edit a
JSON file, restart, discover it is wrong) that must be repeated on every machine.
This task turns that into `./setup.sh`.

## Context (measured 2026-09-14)

| Fact | Evidence |
| --- | --- |
| No MCP server configured | `mcp` → `0/0 servers, 0 tools`; all six adapter config paths absent |
| `pi-mcp-adapter` installed, inert | v2.33.0; `pi-resources.md:64` — "inert until an MCP config exists" |
| No MCP script exists, ever | `git log --diff-filter=A` shows only `scripts/install-skills.mjs` and the deleted `scripts/install.sh` |
| `~/.pi/agent/extensions` is a symlink into this repo | `-> /home/tan/my_pi_setup/pi-agent/extensions` |
| The upstream installer writes `~/.pi/agent/extensions/cbmem.ts` | `cli.c:9231`, reached via that symlink → lands **inside the repo** |
| The adapter writes config by atomic rename | `config.ts:1029-1033` — `writeFileSync(tmp)` + `renameSync` |
| Adapter write targets | `config.ts:1180` (project `.mcp.json` or `~/.config/mcp/mcp.json`), `:1214` (`~/.pi/agent/mcp.json`) |
| `~/.config/mcp/mcp.json` is outside `PI_DST` | so `sync.sh` never sees it; no `PI_NOT_SYNCED` or `.gitignore` entry is required |
| The adapter's own server entry shape | `config.ts:1154` — `{ command, args, lifecycle }` |
| What the server costs | release tarball **37.3 MB downloaded**; installed binary **293 MB on disk** (`ls -l ~/.local/bin/codebase-memory-mcp`, 0.10.8) |

## Requirements

**R1 — Install script.** `scripts/install-mcp.sh` installs the
`codebase-memory-mcp` binary when it is absent, using the upstream installer with
`--skip-config`. `--skip-config` is mandatory, not tidiness: without it the
installer writes `cbmem.ts` through the `~/.pi/agent/extensions` symlink into
`pi-agent/extensions/`, and creates a real `~/.pi/agent/AGENTS.md` and
`~/.pi/agent/skills/` that `PI_FILES` / `PI_DIRS` are designed to own.

**R2 — Idempotency.** A present binary is left alone (`say keep`) rather than
re-downloaded on every `setup.sh`. `--force` is the explicit update path. A
second run writes nothing and reports the same output. The cost this avoids
repeating is **37.3 MB downloaded and 293 MB on disk**, which is why the default
is keep rather than refresh.

**R3 — Registration helper.** `scripts/register-mcp-server.mjs` merges one server
entry into the machine-global MCP config. Bash must not parse JSON (no `jq`), and
a structural merge is an `.mjs` helper per
[`node-guidelines.md`](../../spec/scripts/node-guidelines.md).

**R4 — PATH-resolved command.** The entry is
`{"command": "codebase-memory-mcp", "args": [], "lifecycle": "lazy"}`. The
upstream installer emits an absolute `$HOME`-rooted path; writing that would make
a machine-specific value the tracked input and defeat the point.

**R5 — Merge, never replace.** Any other server already present in the config
survives verbatim. `/mcp setup` is a documented path to that file, so it may
already hold servers this script does not own.

**R6 — Compare before write, and back up.** An unchanged config is not rewritten
(no mtime change, no backup file). A changed config is backed up beside itself
before overwrite, per the node JSON write discipline.

**R7 — `--check`.** The helper reports drift and writes nothing, mirroring
`render-settings.mjs --check`. This is what `doctor.sh` calls.

**R8 — Single definition of the config path.** `MCP_CFG` is defined once in
`scripts/lib.sh` and sourced by `install-mcp.sh` and `doctor.sh`, because
`shell-guidelines.md` names duplicated path lists as this repo's failure mode.

**R9 — `setup.sh` wiring.** A new step calls `install-mcp.sh`, guarded by a
`--skip-mcp` flag mirroring `--skip-skills`. The header comment — which **is** the
`--help` text — is updated in the same change.

**R10 — `doctor.sh` check.** A new section reports the binary and the
registration using `ok` / `warn` / `bad` with counters, never exiting early.

**R11 — No new ignored paths.** `~/.config/mcp/mcp.json` stays outside the repo,
so `.gitignore`, `PI_NOT_SYNCED`, `sync.sh` and `sync-settings.mjs` are untouched.
This is the reason the change is small; a decision to track the config instead
would put it back at nine propagation sites.

**R12 — Documentation.** `README.md` (setup step, day-to-day table),
`spec/index.md` and `spec/scripts/index.md` (helper inventory and counts),
`spec/config/pi-resources.md` (the `pi-mcp-adapter` paragraph plus a new section),
`spec/scripts/shell-guidelines.md` (the widened `lib.sh` contract) and
`spec/guides/change-propagation-guide.md` (a new multi-site fact row).

## Acceptance Criteria

**Script behaviour**

- [ ] On a machine with no `codebase-memory-mcp` on `PATH`,
      `./scripts/install-mcp.sh` installs it and `command -v
      codebase-memory-mcp` succeeds afterwards.
- [ ] The resulting `$MCP_CFG` contains exactly one `codebase-memory-mcp` entry,
      equal to `{"command":"codebase-memory-mcp","args":[],"lifecycle":"lazy"}`.
- [ ] Pre-existing unrelated entries in `$MCP_CFG` keep their exact values. The
      writer re-serialises the whole file, so a foreign entry's original
      *formatting* is not preserved byte-for-byte — only its value is.
- [ ] `$MCP_CFG` is strict JSON, two-space indent, exactly one trailing newline.
- [ ] A second `./scripts/install-mcp.sh` creates no backup file, does not change
      `$MCP_CFG`'s mtime, and exits `0`.
- [ ] No `pi-agent/extensions/cbmem.ts`, no `~/.pi/agent/AGENTS.md`, and no
      `~/.pi/agent/skills/` exists after a run.

**`--check` contract**

- [ ] `node scripts/register-mcp-server.mjs "$MCP_CFG" codebase-memory-mcp
      codebase-memory-mcp --check` exits `0` when the entry is present and
      correct.
- [ ] It exits `1` when the entry is absent, when the command differs, and when
      the file is missing or unparseable.
- [ ] It writes nothing in every case, including the exit-`1` paths.
- [ ] Missing positionals print usage to **stderr** and exit `2`.

**Repo gates**

- [ ] `bash -n setup.sh scripts/*.sh` and `node --check scripts/*.mjs` pass.
- [ ] `./setup.sh` twice produces identical output, with no new files.
- [ ] `./scripts/sync.sh` reports `same pi-agent/settings.core.json`.
- [ ] `./scripts/doctor.sh` ends in `All good.`
- [ ] `git status --short` is clean.
- [ ] `scripts/install-mcp.sh` is mode `100755`.

**End to end**

- [ ] In a fresh Pi session, `mcp({ search: "search_graph" })` returns the
      codebase-memory tools.

## Constraints

- **Bash** (`shell-guidelines.md`): `set -euo pipefail`; `REPO_DIR` from
  `BASH_SOURCE`; `command -v node` preflight; `say()` at `"  %-8s %s\n"` using
  canonical verbs only; unknown flag → usage on stderr, exit `2`; scratch files at
  `/tmp/pi-<purpose>.$$` removed unconditionally; no `jq`, no JSON parsing.
- **Node** (`node-guidelines.md`): ESM `.mjs`, `node:`-prefixed builtins only,
  zero dependencies, synchronous I/O, `structuredClone` before mutating, compare
  before write, 9-column verb literals, diagnostics on `console.error`, exit
  `0`/`1`/`2`.
- **`doctor.sh`**: no `set -e`; `ok`/`warn`/`bad` with counters; never exits
  early. A missing binary is a `warn` (the machine may not want cbm), a broken
  registration is a `bad`.
- **`setup.sh`**: the header comment block must stay comment-only — one
  uncommented line silently truncates `--help`.
- **No new dependencies**, no npm install step, no `package.json`.
- The global MCP config is **shared** with other MCP-aware tools. The script must
  never rewrite keys it does not own, and must not be the only writer.

## Out Of Scope

- **Usage guides** for the new server — that is the separate in-flight task
  `09-14-usage-guides-plugins-skills`.
- **Pinning a version.** The upstream update path is re-running `install.sh`;
  `--force` exposes it. No version is recorded.
- **An `optional/` bundle.** Decided against: always-on core.
- **`~/.pi/agent/mcp.json`.** Decided against: the global shared layer serves
  every MCP-aware tool on the machine, not just Pi.
- **The generated `cbmem.ts` pi extension.** Deliberately unused — pi has an MCP
  client here, and the extension route needs a per-tool-call subprocess and
  registers its whole tool registry (`TOOLS[]` declares 17 on `main`; the
  installed 0.10.8 advertises 15) into context.
- **`codebase-memory-mcp uninstall` / a teardown script.** Not requested; note it
  exists upstream if the removal path is ever needed.

## Decisions Made

1. **2026-09-14 — always-on core, not an opt-in bundle.** Every machine running
   `setup.sh` gets the binary and the registration. Stated with its cost rather
   than hidden behind it: **37.3 MB downloaded and 293 MB on disk** per machine.
2. **2026-09-14 — `~/.config/mcp/mcp.json`, not `~/.pi/agent/mcp.json`.** The
   global shared layer is tool-agnostic: one entry serves Pi, Claude Code, Codex
   and Cursor. It is also outside `PI_DST`, which removes the ignore entry, the
   `sync.sh` report and the `PI_NOT_SYNCED` pairing.
3. **2026-09-14 — the script installs the binary.** `setup.sh` therefore gains a
   network dependency and remote code execution (`curl | bash` from GitHub) where
   it previously only did git clones and `pi update --extensions`. Accepted.
4. **2026-09-14 — `--skip-config` is mandatory.** Non-negotiable given the
   `~/.pi/agent/extensions` symlink.
5. **2026-09-14 — the entry's `command` is PATH-resolved.** Absolute paths are
   machine-specific; a tracked or shared config must not carry one.
6. **2026-09-14 — config is not symlinked and not rendered into the repo.** Its
   owner writes it with `rename(2)` (`config.ts:1029`), which replaces a symlink
   rather than its target — the exact trap `layout-and-surfaces.md` documents for
   `auto-compact.json`.

## Review Record

**2026-09-14 — gate passed, approved by yuanhai.tan.**

Reviewed: `prd.md` (R1–R12, all acceptance criteria), `design.md` (surface
classification, both script contracts, the four merge rules, rejected
alternatives), `implement.md` (9 steps, Step 6 failure-mode proofs, rollback
points), `research/upstream-evidence.md`, and both context manifests.

Three open decisions were put to the reviewer and answered:

1. **Always-on core**, not an optional bundle.
2. **`~/.config/mcp/mcp.json`**, the global shared layer, not the Pi-owned
   override.
3. **The script installs the binary**, accepting that `setup.sh` gains a network
   dependency and remote code execution.

Two risks were surfaced and knowingly accepted rather than reduced:

- `--skip-config` is an unversioned upstream flag. A rename would let the
  installer write through the `~/.pi/agent/extensions` symlink into the repo.
  Mitigation is detection, not prevention: `git status --short` and the
  `cbmem.ts`-absence check in `implement.md` Step 9. A hard refusal guard was
  considered and left to the implementer's judgement.
- The `curl | bash` install path. A pinned commit or checksum would reduce it and
  is out of scope.

No acceptance criterion, constraint or decision was changed at the gate.

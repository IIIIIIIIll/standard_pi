# my_pi_setup

Portable configuration store for my [Pi](https://pi.dev) coding-agent harness.

```bash
git clone git@github.com:IIIIIIIIll/my_pi_setup.git ~/my_pi_setup
~/my_pi_setup/setup.sh
```

That is the whole thing. `setup.sh` is idempotent — **re-running it is how you
update**, including pulling the latest skills from upstream.

It does eight things:

1. renders `~/.pi/agent/settings.json` from core settings + this machine's optional bundles
2. symlinks the resource files and dirs that exist in the repo — `AGENTS.md`
   (meaning `pi-agent/AGENTS.md`), `i-have-adhd.json`, `themes/`, `prompts/`,
   `tools/`, `skills/`, `agents/`, `extensions/`. A source the repo lacks is
   skipped silently, not linked ahead of time: the missing ones appear the next
   time `./setup.sh` runs after they are added. Today only `extensions/` and
   `i-have-adhd.json` exist, so nothing creates `~/.pi/agent/AGENTS.md`
3. seeds `~/.pi/agent/auth.json` from the template if absent
4. installs/refreshes skills **from their upstream sources** (see below)
5. refreshes Pi plugin packages (`pi update --extensions`)
6. installs the `codebase-memory-mcp` binary and registers it in the machine-global
   MCP config (see [MCP server](#the-mcp-server--installed-not-a-package))
7. restores the Trellis-generated Pi surfaces — `.pi/` adapters and
   `.agents/skills/trellis-*` (see [Trellis surfaces](#trellis-surfaces))
8. verifies everything with `scripts/doctor.sh`

A fresh install reproduces everything this repo owns: the symlinks, the rendered
`settings.json` (modulo Pi's own `lastChangelogVersion`), the declared package
set, each skill's content at the commit recorded in the provenance marker, and
the MCP registration. Plugin and skill sources are unpinned on purpose, so a
fresh install resolves the newest upstream — versions may differ from this
machine's, the set may not. Everything else is per-machine state that stays on
the machine: the table under
[What is intentionally *not* stored here](#what-is-intentionally-not-stored-here)
lists it.

Then add credentials and start Pi:

```bash
$EDITOR ~/.pi/agent/auth.json && chmod 600 ~/.pi/agent/auth.json
pi
```

Run `./setup.sh --help` for flags (`--with`, `--none`, `--yes`, `--skip-skills`,
`--skip-plugins`, `--skip-mcp`, `--skip-trellis`, `--skip-verify`).

---

## Skills are fetched, never vendored

Skills are **not** committed here. `skills.json` declares where each one comes
from, and `setup.sh` clones the source and installs it. Nothing can go stale,
because there is no snapshot to fall behind.

```json
{
  "sources": {
    "mattpocock": { "url": "https://github.com/mattpocock/skills.git", "ref": null }
  },
  "skills": [
    { "name": "code-review", "source": "mattpocock", "path": "skills/engineering/code-review" }
  ]
}
```

- `ref: null` tracks the source's default branch, so `./setup.sh` picks up whatever
  is upstream right now. Set `ref` to a tag or commit to pin.
- Add a skill by adding an entry; add another repo under `sources`.
- Resolved commit SHAs are recorded in `~/.agents/.pi-setup-skills.json` so you can
  see exactly what is installed.
- The whole skill directory is copied (upstream ships extra files such as
  `agents/openai.yaml` alongside `SKILL.md`).

Currently installed, all from [`mattpocock/skills`](https://github.com/mattpocock/skills):
`code-review`, `grill-me`, `grilling`, `improve-codebase-architecture`, `research`, `tdd`.

When to reach for each one, whether the model may invoke it on its own, and how it
is triggered: [`docs/skills.md`](docs/skills.md).

---

## Layout

| Path | Live location | How it is applied |
| ------ | --------------- | ------------------- |
| `pi-agent/settings.core.json` | `~/.pi/agent/settings.json` | **Rendered** — core settings, same everywhere |
| `optional/<name>/manifest.json` | `~/.pi/agent/settings.json` | **Rendered** — only where enabled |
| `pi-agent/auth.json.example` | `~/.pi/agent/auth.json` | Copied once as a template; the real file stays local |
| `pi-agent/AGENTS.md`, `pi-agent/i-have-adhd.json`, `pi-agent/{themes,prompts,tools,skills,agents,extensions}/` | `~/.pi/agent/…` | **Symlinked** (if present) |
| `skills.json` | `~/.agents/skills/` | **Fetched from upstream** by `setup.sh` |
| `.trellis/` (tracked) | — | Source of truth for the Trellis workflow |
| `.pi/`, `.agents/` (gitignored) | — | **Generated** by `scripts/install-trellis.sh` — see [Trellis surfaces](#trellis-surfaces) |
| `setup.sh` | — | The entry point |
| `scripts/` | — | Helpers, sync, optional toggles, doctor |
| `docs/` | — | Tracked prose: how to use what is installed — [plugins](docs/plugins.md), [skills](docs/skills.md), [agents](docs/agents.md). Never linked into `~/.pi/agent`. |

`settings.json` is **generated**, never tracked and never a symlink, because it is
a per-machine artefact:

```
settings.core.json  +  enabled optional manifests  ->  ~/.pi/agent/settings.json
```

---

## Trellis surfaces

`.pi/` (the Trellis Pi extension, the three role agents `pi-subagents` discovers,
and the `/trellis-*` prompt commands) and `.agents/skills/trellis-*` are **ignored
by git** — `trellis` generates them, and a committed copy would conflict with every
`trellis update`. So a fresh clone has none of them, and step 7 of `setup.sh` puts
them back:

```bash
./setup.sh                    # includes it
scripts/install-trellis.sh    # or run just this step
```

**`trellis update` cannot do this.** It compares the tracked
`.trellis/.template-hashes.json` against the working tree, reads each absent file
as a deletion *you* made, lists it under "Deleted by you (preserved)", and exits
`✓ Already up to date!`. `--force` does not override that. `scripts/install-trellis.sh`
runs `trellis init --pi -y -s -u <your username>` (`-u` keeps that call's own
`Developer:` line honest) instead. It writes `.trellis/.developer` **before** the
call, which is what stops `trellis init` taking its "new developer" branch and
therefore what *prevents* a `00-join-*` onboarding task and a duplicate developer
workspace directory — they are never created, so nothing has to remove them. What
it does prune is what its own `init` call newly creates under `.trellis/spec/`,
`.trellis/tasks/` and `.trellis/workspace/`, found by comparing the tree before
and after the call rather than by name (in practice the `spec/backend/` and
`spec/frontend/` template layers, which this repo has no use for). It restores
`.trellis/.template-hashes.json` from a byte snapshot, because `trellis init`
drops the `AGENTS.md` hash entry that keeps `trellis update` managing that file.

It is safe to re-run: when the surfaces and the `.trellis/.developer` name are
already correct it prints `ok` and changes nothing. It **is** safe to run on a
machine without the Trellis CLI too — it notes the missing CLI and exits `0`, so
the Pi harness still installs. Install the CLI with
`npm install -g @mindfoldhq/trellis`.

The developer name it writes is your **system username** (`id -un`), not
`git config user.name` — it only rewrites the `name=` line of
`.trellis/.developer`, so a per-developer `workflow=<id>` line in that file
survives. `./setup.sh --skip-trellis` opts out.

---

## Plugins

### Always-on — `settings.core.json`

Anything under `packages` is installed on every machine. Currently:

When to reach for each one, and what to type: [`docs/plugins.md`](docs/plugins.md).
The table below is the inventory; that page is the manual.

| Package | What it adds |
| --------- | -------------- |
| `npm:pi-subagents` | Sub-agent delegation, parallel review, scripted workflows |
| `npm:pi-web-access` | `web_search`, `fetch_content`, and source verification tools |
| `npm:@gotgenes/pi-permission-system` | The only thing gating tool calls — Pi itself has no permission prompts. Committed policy is deliberately permissive (`"*": "allow"`) plus a real `deny` lock that survives `yoloMode`: [`extensions/pi-permission-system/config.json`](pi-agent/extensions/README.md#permission-policy) |
| `npm:@juicesharp/rpiv-ask-user-question` | Structured questionnaire the model can put to you instead of guessing |
| `npm:@juicesharp/rpiv-todo` | Model-facing todo list as a live overlay surviving `/reload` and compaction |
| `npm:@sting8k/pi-vcc` | Algorithmic, LLM-free compaction summaries; keeps the raw transcript searchable |
| `npm:@thunstack/auto-compact` | Compacts early at a configurable **percentage** of context, plus `/auto-compact` and `/auto-compact-config` |
| `npm:pi-mcp-adapter` | MCP servers behind a single proxy tool instead of their full tool lists; reads `.mcp.json` and host configs, adds `/mcp` and `/mcp setup` |
| `npm:pi-lens` | Language-aware feedback on every write/edit — LSP diagnostics, linters/type-checkers, formatters, ast-grep/tree-sitter rules, `/lens-map` |
| `npm:pi-tps-status` | Live tokens-per-second meter in the status bar, with TTFT/token modes and provider-usage reconciliation; `/tps` configures it |
| `https://github.com/ayghri/i-have-adhd` | ADHD-shaped output — answer or next action first, numbered steps, no preamble. `/i-have-adhd` (or `stop adhd mode`) toggles it for the session; `/skill:i-have-adhd` is the aliased skill entry point |

`pi-subagents` also dispatches the Trellis role agents. A dispatched child runs as
its own Pi session, so `pi-agent/extensions/trellis-subagents-bridge/` keeps it
pointed at the session's active task — see
[extensions/README.md](pi-agent/extensions/README.md#trellis-subagents-bridge).

`pi-agent/extensions/run-timer.ts` shows how long the current run has taken, as a
`⏱ 12s` status line beneath the footer — see
[extensions/README.md](pi-agent/extensions/README.md#run-timer). Pi's own footer
is left untouched, so its cache-hit percentage (`CH`) is back where it always
was.

What each role agent is for, the prompt form that actually works, and how to drive
the plugins above day to day: [`docs/`](docs/README.md) —
[plugins](docs/plugins.md), [skills](docs/skills.md), [agents](docs/agents.md).

### The MCP server — installed, not a package

`pi-mcp-adapter` ships no servers of its own, so `setup.sh` installs
[`codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp) and
registers it in the machine-global MCP config at `~/.config/mcp/mcp.json`. That
path is `$HOME/.config/mcp/mcp.json` even when `XDG_CONFIG_HOME` is set, because
the adapter ignores that variable; `doctor.sh` notes the mismatch when it applies.

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "codebase-memory-mcp",
      "args": [],
      "lifecycle": "lazy"
    }
  }
}
```

- The `command` is the PATH-resolved name, never an absolute path, because this
  file is shared and must not carry a machine-specific value.
- That file is **shared by every MCP-aware tool on the machine**, and it lives
  outside `~/.pi/agent/`, so it is not synced into this repo. Merge, never
  replace: `scripts/register-mcp-server.mjs` owns exactly one key and leaves any
  other server alone. It refuses — writes nothing — on an unparseable file, on a
  root that is not an object, on a non-object `mcpServers` value, and on a file
  that spells the key `mcp-servers` instead of `mcpServers`.
- The upstream installer runs with `--skip-config` on purpose: without it, it
  would write a `cbmem.ts` Pi extension, `AGENTS.md` and `skills/` into
  `~/.pi/agent/` — which `setup.sh` owns. Pi reaches the graph over MCP instead.
- **What it costs:** 37.3 MB downloaded, **293 MB on disk** on this machine
  (0.10.8). The upstream installer always fetches `releases/latest`, so the
  version and both numbers float: 0.11.0 today is about 38 MB to download and
  299.9 MB on disk. That is the price of the server being core rather than an
  optional bundle.
- `--skip-config` does not stop every upstream side effect: the install step also
  appends a PATH line to a shell startup file and leaves a copy of `install.sh` at
  `~/.local/bin/install.sh`. Which startup file varies by installer version —
  `~/.bashrc` on this machine's install, `~/.profile` on a fresh 2026-09-16 run —
  while the `~/.local/bin/install.sh` copy is stable. Neither is visible to
  `git status` or to `doctor.sh`, and this repo does not edit files it does not
  own — remove them by hand if you do not want them. The binary itself lands in
  `~/.local/bin`; the post-install re-check accepts it there even when the
  running shell's `PATH` cannot see it yet, so a first run registers the server
  either way and a new shell only decides when `command -v` starts resolving it.
- `scripts/install-mcp.sh --force` reinstalls the binary (that is the update
  path); `./setup.sh --skip-mcp` opts out on a machine that does not want it.
  Inside Pi, `/mcp` lists what the adapter can see.

Compaction is split between the last two: `auto-compact` decides **when**
(percentage of context) and `pi-vcc` decides **how** (algorithmic extraction, no
LLM call). Both read per-machine config that is untracked by design — they are
rewritten at runtime (`auto-compact` by atomic rename, `pi-vcc` in place), so
symlinking either one into the repo would disconnect or overwrite the tracked
copy. So `~/.pi/agent/auto-compact.json` is a one-time local setup step, not
something the repo can reproduce — until it is written, a fresh machine runs on
the extension's own built-in defaults:

```json
{ "version": 1, "enabledAtSessionStart": true, "thresholdPercent": 45, "autoResume": true, "resumptionInstruction": "Continue the unfinished work from the compaction summary. Preserve prior decisions, avoid repeating completed work, and proceed with the next pending step.", "waitForTurnEnd": true, "additionalCompactionInstruction": "" }
```

`thresholdPercent` is the per-machine lever (45 here). `resumptionInstruction` is
the follow-up prompt the extension sends once after a compaction, and
`waitForTurnEnd` is forced `true` by the extension — not a user lever.

The trailing empty `additionalCompactionInstruction` is what the extension saves
here: under `overrideDefaultCompaction: true` a non-empty value cannot reach the
summarizer and only produces an `extension_error` on every compaction. See
[spec/config/pi-resources.md](.trellis/spec/config/pi-resources.md#compaction).

`~/.pi/agent/pi-vcc-config.json` keeps `overrideDefaultCompaction: true`. Do not
set `reserveTokens`: pi-vcc removes the LLM summarization call, so the summary
budget it feeds is irrelevant, and the percentage trigger is the intended lever.

`i-have-adhd` is the one installed package whose config is **tracked and
symlinked**, because the extension only ever *reads* it — unlike the compaction
and web-search files above, nothing rewrites it at runtime. So
[`pi-agent/i-have-adhd.json`](pi-agent/i-have-adhd.json) is the source of truth,
linked into `~/.pi/agent/` by `setup.sh`:

```json
{ "alwaysOn": true, "hideStatus": true }
```

`alwaysOn` starts every session with the rules active — the same effect as the
`.i-have-adhd-always` flag file, which still works. `hideStatus` keeps the
`● ADHD ON` status-bar entry hidden; the rules and `/i-have-adhd` are unaffected.
Both keys are read once at extension startup, so restart Pi after changing them,
and a saved per-session choice (`stop adhd mode`) wins over `alwaysOn` for that
session.

### Optional — `optional/<name>/`

Packages and settings applied only where you enable them. Choices are recorded in
`~/.pi/agent/.pi-setup-state.json` (gitignored), so they never leak between machines.

| Bundle | What it adds |
|--------|--------------|
| [`opencode-go`](optional/opencode-go/README.md) | OpenCode Zen Go plan: usage status bar, `/go-usage`, `/go-status`, and sets `defaultProvider`/`defaultModel` |

```bash
scripts/optional.sh list                    # what exists, what is enabled here
scripts/optional.sh enable  opencode-go
scripts/optional.sh disable opencode-go
```

Plugin versions are left **unpinned** on purpose so `pi update --extensions`
(which `setup.sh` runs) can move them forward. Pi skips updates for any spec you
pin with `@version`.

### Adding a plugin

```bash
# always-on
pi install npm:some-plugin && scripts/sync.sh    # then commit

# optional
scripts/optional.sh scaffold my-plugin
$EDITOR optional/my-plugin/manifest.json
scripts/optional.sh enable my-plugin
```

### Removing a plugin

```bash
# always-on
pi remove npm:some-plugin </dev/null && scripts/sync.sh    # then commit
```

`pi remove` has no `--yes`: with no TTY it waits on a confirmation forever, so
close stdin when it runs from a script. Then drop its entry from
[`docs/plugins.md`](docs/plugins.md) — `scripts/check-docs.mjs` fails until the
docs and `packages` agree again, which is the point.

---

## Day-to-day

Symlinked resources (`AGENTS.md`, `i-have-adhd.json`, `themes/`, `prompts/`,
`tools/`, `skills/`, `agents/`, `extensions/`) are already repo changes as you
edit them — just commit.

Settings need one explicit step, because `settings.json` is generated:

| You did this in Pi | Do this |
| -------------------- | --------- |
| Changed a core setting (theme, thinking level, …) | `scripts/sync.sh` → commit |
| `pi install …` an always-on plugin | `scripts/sync.sh` → commit |
| Want a plugin only on this machine | `scripts/optional.sh scaffold` + enable |
| Want newer skills | `./setup.sh` (re-fetch) |
| Want the MCP server installed or updated | `./setup.sh` (install if absent), or `scripts/install-mcp.sh --force` to reinstall the binary |
| Missing `/trellis-*` commands, or `pi-subagents` cannot find `trellis-implement` | `./setup.sh` (restores `.pi/` and `.agents/`); `scripts/install-trellis.sh` alone repairs just this |

```bash
scripts/sync.sh
git add -A && git commit -m "…" && git push
```

> Run `sync.sh` **before** `setup.sh` if you changed settings locally; otherwise the
> render overwrites them (a `settings.json.pre-render-*` backup is always written
> first, and `doctor.sh` flags the drift).

---

## What is intentionally *not* stored here

| Path | Why |
| ------ | ----- |
| `~/.pi/agent/auth.json` | Real API keys — secrets never enter git |
| `~/.agents/skills/`, `~/.pi/agent/skills/` | Fetched from upstream via `skills.json` |
| `~/.agents/skills/.skill-lock.json` | Pi's own skill-selection lock, written by Pi; outside every path list in `scripts/lib.sh` |
| `~/.pi/agent/models-store.json` | Model catalog cached from `https://pi.dev/api/models/providers/<id>` |
| `~/.pi/agent/sessions/` | Per-machine conversation history |
| `~/.pi/agent/npm/`, `git/`, `bin/` | Installed `node_modules`, cloned repos, platform `rg`/`fd` |
| `~/.pi/agent/trust.json`, `agent-memory/` | Per-machine trust decisions and accumulated memory |
| `~/.pi/agent/missions/` | Per-machine mission records |
| `~/.pi/agent/profiles/` | Per-machine agent profiles |
| `~/.pi/agent/run-history.jsonl` | Per-machine run history log |
| `~/.pi/agent/web-search-cache/` | Cached web-search results, re-fetchable |
| `~/.pi/agent/cache/` | Pi's scratch cache |
| `~/.pi/agent/auto-compact.json`, `pi-vcc-config.json`, `web-search.json`, `mcp-cache.json` | Extension-owned per-machine config; rewritten at runtime, so never symlinked — see [spec/config/layout-and-surfaces.md](.trellis/spec/config/layout-and-surfaces.md#per-machine-extension-config-is-not-symlinked). `web-search.json` also holds provider credentials, and `mcp-cache.json` caches remote tool metadata |
| `~/.pi-lens/` | pi-lens's own machine-global root — config, managed LSP/tool binaries, per-project caches, logs. Outside `~/.pi/agent/`, so it is not one of `scripts/lib.sh`'s paths |
| `~/.config/mcp/mcp.json` | MCP servers for every MCP-aware tool on the machine, written by `scripts/install-mcp.sh`. Outside `~/.pi/agent/`, so it is not one of `scripts/lib.sh`'s paths |
| `~/.cache/codebase-memory-mcp/` | The MCP server's own state — `_config.db` and `logs/`, written by the binary. Outside `~/.pi/agent/` |
| `<file>.bak-*`, `settings.json.pre-render-*` | Backups written by the scripts, including `sol-pi.json.bak-*`, left from a resource this repo no longer carries |

> **Security:** `auth.json` is gitignored and `doctor.sh` fails if it ever becomes
> tracked. If that happens, rotate the key — deleting a file in a later commit does
> not remove it from git history.

---

## Scripts

| Script | What it does |
| -------- | -------------- |
| `setup.sh` | The entry point: everything above, idempotent. |
| `scripts/lib.sh` | Sourced, never run: the single definition of the harness path lists (`PI_DIRS`/`PI_FILES`/`PI_NOT_SYNCED`) and the MCP config destination, read by `setup.sh`, `sync.sh`, `doctor.sh` and `install-mcp.sh`; `doctor.sh` checks that `.gitignore` covers every not-synced path. |
| `scripts/optional.sh list \| enable \| disable \| scaffold` | Per-machine optional plugin bundles. |
| `scripts/install-skills.mjs` | Fetches skills from `skills.json` sources and records the resolved commit plus a content digest of each installed tree in the provenance marker (`--check` re-hashes each tree offline and reports `missing`, `drift`, or `unrecorded` instead of trusting that the directory exists). |
| `scripts/install-mcp.sh` | Installs `codebase-memory-mcp` if absent (upstream installer, `--skip-config`) and registers it in `~/.config/mcp/mcp.json`; `--force` reinstalls the binary. |
| `scripts/install-trellis.sh` | Restores the gitignored Trellis surfaces `trellis update` cannot (`.pi/` adapters, `.agents/skills/trellis-*`) by running `trellis init` and pruning that call's by-products; a no-op when they are present, and a `note` plus exit `0` when the Trellis CLI is absent. |
| `scripts/register-mcp-server.mjs` | The JSON helper that helper uses: merges one server entry, backs up before overwrite, `--check` for drift without writing. |
| `scripts/check-docs.mjs` | Compares the entry ids in `docs/plugins.md` and `docs/skills.md` against `settings.core.json` and `skills.json`; run by `doctor.sh`, and it fails loudly rather than skipping when an input is unreadable. |
| `scripts/sync.sh` | Both directions: folds live settings into `settings.core.json`, stripping optional contributions, and copies live resource files/dirs back into `pi-agent/`. |
| `scripts/doctor.sh` | Checks symlinks, render drift, the Trellis surfaces and adapter tool coverage, skills, docs coverage, `auth.json` permissions, git cleanliness, and scans tracked files for secrets. |
| `scripts/render-settings.mjs`, `scripts/sync-settings.mjs` | Node helpers used by the shell scripts. |

Override the Pi config directory with `PI_CODING_AGENT_DIR` — Pi reads that one
itself. The scripts here additionally honour `AGENTS_SKILLS_DIR` for the skills
destination they install into; that variable belongs to this repo, not to Pi.

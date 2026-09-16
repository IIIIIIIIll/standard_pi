# Pi Resources

> `settings.core.json`, `skills.json`, and `pi-agent/extensions/` — the three
> tracked inputs that define what the harness *is*.

---

## `pi-agent/settings.core.json`

Always-on settings, identical on every machine. It is the base that
`render-settings.mjs` clones before merging optional manifests.

```json
{
  "packages": [
    "npm:pi-subagents",
    "npm:pi-web-access",
    "npm:@juicesharp/rpiv-ask-user-question",
    "npm:@juicesharp/rpiv-todo",
    "npm:@gotgenes/pi-permission-system",
    "npm:@sting8k/pi-vcc",
    "npm:@thunstack/auto-compact",
    "npm:pi-mcp-adapter",
    "npm:pi-lens",
    "npm:pi-tps-status",
    "https://github.com/ayghri/i-have-adhd"
  ],
  "theme": "dark",
  "defaultThinkingLevel": "high",
  "compaction": {
    "enabled": true
  },
  "autocompleteMaxVisible": 7
}
```

Rules:

- **Package specs are unpinned.** No `@version` — Pi skips updates for pinned
  specs, and `setup.sh` runs `pi update --extensions` on every invocation.
- **Anything under `packages` is installed on every machine.** If it is not wanted
  everywhere, it belongs in an optional bundle instead.
- `lastChangelogVersion` must never appear here — it is runtime-owned, carried
  over on render and deleted on sync.
- Add a setting by editing this file, then `./setup.sh` (or `scripts/sync.sh` if
  you changed it live in Pi) and commit.

### The package inventory

**Ownership: this table is the contributor view;
[`docs/plugins.md`](../../../docs/plugins.md) is the daily-use view.** They cover
overlapping material on purpose, and the division is:

- **This file owns** *why* a package is core, and the mechanics of its config:
  write behaviour, symlink traps, credential warnings, compaction, measured paths.
  **It wins any disagreement** with `docs/`.
- **`docs/plugins.md` owns** what it is, when to reach for it, what to type, and a
  single config line naming the path and its surface.
- **Exactly two things are deliberately duplicated**: the config location and its
  surface, and the invocation tokens (e.g. `/lens-map`, `/tps`). Both are required
  in every `docs/` entry. Nothing else is restated in either direction — when you
  add a mechanic here, `docs/` links to it rather than repeating it.

Editing either one: keep the split above, and see
[The `docs/` coverage check](#the-docs-coverage-check) for what the checker
compares.

| Package | What it adds | Why it is core |
| --------- | -------------- | ---------------- |
| `npm:pi-subagents` | Sub-agent delegation, parallel review, scripted workflows | the delegation mechanism itself |
| `npm:pi-web-access` | `web_search`, `fetch_content`, source verification | every machine needs research |
| `npm:@juicesharp/rpiv-ask-user-question` | structured questionnaire overlay | prevents guessing at requirements |
| `npm:@juicesharp/rpiv-todo` | model-facing todo list that survives `/reload` and compaction | used by the Trellis workflows |
| `npm:@gotgenes/pi-permission-system` | the permission gate | see below — the **only** thing gating tool calls |
| `npm:@sting8k/pi-vcc` | algorithmic, transcript-preserving compaction summaries with **no LLM call** | owns "how to summarize" — see [Compaction](#compaction) |
| `npm:@thunstack/auto-compact` | early percentage-triggered compaction, session toggle, TUI panel | owns "when to compact" — see [Compaction](#compaction) |
| `npm:pi-mcp-adapter` | MCP servers behind one proxy tool (~200 tokens) instead of every server's full tool list; reads `.mcp.json`, `~/.config/mcp/mcp.json`, and host configs; adds `/mcp`, `/mcp setup`, `mcp-auth` | the on-demand path into the MCP ecosystem without paying for it in context |
| `npm:pi-lens` | language-aware feedback on every write/edit: LSP diagnostics and navigation, linters/type-checkers, format/autofix, ast-grep and tree-sitter rules, ranked `symbol_search`, `/lens-map` | edits get checked by the real toolchain instead of by the model's own reading |
| `npm:pi-tps-status` | live tokens-per-second meter in the status bar: TTFT and token-count modes, three counting strategies, provider-usage reconciliation, `/tps` settings | streaming throughput is otherwise invisible; it keeps its config outside `~/.pi/agent/`, at `$XDG_CONFIG_HOME/pi-tps-status/config.json` (like `pi-lens`), so it adds nothing to the path lists |
| `https://github.com/ayghri/i-have-adhd` | ADHD-shaped replies -- answer or next action first, numbered steps, progress restated each turn, concrete time estimates, no preamble; `/i-have-adhd` (or `stop adhd mode`) toggles it per session, `/skill:i-have-adhd` is the aliased skill | output *shape* is a standing preference rather than a per-task prompt, so it belongs to every machine; it is the one package here with a tracked, symlinked config file (`pi-agent/i-have-adhd.json`) -- see below |

`pi-lens` and `pi-tps-status` are self-contained: neither needs a tracked
config file in this repo, and neither writes into `~/.pi/agent/`.
`pi-mcp-adapter` ships no MCP servers of its own, so the harness supplies one:
`setup.sh` installs `codebase-memory-mcp` and registers it in
`~/.config/mcp/mcp.json` — the **global** layer, shared with every MCP-aware tool
on the machine. That is an always-on core cost, so it is worth stating plainly:
**37.3 MB downloaded and 293 MB on disk** per machine. `/mcp setup` previews every
file it would change; see
[The global MCP config](#the-global-mcp-config) for the surface and why no path
list holds it. `pi-lens` keeps **everything** under its own machine-global
root: config at `~/.pi-lens/config.json`, managed tool binaries at
`~/.pi-lens/bin/`, per-project state at `~/.pi-lens/projects/<slug>/`, plus its
global logs. That is deliberately outside `~/.pi/agent/`, so it appears in
neither `scripts/lib.sh`'s path lists nor `.gitignore` — do not go looking for
pi-lens state under `pi-agent/`. It downloads LSP servers and tool binaries on
first use (`PI_LENS_DISABLE_LSP_INSTALL`, `PI_LENS_DISABLE_TOOL_INSTALL` opt out),
which is why a fresh machine needs network on the first session, not at setup.
Its project config is `.pi-lens.json` (project root, outermost wins per field).

`pi-tps-status` follows `pi-lens` in keeping its state outside `~/.pi/agent/`: the
`/tps` settings persist to `$XDG_CONFIG_HOME/pi-tps-status/config.json`
(`~/.config/pi-tps-status/config.json` by default, written atomically), so it
also appears in neither `scripts/lib.sh`'s path lists nor `.gitignore`.

`pi-timer` used to sit in this list, and it is deliberately gone rather than
kept: it installed its per-run timer by replacing Pi's **whole** footer through
`ctx.ui.setFooter()`, and its rebuild — a copy of an older footer — silently
dropped core's `CH<rate>%` cache-hit segment and its `(sub)` subscription case.
The timer now lives in the hand-placed [`run-timer.ts`](#run-timerts), which
publishes through `ctx.ui.setStatus()` and leaves line 2 to Pi core. Do not
re-add the package; see the `run-timer.ts` subsection below for the rule that
follows from it.

`pi-web-access` is the one core package that *does* own a per-machine file in the
agent dir: `~/.pi/agent/web-search.json` — provider selection, proxy, `authFetch`
profiles, curator defaults, and the API keys for those providers. The package
writes it with a plain `writeFileSync`, so a symlink would send per-machine state
straight into the repo; it is ignored and reported instead, like the compaction
configs. Treat it as secret-bearing: `doctor.sh`'s shape-based scan will not
reliably catch a key it contains. Its search cache is a separate path,
`~/.pi/agent/web-search-cache/`, already on both lists. It resolves the file
differently from Pi's own paths — `PI_CODING_AGENT_DIR`, then an existing
`$XDG_CONFIG_HOME/pi/` file, then a legacy `~/.pi/` file, then the default — so a
machine that ever used XDG has the config somewhere else entirely.

`i-have-adhd` is the counter-example to `pi-web-access`. It also owns a file in
the agent dir, `~/.pi/agent/i-have-adhd.json`, but that file is **tracked here**
at `pi-agent/i-have-adhd.json` and symlinked into place (it is in `PI_FILES`),
because the extension only reads it: `extensions/i-have-adhd.ts` calls
`readFileSync` once at startup and contains no write call at all, and a session
toggle is persisted with `pi.appendEntry` into the session history instead. The
two keys are portable intent, not machine state:

```json
{ "alwaysOn": true, "hideStatus": true }
```

`alwaysOn` starts every session with the ruleset active (equivalent to the
`.i-have-adhd-always` flag file, which still works); `hideStatus` keeps the
`● ADHD ON` status-bar entry off while leaving the rules and `/i-have-adhd`
working. Both are read once at extension startup, so restart Pi after editing the
file, and a saved per-session choice (`stop adhd mode`) wins over `alwaysOn`.
Moving this file into the ignored list would make `./setup.sh` unable to
reproduce always-on — read
[layout-and-surfaces.md](./layout-and-surfaces.md#the-exception-a-read-only-extension-config-is-symlinked)
before you do, and re-measure the package's write behaviour rather than assuming
it.

`@gotgenes/pi-permission-system` is npm-installed but reads its policy from
`extensions/pi-permission-system/config.json`, which is why that config is
committed here rather than living in the package.

### Compaction

Pi's native auto-compaction triggers at `contextWindow - reserveTokens`
(`reserveTokens` default 16384), which on a 1,000,000-token model is ~98% full —
too late to be useful. Two packages split the job:

| Concern | Owner | Setting |
| --------- | ------- | --------- |
| **When** to compact | `auto-compact` | `thresholdPercent` (per-machine; 45 here) |
| **How** to summarize | `pi-vcc` | `overrideDefaultCompaction: true` — algorithmic, **no LLM call** |
| Final backstop | Pi core | `reserveTokens: 16384`, untouched (~98%) |
| Resuming the run | `auto-compact` | `autoResume: true` |
| Follow-up prompt | `auto-compact` | `resumptionInstruction` — sent once after a compaction; the live value is the extension's default text |
| Turn boundary | `auto-compact` | `waitForTurnEnd: true` — forced by the extension (`extensions/auto-compact/index.ts:110` in `@thunstack/auto-compact`, excluded from patchable keys at `:726`), not a user lever |

Facts that must not be re-litigated:

- **`reserveTokens` stays untouched.** Pi overloads it as the summarization
  output budget (`0.8 × reserveTokens`), so raising it to move the native trigger
  would change an unrelated number. With pi-vcc's `overrideDefaultCompaction:
  true` there is no LLM summarization call, so that budget is irrelevant anyway.
  The percentage trigger is the right lever: proportional, and still meaningful
  on a smaller context window.
- **`autoResume: true` is required on Pi ≥ 0.84.4.** Measured on Pi **0.85.1**
  (`--mode rpc`, `thresholdPercent: 1` to force a compaction after two tool
  turns): with `false`, the session compacted **once** and then **stalled** — 0
  resumption messages, the remaining steps never ran, no final answer. With
  `true`, it compacted **once**, delivered the `resumptionInstruction` follow-up
  **exactly once**, and completed the work. `ctx.compact()` is Pi's public API;
  it aborts the agent loop (`session.compact()` opens with `await this.abort()`)
  and does **not** resume. Only Pi's *native threshold* path self-resumes, and
  `auto-compact` does not use it. The two packages' docs disagree; the
  measurement is the authority.
- **pi-vcc does not send its own continue here.** `shouldScheduleAutoContinue`
  returns `false` for Pi ≥ 0.84.4 (`PI_SELF_RESUME_VERSION` in pi-vcc 0.7.2), so
  `continueAfterThresholdCompact: true` is inert on this machine; and the
  `session_compact` handler that would send it only fires for `reason`
  `threshold` or `overflow`, never `manual`, which is the path `ctx.compact()`
  takes. Do not rely on it as the resume mechanism.
- **`additionalCompactionInstruction` does not reach the summarizer here.**
  `auto-compact` passes it (non-empty by default) to `ctx.compact()` as
  `customInstructions`; pi-vcc's parser treats any non-`__pi_vcc__` free text as
  a post-compaction follow-up prompt, tries to send it from `session_compact`
  while compaction is still in progress, and swallows the `Cannot submit a
  prompt while compaction is in progress` rejection. Pi still emits an
  `extension_error` (`send_user_message`) on every compaction — harmless (the
  text is dropped, no extra turn), but do not expect the setting to take effect
  under `overrideDefaultCompaction: true`.
- **`keepRecentTokens` (default 20000) is untouched** and is what makes
  compaction eligible at all: a session with less history has no cut point, so
  the trigger cannot fire. A three-command session never reaches it, which is why
  the R3 test above needed large files read into context first.
- **Test the resume path with `pi --mode rpc`, not `pi -p`.** Measured in `pi -p`
  with >20k tokens of history: exit 1, `This operation was aborted`, 0 compaction
  entries and 0 resume messages — for **both** `autoResume` values, so the flag is
  indistinguishable from a stall there. The mechanism is inferred rather than
  measured: `ctx.compact()` is fire-and-forget, and print mode tears the runtime
  down once the aborted prompt resolves, before compaction settles. RPC mode keeps
  the session alive and discriminates cleanly.

Both settings files (`~/.pi/agent/auto-compact.json`,
`~/.pi/agent/pi-vcc-config.json`) are per-machine, untracked and **never
symlinked** — see
[layout-and-surfaces.md](./layout-and-surfaces.md#per-machine-extension-config-is-not-symlinked).

### The global MCP config

The harness registers the MCP servers it installs in `~/.config/mcp/mcp.json`.
`setup.sh` calls `scripts/install-mcp.sh`, which installs `codebase-memory-mcp`
with upstream's `--skip-config`, then `scripts/register-mcp-server.mjs` merges one
entry into that file:

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

**What it costs.** `codebase-memory-mcp` 0.10.8 is **37.3 MB downloaded** and
**293 MB on disk** once the binary is extracted (measured 2026-09-14;
`ls -l ~/.local/bin/codebase-memory-mcp`). That is the number behind the decision
to make the server always-on core rather than an optional bundle: the server is
core because every machine should have code intelligence, and a 293 MB binary is
what that buys. Say it plainly rather than leaving it to be discovered.

**What it costs in context is a different number, and it is small.** The adapter
keeps the server's metadata outside the context: the 15 tool definitions are
about 21 KB of JSON (~5,400 tokens at 4 bytes/token, ~6,800 at the 3.2
bytes/token JSON schemas actually run at), and they live in
`~/.pi/agent/mcp-cache.json` (23 KB on disk), reached on demand through
`mcp({ search })` / `mcp({ describe })`. What sits in the model's tool list
instead is the `mcp` proxy (~200 tokens, already paid by `pi-mcp-adapter` on
every machine) plus one `mcp__<server>` namespace tool per registered server,
measured at ~100 tokens for this one. That namespace tool appears only once the
cache has been populated, so a machine that has never contacted the server pays
nothing for it. The variable cost is per call — a `search_graph` result runs from
a few hundred to a few thousand tokens — and nothing here reduces that. So the
293 MB is a **disk** decision, not a context one: do not re-open the always-on
choice on token grounds.

The cache itself is a runtime file `pi-mcp-adapter` owns, so it is named in both
`.gitignore` and `PI_NOT_SYNCED` alongside the other agent-dir files a package
rewrites. It is not credential-bearing — the adapter hashes a bearer token into
`configHash` rather than storing it (`dist/metadata-cache.js:78`) — but it holds
remote content and must never become repo material.

Facts a contributor must not break:

- **It is Generated, outside the repo** — the category
  `~/.agents/.pi-setup-skills.json` already occupies, not a fifth surface. It is
  outside on the same terms, which is why
  [layout-and-surfaces.md](./layout-and-surfaces.md)'s map carries it: it does not
  live under `PI_DST`, so it takes no `PI_DIRS` / `PI_FILES` entry; the
  `PI_NOT_SYNCED` entries are checked as `pi-agent/<name>`, so a path outside the
  repo cannot be expressed there at all; and there is no repo path for
  `.gitignore` to cover. The path is defined once in `scripts/lib.sh` as
  `MCP_CFG`, not `PI_`-prefixed because that prefix means a harness path under
  `PI_DST`.
- **`MCP_CFG` follows the reader, not the XDG standard.** It is
  `$HOME/.config/mcp/mcp.json`, because `pi-mcp-adapter` hardcodes
  `join(homedir(), ".config", "mcp", "mcp.json")` (`dist/config.js:14` in
  `pi-mcp-adapter` 2.34.0) and ignores `XDG_CONFIG_HOME`. Honouring the variable
  here would register the server where the adapter never looks — and `doctor.sh`,
  reading the same constant back, would still report green. `doctor.sh` emits a
  `warn` when `XDG_CONFIG_HOME` points somewhere else, so the mismatch is
  visible rather than silent. Do not "fix" the constant to the XDG-resolved path.
- **`sync.sh` and `sync-settings.mjs` never see it**: they enumerate `PI_DST`.
  Adding it to any of those lists means the surface decision has been misread.
- **Its owner writes it with an atomic rename** (`config.ts:1029`), so it can
  never be a symlink or a repo-rendered file — the trap
  [layout-and-surfaces.md](./layout-and-surfaces.md#per-machine-extension-config-is-not-symlinked)
  documents for `auto-compact.json`. The repo stores the *instruction* to
  register the server, not the file.
- **This repo is not the only writer.** `/mcp setup`, `/mcp enable`/`disable` and
  hand edits all reach it, so the merge only ever adds its own key and preserves
  every other server. Four shapes are **refused** (exit `1`, no write, no backup)
  rather than repaired: an unparseable file; a root that is not an object; a
  non-object `mcpServers` value; and a file that spells the key `mcp-servers`
  instead of `mcpServers`. The first prevents deleting every other server with a
  parse-failure reset, the middle two prevent a rekeying spread (a string
  `mcpServers` would become `{"0":"o",…}`) or a merge that reports success and
  registers nothing, and the last prevents shadowing — the adapter reads
  `raw.mcpServers ?? raw["mcp-servers"] ?? {}` and prefers camelCase.
- **The helper is deliberately stricter than the reader on three inputs.**
  `pi-mcp-adapter` parses the file with `parseJsonWithComments` (comments and
  trailing commas tolerated) and treats `mcpServers: null` as absent —
  `isRecord(null)` is false, so it reads `{}`. `register-mcp-server.mjs` uses
  strict `JSON.parse` and refuses `null` outright, so a file the adapter happily
  reads can exit `1` here and `doctor.sh` turns that into a `bad`. Keep the
  asymmetry: the helper is not the file's owner and cannot tell intent from
  damage, and a `null` in that key means a truncated or corrupt write rather than
  a request to clear it. Relaxing any of the three buys nothing and hides damage.
- **`command` is PATH-resolved, never absolute.** Upstream's own generated entry
  carries an absolute `$HOME`-rooted path; that would make a machine-specific
  value the thing this repo reproduces, and the file is shared across tools.
- **`--skip-config` is mandatory when running upstream's installer.** Without it
  the installer writes `~/.pi/agent/AGENTS.md`, `~/.pi/agent/skills/` and
  `~/.pi/agent/extensions/cbmem.ts` — and that last directory is a symlink into
  this repo, so `cbmem.ts` would land in the git working tree. Pi reaches the
  graph through the MCP client here, not through the generated extension.
- **`--skip-config` does not stop every upstream side effect.** The binary's
  install step also appends a PATH line to the shell profile under a
  `# Added by codebase-memory-mcp install` comment, and leaves a 12.9 KB copy of
  `install.sh` at `~/.local/bin/install.sh`. **Which profile file varies by
  installer version** — `~/.bashrc` for the 2026-09-14 install here, `~/.profile`
  on a 2026-09-16 sandbox run — so the claim is the comment and the expanded
  absolute path, not the file it lands in. The appended line is the install
  directory **already expanded to an absolute path** — the writer's template is
  `export PATH="%s:$PATH"`, measured here as
  `export PATH="/home/tan/.local/bin:$PATH"` — so it is not the portable `$HOME`
  form and must not be quoted as one. `--skip-config` prevents neither, both are
  invisible to `git status` and to `doctor.sh`, and this repo does not edit files
  it does not own — so they are documented, not removed. The entry does not, and
  must not, gate the first run: `install-mcp.sh`'s post-install re-check falls
  back to `~/.local/bin/codebase-memory-mcp` when `command -v` misses, because a
  shell started before the install has not re-read that profile — and the
  registration stores the bare name, which the Pi session resolves itself.
- **`doctor.sh` treats "no binary and no config" as a single `warn`**, because
  `--skip-mcp` is a legitimate machine choice and that machine must still reach
  `All good.`. A binary that is present with a missing or drifted config is a
  `bad`. Present-at-`~/.local/bin`-but-not-on-`PATH` counts as present (a `warn`
  about the new shell), so the pair it forms with the registration still gets
  judged together.

---

## `skills.json`

```json
{
  "_comment": "Skills are installed from upstream at setup time and never vendored here, so they cannot fall behind. Add an entry under skills to install another; set a source ref to pin.",
  "sources": {
    "mattpocock": { "url": "https://github.com/mattpocock/skills.git", "ref": null }
  },
  "skills": [
    { "name": "code-review", "source": "mattpocock", "path": "skills/engineering/code-review" }
  ]
}
```

Structure: `sources` maps an id to a git URL (plus optional `ref`); `skills`
lists `{name, source, path}` where `path` is the skill directory **inside the
source repo**. The real file lists six skills — one is shown above for shape;
`README.md` names all of them.

Rules:

- **Skills are never vendored.** Nothing under `~/.agents/skills/` is committed;
  `setup.sh` re-clones and re-copies. This is why there is no snapshot to go stale.
- `ref: null` means "track the source's default branch". Set `ref` to a tag or
  commit only to pin deliberately.
- The **whole skill directory is copied**, not just `SKILL.md` — upstream ships
  extra files (e.g. `agents/openai.yaml`, `references/`) that must come along.
- Replacing a skill is destructive on purpose: the destination is
  `rmSync`'d and re-copied so upstream deletions take effect. Do not add a merge.
- An unknown `source` id, a missing `SKILL.md` at `path`, or a failed clone are
  collected into `problems`, the remaining skills still install, and the process
  exits `1` at the end. A partial install is reported, never rolled back —
  re-running `./setup.sh` is the recovery path.
- `node scripts/install-skills.mjs . --check` verifies installation **without
  network** and is what `doctor.sh` uses: it re-hashes each installed tree and
  compares it against the digest its provenance entry records, so a stale or
  edited copy reads as `drift` instead of `ok`. `missing` and `drift` exit `1`;
  `unrecorded` is a note — a skill the marker has no digest for — and only fails
  when the marker file itself is gone. Keep it offline.
- Provenance is recorded outside the repo at `~/.agents/.pi-setup-skills.json`
  (a sibling of the skills dir, so `AGENTS_SKILLS_DIR` moves it too). It contains
  `installedAt`, per-source/per-skill resolved commit SHAs, and a content
  `digest` of each installed tree — the value `--check` compares against.
  `doctor.sh` prints the source commits from it.
- `_comment` is a real key, not JSONC. Keys starting with `_` are a convention
  here for "not data".

Adding a skill: add an entry under `skills`, then `./setup.sh`, then commit
`skills.json`. If the skill comes from a new repo, add a `sources` entry too.
Daily use for these six — when to reach for each, and whether the model may invoke
it on its own — is [`docs/skills.md`](../../../docs/skills.md); the inventory here
stays the contributor view.

---

## The `docs/` coverage check

`docs/` answers "when do I reach for this, and what do I type" for the 11
always-on packages ([`docs/plugins.md`](../../../docs/plugins.md)) and the 6 fetched
skills ([`docs/skills.md`](../../../docs/skills.md)). Nothing keeps those pages
current except this check: `scripts/check-docs.mjs`, run by `doctor.sh` as
`==> Docs coverage`.

It is a **membership** check — both files must cover exactly what the repo ships —
and it is deliberately not a content check. A flag renamed inside a package that is
still listed stays invisible; a package added, removed, renamed, or misspelled in
an entry fails immediately.

| Input | Source of truth | Compared as |
| ------- | ----------------- | ------------- |
| Plugin ids | entry headings in `docs/plugins.md` | set-equality with `packages` in `pi-agent/settings.core.json` |
| Skill ids | entry headings in `docs/skills.md` | set-equality with the `name` of each entry in `skills.json` |

The heading shape is a **parser contract**, not styling, and it is stated in
`docs/README.md` for the user as well:

- An entry is a heading of three hashes; the **first** backtick-delimited token on
  that line is the id. Trailing text is allowed. The id is the exact spec string
  (`npm:pi-lens`, `https://github.com/ayghri/i-have-adhd`) or the exact `skills.json`
  name.
- Lines inside fenced code blocks are skipped, so an example heading in a fence is
  never counted.
- Pointer sections use two hashes, so the checker does not read them as entries.

Fail-loud rules — seeing nothing is drift too, and an unrunnable check is reported
rather than skipped:

| Condition | Result |
| ----------- | -------- |
| `docs/plugins.md` or `docs/skills.md` missing | `bad` |
| An existing file yields zero entry headings | `bad` (formatting drift or an emptied file) |
| `settings.core.json` / `skills.json` unreadable or unparseable | `bad` |
| A shipped id with no entry, or an entry for something not shipped | `bad`, naming each id |
| An id documented twice | `bad`, naming the id |
| `node` unavailable | `bad` — `doctor.sh` cannot run this check at all |

Exit codes follow [`scripts/node-guidelines.md`](../scripts/node-guidelines.md): `0`
success, `1` any problem above, `2` a missing positional argument. The success line
(with both counts) goes to **stdout**; each problem goes to **stderr**, one per line.
`doctor.sh` captures both with `>/tmp/pi-doctor-docs.$$ 2>&1` — drop the `2>&1` and
the captured file is empty and the ids land unindented on the terminal.

Changing either list therefore has a third site: add or remove the package in
`settings.core.json`, then update
[`docs/plugins.md`](../../../docs/plugins.md), or `doctor.sh` fails until you do.

---

## `pi-agent/extensions/`

`~/.pi/agent/extensions/` is Pi's **global, hand-placed** extension directory —
auto-discovered for every project and hot-reloadable with `/reload`. `setup.sh`
symlinks it here, so anything added is versioned with the harness.

| Path | What it is |
| ------ | ------------ |
| `<name>.ts` | a single-file extension |
| `<name>/index.ts` | a multi-file extension |
| `<name>/config.json` | conventional per-extension config the extension reads |
| `<name>/logs/` | runtime output — gitignored via `pi-agent/extensions/*/logs/` |

**Installed packages do not live here.** `pi install …` puts code under
`~/.pi/agent/npm/` or `~/.pi/agent/git/`, and it is tracked by *package spec* in
`settings.core.json` or an optional manifest. This directory is only for
extensions placed by hand, **and** for the handful of packages that read their
config from under here — which is exactly the permission system's situation.

`.pi/` and `.agents/` at the repo root are **not** part of this layer: they are
project-local Trellis adapters, regenerated by the `trellis` CLI, and gitignored.

### `trellis-subagents-bridge/`

Makes `pi-subagents` children resolve their parent's active Trellis task.

`pi-subagents` already discovers `.pi/agents/trellis-*.md`, but a dispatched child
starts as its own Pi session, and the generated Trellis extension resolves the
active task from `.trellis/.runtime/sessions/<key>.json` — where the key derives
from the **child's** own session id. Without the bridge the child is told
`Status: no_task` and its `task.py current` exits 1.

Facts a contributor must not break:

- **It is global.** Pi loads `~/.pi/agent/extensions/` in every project, so the
  bridge returns immediately unless the resolved cwd contains `.trellis/`, and it
  publishes, injects, and writes nothing when no task resolves.
- **It injects the child's task context, and that injection is the child's whole
  context.** A marked child runs a generated extension that returns at load, so
  nothing else builds it a `## Trellis Task Context`: the bridge appends the curated
  files of the role that was dispatched, then `prd.md` → `design.md` →
  `implement.md`. Four facts travel with it. The manifest is chosen by **relaying**
  the agent name the dispatcher already passed and matching the task-dir manifest
  whose stem is a **suffix** of it — so a dispatched name whose last `-`-separated
  segment is `check` selects `check.jsonl` — falling back to every `*.jsonl` in the
  task directory — there is deliberately no role table here, and one would couple
  this repo to role names it does not own. The budget is **read** from
  `context_injection` in `.trellis/config.yaml` when that block is uncommented —
  never restated — so this third consumer cannot drift from the generated
  extension's reader and `task.py validate`. That block ships **commented out**
  here (`.trellis/config.yaml:158-161`), so today the bridge's built-ins apply:
  `DEFAULT_CONTEXT_INJECTION_LIMITS` at
  `pi-agent/extensions/trellis-subagents-bridge/index.ts:319-323`, read by
  `readContextInjectionLimits()` at `:354-393` — `max_file_bytes` **32768**,
  `max_artifact_bytes` **65536**, `max_total_bytes` **131072**. A body already
  present in the prompt verbatim is skipped, which is what
  keeps the injection from duplicating a file the shipped tool already supplied. And
  the block is assembled once per session and tested for presence **whole** — the
  tag rule below applies to it too, and there is no tag to match.
- **It corrects a value, and adds to the prompt — it never rewrites either.**
  Nothing in the generated extension is stripped or rewritten. The parent publishes
  `TRELLIS_CONTEXT_ID` and the child writes its own runtime session pointer, so the
  generated extension resolves the real task through its normal path. What the
  injection adds is appended at the end of the child's system prompt; a strip or a
  bash rewrite of anything already there means the design has been abandoned, not
  extended.
- **`contextKey()` is replicated on purpose.** The pointer filename must equal the
  key the generated extension computes, and that derivation lives in a generated
  file (see `.trellis/.template-hashes.json`). If upstream changes it, the bridge
  must change with it — otherwise children silently resolve nothing.
- **The child gate is marker-based, and the roles are exhaustive:** the bridge's
  own marker plus `PI_SUBAGENT_CHILD === "1"` selects the child branch, and a child
  *without* that marker — the generated `trellis_subagent` tool's own children,
  which already carry a correct key — is an early no-op. Both child tests share
  `PI_SUBAGENT_CHILD`, which is what keeps either shape out of the **parent**
  branch: `publish()` there would delete the key that tool set for its child. The
  shipped tool's children also inherit the bridge marker (its `buildChildEnv`
  spreads the parent's environment), so they are handled as bridge children; that
  overlap is absorbed by the whole-body dedup above rather than by a second test,
  and treating a marker-bearing child as untouchable would leave it with no context
  at all.
- **It deactivates the shipped `trellis_subagent` tool** with
  `pi.setActiveTools(...)`, on session start and on every turn, so that tool is
  not callable and its competing `promptGuidelines` are not injected (Pi includes
  a tool's guidelines only while it is active). It does **not** edit the generated
  extension — `.pi/` is gitignored and template-tracked, so a patch there would be
  machine-local and lost to `trellis update`.
- **`SHIPPED_TOOLS` is the single source for the shipped tool names**, and
  `doctor.sh` checks it against the generated extension: it greps the extension for
  the names it registers and fails when one is missing from that list. So a
  `trellis update` that renames the tool, or registers another, fails loudly
  instead of silently leaving the shipped path callable again. The check also
  fails when it can extract **no** names from an extension that clearly calls
  `registerTool` — seeing nothing is drift too, and a reflowed template must not
  be allowed to turn the check into a silent pass.
- **`CHILD_INERT_MARKER` is the single source for the child-inert marker.** The
  bridge sets that name in the parent's environment — **persistently, for the
  session**, not windowed around the dispatch call — so every child the process
  spawns inherits it, including one a scheduled run spawns from a timer with nothing
  in flight, and the child's copy of the generated extension returns at load instead
  of running the *parent's* per-turn session path. The persistent shape's cost is
  measured and accepted: a `pi` process started from a bash tool in the session
  inherits the marker too, loads with the generated extension inert, and reports no
  task — visible, where a missed window would have been silent. The name has exactly
  two readers in live code, both repo-owned (that guard and the bridge's own
  predicate); the package that spawns the children reads only its own
  `PI_SUBAGENT_CHILD`, so setting this cannot reach it. `doctor.sh` reads the name
  off the declaration and fails when the generated extension stops returning on it,
  **or** returns on it only after the first registration call — a guard below the
  registrations registers everything and then returns. The predicate tests the
  constant, never the literal, so the name appears exactly once in this file.
- **Every marker the predicates read has a line that assigns it, and `doctor.sh`
  checks that.** Measured 2026-09-15: `BRIDGE_CHILD_MARKER` was read by
  `isBridgeChild()` and `isOtherChild()` and assigned nowhere, so `isOtherChild()`
  was true in every child, the child branch returned at extension load, and every
  dispatched child silently received nothing — no curated manifest, no task
  artifacts, and no breadcrumb, which is worse than before the bridge existed.
  `doctor.sh` was green throughout. Both markers are now set together in
  `markChildren`, gated on a resolved task so a session with no active task sets
  neither, and the check fails when a `*_MARKER` / `*_ENV` constant declared in
  this file has no `process.env[<name>] =` line. Names the bridge **inherits**
  (`PI_SUBAGENT_CHILD`, `TRELLIS_CONTEXT_ID`) are read-only here by design and are
  deliberately out of scope — the bridge must not set them.
- The child's pointer is removed on `session_shutdown`. A crashed child leaves it
  behind; that is accepted rather than pruned.

**Three conventions this file learned the hard way.** All were found by a check or
probe phase, and all generalize to any extension in this layer:

- **Role predicates must be exhaustive, not selective.** A bridge that tests only
  for its own child marker falls through into the *parent* branch for every other
  kind of child. The shipped `trellis_subagent` tool sets both markers, so its
  children took the parent branch, and `publish()` deleted the very key the shipped
  tool had set for them — a strict regression, invisible while R10 keeps that tool
  uncallable. Enumerate the roles explicitly and make the unknown case an early
  no-op.
- **Idempotency guards must match the whole injected constant, never a bare tag.**
  An opening tag like `<trellis-pi-dispatch>` also occurs in ordinary prose that
  reaches the same assembled prompt — task `design.md`, research notes — so a tag
  test suppresses the injection for exactly the sessions whose documents quote it.
  The failure is silent and self-inflicted: writing the tag down is what triggers
  it.
- **A marker that is read but never set makes its role unreachable, and nothing
  fails loudly when it happens.** The child branch is selected by
  `BRIDGE_CHILD_MARKER`, which the parent sets for the child to inherit. The first
  implementation set only `CHILD_INERT_MARKER` — the one that stops the generated
  extension — so `isOtherChild()` was true in **every** child, the child returned at
  extension load, and it received nothing at all: no curated manifest, no task
  artifacts, and no breadcrumb either. That is *worse* than before the bridge
  existed. `doctor.sh` was green, the extension loaded, and the child quietly
  reported `no_task`. A **delivery probe** found it; reading the diff did not, and
  the two markers sat three lines apart. When one process sets a marker another
  reads, confirm some line actually assigns it, and treat "the constant is only ever
  read" as the defect it is — `grep -c 'process.env\[BRIDGE_CHILD_MARKER\] = '`
  returning zero was the whole bug. Prefer a check to care: the failure shape is a
  silent absence, like the `SHIPPED_TOOLS` case above.

  The same function is gated on a resolved task, deliberately: the marker is a
  session-wide side effect on every process the session spawns, so a session with
  no active task must not set it. That is R6 and AC7's "does nothing when no task
  resolves".

### `run-timer.ts`

Publishes how long the current run has been going, on the footer status line —
one `ctx.ui.setStatus()` string: `⏱ 12s`, `⏱ 1m 05s`, `⏱ 1h 02m`.

Facts a contributor must not break:

- **No extension under `pi-agent/extensions/` may call `ctx.ui.setFooter()`.**
  Line 2 belongs to Pi core. A replacement footer is a hand-written copy of one,
  and a copy goes stale: `npm:pi-timer` was removed for exactly this reason — its
  `setFooter()` rebuild pushed `↑ ↓ R W $ ctx%` and silently deleted core's
  `CH<rate>%` cache-hit segment and its `(sub)` subscription case, with no warning
  and no upstream release adding them back. Do not re-add that package. The
  hand-placed `cache-hit-rate.ts`, which republished `CH` as a status line to
  compensate, was deleted with it: core's footer shows `CH` again because core
  owns the line, not because anything in this repo recomputes it. `doctor.sh`'s
  `==> Footer ownership` section fails when one of these files calls it, and
  fails when it can find no extension files to scan at all — a check that reports
  `ok` after it has stopped reading is worse than no check.
- **It publishes via `ctx.ui.setStatus()` only.** One key, one string, updated by
  calling again and withdrawn with `undefined` — no footer, no widget, no overlay,
  no writes. Pi core's footer and any custom footer both render
  `footerData.getExtensionStatuses()`, so one status string composes under either;
  that is the property `setFooter()` does not have.
- **The key is `run-timer`, which sorts before `tps`.** A footer sorts statuses by
  key, joins them with a space, and truncates the **whole joined line**, so the
  leftmost entry is the one a narrow terminal keeps. `tps` is the other live key,
  so the TPS meter loses its tail rather than the timer losing anything.
- **The value is wall-clock elapsed time from `agent_start` to `agent_end`, and
  nothing else.** No session statistic is read or recomputed. It renders in the
  accent colour while the run is live and dim once it has ended, freezing at the
  final duration until the next run or the next session, and nothing is shown
  before the first run of a session. A 1s ticker drives the count and is cleared
  on `agent_end`, `session_switch`, `session_start` and `session_shutdown`, so
  repeated runs cannot leak an interval.
- **It owns no state.** No config file, no `fs` import, nothing persisted, so it
  changes neither path list in `scripts/lib.sh` nor `.gitignore`. There is nothing
  to symlink and nothing to ignore.
- **It is global.** Pi loads `~/.pi/agent/extensions/` in every project, so it
  drives its display from the run lifecycle it is handed and returns quietly when
  the UI context is absent.

---

## Permission Policy

`pi-agent/extensions/pi-permission-system/config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/gotgenes/pi-packages/main/packages/pi-permission-system/schemas/permissions.schema.json",
  "permission": {
    "*": "allow",
    "path": { "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
    "bash": { "rm -rf *": "deny" },
    "external_directory": { "*": "ask", "/tmp/*": "allow" },
    "external_directory_read": { "*": "allow" }
  }
}
```

Pi itself has **no permission prompts** — it runs tools with full user
permissions. This extension is the only gate, which is why `"*": "allow"` is the
right default here: it means "stop gating everything, keep only the rules below".

Facts that must not be forgotten when editing this file:

- **A missing config is not "no policy"; it is "interrupt the user on every tool
  call."** Omitting `"*"` defaults every category to `ask`. That is the failure
  mode the committed file exists to prevent.
- **Any parse failure falls back to `ask` for all categories**, and a config that
  fails schema validation clamps every `allow` up to `ask` (deny-preserving).
  Therefore: **strict JSON, no comments, no trailing commas.** Do not "tidy" this
  into JSONC, and do not add a `$comment`-style key that the schema rejects.
- **`deny` survives `yoloMode`.** The `path` deny and the `rm -rf` deny are
  enforced unconditionally, including when the extension's own YOLO mode is on.
- Precedence is **most-restrictive-wins** across four layers:
  `path` (cross-cutting) → `external_directory` (CWD boundary) → per-tool
  patterns → `bash` patterns. A `path` deny cannot be loosened by a per-tool
  `allow`.
- Patterns match both the referenced path and its symlink-resolved form, so a
  deny cannot be evaded through a symlink alias.
- **The outside-CWD boundary is split by direction.** Reads are open
  (`external_directory_read` → `{ "*": "allow" }`); writes still `ask`, with
  `/tmp` allowed so scratch files need not be parked inside the repo to dodge
  the gate. This is why `external_directory` is a map, not the string `"ask"`.
- **Bare `external_directory` is sugar**, expanding into `external_directory_read`
  and `external_directory_write` with its entries placed first. The explicit
  `external_directory_read` therefore has the final say on reads, and the sugar
  map alone decides writes. Do not collapse that directional key back into a
  string, and do not add a parallel `path_read` allow — reads are already
  handled at this layer.
- **`/tmp/*`, never a bare `/tmp`.** A trailing `*` is greedy and crosses
  directory boundaries; a bare directory pattern matches only the directory
  entry itself, which is not the path a tool call carries. One entry covers
  macOS too, where `/tmp` resolves to `/private/tmp`: patterns match both the
  path and its symlink-resolved form.
- **Open reads do not touch the `deny` floor.** `path` is the cross-cutting
  layer and wins over any `external_directory` allow, so `*.env` stays blocked
  and `rm -rf *` stays blocked under `/tmp` exactly as elsewhere.
- `extensions/pi-permission-system/logs/` is gitignored **by design**: the review
  log records bash command strings unredacted. Never commit it, and do not paste
  it into a spec or issue without redacting.
- **A covered external access logs as `permission_request.session_approved`.**
  The gate writes that record whenever every external path on the command was
  already allowed — *config* allows included — with `decidedBy: { surface:
  "external_directory", pattern: null }`. It is not evidence that a session grant
  or a human decided anything; on that path nothing prompted at all. What a
  prompt looks like is a `permission_request.waiting` event followed by a
  resolution such as `confirmation_unavailable` (headless) or `user_approved`.
  The event name alone has misled at least one reader into thinking the policy
  allow had not applied.

### What A Dispatched Child Can And Cannot Run

The gate **reads the command string**. A path that appears literally in the
command is gated by its direction; a path buried inside a script the command
invokes is never seen, and the check then passes vacuously. Measured
2026-09-14, while a `trellis-check` child was verifying this repo against its own
plan — every row below is an observed `logs/` record, not a reading of the
config:

| Command string | Gate record | Child outcome |
| --- | --- | --- |
| `./scripts/doctor.sh` | `session_approved`, `pattern: null` | runs — no external path is in the string |
| `cd /tmp && /abs/path/scripts/doctor.sh` | `session_approved` | runs — `/tmp/*` is allowed |
| `… render-settings.mjs "$HOME/.pi/agent/settings.json" --check` | `waiting` → `forwarded_permission.request_created` | **blocks on a dialog the child cannot see** |
| `timeout 25 pi remove --help` | `waiting` → forwarded | blocks the same way |
| `rm -rf <dir>` | `Denied by policy: 'bash' (rule 'rm -rf *')` | refused before it runs; a compound command loses the whole call |

The `pi remove` row is worth separating from the rest: the committed policy has
no `bash` pattern for it, so it is the external-directory **write** path
(`pi remove` mutates `~/.pi/agent/npm`) rather than a text match. The behaviour is
stable either way, and it holds for `--help`, which reads nothing and still asks.

Two rules follow, and a dispatch prompt must state both:

- **Keep `$HOME`, `~`, and `~/.pi` out of the command string.** A check that
  needs a live-settings path as an argument cannot avoid naming it, so it is the
  parent's to run: `render-settings.mjs --check` was never runnable by a child.
  `doctor.sh` and `check-docs.mjs` are unaffected — their external paths are
  inside the scripts, invisible to the gate. `/tmp` is explicitly safe.
- **Read `waiting` as "blocked", never as "slow".** `permission_request.waiting`
  with `decidedBy: null`, followed by
  `forwarded_permission.request_created`, means the dialog was routed to the
  **parent session**. A headless child has no way to answer it: it sits there
  until it is interrupted, or resolves as `confirmation_unavailable`. A 240-second
  stall in a child's transcript is this, and re-prompting the child does not fix
  it — the prompt has to stop asking for the command.

Separate from the gate, one shape waits on a **TTY** rather than a dialog:
`pi remove <pkg>` with no `</dev/null` blocks on an interactive confirmation
forever. There is no `--yes`; `--help` documents only `-l`, `--approve`, and
`--no-approve`.

The full rationale, state table, and tuning recipes live in
`pi-agent/extensions/README.md`. That file is the deep reference; this spec
records only the rules a contributor must not break.

---

## Anti-Patterns

- **Do not pin a package spec with `@version`.** It silently disables updates.
- **Do not add comments or trailing commas to any release JSON.** For the
  permission config it changes behaviour, not just formatting.
- **Do not vendor a skill into the repo.** Add it to `skills.json`.
- **Do not edit `~/.pi/agent/settings.json` directly** as a way of adding a
  package — that file is overwritten on the next render.
- **Do not put an installed package's code under `extensions/`.** Only config.
- **Do not copy only `SKILL.md`** when hand-updating a skill; copy the directory.
- **Do not commit the permission review log** or quote it verbatim elsewhere.
- **Do not loosen a `deny` rule** to make a task pass. The denies for `*.env` and
  `rm -rf *` are the deliberate least-privilege floor of an otherwise fully-open
  harness.

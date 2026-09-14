# Plugins — daily use

> When to reach for each always-on package, and what to type. One entry per spec
> string in `pi-agent/settings.core.json`.
>
> Why each package is core, and how its config actually behaves (write
> behaviour, symlink traps, measured paths), live in
> [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).
> Install and lifecycle rules live in [`README.md`](../README.md).
> Entry contract and heading convention: [`docs/README.md`](./README.md).

---

### `npm:pi-subagents`

**What it is.** Delegation — one `subagent` tool that runs focused child Pi sessions and brings their results back, plus packaged agents (`scout`, `researcher`, `evidence-auditor`, `worker`, `reviewer`, `oracle`, `delegate`).

**Reach for it when.** A second or third set of model eyes is worth it: code review, codebase recon, parallel audits, a decision you want challenged, or a saved scripted workflow you want run end to end.

**Invoke.** `subagent({ agent, task })`, or just ask in plain language ("use reviewer to review this diff"). `/subagents-fleet` opens the live inspector for running children, `/subagents-doctor` checks setup, `/subagents-guide [topic]` prints installed-version help, and `/council` convenes the packaged advisor workflow.

**Config.** None tracked here — the extension reads optional `~/.pi/agent/extensions/subagent/config.json`, which would sit in the symlinked `pi-agent/extensions/` tree; this repo ships no such file.

**Gotcha.** A foreground child (`async: false`) never loads the parent's ambient extensions, so an agent that needs MCP tools or a provider extension has to run as a background child.

### `npm:pi-web-access`

**What it is.** Web research tools: `web_search`, `fetch_content`, `get_search_content`, and `source_check`, with provider routing and automatic GitHub/YouTube/PDF/video/image handling.

**Reach for it when.** A fact needs a source, a page or repo needs reading, or a claim needs checking against the pages that own it rather than a write-up about them.

**Invoke.** `web_search({ query: "..." })`, `fetch_content({ url: "..." })`, `get_search_content({ responseId: "..." })`, `source_check({ claim: "..." })`; `/websearch` opens the curator directly so you can review results before they reach the agent.

**Config.** `~/.pi/agent/web-search.json` — ignored. Mechanics: [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).

**Gotcha.** Fetched content lives in a cache with a one-hour lifetime; after that, `get_search_content` finds nothing and the page has to be fetched again.

### `npm:@juicesharp/rpiv-ask-user-question`

**What it is.** One tool, `ask_user_question`, that opens a tabbed terminal dialog of up to four questions with written-out options and hands your choices back as structured data.

**Reach for it when.** A task has a real decision buried in it and guessing would cost more to undo than fifteen seconds of picking; options with descriptions beat a wall of prose.

**Invoke.** The model calls `ask_user_question` — there is no slash command. Move with the arrow keys, choose with `Enter`, `n` attaches a note, `Esc` abandons the questionnaire.

**Config.** `~/.config/rpiv-ask-user-question/config.json` — none here; machine-global, outside `~/.pi/agent`.

### `npm:@juicesharp/rpiv-todo`

**What it is.** A `todo` tool plus `/todos` and a live panel above the editor, showing what the agent is doing now, what is finished, and what is queued.

**Reach for it when.** Work has several steps and you want the plan to stay on screen instead of asking the agent where it is.

**Invoke.** The model calls `todo`; you run `/todos` to print the full list grouped by status, and `ctrl+shift+t` collapses or expands the panel.

**Config.** `~/.config/rpiv-todo/config.json` — none here; machine-global, outside `~/.pi/agent`.

**Gotcha.** Task state is keyed by session, so a detached or child session can neither read nor overwrite the foreground list.

### `npm:@gotgenes/pi-permission-system`

**What it is.** The permission gate. Pi itself has no permission prompts, so this extension is the only thing deciding what a tool call, a bash command, or an MCP/skill call is allowed to do.

**Reach for it when.** You are tightening or loosening what the agent may do — adding a deny, opening a read-only directory outside the working tree, or silencing a repeated prompt.

**Invoke.** `/permission-system` opens its own settings — `show` prints the expanded policy, `path` the config path, plus `reset` and `help`. Otherwise it acts at tool-call time as a silent `allow`, a blocking `deny`, or an inline prompt (`ask`) — `y` approve, `s` approve for the session, `n` deny, `r` deny with a reason, each hotkey arming and a second press confirming.

**Config.** `pi-agent/extensions/pi-permission-system/config.json` — tracked; it is committed here because the package reads its policy out of the extensions tree. Full rationale: [`pi-agent/extensions/README.md`](../pi-agent/extensions/README.md).

### `npm:@sting8k/pi-vcc`

**What it is.** Algorithmic conversation compactor: it builds a brief, sectioned transcript by extraction and formatting, with **no LLM call** and the same output for the same input.

**Reach for it when.** You want compaction to be deterministic and free, or you want to compact on demand while keeping the dropped history searchable.

**Invoke.** `/pi-vcc` compacts now keeping the last user turn, `/pi-vcc keep:N [prompt]` keeps the last `N`, `/pi-vcc-recall <query> [scope:all]` searches the raw session history including what compaction dropped. By default it also takes over `/compact` and the automatic threshold path.

**Config.** `~/.pi/agent/pi-vcc-config.json` — ignored. The compaction split it is half of: [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).

### `npm:@thunstack/auto-compact`

**What it is.** Early, percentage-triggered compaction that runs between model responses and resumes unfinished tool-driven work afterwards.

**Reach for it when.** Long sessions reach Pi's native near-full trigger too late, or you want a per-session toggle and an interactive settings panel instead of editing a file.

**Invoke.** `/auto-compact` toggles it for the current session; `/auto-compact-config` opens the settings panel, which needs TUI mode.

**Config.** `~/.pi/agent/auto-compact.json` — ignored. Threshold and resume rationale: [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).

### `npm:pi-mcp-adapter`

**What it is.** One `mcp` proxy tool (~200 tokens) in front of every configured MCP server, with lazy connections and cached metadata, plus an optional `mcpScript` tool for batching several MCP calls in one request.

**Reach for it when.** You want the MCP ecosystem without paying for every server's full tool list in context, or you need to add or authenticate a server without restarting Pi.

**Invoke.** `mcp({ })` for status, `mcp({ search: "..." })` and `mcp({ describe: "..." })` to discover, `mcp({ tool: "...", args: { ... } })` to call, `mcpScript({ code: "..." })` to chain several calls. Commands: `/mcp` for the panel, `/mcp setup`, `/mcp tools`, `/mcp prompts`, `/mcp reconnect [server]`, `/mcp enable|disable <server>`, `/mcp logout <server>`, `/mcp-auth [server]`.

**Config.** `~/.config/mcp/mcp.json` — generated outside the repo; it is the shared, machine-global layer `setup.sh` registers into, with Pi-only overrides in `~/.pi/agent/mcp.json` and `.pi/mcp.json`. Surface rationale: [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).

### `npm:pi-lens`

**What it is.** Language-aware feedback on every write and edit: LSP diagnostics and navigation, language-specific linters and type-checkers, safe format/autofix, ast-grep and tree-sitter rules, and a ranked identifier index.

**Reach for it when.** You want the real toolchain rather than the model's own reading to be what checks an edit, or you are navigating a codebase and want ranked `symbol_search` → `module_report` → `read_symbol` instead of grep.

**Invoke.** Tools appear on write/edit with nothing to type. Five stay always active (`lens_diagnostics`, `module_report`, `read_symbol`, `read_enclosing`, `symbol_search`); five more (`ast_grep_search`, `ast_grep_replace`, `ast_grep_outline`, `lsp_navigation`, `lens_diagnostic_mark`) are switched on through `pi_lens_activate_tools`. Commands: `/lens-map`, `/lens-toggle`, `/lens-context-toggle`, `/lens-widget-toggle`, `/lens-health`, `/lens-perf`, `/lens-tools`, `/lens-tdi`, `/lens-allow-edit <path>`.

**Config.** `~/.pi-lens/config.json` — none here; machine-global under its own root, outside `~/.pi/agent`. Project config is `.pi-lens.json`.

**Gotcha.** It downloads LSP servers and tool binaries on first use, so the first session on a fresh machine needs network — not `./setup.sh`.

### `npm:pi-tps-status`

**What it is.** A live tokens-per-second widget in the status bar: a sliding-window rate with color tiers, plus optional time-to-first-token and token/elapsed stats.

**Reach for it when.** You want to watch streaming throughput while it happens, or to tell a slow provider from a slow task.

**Invoke.** The widget appears on session start; `/tps` opens the interactive settings list (display mode, counting strategy, end-of-stream behaviour).

**Config.** `$XDG_CONFIG_HOME/pi-tps-status/config.json` (default `~/.config/pi-tps-status/config.json`) — none here; machine-global, outside `~/.pi/agent`. Mechanics: [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).

**Gotcha.** Settings used to live under the `tokenSpeed` key in Pi's own settings file; they are not migrated, so re-run `/tps` after an upgrade.

### `npm:pi-timer`

**What it is.** A per-run elapsed timer in the footer: `runs for` while the agent works, `ran for` once it stops, reset on the next run.

**Reach for it when.** You want to know how long a run actually took, which is the number that makes "is this model slow or is this task big?" answerable.

**Invoke.** Nothing to type — it renders inline in the footer on every run.

**Config.** None — see [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md) for why it needs no file.

**Gotcha.** It calls `ctx.ui.setFooter()` and rebuilds the footer by hand, because Pi exposes no composable footer primitive. That rebuild is a copy of an older footer, so it drops Pi's `CH<rate>%` cache-hit segment. The hand-placed `pi-agent/extensions/cache-hit-rate.ts` republishes that number as a status line; if `Cache: 98.2%` ever disappears from the footer, that extension is the first thing to check.

### `https://github.com/ayghri/i-have-adhd`

**What it is.** ADHD-shaped replies: answer or next action first, numbered steps, progress restated each turn, concrete time estimates, no preamble — ten rules, canonical copy in the package's `skills/i-have-adhd/SKILL.md`.

**Reach for it when.** You want output *shape* to be a standing preference rather than something you ask for per task.

**Invoke.** `/i-have-adhd` toggles it for the session (`on` and `off` are accepted too), `/skill:i-have-adhd` is the alias that turns it on, and `stop adhd mode` or `normal mode` turns it off.

**Config.** `pi-agent/i-have-adhd.json` → `~/.pi/agent/i-have-adhd.json` — symlinked; keys are `alwaysOn` and `hideStatus`. Why it is the one symlinked extension config, and what to re-measure on a package update: [`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md).

---

## Enabled-only bundles

Packages in `optional/<name>/manifest.json` are rendered into the live settings
only on a machine where the bundle is enabled, so they are not listed here.
Each bundle documents itself:

- [`optional/opencode-go/README.md`](../optional/opencode-go/README.md) — the
  only bundle that exists today; adds `npm:@oscarfalero/pi-opencode-go` with
  `/go-usage` and `/go-status`.

## Hand-placed extensions

The two extensions under `pi-agent/extensions/` are placed by hand rather than
installed from a package, and are documented where they live:

- [`pi-agent/extensions/README.md`](../pi-agent/extensions/README.md) — the
  permission policy, and the `trellis-subagents-bridge` that lets a dispatched
  child resolve its parent's Trellis task.

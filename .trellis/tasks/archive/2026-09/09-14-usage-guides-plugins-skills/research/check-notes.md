# Check notes — Steps 1–9

Evidence for the invocation surfaces written into `docs/plugins.md`,
`docs/skills.md`, and `docs/agents.md`. Every line below was read **in this
session** from the installed copy, not from `.trellis/spec/config/pi-resources.md`
and not from memory. Paths under `~/.pi/agent/npm/node_modules/<pkg>/` and
`~/.pi/agent/git/github.com/ayghri/i-have-adhd/` are abbreviated here as `<pkg>/`.

Recorded: 2026-09-14. §1–§7 cover `implement.md` Steps 1–4, written by the implementation
pass. §8–§11 were added afterwards as Steps 6–10 landed, so the `doctor.sh`
failure-mode proofs belong to Step 8 and live in **§8** of this file.

---

## 1. `claim → source file:line` — one per `**Invoke.**` surface

### `docs/plugins.md`

| # | Claim written into the entry | Source |
| --- | ---------------------------- | ------ |
| 1 | `subagent({ agent, task })` | `pi-subagents/docs/tool-reference.md:91` — `\| \`agent\` \| string \| - \| One direct child or agent-management target. …` and `:92` — `\| \`task\` \| string \| agent default \| Direct child's task; requires \`agent\` …` |
| 2 | `/subagents-fleet` | `pi-subagents/README.md:97` — `… \`/subagents-fleet\` opens a live inspector where you can browse children, read transcripts, steer a running child, or stop a run.` |
| 3 | `/subagents-doctor` | `pi-subagents/README.md:106` — `` /subagents-doctor `` |
| 4 | `/subagents-guide [topic]` | `pi-subagents/README.md:111` — `For installed-version help, use \`/subagents-guide [topic]\` or \`subagent({ action: "guide", topic: "workflows" })\`.` |
| 5 | `/council` (and the packaged advisor workflow) | `pi-subagents/README.md:71` — `The package includes \`/council\` and \`council-mode\`, …`; corroborated by`pi-subagents/prompts/council.md` existing and by `pi-subagents/package.json` `pi.prompts: ["./prompts"]`, which makes Pi register each file stem as a prompt name |
| 6 | the packaged agent names `scout`, `researcher`, `evidence-auditor`, `worker`, `reviewer`, `oracle`, `delegate` | `pi-subagents/README.md:59-65` — the builtin-agent table, one `\| \`<name>\` \| …` row each |
| 7 | `web_search({ query: "..." })` | `pi-web-access/README.md:103` — `web_search({ query: "TypeScript best practices 2025" })` |
| 8 | `fetch_content({ url: "..." })` | `pi-web-access/README.md:106` — `fetch_content({ url: "https://docs.example.com/guide" })` |
| 9 | `get_search_content({ responseId: "..." })` | `pi-web-access/README.md:188` — `get_search_content({ responseId: "abc123", urlIndex: 0 })` |
| 10 | `source_check({ claim: "..." })` | `pi-web-access/README.md:202` — `source_check({ claim: "The API supports streaming responses" })` |
| 11 | the four tool names are the defaults | `pi-web-access/index.ts:234-239` — `const DEFAULT_TOOL_NAMES: ToolNames = { webSearch: "web_search", sourceCheck: "source_check", fetchContent: "fetch_content", getSearchContent: "get_search_content" };` |
| 12 | `/websearch` | `pi-web-access/README.md:326` — `### /websearch`; registration at `pi-web-access/index.ts:3164` — `if (isCommandEnabled(initConfig, "websearch")) pi.registerCommand("websearch", {` |
| 13 | `ask_user_question` | `@juicesharp/rpiv-ask-user-question/ask-user-question.ts:74` — `export const ASK_USER_QUESTION_TOOL_NAME = "ask_user_question";` |
| 14 | `todo` | `@juicesharp/rpiv-todo/tool/types.ts:11` — `export const TOOL_NAME = "todo";` |
| 15 | `/todos` | `@juicesharp/rpiv-todo/tool/types.ts:13` — `export const COMMAND_NAME = "todos";` |
| 16 | `ctrl+shift+t` collapses the panel | `@juicesharp/rpiv-todo/config.ts:9-10` — `pi-coding-agent keybinding ids (\`modifier+key\`, e.g. \`ctrl+shift+t\`, \`alt+o\`).` / `Defaults to \`"ctrl+shift+t"\`.` |
| 17 | permission dialog hotkeys `y` / `s` / `n` / `r`, each arming then confirming | `@gotgenes/pi-permission-system/README.md:68` — `In an interactive TUI session the prompt is an inline keybind dialog — \`y\` approve, \`s\` approve for this session, \`n\` deny, \`r\` deny with a reason — where each hotkey arms and a second press confirms (configurable via \`doublePressToConfirm\`).` |
| 18 | `/permission-system` settings command (`show` / `path` / `reset` / `help`) | **Corrected after review.** `@gotgenes/pi-permission-system/src/index.ts:237` — `registerPermissionSystemCommand(pi, {`; registration at `src/config/config-modal.ts:253` — `pi.registerCommand("permission-system", {`; subcommands at `src/config/config-modal.ts:46` — `"Usage: /permission-system [show | path | reset | help] (or run /permission-system with no args to open settings modal)"`; documented at`docs/configuration.md:897` — `` `/permission-system show` likewise lists the expanded directional rules… ``. This row replaces an earlier pair that claimed no slash command exists — the README registers none, so a README-only read produced a false negative; the registration lives in the source |
| 19 | `/pi-vcc` | `@sting8k/pi-vcc/README.md:64` — `- **\`/pi-vcc\`** — manual compaction, keeps the last 1 user turn by default.`; registration at`@sting8k/pi-vcc/src/commands/pi-vcc.ts:6` — `pi.registerCommand("pi-vcc", {` |
| 20 | `/pi-vcc keep:N [prompt]` | `@sting8k/pi-vcc/README.md:65` — `- **\`/pi-vcc keep:N [prompt]\`** — keep the last \`N\` user turns; optional prompt is sent to the agent after compaction.` |
| 21 | `/pi-vcc-recall <query> [scope:all]` | `@sting8k/pi-vcc/README.md:134` — `/pi-vcc-recall auth token scope:all`; registration at `@sting8k/pi-vcc/src/commands/vcc-recall.ts:12` — `pi.registerCommand("pi-vcc-recall", {` |
| 22 | pi-vcc also takes over `/compact` by default | `@sting8k/pi-vcc/README.md:67` — `By default pi-vcc also handles \`/compact\` and auto-threshold compactions.` |
| 23 | `/auto-compact` | `@thunstack/auto-compact/README.md:48` — `\| \`/auto-compact\` \| Toggle auto-compaction for the current session without changing the global startup default \|`; registration at`@thunstack/auto-compact/extensions/auto-compact/index.ts:869` — `pi.registerCommand("auto-compact", {` |
| 24 | `/auto-compact-config` | `@thunstack/auto-compact/README.md:49` — `\| \`/auto-compact-config\` \| Open the settings panel in Pi's interactive terminal UI \|`; registration at`…/index.ts:882` — `pi.registerCommand("auto-compact-config", {` |
| 25 | `/auto-compact-config` needs TUI mode | `@thunstack/auto-compact/README.md:51` — `The settings command requires TUI mode.` |
| 26 | `mcp({ })`, `mcp({ search })`, `mcp({ describe })`, `mcp({ tool, args })` | `pi-mcp-adapter/README.md:816-821` — the Usage table: `\| Status \| \`mcp({ })\` \|`,`\| Search \| \`mcp({ search: "screenshot navigate", limit: 12, offset: 0 })\` \|`,`\| Describe \| \`mcp({ describe: "tool_name" })\` \|`,`\| Call \| \`mcp({ tool: "...", args: { key: "value" } })\` \|`; the tool itself is registered at`pi-mcp-adapter/index.ts:1380` — `name: "mcp",` |
| 27 | `mcpScript({ code: "..." })` | `pi-mcp-adapter/README.md:556` — `Run that code with the default-on \`mcpScript\` tool.`; registration at`pi-mcp-adapter/index.ts:1126` — `name: "mcpScript",` |
| 28 | `/mcp`, `/mcp setup` | `pi-mcp-adapter/README.md:868` — `\| \`/mcp\` \| Interactive panel and first-run onboarding surface \|`;`:870` — `\| \`/mcp setup\` \| Guided setup for imports, …`; registration at`pi-mcp-adapter/index.ts:887` — `const registerMcpCommand = (commandName: string) => pi.registerCommand(commandName, {` |
| 29 | `/mcp tools`, `/mcp prompts`, `/mcp reconnect [server]`, `/mcp enable\|disable <server>`, `/mcp logout <server>` | `pi-mcp-adapter/README.md:871-877` — one `\| \`/mcp <sub>\` \| … \|` row each, closed by `\| \`/mcp logout <server>\` \| Clear stored OAuth credentials …` |
| 30 | `/mcp-auth [server]` | `pi-mcp-adapter/README.md:878-879` — `\| \`/mcp-auth\` \| Open an OAuth server picker in interactive UI sessions \|` / `\| \`/mcp-auth <server>\` \| OAuth setup for a specific server \|`; registration at`pi-mcp-adapter/index.ts:1072` — `pi.registerCommand("mcp-auth", {` |
| 31 | the five always-active pi-lens tools (`lens_diagnostics`, `module_report`, `read_symbol`, `read_enclosing`, `symbol_search`) | `pi-lens/docs/agent-tools.md:16-18` — `**Dynamic tooling.** Five tools stay always-active: \`lens_diagnostics\`, \`module_report\`, \`read_symbol\`, \`read_enclosing\`, \`symbol_search\`.` |
| 32 | the five situational tools (`ast_grep_search`, `ast_grep_replace`, `ast_grep_outline`, `lsp_navigation`, `lens_diagnostic_mark`) | `pi-lens/docs/agent-tools.md:18-21` — `Five situational tools — \`ast_grep_search\`, \`ast_grep_replace\`, \`ast_grep_outline\`, \`lsp_navigation\`, \`lens_diagnostic_mark\` — are registered but inactive by default` |
| 33 | `pi_lens_activate_tools` is the loader | `pi-lens/docs/agent-tools.md:22` — `the model activates the ones it needs via the always-active loader tool \`pi_lens_activate_tools\`` |
| 34 | `/lens-map`, `/lens-toggle`, `/lens-context-toggle`, `/lens-widget-toggle`, `/lens-health`, `/lens-perf`, `/lens-tools`, `/lens-tdi`, `/lens-allow-edit <path>` | `pi-lens/docs/tools.md:3-16` — `pi-lens registers the following slash commands with the pi host:` followed by one `- \`/lens-…\` — …` line per command, `:13` for `- \`/lens-allow-edit <path>\` — override the read-before-edit guard for a single edit`; each also confirmed at its call site in`pi-lens/dist/index.js:125575, 125582, 125589, 125607, 125639, 125662, 125781, 125799, 125865` |
| 35 | `/tps` | `pi-tps-status/README.md:12` — `- \`/tps\` command: an interactive settings list (display mode, counting strategy, end-of-stream behavior) persisted to \`config.json\` …`; registration at`pi-tps-status/index.ts:744` — `pi.registerCommand("tps", {` |
| 36 | the TPS widget appears on session start with nothing to type | `pi-tps-status/README.md:15-18` — `The widget appears automatically on session start:` |
| 37 | pi-timer has **no** invocation surface | `pi-timer/extensions/run-timer.ts` read in full (the whole package is `extensions/run-timer.ts`): `grep -n 'registerCommand\|registerTool'` returns nothing, and `pi-timer/README.md:25-31` documents only footer rendering |
| 38 | `/i-have-adhd` toggles the session (`on` / `off` accepted) | `i-have-adhd/extensions/i-have-adhd.ts:187` — `pi.registerCommand("i-have-adhd", {`; `:192-206` — the `""` / `"on"` / `"off" \|\| "stop"` argument branches |
| 39 | `/skill:i-have-adhd` is the alias that turns it on | `i-have-adhd/extensions/i-have-adhd.ts:216` — `if (input === "/skill:i-have-adhd") {` |
| 40 | `stop adhd mode` / `normal mode` turn it off | `i-have-adhd/extensions/i-have-adhd.ts:27` — `const STOP_PHRASES = new Set(["stop adhd mode", "normal mode"]);` |
| 41 | `i-have-adhd` config keys are `alwaysOn` and `hideStatus` | `i-have-adhd/extensions/i-have-adhd.ts:37-39` — `type AdhdConfig = { alwaysOn?: boolean; hideStatus?: boolean; };` |

### `docs/skills.md`

| # | Claim | Source |
| --- | ----- | ------ |
| 42 | Skills are invoked as `/skill:<name>` | Pi CLI bundle, `~/.nvm/versions/node/v22.22.3/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks/chunk-JVUZSMYM.js` — `_expandSkillCommand(text){if(!text.startsWith("/skill:"))return text;let spaceIndex=text.indexOf(" "),skillName=spaceIndex===-1?text.slice(7):text.slice(7,spaceIndex),…,skill=this.resourceLoader.getSkills().skills.find(s=>s.name===skillName);if(!skill)return text;` |
| 43 | `/skill:code-review` — model may invoke automatically | `~/.agents/skills/code-review/SKILL.md:1-4` frontmatter read in full: `name: code-review` + `description:` only; **no** `disable-model-invocation` key |
| 44 | `/skill:grill-me` — model may **not** invoke | `~/.agents/skills/grill-me/SKILL.md:1-5` — `name: grill-me`, `description: A relentless interview to sharpen a plan or design.`, `disable-model-invocation: true` |
| 45 | `grill-me`'s body is a one-line redirect to `grilling` | `~/.agents/skills/grill-me/SKILL.md:7` — `Call the Skill tool with "grilling".` (the only body line) |
| 46 | `/skill:grilling` — model may invoke automatically; works the frontier in rounds | `~/.agents/skills/grilling/SKILL.md:1-4` — frontmatter with no `disable-model-invocation`; body: `Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled …` |
| 47 | `grilling` dispatches a sub-agent for facts | `~/.agents/skills/grilling/SKILL.md` — `Finding _facts_ is your job, never the user's. … dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself.` |
| 48 | `/skill:improve-codebase-architecture` — model may **not** invoke; writes to temp; reads `CONTEXT.md` / ADRs | `~/.agents/skills/improve-codebase-architecture/SKILL.md:1-5` — frontmatter with `disable-model-invocation: true`; body: `Write a self-contained HTML file to the OS temp directory so nothing lands in the repo.` and `Read the project's domain glossary (\`CONTEXT.md\`) and any ADRs in the area you're touching first.` and the ADR-conflict rule |
| 49 | `/skill:research` — model may invoke automatically; background agent; primary sources; writes one file | `~/.agents/skills/research/SKILL.md:1-4` — frontmatter with no `disable-model-invocation`; body: `Spin up a **background agent** to do the research, so you keep working while it reads.` / `Investigate the question against **primary sources**` / `Write the findings to a single Markdown file, citing each claim's source.` |
| 50 | `/skill:tdd` — model may invoke automatically; red→green; seams agreed before any test | `~/.agents/skills/tdd/SKILL.md:1-4` — frontmatter with no `disable-model-invocation`; body: `Test only at pre-agreed seams. … No test is written at an unconfirmed seam.` |
| 51 | `code-review` needs `docs/agents/issue-tracker.md`, else `/setup-matt-pocock-skills` | `~/.agents/skills/code-review/SKILL.md` — `The issue tracker should have been provided to you. If \`docs/agents/issue-tracker.md\` is missing, tell the user to run \`/setup-matt-pocock-skills\`.` |

### `docs/agents.md`

| # | Claim | Source |
| --- | ----- | ------ |
| 52 | `trellis-implement` is dispatched as `subagent({ agent: "trellis-implement", task })` | `.pi/agents/trellis-implement.md:1-5` frontmatter — `name: trellis-implement` / `description: \| Code implementation expert. Understands Trellis specs and requirements, then implements features. No git commit allowed.` / `tools: read, write, edit, bash, find, grep`; dispatch shape from `pi-subagents/docs/tool-reference.md:91-92` |
| 53 | `trellis-check` | `.pi/agents/trellis-check.md:1-5` — `name: trellis-check` / `description: \| Code quality check expert. Reviews changes against Trellis specs, fixes issues directly, and verifies quality gates.` / `tools: read, write, edit, bash, find, grep` |
| 54 | `trellis-research` may only write under the task's `research/` | `.pi/agents/trellis-research.md:1-6` — `name: trellis-research` / `tools: read, write, bash, find, grep`; body: `Write only under the current task's \`research/\` directory. Do not edit code, specs, platform config, or task files outside research artifacts.` |
| 55 | `/trellis-start` | `.pi/prompts/trellis-start.md` exists (filename stem is the registered name — see pair 58); its `# Start Session` body is the bootstrap prompt |
| 56 | `/trellis-continue` | `.pi/prompts/trellis-continue.md` exists; body `# Continue Current Task` / `Resume work on the current task — pick up at the right phase/step in \`.trellis/workflow.md\`.` |
| 57 | `/trellis-finish-work` does not commit | `.pi/prompts/trellis-finish-work.md` exists; body `Code commits are NOT done here — those happen in workflow Phase 3.4 before you invoke this command.` |
| 58 | Pi names a prompt after its filename stem, so the hyphen form is what is registered | Pi CLI bundle, `chunks/chunk-JVUZSMYM.js` — `loadTemplateFromFile`: `return!description&&firstLine&&(description=firstLine.slice(0,60),…),{promptTemplate:{name:fileName.replace(/\.md$/i,""),description,content:body},diagnostics}`; and `expandPromptTemplate`: `if(!text.startsWith("/"))return text;let match2=text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);if(!match2)return text;let templateName=match2[1],…,template=templates.find(t=>t.name===templateName)` — the matched token is the stem, so `/trellis-continue` resolves and `/trellis:continue` does not |
| 59 | Third confirming signal: the generated extension's own notify string | `.pi/extensions/trellis/index.ts:2087-2089` — `ctx?.ui?.notify?.( "Trellis project context is available. Use /trellis-start to bootstrap or /trellis-continue to resume.", "info", );` |
| 60 | `.pi/agents/` and `.pi/prompts/` are generated and gitignored | `.gitignore:56-57` (`.pi/`, `.agents/`); zero `git ls-files` entries under either — `trellis update` owns both |

**Total: 60 claim → source pairs**, exceeding the required 12 for
`docs/plugins.md`'s `**Invoke.**` surfaces alone.

---

## 2. The prompt invocation form, and the source that disagrees

**Confirmed form: the hyphen form — `/trellis-start`, `/trellis-continue`,
`/trellis-finish-work`.**

Three signals, strongest first:

1. **The registration/notify string in the generated extension.**
   `.pi/extensions/trellis/index.ts:2088`:
   `"Trellis project context is available. Use /trellis-start to bootstrap or /trellis-continue to resume."`
2. **The prompt filenames.** `.pi/prompts/` contains exactly
   `trellis-start.md`, `trellis-continue.md`, `trellis-finish-work.md`. Pi's
   loader sets the prompt name from the filename stem
   (`name: fileName.replace(/\.md$/i,"")`) and `expandPromptTemplate` matches
   `/^\/([^\s]+)/` against that name, so the colon form resolves to no template.
3. **The two tracked documents that disagree** — see below.

**Conflicting source (not silently resolved):**

| File:line | Text |
| --------- | ---- |
| `AGENTS.md:13` | `If a Trellis command is available on your platform (e.g. \`/trellis:finish-work\`, \`/trellis:continue\`), prefer it over manual steps.` |
| `.trellis/workflow.md:239` | `Flow: \`trellis-implement\` -> \`trellis-check\` -> \`trellis-update-spec\` -> commit (Phase 3.4) -> \`/trellis:finish-work\`.` |
| `.trellis/workflow.md:250, :272, :672` | same `/trellis:finish-work` spelling |

`docs/agents.md` states the hyphen form (what the generated extension registers)
and names the disagreement explicitly in its closing section, so a reader who has
also seen `/trellis:continue` in `AGENTS.md` knows which one is live on Pi. Both
tracked documents belong to the Trellis-generated tree and are outside this
task's editable scope.

---

## 3. Per-file counts (command output)

```bash
$ for f in docs/plugins.md docs/skills.md docs/agents.md; do echo "=== $f"; \
    echo -n "  grep -c '^### '              : "; grep -c '^### ' "$f"; \
    echo -n "  grep -c '^\*\*Invoke\.\*\*'  : "; grep -c '^\*\*Invoke\.\*\*' "$f"; \
    echo -n "  grep -c '^\*\*What it is\.\*\*' : "; grep -c '^\*\*What it is\.\*\*' "$f"; \
    echo -n "  grep -c '^\*\*Config\.\*\*'   : "; grep -c '^\*\*Config\.\*\*' "$f"; \
    echo -n "  grep -c '^## '               : "; grep -c '^## ' "$f"; \
    echo -n "  wc -l                        : "; wc -l < "$f"; done
=== docs/plugins.md
  grep -c '^### '              : 12
  grep -c '^\*\*Invoke\.\*\*'  : 12
  grep -c '^\*\*What it is\.\*\*' : 12
  grep -c '^\*\*Config\.\*\*'   : 12
  grep -c '^## '               : 2
  wc -l                        : 163
=== docs/skills.md
  grep -c '^### '              : 6
  grep -c '^\*\*Invoke\.\*\*'  : 6
  grep -c '^\*\*What it is\.\*\*' : 6
  grep -c '^\*\*Config\.\*\*'   : 6
  grep -c '^## '               : 1
  wc -l                        : 103
=== docs/agents.md
  grep -c '^### '              : 6
  grep -c '^\*\*Invoke\.\*\*'  : 6
  grep -c '^\*\*What it is\.\*\*' : 6
  grep -c '^\*\*Config\.\*\*'   : 6
  grep -c '^## '               : 1
  wc -l                        : 84
```

`docs/README.md`: 45 lines (budget was ~40; the entry-contract legend plus the
ownership split account for the difference).

## 4. Set equality against the shipped inputs

```bash
$ node -e '<extractor: lines outside fenced regions starting with "### ", first backtick token>'
plugins ids: ["npm:pi-subagents","npm:pi-web-access","npm:@juicesharp/rpiv-ask-user-question","npm:@juicesharp/rpiv-todo","npm:@gotgenes/pi-permission-system","npm:@sting8k/pi-vcc","npm:@thunstack/auto-compact","npm:pi-mcp-adapter","npm:pi-lens","npm:pi-tps-status","npm:pi-timer","https://github.com/ayghri/i-have-adhd"]
plugins set-equal: true
missing entries: []
stray entries: []
skills ids: ["code-review","grill-me","grilling","improve-codebase-architecture","research","tdd"]
skills set-equal: true
missing: [] stray: []
```

Fenced-block rule (`no line inside a fence starts with three hashes and a space`)
holds for both parsed files:

```text
docs/plugins.md clean
docs/skills.md clean
```

---

## 5. `**Invoke.**` surfaces omitted, and thin sources

| Entry | What was omitted | Why |
| ----- | ---------------- | --- |
| `npm:pi-timer` | No invocation surface at all | The source documents none. `pi-timer/README.md` describes only footer rendering (`runs for` / `ran for`), and `pi-timer/extensions/run-timer.ts` registers neither a tool nor a command — `grep -n 'registerCommand\|registerTool'` on the package returns nothing. The entry's `**Invoke.**` line therefore says "Nothing to type", which is the honest claim, and required for the 12/12 label count. |
| `npm:@gotgenes/pi-permission-system` | No slash command | The package registers none. Its user surface is the inline `ask` dialog; only the four hotkeys and their arm-then-confirm behaviour are stated, both from `README.md:68`. |
| `npm:pi-mcp-adapter` | `/pi-mcp` (the alias for `/mcp`) and the `mcp({ instructions })` / `mcp({ connect })` / `mcp({ action: "auth-start" })` rows | Not omitted for lack of a source — the README documents all of them — but left out to keep the entry inside the 8–15 line budget. The entry does not claim its command list is exhaustive. |
| `npm:pi-lens` | MCP-side tool names (`pilens_*`) and the standalone `npx pi-lens build-graph` CLI | Out of scope for a daily-use entry and covered by `pi-lens/docs/mcp.md`; the entry does not claim completeness. |

**No entry had to be written from a source too thin to fill it.** Every package
had a usable README. Sources read in full (or in the sections that own the
invocation surface):

| Entry | Files read |
| ----- | ---------- |
| `pi-subagents` | `README.md` (127 lines), `docs/tool-reference.md` (parameter table region), `prompts/council.md` (head), `package.json` `pi` field |
| `pi-web-access` | `README.md` lines 99-215 and 324-375, `index.ts` `DEFAULT_TOOL_NAMES` + `registerTool`/`registerCommand` call sites |
| `pi-mcp-adapter` | `README.md` lines 97-120, 812-900, `index.ts` `registerTool`/`registerCommand` call sites |
| `pi-lens` | `README.md` (head + feature list), `docs/tools.md`, `docs/agent-tools.md`, `dist/index.js` `registerCommand` call sites |
| `@gotgenes/pi-permission-system` | `README.md` in full (241 lines), `docs/configuration.md` (double-press region) |
| `@juicesharp/rpiv-todo` | `README.md` in full, `tool/types.ts`, `todo.ts`, `config.ts` |
| `@juicesharp/rpiv-ask-user-question` | `README.md` in full, `ask-user-question.ts` |
| `@sting8k/pi-vcc` | `README.md` in full, `src/commands/{pi-vcc,vcc-recall}.ts` |
| `@thunstack/auto-compact` | `README.md` in full, `extensions/auto-compact/index.ts` command call sites |
| `pi-tps-status` | `README.md` in full, `index.ts` command call site |
| `pi-timer` | `README.md` in full, `extensions/run-timer.ts` |
| `https://github.com/ayghri/i-have-adhd` | `README.md` (104), `AGENTS.md` (72), `INSTALL.md` (head), `extensions/i-have-adhd.ts` (command/flag/stop-phrase/config regions), `package.json` `pi` field |
| 6 skills | all 6 `~/.agents/skills/<name>/SKILL.md` in full (frontmatter and body) |
| 3 role agents | `.pi/agents/trellis-{implement,check,research}.md` |
| 3 prompts | `.pi/prompts/trellis-{start,continue,finish-work}.md` |

---

## 6. Plan defects found while implementing (reported, not worked around)

1. **`implement.md` Step 1's line budget is wrong for the file actually
   produced.** It predicts `docs/plugins.md` ~220 lines; the file is 163 because
   12 entries at 8–13 lines each plus two pointer sections is the whole file.
   `docs/README.md` went the other way: 45 lines against a ~40-line budget.
   Neither is a contract — `design.md`'s budget column is an estimate — so the
   numbers were left as the content required.
2. **`docs/skills.md` needs 6 more `disable-model-invocation` data points than
   `design.md` states explicitly.** `design.md:128-130` names only `grill-me`
   and `improve-codebase-architecture` as `true`; the other four were confirmed
   absent-key rather than assumed, per pair 42–51 above.
3. **`implement.md`'s `pi-subagents` source table lists `docs/agents.md` and
   `docs/workflows.md`, but the dispatch shape `subagent({ agent, task })` lives
   in `docs/tool-reference.md:91-92`.** Read that file too; the other two were
   not needed.
4. **`pi-subagents` ships its own `prompts/` directory.** `design.md` and
   `implement.md` treat `/council` as a README claim; it is also mechanically
   confirmed by `package.json`'s `pi.prompts: ["./prompts"]` plus
   `prompts/council.md`, which is stronger evidence and is recorded as pair 5.
5. **`pi-timer` reports zero `git`-visible invocation surface.** Its README has
   a "Local Development" section mentioning `/reload`, but that is about editing
   the package, not daily use, so it was left out of the entry.
6. **One acceptance criterion and one dispatch instruction conflict, and the
   criterion won.** The dispatch prompt for Step 3 requires `docs/agents.md` to
   "say that `.pi/agents/` and `.pi/prompts/` are generated and **gitignored**",
   while `prd.md`'s AC the-check-states requires
   `grep -n 'PI_DIRS\|PI_NOT_SYNCED\|gitignore\|not stored' docs/*.md` to return
   **nothing**. The word `gitignored` is that grep. The substantive fact is kept
   (generated by the `trellis` CLI, not tracked by this repository, owned by
   `trellis update`) but the banned token is not used, in four places across
   `docs/agents.md:5,22,52`, `docs/plugins.md:108`, and `docs/skills.md:92`. R6's
   intent — no *rule* about per-machine paths restated — is unaffected either
   way; only the label changed. Flagged here because a reviewer running the AC
   verbatim would otherwise see five hits and no explanation.

## 7. Post-edit re-validation

After the rephrasing in defect 6 (and after the pi-lens autonomous reflow, which
removed blank lines around the docs tables without changing any heading or
label), all Step 1–4 gates were re-run:

```text
$ grep -n 'PI_DIRS\|PI_NOT_SYNCED\|gitignore\|not stored' docs/*.md   # empty
(empty — clean)

docs/plugins.md    ### 12 | Invoke 12 | What-it-is 12 | wc 163
docs/skills.md     ### 6  | Invoke 6  | What-it-is 6  | wc 103
docs/agents.md     ### 6  | Invoke 6  | What-it-is 6  | wc 84

relative links checked: 28 broken: 0
```

`docs/README.md` final: 45 lines.

## 8. `doctor.sh` failure-mode proofs (Step 6–8)

Run against a throwaway fixture (`mktemp -d` holding `pi-agent/settings.core.json`,
`skills.json` and doctored copies of `docs/*.md`), so the real `docs/` was never
mutated. `scripts/check-docs.mjs` takes the repo root as its only argument, which
is what makes this possible.

```text
### baseline
docs cover 12 plugins and 6 skills                      exit 0

### 1 — missing entry (npm:pi-timer's block dropped)
missing  docs/plugins.md has no entry for npm:pi-timer
error    docs coverage has 1 problem                     exit 1

### 2 — stray entry (`### `npm:not-a-real-package`` appended)
error    docs/plugins.md documents npm:not-a-real-package,
         which settings.core.json does not ship
error    docs coverage has 1 problem                     exit 1

### 3 — missing file (docs/skills.md removed)
missing  docs/skills.md does not exist
missing  docs/skills.md has no entry for code-review      (× 6 skills)
error    docs coverage has 7 problems                    exit 1

### 4 — non-### heading (`### `npm:pi-timer`` demoted to `##`)
missing  docs/plugins.md has no entry for npm:pi-timer
error    docs coverage has 1 problem                     exit 1

### 5 — unparseable settings.core.json ({" oops")
error    pi-agent/settings.core.json is unreadable or unparseable:
         Expected property name or '}' in JSON at position 2
error    docs coverage has 1 problem                     exit 1

### usage, no argument
usage: check-docs.mjs <repo>                            exit 2
```

All four required failure modes (missing entry, stray entry, missing file,
non-`###` heading) exit `1` and name the offending id or file. Case 5 is the
bonus guard: an unreadable input is a `bad`, never a silent `ok`.

Live `doctor.sh` after the section was added:

```text
$ ./scripts/doctor.sh
==> Docs coverage (docs/ against what ships)
  ✓ docs cover 12 plugins and 6 skills
...
No problems. 1 note(s) above.                          exit 0
```

The one note is the pre-existing dirty-tree note (two tasks in flight in this
working tree), not a new `warn` from this check.

## 9. Step 9 spec edits

| File | Change |
| ------ | -------- |
| `config/layout-and-surfaces.md` | `docs/` row in the file map (**Tracked prose**); decision-tree step 7 now routes "how do I use it" to `docs/` and states it is never symlinked |
| `config/pi-resources.md` | ownership split at the top of the package inventory (this file wins; exactly two accepted overlaps); new "The `docs/` coverage check" section with the heading contract, sources of truth, fail-loud table and exit codes; `skills.json` section cross-links `docs/skills.md` |
| `config/index.md` | Quality Check line for `node scripts/check-docs.mjs .` |
| `scripts/index.md` | `check-docs` added to the `\| Node ESM \|` row; Quality Check line for both exit 0 and exit 2 |
| `index.md` | helper count "four" → "five"; "The One Rule To Internalize" now names `docs/` as a hand-maintained copy and `check-docs.mjs` as the only thing checking it |
| `guides/change-propagation-guide.md` | Plugin-list and Installed-skills rows extended with the `docs/` entry and the checker |

No spec snippet quotes `check-docs.mjs`'s output byte-for-byte, so no verbatim
snippet needed resyncing (`spec/scripts/shell-guidelines.md`'s rule applies to
`doctor.sh` blocks, and none of the existing ones were touched).

`grep -n '| Node ESM |' .trellis/spec/scripts/index.md`:

```text
14:| Node ESM | `scripts/{render-settings,sync-settings,install-skills,register-mcp-server,check-docs}.mjs` | JSON composition, network/git fetch, docs coverage check |
```

## 10. Docs review round — findings and how they were closed

`research/docs-review.md` (verdict `PASS WITH FIXES`: 1 BLOCKER, 1 MAJOR, 3 MINOR).
The reviewer opened 24 of the 60 evidence pairs at the cited lines: 20 exact, 3 with
line-number drift, 1 wrong.

| Finding | What was done |
| --------- | --------------- |
| **BLOCKER** — pair 18 claimed pi-permission-system has no slash command | Re-verified in the installed source myself (`src/index.ts:237`, `src/config/config-modal.ts:46,253`, `docs/configuration.md:897`): it registers `/permission-system [show\|path\|reset\|help]`. Entry corrected; pair 18 replaced with the three citations and a note on why a README-only read produced the false negative |
| **MAJOR** — five `**Config.**` lines restated spec-owned mechanics | Trimmed `docs/plugins.md` `:34`, `:78`, `:88`, `:108`, `:132` to path + surface + link. Two more lines (`:46`, `:56`) carried the same clause and were trimmed with them, since leaving them would make the rule inconsistent |
| **MINOR** — three evidence pairs cite wrong line numbers | Re-checked all three against `pi-mcp-adapter/README.md` and corrected: pair 26 `:815-822`→`:816-821`, pair 29 `:871-878`→`:871-877`, pair 30 `:880-881`→`:878-879` |
| **MINOR** — `docs/skills.md` restated lifecycle (`:6`, `:92-94`) | Both clauses dropped, links kept |
| **MINOR** — the AC-12 grep is no longer load-bearing | No docs edit. The `gitignored` → `untracked` substitution is honest (the fact is present at `docs/agents.md:5-8` and recorded in §6), but the criterion as written now passes without proving what it was meant to prove. **AC 12 was therefore verified by reading, not by the grep alone** — recorded in `prd.md`'s review record |

Independent accuracy checks in the review (A–F: pi-subagents, pi-vcc, pi-tps-status,
pi-mcp-adapter, pi-lens, permission hotkeys) all came back `VERIFIED` except the
`/permission-system` negative, which is the BLOCKER above.

After the fixes, re-run and green: `grep -c '^### '` 12/6/6, `**Invoke.**` 12/6/6,
`node scripts/check-docs.mjs .` exit 0, `./scripts/doctor.sh` `All good.`-equivalent
(`No problems. 1 note(s)` — the pre-existing dirty-tree note), and `AC12` grep empty.

## 11. Final review round (whole change) — findings and how they were closed

`research/final-review.md` covered the complete change, not just `docs/`: verdict
`READY WITH FIXES`, **BLOCKER and MAJOR tiers empty**, 4 MINORs. It re-derived the
§8 failure proofs on its own fixture (all five reproduced, plus four new cases:
empty `docs/plugins.md` → the emptied-file guard fires; duplicate entry → exit 1;
unparseable `skills.json` → exit 1; an example heading inside a fence → correctly
ignored), confirmed the helper breaks no `node-guidelines.md` rule, confirmed the
`doctor.sh` section adds no new `warn` on a healthy tree and reports the counts from
the helper rather than hard-coding 12/6, and found **no missed spec-propagation
site** across `optional-bundles.md`, `node-guidelines.md`, `shell-guidelines.md`,
both indexes, both extended propagation rows, and `README.md`.

| Finding | What was done |
| --------- | --------------- |
| Pair 25 cited `auto-compact/README.md:81` for "The settings command requires TUI mode." | Re-read the file: the sentence is at `:51` (`:81` is a different sentence about preferring the command over hand-editing). Corrected |
| Pair 27 cited `pi-mcp-adapter/index.ts:1125` for `name: "mcpScript",` | Re-read: `:1125` is the `registerTool` cast, `:1126` is the name. Corrected |
| This file's header claimed the Step 8 failure proofs were "**not** in this file" while §8 is exactly those | Header restated: §1–§7 are Steps 1–4, §8–§11 were added as Steps 6–10 landed |
| `docs/agents.md` Config lines called `.pi/agents/` and `.pi/prompts/` "untracked"/"generated", but `layout-and-surfaces.md` classifies `.pi/`, `.agents/` as **Ignored**, and `docs/README.md`'s legend defines only the four spec terms | All six Config lines now say "an ignored file under `.pi/agents/`" / `.pi/prompts/`. Worth noting for the next editor: `ignored` is the spec's term and does not trip AC 12's grep, and it removes an ambiguity — "generated" in the old wording collided with the surface meaning of *generated* (rendered per machine from tracked inputs) |

The page header keeps the plain-English "this repository does not track" for the
same fact. The contract field needs the spec's term; the prose does not.

**Acceptance criteria, as ruled by this round:** 11 `MET`, 2 `MET WITH CAVEAT`.
The caveats are recorded rather than glossed — AC 9's `setup.sh` halves were run by
the parent with `--skip-plugins --skip-skills --skip-mcp` (identical output) and
once unfiltered (exit 0), not by the reviewer; AC 12's grep is weakened by the
disclosed `gitignored` → `untracked` substitution and was ruled honestly disclosed,
not a rationalisation.

## 12. Commit provenance

Committed as `0f46c9f` — *feat(docs): daily-use guides for the shipped plugins,
skills, and agents*. 25 files: the four `docs/` pages, `scripts/check-docs.mjs`, the
`doctor.sh` section, `README.md`, six spec files, and this task directory.

**This commit was staged line-selectively, not file-selectively.** Three tasks were
in flight in one working tree, and in several files this task's lines sat in the
same diff hunk as another task's. Each shared file's staged content was therefore
built from `HEAD` plus only this task's lines (`git hash-object` +
`git update-index --cacheinfo`) and verified with
`git show HEAD:<file> | grep -c` for the other task's fingerprints.

Three consequences a future reader will otherwise trip over:

- **`.trellis/spec/index.md` reads "four dependency-free Node ESM helpers" in this
  commit**, and the `| Node ESM |` row lists four names without
  `register-mcp-server.mjs`. That is correct for this point in history: HEAD had
  three, and this task adds one. The working tree reads "five" because the MCP
  task's fourth helper is not committed yet.
- **`README.md`'s script table in this commit** carries the `check-docs.mjs` row
  before `sync.sh`; the MCP task's `register-mcp-server.mjs` row is not in it.
- **At handoff, `git diff HEAD` on the six shared files contains only the other
  task's lines** — checked, zero of this task's lines pending — so their commit
  completes the combined state without duplicating anything.

Two hazards this hit, both worth knowing:

1. **`git update-index --chmod=+x <path>` re-hashes that path from the working
   tree**, silently restoring another task's content into the staged blob (and it
   did: the first amend re-introduced their `doctor.sh` section). Set the mode
   atomically instead — `git update-index --cacheinfo 100755,<full-40-char-sha>,<path>`
   — and use the full SHA: an abbreviated one fails with
   `option 'cacheinfo' expects <mode>,<sha1>,<path>`.
2. **A concurrent agent staged `scripts/doctor.sh` and this task's propagation
   guide between staging and commit**, so the first attempt (`fab9a52`) carried
   their 27-line MCP section and their MCP propagation row. Both were stripped by
   amending; never trust a staged tree you verified more than a moment ago when
   another agent is live in the same worktree.

**What was verified is the committed tree, not the working tree:** `git archive
HEAD | tar -x` into a temp directory, then `node --check`, `bash -n`, `node
scripts/check-docs.mjs .` (ok, 12 plugins and 6 skills), counts 12/6/6, AC 12 grep
empty, and `scripts/doctor.sh` mode `100755` (the first staging attempt had
silently dropped it to `100644`).

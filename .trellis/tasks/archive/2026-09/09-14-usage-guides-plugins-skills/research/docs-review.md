# Docs review — Steps 1–4 (`docs/plugins.md`, `docs/skills.md`, `docs/agents.md`, `docs/README.md`)

Independent check of the four new prose files against `prd.md` (R1–R10), `design.md`
(entry contract, sourcing, ownership split), and the implementer's evidence in
`research/check-notes.md`.

Scope: the four `docs/` files and their R5 evidence only. `scripts/check-docs.mjs`,
the `doctor.sh` section, and the `README.md` link edits belong to Steps 5–10 and
were not reviewed here.

## Verdict

**PASS WITH FIXES** — membership, ids, label order, budgets, links, and the great
majority of the R5 evidence hold up against the installed sources, but one
`**Invoke.**` line states a false negative (a slash command the package really
registers), and several `**Config.**` lines restate spec-owned mechanics that R6
places out of bounds.

## R5 evidence audit

Pairs opened at the cited line in the installed copy. `check-notes.md` really does
contain 60 numbered rows (1–60, no gaps).

| # | Claim | Cited source | Verdict | What the line actually says |
| --- | -------- | ------------ | ------- | ---------------------------- |
| 1 | `subagent({ agent, task })` | `pi-subagents/docs/tool-reference.md:91-92` | VERIFIED | `\| \`agent\` \| string \| - \| One direct child or agent-management target.` / `\| \`task\` \| string \| agent default \| Direct child's task; requires \`agent\`…` |
| 2 | `/subagents-fleet` | `pi-subagents/README.md:97` | VERIFIED | "`/subagents-fleet` opens a live inspector where you can browse children…" |
| 4 | `/subagents-guide [topic]` | `pi-subagents/README.md:111` | VERIFIED | "For installed-version help, use `/subagents-guide [topic]` or `subagent({ action: "guide" … })`" |
| 5 | `/council` | `pi-subagents/README.md:71` | VERIFIED | "The package includes `/council` and `council-mode`…"; `prompts/council.md` exists and `package.json` has `pi.prompts: ["./prompts"]` |
| 8/9 | `fetch_content` / `get_search_content` shapes | `pi-web-access/README.md:106`, `:188` | VERIFIED | `fetch_content({ url: "https://docs.example.com/guide" })` / `get_search_content({ responseId: "abc123", urlIndex: 0 })` |
| 16 | `ctrl+shift+t` collapse key | `@juicesharp/rpiv-todo/config.ts:9-10` | VERIFIED | `Defaults to \`"ctrl+shift+t"\``; also`:24 export const DEFAULT_COLLAPSE_KEY = "ctrl+shift+t"` |
| 17 | permission hotkeys `y`/`s`/`n`/`r`, arm-then-confirm | `@gotgenes/pi-permission-system/README.md:68` | VERIFIED | "…`y` approve, `s` approve for this session, `n` deny, `r` deny with a reason — where each hotkey arms and a second press confirms…" |
| **18** | **permission system has no slash command** | `@gotgenes/pi-permission-system/README.md` (in full) | **WRONG** | The package registers `/permission-system`: `src/index.ts:237` calls `registerPermissionSystemCommand(pi, {…})`, defined at `src/config/config-modal.ts:253` as `pi.registerCommand("permission-system", { description: "Configure pi-permission-system logging and yolo-mode behavior" … })`, and its own `docs/configuration.md:898` documents `` `/permission-system show` ``. Reading the README in full cannot support a negative claim about registration. |
| 19 | `/pi-vcc` | `@sting8k/pi-vcc/README.md:64` | VERIFIED | "**`/pi-vcc`** — manual compaction, keeps the last 1 user turn by default." |
| 20 | `/pi-vcc keep:N [prompt]` | `@sting8k/pi-vcc/README.md:65` | VERIFIED | verbatim bullet on line 65 |
| 21 | `/pi-vcc-recall <query> [scope:all]` | `@sting8k/pi-vcc/README.md:134` | VERIFIED | line 134 is `/pi-vcc-recall auth token scope:all` |
| 22 | pi-vcc takes over `/compact` by default | `@sting8k/pi-vcc/README.md:67` | VERIFIED | "By default pi-vcc also handles `/compact` and auto-threshold compactions." |
| 26 | `mcp({ })` / `search` / `describe` / `tool,args` | `pi-mcp-adapter/README.md:815-822` | VERIFIED (range covers) | Rows are at `:816`, `:818`, `:819`, `:821` — inside the cited range, though not at its first line |
| 28 | `/mcp`, `/mcp setup` | `pi-mcp-adapter/README.md:868`, `:870` | VERIFIED | exact lines |
| 29 | `/mcp tools` … `/mcp logout` | `pi-mcp-adapter/README.md:871-878` | VERIFIED, range end off by one | Rows are `871`–`877`; `878` is already `/mcp-auth` |
| 30 | `/mcp-auth [server]` | `pi-mcp-adapter/README.md:880-881` | **citation wrong (content right)** | The two rows are at `:878` and `:879`; `:880-881` is a blank line and the `autoAuth` paragraph |
| 31/32/33 | pi-lens five always-active, five situational, `pi_lens_activate_tools` | `pi-lens/docs/agent-tools.md:16-18`, `:18-21`, `:22` | VERIFIED | "Five tools stay always-active: `lens_diagnostics`, `module_report`, `read_symbol`, `read_enclosing`, `symbol_search`. Five situational tools — `ast_grep_search`, …"; loader tool at `:22` |
| 34 | the nine `/lens-*` commands, `:13` for `allow-edit` | `pi-lens/docs/tools.md:3-16` | VERIFIED | `:13` is `- \`/lens-allow-edit <path>\` — override the read-before-edit guard for a single edit`;`dist/index.js:125575` is `pi.registerCommand("lens-toggle", {` and `:125865` is `pi.registerCommand("lens-allow-edit", {` |
| 41 | `i-have-adhd` keys `alwaysOn` / `hideStatus` | `i-have-adhd/extensions/i-have-adhd.ts:37-39` | VERIFIED | `type AdhdConfig = { alwaysOn?: boolean; hideStatus?: boolean; };` |
| 42 | skills are invoked as `/skill:<name>` | Pi bundle `chunk-JVUZSMYM.js` | VERIFIED | `_expandSkillCommand(text){if(!text.startsWith("/skill:"))return text;…skills.find(s=>s.name===skillName)` |
| 45 | `grill-me` body is a one-line redirect | `grill-me/SKILL.md:7` | VERIFIED | line 7 is exactly `Call the Skill tool with "grilling".` (only body line) |
| 58 | prompt name comes from the filename stem | Pi bundle `chunk-JVUZSMYM.js` | VERIFIED | `fileName.replace(/\.md$/i,"")` present in `loadTemplateFromFile` |
| 59 | generated extension's notify string | `.pi/extensions/trellis/index.ts:2088` | VERIFIED | `"Trellis project context is available. Use /trellis-start to bootstrap or /trellis-continue to resume."` |
| 60 | `.pi/` and `.agents/` are untracked | `.gitignore:56-57` | VERIFIED | lines 56–57 are `.pi/` and `.agents/`; `git ls-files .pi .agents` → 0 |

Summary: of the 24 rows opened, 20 are exact, 3 have line-number drift only
(26, 29, 30 — all correct in content), and **1 (pair 18) is factually wrong**.

Additional R5-relevant negatives re-tested against the installed source:

- `rpiv-ask-user-question` — no `registerCommand` anywhere → the entry's "there is no slash command" (pair-adjacent) is **correct**.
- `pi-timer` — no `registerCommand` / `registerTool` in the package; `extensions/run-timer.ts` imports only types and `pi-tui`, no `fs` → "Nothing to type" and the `**Config.**` "none" are **correct**.
- `rpiv-todo` — exactly one command (`todo.ts:107` registers `/todos`) → correct.

### Claims in the docs with no evidence pair behind them

R5 only requires pairs for `**Invoke.**` surfaces, so these are not R5 violations —
but they are unpaired, and the one that is wrong is wrong:

| Docs location | Unpaired claim | My independent result |
| --------------- | -------------- | --------------------- |
| `docs/plugins.md:66` | "No slash command" | **WRONG** — `/permission-system` is registered |
| `docs/plugins.md:22` | `~/.pi/agent/extensions/subagent/config.json` | VERIFIED — `pi-subagents/docs/configuration.md:3` |
| `docs/plugins.md:34` | `~/.pi/agent/web-search.json` — ignored | VERIFIED — `pi-web-access/README.md:31`, `:299` |
| `docs/plugins.md:46` | `~/.config/rpiv-ask-user-question/config.json`, read never written | VERIFIED — README:50; no `writeFile` in the package |
| `docs/plugins.md:56` | `~/.config/rpiv-todo/config.json`, read never written | VERIFIED — README:71; no `writeFileSync` in the package |
| `docs/plugins.md:78` | `~/.pi/agent/pi-vcc-config.json` | VERIFIED — `pi-vcc/README.md:151` |
| `docs/plugins.md:88` | `~/.pi/agent/auto-compact.json` | VERIFIED — `auto-compact/README.md:55` (`$PI_CODING_AGENT_DIR/auto-compact.json`); README also states the `~/.pi/agent` default |
| `docs/plugins.md:98` | `~/.config/mcp/mcp.json` + `~/.pi/agent/mcp.json` + `.pi/mcp.json` | VERIFIED — `pi-mcp-adapter/README.md:56`, `:60`, `:61` |
| `docs/plugins.md:108` | `~/.pi-lens/config.json` + project `.pi-lens.json` | VERIFIED — `pi-lens/docs/configuration.md:7-8` |
| `docs/plugins.md:120` | `$XDG_CONFIG_HOME/pi-tps-status/config.json` | VERIFIED — `pi-tps-status/index.ts:181` (`process.env.XDG_CONFIG_HOME`) and `:188` (`join(configBase(), "pi-tps-status", "config.json")`) |
| `docs/plugins.md:142` | `i-have-adhd` → symlinked; keys | VERIFIED — `scripts/lib.sh:19` `PI_FILES=(AGENTS.md i-have-adhd.json)`; keys per pair 41 |
| `docs/plugins.md:138` | "ten rules, canonical copy in `skills/i-have-adhd/SKILL.md`" | VERIFIED — 10 `### N.` rule headings in that file |
| `docs/plugins.md:20` Gotcha | foreground child never loads ambient extensions | VERIFIED — `pi-subagents/docs/agents.md:412`, `docs/tool-reference.md:112` |
| `docs/plugins.md:34` Gotcha | cache has a one-hour lifetime | VERIFIED — `pi-web-access/README.md:185` |
| `docs/plugins.md:54` Gotcha | state keyed by session, detached/child cannot read it | VERIFIED — `rpiv-todo/README.md:63-64` |
| `docs/plugins.md:110` Gotcha | downloads LSP servers / tool binaries on first use | VERIFIED in substance — `pi-lens/docs/dependencies.md:1-7` (auto-install gates; GitHub-release binaries to `~/.pi-lens/bin/`) |
| `docs/plugins.md:122` Gotcha | `tokenSpeed` settings not migrated | VERIFIED — `pi-tps-status/README.md:125` |
| `docs/skills.md:*` Gotchas (6) | issue tracker, redirect, sub-agent dispatch, temp report + ADRs, background agent, seams | VERIFIED — pairs 45, 47, 48, 49, 50, 51 |
| `docs/agents.md:16,26,36,46,56,66` | role-agent and prompt descriptions | VERIFIED — `.pi/agents/trellis-implement.md:22-25`, `.pi/agents/trellis-research.md:25`, `.pi/prompts/trellis-start.md` steps 1–3, `trellis-finish-work.md:3` |

No other entry asserts something the installed source contradicts.

## Accuracy spot-checks (independent of the check notes)

Six targeted checks requested by the review brief, all against the installed copy:

| # | Claim in the docs | Source | Result |
| --- | ------------------ | ------ | ------ |
| A | `npm:pi-subagents`: `subagent({ agent, task })`, `/subagents-*`, `/council` | `pi-subagents/docs/tool-reference.md:91-92`, `README.md:97,106,111,71`, `prompts/council.md`, `package.json.pi.prompts` | **VERIFIED** |
| B | `npm:pi-vcc`: `/pi-vcc`, `/pi-vcc keep:N [prompt]`, `/pi-vcc-recall <query> [scope:all]`, `/compact` takeover | `pi-vcc/README.md:64,65,134,67`; `src/commands/pi-vcc.ts:6`, `src/commands/vcc-recall.ts:12` | **VERIFIED** |
| C | `npm:pi-tps-status`: `/tps` settings list; `tokenSpeed` key not migrated | `pi-tps-status/README.md:12`, `:125`; `index.ts:744` | **VERIFIED** |
| D | `npm:pi-mcp-adapter`: `/mcp` subcommands; three config locations | `README.md:868-879` (`/mcp`, `setup`, `tools`, `prompts`, `reconnect`, `enable/disable`, `logout`, `mcp-auth`); `:56`, `:60`, `:61` for the paths | **VERIFIED** (docs also list `/pi-mcp` omission — deliberate, see `check-notes.md` §5) |
| E | `npm:pi-lens`: five always-active, five activate-on-demand, nine `/lens-*` commands | `docs/agent-tools.md:16-22`; `docs/tools.md:5-16`; `dist/index.js:125575…125865` | **VERIFIED** — the entry lists exactly the nine the source registers |
| F | `npm:@gotgenes/pi-permission-system`: `y`/`s`/`n`/`r` hotkeys, arm-then-confirm | `README.md:68` | **VERIFIED** — but the entry's separate claim of *no* slash command is **WRONG** (see above; `src/index.ts:237`, `config-modal.ts:253`, `docs/configuration.md:898`) |

## Entry contract

| File | Headings | Ids exact | Labels present + ordered | `**Config.**` present | Budget 8–15 lines | Result |
| ------ | ---------: | ----------- | -------------------------- | ----------------------- | ------------------- | -------- |
| `docs/plugins.md` | 12 `###` | 12/12 match `settings.core.json` exactly, both directions | 12/12, `What it is` → `Reach for it when` → `Invoke` → `Config` (optional `Gotcha` last) | 12/12 | 8–10 lines each | PASS |
| `docs/skills.md` | 6 `###` | 6/6 match `skills.json` exactly | 6/6 | 6/6 | 10 lines each | PASS |
| `docs/agents.md` | 6 `###` | 3 agents (`trellis-implement`, `trellis-check`, `trellis-research`) + 3 prompts, as R3 requires | 6/6 | 6/6 | 8 lines each | PASS |

- Verified ids by reading `pi-agent/settings.core.json` and `skills.json`, not the docs; both sets are equal with no missing and no stray entries.
- Pointer sections are `##` in both parsed files (`plugins.md:146,156`; `skills.md:88`); `docs/agents.md`'s trailing note is `##` at `:76`.
- No fenced block in either parsed file contains a line starting with `###` (checked line-by-line with fence tracking). `docs/README.md` has zero `###` headings.
- AC grep counts reproduced: `**Invoke.**` = 12 / 6 / 6; `**What it is.**` in `plugins.md` = 12.
- All internal links resolve: 6/13/5/4 links per file, 0 broken.
- `**Config.**` surface labels: `tracked` (permission config, `:68`), `symlinked` (`docs/plugins.md:142`), `generated outside the repo` (`:98`), `ignored` (`:34`, `:78`, `:88`), and "none"/"none here" for the out-of-tree and no-file cases. Every one matches `.trellis/spec/config/index.md` or `pi-resources.md`'s own designation of that path. No wrong surfaces found — including the three high-risk ones: i-have-adhd (`:142`, symlinked, confirmed by `PI_FILES`), pi-lens (`:108`, own root outside every harness list), pi-timer (`:132`, no state at all).

## R6 overlap

Ruling on the two accepted overlaps: every entry states the config location and
one surface term, and the `**Invoke.**` lines repeat invocation tokens that
`README.md`'s plugin table already carries — both are the overlaps R6 permits.

Two things reach past the permitted overlap:

1. **Reason clauses on five `**Config.**` lines restate spec-owned mechanics.**
   `docs/plugins.md:88` ("written atomically by the package, so a symlink would be
   replaced on the first save") is the clearest — that is exactly the trap
   `.trellis/spec/config/layout-and-surfaces.md` §"Per-machine extension config is
   not symlinked" owns. `:34` ("it holds provider API keys, so it is never
   symlinked") restates the credential warning, `:78` ("the package writes it"),
   `:132` ("imports no `fs` at all") and `:108` ("sits on no harness path list and in
   no ignore rule") restate measured mechanics from `pi-resources.md`. Each of these
   lines also links to the authority, so the damage is a duplicated sentence rather
   than a lost one; the fix is to drop the clause.
2. **Header restatements.** `docs/skills.md:6` ("fetched … and never vendored") repeats
   `README.md`'s own section title "Skills are fetched, never vendored", and
   `docs/skills.md:92-94` describes the `.agents/` set as "CLI-owned, untracked …
   regenerated by the `trellis` CLI" — a lifecycle rule the spec/README own. These are
   one clause each; the fix is to point at the anchors and stop at the link.

**Ruling on the `gitignored` → `untracked` rephrasing.** It is honest, not a dodge.
The substantive fact is present and correct in all three files — `docs/agents.md:5-8`
says the sets are "**generated by the `trellis` CLI** … which this repository does not
track, and `trellis update` owns them", `docs/plugins.md:108` and `docs/skills.md:92`
say "untracked". Nothing is hidden from the reader; only the AC's literal grep token
was avoided, and the substitution is disclosed in `check-notes.md` §6 rather than
concealed. What is genuinely weakened is the *check*, not the docs: AC 12's
`grep -n '…|gitignore|…'` can no longer prove "no per-machine rule was restated",
because the statement exists in different words. That belongs in the acceptance
record for the main session, not as a `docs/` edit.

## Findings

### BLOCKER

**B1 — `docs/plugins.md:66` asserts a false negative: permission system *does* have a slash command.**

- What is wrong: "**Invoke.** No slash command; it acts at tool-call time …" That claim is contradicted by the installed package: `src/index.ts:237` calls `registerPermissionSystemCommand(pi, {…})`, which at `src/config/config-modal.ts:253` runs `pi.registerCommand("permission-system", { description: "Configure pi-permission-system logging and yolo-mode behavior" … })`; the package's own `docs/configuration.md:898` documents `` `/permission-system show` ``. Evidence pair 18 in `check-notes.md` is wrong, and its method ("README read in full") cannot support a negative registration claim.
- Why it matters: R5 forbids writing a surface that is not confirmed from the installed source, and this is the inverse failure — it tells the reader a working config/logging command does not exist. It is also the only claim in the three pages directly falsified by a source, and it is recorded as evidence, so it undermines the rest of the R5 artefact.
- Smallest fix: change the `**Invoke.**` line to name the confirmed command, e.g. `` **Invoke.** `/permission-system` opens the package's own logging / yolo-mode settings; otherwise it acts at tool-call time as a silent `allow`, a blocking `deny`, or an inline prompt (`ask`) — … `` and replace pair 18 in `check-notes.md` with the two real citations (`src/index.ts:237`, `src/config/config-modal.ts:253`).

### MAJOR

**M1 — Five `**Config.**` lines restate spec-owned mechanics instead of only naming location + surface (R6).**

- What is wrong: the reason clause after the surface term duplicates what
  `pi-resources.md` / `layout-and-surfaces.md` own. Worst at `docs/plugins.md:88`
  ("written atomically by the package, so a symlink would be replaced on the first
  save" — the written-atomic-rename trap verbatim from the spec); also `:34`
  (credential warning), `:78` (write behaviour), `:132` (the "no `fs`" measurement),
  `:108` (path-list / ignore-rule ownership).
- Why it matters: R6 bounds the overlap to two things and makes `pi-resources.md`
  authoritative; a duplicated mechanism sentence will drift independently of the spec
  and cannot be caught by any check.
- Smallest fix: keep the path, keep the surface term, keep the link, delete the
  explanatory clause — e.g. `**Config.** \`~/.pi/agent/auto-compact.json\` — ignored.
  Threshold and resume rationale: [pi-resources.md](…)`.

### MINOR

**m1 — three R5 evidence pairs cite wrong line numbers (content correct).**
`check-notes.md` pair 30 cites `pi-mcp-adapter/README.md:880-881` for the `/mcp-auth`
rows; they are at `:878-879`. Pair 29's range ends at `:878` when the last row it
names is `:877`. Pair 26's range starts at `:815` when the first row it names is
`:816`. Why it matters: a wrong line is what a future reader uses to re-verify.
Smallest fix: correct the three numbers in `check-notes.md`.

**m2 — Header restatements in `docs/skills.md`.**
`:6` ("never vendored") reproduces `README.md`'s section title, and `:92-94`
describes the generated `.agents/` set's untracked/CLI-owned lifecycle. R6 keeps
both in `README.md` / the spec. Smallest fix: drop the two clauses and keep the
links.

**m3 — the AC-12 grep is no longer load-bearing after the `gitignored` → `untracked`
substitution.**
The docs are honest (see ruling above), but the criterion as written now passes
without proving what it was meant to prove. Smallest fix: no `docs/` edit; record in
the task notes/PRD that AC 12 was verified by reading, and that the token is
deliberately different.

Tiers with nothing in them: no further blockers, and **no MAJOR or MINOR finding
about ids, membership, label order, budgets, pointer headings, fenced-block safety,
`**Config.**` surface labels, or link resolution — all of those are clean.**

## Recommended `docs/` edits

1. `docs/plugins.md:66` — replace "No slash command" with the confirmed `/permission-system` surface, and fix check-notes pair 18.
2. `docs/plugins.md:88` — delete "written atomically by the package, so a symlink would be replaced on the first save"; keep `ignored` + the link.
3. `docs/plugins.md:34` — delete "it holds provider API keys, so it is never symlinked"; keep `ignored` + the link.
4. `docs/plugins.md:78` — delete "the package writes it, so it is never symlinked"; keep `ignored` + the link.
5. `docs/plugins.md:132` — delete "the extension imports no `fs` at all, so it has no file to track, ignore, or symlink"; keep "None" + the link.
6. `docs/plugins.md:108` — delete "so it sits on no harness path list and in no ignore rule"; keep "none here, machine-global" + the path facts.
7. `docs/skills.md:6` — delete "and never vendored" (and the follow-on clause); keep the source pointer and the README link.
8. `docs/skills.md:92-94` — trim the "CLI-owned, untracked / regenerated by the `trellis` CLI" description to a pointer plus the two anchors.
9. `check-notes.md` — correct pair 30 (`:878-879`), pair 29 (`:871-877`), pair 26 (`:816-821`), and rewrite pair 18.

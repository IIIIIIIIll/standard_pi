# Add usage guides for shipped plugins and skills

## Goal

Give the repo a front-door **daily-use layer**: for each thing this harness
installs, say when to reach for it and what to type. Today `README.md` answers
"what is installed" with one table row per package, and the six fetched skills are
a bare name list — a reader can see that `pi-lens` exists but not what to type.

The audience is the repo's owner on a machine where the harness is already set up.
This is a **daily-use reference**, not an install guide; setup and lifecycle rules
stay in `README.md`.

## Context (measured 2026-09-14, HEAD `1e45cc7`)

- `pi-agent/settings.core.json` installs **12** always-on packages; `skills.json`
  fetches **6** skills from `mattpocock/skills`.
- `.pi/agents/trellis-{implement,check,research}.md` and
  `.pi/prompts/trellis-{start,continue,finish-work}.md` exist, and both `.pi/` and
  `.agents/` are gitignored with zero `git ls-files` entries (`.gitignore:56-57`).
- **The gap is discoverability, not absence.** `.trellis/spec/config/pi-resources.md`
  already documents invocation for several packages — `/mcp` + `/mcp setup`,
  `/lens-map` (`:58-62`), `/tps`, `/i-have-adhd` — and `:64-80` explains them — but
  that file is written for a maintainer reading the spec
  tree. `README.md` gives prose to only three packages clearly (`pi-vcc`,
  `auto-compact`, `i-have-adhd`), one paragraph to `pi-subagents`, and a bare
  linking table cell to `pi-permission-system`; the other seven get a single table
  row. `docs/` is the front-door copy that a reader actually finds.
- `README.md` carries 10 distinct backticked slash commands in 11 mentions, and
  across tracked docs the tally reaches 15 distinct / 58 mentions. Every one of the
  README instances is a passing mention; the spec tree is the only place that
  explains any of them, which is what makes `docs/` a discoverability fix rather
  than the first time the information is written down.
- Authoritative source for every invocation claim is the **installed** copy at
  `~/.pi/agent/npm/node_modules/<pkg>/` (plus `docs/`, `OAUTH.md`) and
  `~/.pi/agent/git/github.com/ayghri/i-have-adhd/`. Upstream web docs are not
  consulted; the installed copy is the version Pi actually runs.
- Source volume (measured): 3,368 lines of package READMEs **plus 15,835 lines
  across 73 sub-doc files** (`pi-lens/docs` alone is 38 files / 7,640 lines, and
  `pi-permission-system/docs` is 17 / 3,638). This is why entries are 8–15 lines and
  why extraction is delegated.

## Requirements

**R1 — Plugin coverage.** `docs/plugins.md` has exactly one entry per package in
`pi-agent/settings.core.json` — all 12, no extras. `optional/` bundles and the two
hand-placed extensions are listed as pointers, not duplicated.

**R2 — Skill coverage.** `docs/skills.md` has exactly one entry per skill in
`skills.json` — all 6. Each entry states whether the model may invoke that skill
automatically or whether it is human-invoked only.

**R3 — Role-agent and prompt coverage.** `docs/agents.md` covers the 3 role agents
in `.pi/agents/` and the 3 prompts in `.pi/prompts/`: what each is for and how to
reach it. Prompt invocation is stated in the form the generated extension actually
registers, not the form this repo's prose happens to use.

**R4 — Entry contract.** Every entry states, in this order: what it is (one line),
when to reach for it, the exact invocation surface (tool name, slash command, or
the `subagent({agent, task})` shape), and where its config lives **with its
surface** (tracked / symlinked / generated / ignored, per `spec/config/index.md`).
A gotcha line appears only when the source documents a real trap. Target 8–15
lines.

**R5 — Accuracy over completeness.** Every invocation token is copied from the
installed package source, never from memory or inference. A surface that cannot be
confirmed is **omitted**, not guessed, and the omission is recorded. No entry may
invent a flag, command, or config key.

**R6 — Bounded overlap, not duplication.** Setup, render, symlink, and per-machine
config rules stay in `README.md` and `.trellis/spec/config/`. Exactly two things
necessarily appear in both `docs/` and `pi-resources.md`, and no more: the config
location and surface, and the invocation tokens (R4 requires both, and the inventory
already carries tokens such as `/lens-map` and `/tps` inside its rationale prose).
`pi-resources.md` stays authoritative for both, and `docs/` links to it for the
mechanics. Nothing else is restated: `docs/` links to the owning spec. Detail for
`trellis-subagents-bridge` and the permission policy stays in
`pi-agent/extensions/README.md`.

**R7 — Coverage is enforced.** `scripts/doctor.sh` gains a check that
`docs/plugins.md` and `docs/skills.md` each cover exactly the shipped set, offline
and without invoking `pi`. It follows the existing fail-loud rule: an unreadable
or unrecognizable input is a `bad`, never a silent `ok`.

**R8 — README points in.** The Plugins section and the skills list in `README.md`
link into `docs/`, so the new pages are reachable from the front door.

**R9 — The new surface is specified.** `docs/` is a new tracked prose surface, and
`doctor.sh` gains a check backed by a fourth `.mjs` helper. Both are recorded in
`.trellis/spec/`: the surface decision in `config/`, the helper in `scripts/`, and
the `.mjs` count wherever the repo states it.

**R10 — `docs/` must not become a Pi surface.** It is not added to `PI_DIRS` or
`PI_FILES` in `scripts/lib.sh` and is never symlinked into `~/.pi/agent`.

## Acceptance Criteria

- [ ] `docs/plugins.md` contains one entry for each of the 12 packages in
      `settings.core.json`, zero entries for anything else, and its pointer
      sections use a heading level the check does not read as an entry.
- [ ] `docs/skills.md` contains one entry for each of the 6 names in `skills.json`,
      and each entry states whether model invocation is enabled for that skill.
- [ ] `docs/agents.md` covers the 3 role agents and the 3 prompts; the prompt
      invocation form is confirmed against the generated extension, and the
      confirming evidence is recorded in `research/check-notes.md`.
- [ ] Every entry carries the required `**What it is.**`, `**Reach for it when.**`
      and `**Invoke.**` labels and names its config location and surface (or states
      it has none): `grep -c '^\*\*Invoke\.\*\*' docs/{plugins,skills,agents}.md`
      returns 12 / 6 / 6, and `grep -c '^\*\*What it is\.\*\*' docs/plugins.md`
      returns 12.
- [ ] Every `**Invoke.**` surface written into `docs/plugins.md` has one
      `claim → source file:line` line in `research/check-notes.md` (12 or more, not
      a sample) — this is the only evidence for R5.
- [ ] The 4 `doctor.sh` failure-mode proofs (missing entry, stray entry, missing
      file, non-`###` heading) each exit `1` with the offending id or file named,
      with exit codes recorded in `research/check-notes.md`.
- [ ] `./scripts/doctor.sh` exits `0` with the new check reporting the expected
      counts, and its full output adds no new `warn` to the pre-change baseline.
- [ ] `node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check`
      still reports no drift.
- [ ] `./setup.sh` twice in a row stays idempotent, and `./scripts/doctor.sh | grep -A2 'Docs coverage'`
      shows the new section reporting the expected counts. `All good.` is asserted
      only once every unrelated modified/untracked path is committed too, since
      `doctor.sh` raises a note for any dirty tree.
- [ ] `grep -rn 'docs/' scripts/lib.sh` returns nothing, and `./setup.sh` output
      contains no `docs` line — `docs/` is never linked into `~/.pi/agent` (R10).
- [ ] `README.md` links to all three new pages, and every link target exists.
- [ ] `grep -n 'PI_DIRS\|PI_NOT_SYNCED\|gitignore\|not stored' docs/*.md` returns
      nothing — no per-machine rule is restated (R6).
- [ ] `layout-and-surfaces.md` has a `docs/` row in its file map and a step in its
      decision tree, and the `| Node ESM |` row of
      `.trellis/spec/scripts/index.md` names the new helper —
      `grep -n '| Node ESM |' .trellis/spec/scripts/index.md` contains
      `check-docs` (R9).

## Constraints

- `scripts/doctor.sh` runs `set -uo pipefail` **without** `-e`, uses `ok`/`warn`/`bad`
  with counters, and must never `exit` early. New checks call those helpers.
- JSON parsing in bash goes through a `node -e` one-liner (no `jq`); a JSON file is
  strict JSON (no comments, no trailing commas).
- `pi-lens` rewrites `*.md` and `*.sh` on write (reflow, table separators, one-liner
  expansion). Heading and code-fence shapes chosen here must survive that, because
  `doctor.sh` parses them.
- No new dependency, no network access, no `pi` invocation in any check.
- Do not edit `.pi/`, `.agents/`, or `.trellis/workflow.md` — generated and/or
  gitignored.

## Out Of Scope

- Re-documenting setup, installation, `sync.sh`, or the render model — `README.md`
  owns those.
- Per-machine extension config files (`auto-compact.json`, `pi-vcc-config.json`,
  `web-search.json`): described where they already live, linked only.
- The generated `.agents/skills/trellis-*` set: `docs/skills.md` points at
  always-present anchors (`.trellis/workflow.md`, `AGENTS.md`) and mentions the
  `trellis-meta` references as available after `trellis init`, rather than
  restating them.
- Detecting upstream command renames. R7 catches membership drift only; a renamed
  flag inside a plugin stays invisible until someone reads the entry.
- Vendoring or mirroring upstream README text.

## Decisions Made

| Question | Answer |
| ---------- | -------- |
| Scope | 12 always-on plugins + 6 fetched skills + role agents and prompts |
| Depth | When to use + how to invoke; self-authored, no upstream text copied |
| Location | New `docs/` directory, linked from `README.md` |
| Staleness | Membership check in `doctor.sh`, no upstream content re-check |
| Overlap with the spec tree | One config line per entry is accepted overlap; `pi-resources.md` stays authoritative for its mechanics, `docs/` links to it |

## Review Record

Planning artifacts were reviewed read-only before implementation. Findings and the
command log that produced them: `research/artifact-review.md` (verdict
`READY WITH FIXES`). The requirements above are the post-review revision; the
BLOCKER it raised — that `pi-resources.md` already carried a 12-package inventory
— is answered by R6 and by the ownership split in `design.md`.

### Implementation review (docs round)

`research/docs-review.md` reviewed the four `docs/` files read-only: verdict
`PASS WITH FIXES`, 1 BLOCKER, 1 MAJOR, 3 MINOR, all closed — see
`research/check-notes.md` §10 for each finding and its fix. The BLOCKER was a false
negative (the permission system *does* register `/permission-system`); the MAJOR was
five `**Config.**` lines restating spec-owned mechanics, now trimmed to path +
surface + link. Independent checks of ids, membership, label order, budgets,
pointer headings, fenced-block safety, `**Config.**` surface labels and link
resolution all passed with nothing raised.

**One acceptance criterion changed meaning during implementation, and the record
says so.** AC 12 was written to be checked by
`grep -n 'PI_DIRS\|PI_NOT_SYNCED\|gitignore\|not stored' docs/*.md` returning
nothing. Writing `docs/agents.md` honestly — `.pi/agents/` and `.pi/prompts/` are
not tracked — required the token `gitignored`, so the sentence was rephrased to
"this repository does not track". The grep still passes and the fact is stated, but
the grep alone no longer proves the criterion: **AC 12 was verified by reading the
three pages**, and the rephrasing is disclosed in `check-notes.md` §6 and §10 rather
than being quietly tuned to satisfy a pattern.

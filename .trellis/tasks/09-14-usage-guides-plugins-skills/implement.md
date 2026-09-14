# Implement Plan — Usage guides for shipped plugins and skills

Read `prd.md` (R1–R10, AC list), `design.md` (ownership split, entry contract,
coverage check contract), and `research/artifact-review.md` (the read-only review
that produced this revision) first. `implement.jsonl` lists the specs governing the
touched layers.

## Ground rules

- Do **not** edit `.pi/`, `.agents/`, or `.trellis/workflow.md` (generated and/or
  gitignored).
- Every fact copied into `docs/` must be read from the installed source in this
  session. No memory, no upstream web pages, no inference. When a source does not
  say it, leave it out and record the omission in the check notes.
- **The tempting shortcut is a repo document.** `.trellis/spec/config/pi-resources.md`
  already carries the exact tokens several entries need (`/mcp setup`, `/lens-map`,
  `/tps`, `/i-have-adhd`) and is one file instead of fourteen. Copying from it
  satisfies neither R5 (the claim must come from the installed package source) nor
  R6, and every mechanical gate still passes. Do not do it: read the package.
- `docs/` is untouched by the symlink layer: no `scripts/lib.sh` change, no
  `.gitignore` change, no `setup.sh` change.
- **The working tree is shared.** Another task (`09-14-codegraph-mcp-install`) has
  uncommitted edits in `README.md`, `scripts/*`, and `.trellis/spec/*`, and both
  tasks edit `README.md` and `.trellis/spec/scripts/index.md`. Never `git add -A`.
  Stage only this task's paths, and read each edit target immediately before
  editing it rather than trusting a line number or a count quoted in this plan.
- `doctor.sh` keeps `set -uo pipefail` (no `-e`), uses `ok`/`warn`/`bad`, never
  exits early, and cleans `/tmp/pi-doctor-docs.$$` with `rm -f` after the branch.
- `scripts/check-docs.mjs` follows `spec/scripts/node-guidelines.md`: ESM, `node:`
  builtins only, sync I/O, positional args first, usage on stderr with exit `2`,
  `1` for problems, `0` for success, 9-column verb output.
- **Only entry headings use `###`.** Pointer sections inside the two parsed files
  use `##`, and no fenced block in either parsed file contains a line starting with
  three hashes and a space.

### The check notes artifact

`research/check-notes.md` under the task directory is where every proof this plan
demands is recorded. It does not exist yet; Step 1 creates it. It must end up
containing:

1. One `claim → source file:line` pair per `**Invoke.**` surface written (12 or
   more, not a sample), verbatim.
2. The confirmed prompt invocation form plus the conflicting source that disagrees
   with it.
3. The 4 `doctor.sh` failure-mode proofs, each with the exit code observed and the
   offending id or file named in the output.
4. The per-file id counts (`docs/plugins.md` 12, `docs/skills.md` 6) as their
   command output.
5. Any `**Invoke.**` surface that had to be omitted for lack of a source.

`prd.md` AC 3, AC 5 and AC 6 point at this file directly; AC 4's counts are also
recorded here per Steps 1–3. `git status --short`
must be clean of it before the final commit only if you choose to commit it — it is
task-local evidence, not a repo deliverable.

### Source list (installed copies — read these, do not guess)

Read the README first; open a sub-doc only when the README's claim is unclear or
the invocation surface is not covered there. Prefer these specific files:

| Entry | Read |
| ------- | ------ |
| `pi-subagents` | `README.md` (127) + `docs/tool-reference.md`, `docs/agents.md`, `docs/workflows.md` |
| `pi-web-access` | `README.md` (1010) |
| `pi-mcp-adapter` | `README.md` (905) + `OAUTH.md` (no `docs/` dir exists) |
| `pi-lens` | `README.md` (359) + `docs/usage.md`, `docs/tools.md`, `docs/configuration.md` |
| `@gotgenes/pi-permission-system` | `README.md` (241) + `docs/configuration.md` |
| `@juicesharp/rpiv-todo` | `README.md` (122) + `docs/configuration.md`, `docs/tool-schema.md` |
| `@juicesharp/rpiv-ask-user-question` | `README.md` (94) + `docs/configuration.md`, `docs/tool-schema.md` |
| `@sting8k/pi-vcc` | `README.md` (186) |
| `@thunstack/auto-compact` | `README.md` (119) |
| `pi-tps-status` | `README.md` (146) |
| `pi-timer` | `README.md` (59) |
| `i-have-adhd` | `~/.pi/agent/git/github.com/ayghri/i-have-adhd/{README.md,AGENTS.md}` |
| 6 skills | `~/.agents/skills/<name>/SKILL.md` — full frontmatter, all 6 present |
| 3 agents | `.pi/agents/trellis-{implement,check,research}.md` frontmatter |
| 3 prompts | `.pi/prompts/trellis-*.md` + the command name registered in `.pi/extensions/trellis/index.ts` |

`pi-lens/docs` holds 38 files (7,640 lines), `pi-subagents/docs` 10 (3,623), and
`pi-permission-system/docs` 17 (3,638); `rpiv-todo` and `rpiv-ask-user-question` add
8 more files / 934 lines — 15,835 sub-doc lines across five trees in total. Do not
read any of them wholesale.

## Step 1 — `docs/plugins.md` (12 entries)

Create the file, create `research/check-notes.md`, then write one `###` entry per
package in `pi-agent/settings.core.json`. The ids below are that file's spec
strings; the check compares them as a **set**, so the order here is not an
invariant, but keep `settings.core.json`'s order to avoid a misleading hand-diff:

```text
npm:pi-subagents              npm:pi-web-access
npm:@juicesharp/rpiv-ask-user-question
npm:@juicesharp/rpiv-todo     npm:@gotgenes/pi-permission-system
npm:@sting8k/pi-vcc           npm:@thunstack/auto-compact
npm:pi-mcp-adapter            npm:pi-lens
npm:pi-tps-status             npm:pi-timer
https://github.com/ayghri/i-have-adhd
```

Entry shape per `design.md` (What it is / Reach for it when / Invoke / Config /
Gotcha). The `**Config.**` line carries exactly one path plus its surface, and
links to `.trellis/spec/config/pi-resources.md` for the mechanics — do not restate
the write-behaviour or symlink-trap prose that lives there.

Close the file with two `##` pointer sections — enabled-only bundles (`optional/`,
linking `optional/opencode-go/README.md`) and hand-placed extensions
(`pi-agent/extensions/README.md`) — with no per-entry duplication.

**Validation.** `grep -c '^### ' docs/plugins.md` returns 12;
`grep -c '^\*\*Invoke\.\*\*' docs/plugins.md` returns 12; the extracted ids are
set-equal to `packages` in `pi-agent/settings.core.json`. Record **one
`claim → source file:line` pair per `**Invoke.**` surface written** (12 or more,
not a sample) in `research/check-notes.md`. This is the only evidence for R5, and
it is the step that stops the tokens being copied from `pi-resources.md`.

**Review gate.** Dispatch `trellis-check` on the file: entry contract complete, no
invented command, no rule restated from `README.md` or `pi-resources.md`.

## Step 2 — `docs/skills.md` (6 entries)

One entry per `skills.json` name — `code-review`, `grill-me`, `grilling`,
`improve-codebase-architecture`, `research`, `tdd`. Read each `SKILL.md`'s
**complete frontmatter**, not just `description`, and state per entry whether the
model may invoke it automatically:

- `grill-me` and `improve-codebase-architecture` declare
  `disable-model-invocation: true` — their entries say so, and do not imply the
  model reaches for them.
- `grill-me`'s body is a one-line redirect to the `grilling` skill; that redirect
  belongs in its `**Gotcha.**` line.

End with a `##` pointer section for the generated Trellis skill set. Anchor it on
paths that exist on a fresh clone (`.trellis/workflow.md`, `AGENTS.md`); describe
`trellis-meta`'s references as available after `trellis init`, and do not link the
gitignored `.agents/skills/trellis-*` path as if it were guaranteed.

**Validation.** `grep -c '^### ' docs/skills.md` returns 6 and matches `skills.json`
names as a set; `grep -c '^\*\*Invoke\.\*\*' docs/skills.md` returns 6 and
`grep -c '^\*\*What it is\.\*\*' docs/skills.md` returns 6.

## Step 3 — `docs/agents.md` (3 agents + 3 prompts)

Read the three `.pi/agents/*.md` frontmatter blocks (`name`, `description`,
`tools`) and the three `.pi/prompts/*.md` intros. Cover each: what it is, when to
dispatch it, and the invocation shape.

**Confirm the prompt form before writing it.** `.trellis/workflow.md` and
`AGENTS.md` use `/trellis:continue` / `/trellis:finish-work`, while
`.pi/extensions/trellis/index.ts` registers the hyphen form. Confirm from three
signals, strongest first: the registration/notify string in the generated extension,
the prompt **filenames** under `.pi/prompts/`, and the two tracked docs that
disagree. State the form the generated extension registers, and put the confirmed
evidence and the conflicting source in `research/check-notes.md`. Do not resolve the
conflict by guessing.

State that `.pi/agents/` and `.pi/prompts/` are generated and gitignored
(`trellis update` owns them) — the one fact this page must not omit.

**Validation.** 6 `###` headings; each of the 6 names appears verbatim in the file;
`grep -c '^\*\*Invoke\.\*\*' docs/agents.md` returns 6.

## Step 4 — `docs/README.md` (index)

~40 lines: what `docs/` is for, the three page links with one-line descriptions,
the entry-contract legend (required/optional fields), the heading convention stated
explicitly, and the ownership split — `docs/` owns daily use,
`.trellis/spec/config/pi-resources.md` owns why-it-is-core and config mechanics.
Link back to `README.md` for install and lifecycle rules.

**Validation.** All three link targets exist (`test -f` each). The convention
paragraph renders as prose, not a broken code span.

## Step 5 — `README.md` links

Three edits, nothing else: the `### Always-on — settings.core.json` section gains a
line pointing at `docs/plugins.md`, the skills paragraph in "Skills are fetched,
never vendored" gains a line pointing at `docs/skills.md`, and the `pi-subagents`
paragraph that mentions the Trellis role agents gains a pointer to `docs/agents.md`.

**Validation.** `grep -n 'docs/' README.md` shows all three, and
`git diff README.md` touches nothing else.

## Step 6 — `scripts/check-docs.mjs`

Write the helper per the contract in `design.md`: positional `<repo>`, usage on
stderr + exit `2` when missing; read `docs/plugins.md`, `docs/skills.md`,
`pi-agent/settings.core.json`, `skills.json`; walk lines **outside fenced code
regions**, keep those starting with three hashes and a space, take the first
backtick-delimited token; compare as sets; report both directions; exit `1` on any
problem.

Streams: the success counts line goes to stdout; each offending id goes to stderr
with `console.error`, matching `node-guidelines.md`'s diagnostics/progress split.
Header comment block is a contract document: exact invocation line, the heading
convention including the fenced-block rule, and why the id is the spec string.
Failure collection follows `install-skills.mjs` (accumulate, report all, exit once)
— never throw out of the per-file loop.

**Validation.** `node --check scripts/check-docs.mjs`; then
`node scripts/check-docs.mjs .` exits `0` and prints the counts on stdout. Confirm
the split: `node scripts/check-docs.mjs . 2>/dev/null` still shows the counts.

## Step 7 — `doctor.sh` section

Add `==> Docs coverage` after the `==> Skills` section. Copy the `node` preflight
from `==> Optional bundles`, and the temp-file branch shape from `==> Skills`:
run the helper with `>/tmp/pi-doctor-docs.$$ 2>&1` (the redirect is required — the
offending ids go to stderr), `ok` plus the captured counts on success, `bad` with
`sed 's/^/      /'` output on failure, `rm -f` unconditionally after the branch.

**Validation.** `bash -n scripts/doctor.sh`; `./scripts/doctor.sh` exits `0` and
adds no new `warn` to the pre-change baseline (the current baseline is one note, the
uncommitted task directory).

## Step 8 — Prove the failure modes, then revert

Each of these is a real run, not a code read. Record the exit code and the offending
id or file for each in `research/check-notes.md`.

1. Change one entry heading from three hashes to four (do **not** HTML-comment it —
   a commented `###` line still starts with three hashes and the check correctly
   ignores nothing) → `doctor.sh` exits `1` naming that package. Restore.
2. Add an entry heading for `npm:not-installed` → exits `1` naming it. Remove.
3. Move `docs/skills.md` aside → `bad` (missing file). Restore.
4. Rewrite one entry heading from three hashes to two → `bad` (zero headings, or a
   count mismatch). Restore.

**Validation.** `git status --short` shows only the intended files after reverting;
the four recorded exit codes all read `1`.

## Step 9 — Spec updates

- `.trellis/spec/config/layout-and-surfaces.md`: add the `docs/` prose surface to
  the file map and a step to the decision tree — tracked, never symlinked, never in
  `PI_DIRS`/`PI_FILES`.
- `.trellis/spec/config/pi-resources.md`: **reconcile, do not duplicate.** Add a
  cross-link from the package inventory to `docs/plugins.md` and record the
  ownership split (inventory = why-it-is-core + config mechanics; `docs/` = daily
  use). State there that the two accepted overlaps are the config line and the
  invocation tokens, per R6, and that this file wins any disagreement. Also add the
  coverage check's contract (heading convention, id source of truth, fail-loud
  rules, exit codes) next to the `skills.json` / `settings.core.json` specs it
  depends on.
- `.trellis/spec/scripts/index.md`: add the new `.mjs` helper to the **Node ESM**
  row (it currently lists four entries, including `register-mcp-server.mjs` from the
  MCP task) and a quality-check line to run it.
- `.trellis/spec/index.md`: increment the helper-count sentence in "What This
  Project Is" (it currently reads "four dependency-free Node ESM helpers") — read
  the line and add one, do not hard-code a number; the MCP task already moved this
  count once. Check the plugin-list sentence in "The One Rule To Internalize" for
  another copy of the list.
- `.trellis/spec/config/index.md`: index entry / quality-check line for the new
  check, so a future maintainer runs it.
- `.trellis/spec/guides/change-propagation-guide.md`: **extend** the two existing
  rows (add to their site lists; do not delete a site they already name) —
  - **Plugin list**: `settings.core.json` `packages` (+ the owning
    `optional/*/manifest.json`), `README.md` plugin table, `docs/plugins.md` entry,
    `.trellis/spec/config/pi-resources.md` inventory.
  - **Installed skills**: `skills.json`, `README.md` "Currently installed",
    `~/.agents/.pi-setup-skills.json` (generated), `docs/skills.md` entry,
    `.trellis/spec/config/pi-resources.md` `skills.json` section.

**Validation.** No stale verbatim snippet: if a spec quotes the helper's output or a
`doctor.sh` block, the quoted text matches the file byte-for-byte
(`spec/scripts/shell-guidelines.md` requires updating the snippet in the same
change). `grep -n '| Node ESM |' .trellis/spec/scripts/index.md` names `check-docs`,
not only a quality-check line.

## Step 10 — Final battery

```bash
node --check scripts/check-docs.mjs
bash -n setup.sh scripts/*.sh
node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" \
  "$HOME/.pi/agent/.pi-setup-state.json" --check
./setup.sh && ./setup.sh          # idempotent, second run reports nothing to do
./scripts/doctor.sh               # see the note below on exit 0 vs `All good.`
grep -rn 'docs/' scripts/lib.sh   # empty (R10)
git status --short
```

**`All good.` only prints on a fully clean run** (`scripts/doctor.sh:242-248`
requires `problems == 0 && notes == 0`). The `==> Repo` section raises a note for
**any** dirty tree, including paths another task is editing — so `All good.` may be
unreachable for reasons that have nothing to do with this work. Two checks that are
reachable either way: `./scripts/doctor.sh | grep -A2 'Docs coverage'` shows the new
section with the expected counts, and the run's exit code is `0`. Assert `All good.`
only once every unrelated modified/untracked path is also committed.

**Review gate.** Dispatch `trellis-check` for the last iteration: every AC in
`prd.md` ticked or reported unmet, `README.md` links resolve, no rule duplicated
from `README.md` or `pi-resources.md` into `docs/`, and the four failure-mode
proofs are in `research/check-notes.md`.

## Rollback points

| After | To undo |
| ------- | --------- |
| Step 5 | `rm -rf docs/` and `git checkout README.md` — the change is purely additive to this point |
| Step 7 | Delete the single `==> Docs coverage` block from `doctor.sh` and `git rm scripts/check-docs.mjs`; no other file depends on either |
| Step 9 | Spec edits are additions to existing sections; revert per file with `git checkout <spec path>` |

## Stop And Report

Do not silently work around these:

- An installed package has no usable README (or none at all) → write the entry from
  whatever source exists and report which package is thin, rather than inventing an
  `**Invoke.**` line.
- A package's invocation surface cannot be determined from its source → omit the
  entry's `**Invoke.**` detail and record it in `research/check-notes.md` as a
  coverage gap.
- The generated prompt form cannot be confirmed → report it; do not pick one of the
  two spellings by preference.
- `doctor.sh` gains a `warn` after Step 7 → the check is mis-wired; fix before
  continuing, because a new note on the clean-path run means the check cannot tell
  healthy from unhealthy.

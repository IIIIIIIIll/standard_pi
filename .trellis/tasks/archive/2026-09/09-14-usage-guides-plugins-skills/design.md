# Design — Usage guides for shipped plugins and skills

## Purpose

Add a tracked `docs/` prose surface that answers "when do I reach for this, and
what do I type", plus a machine check that the surface cannot silently fall out of
sync with what the repo actually installs.

The split of responsibility is the whole design:

| Surface | Owns |
| --------- | ------ |
| `README.md` | install, `setup.sh`, render model, symlink surfaces, what is never stored |
| `docs/` | per-thing daily use: purpose, trigger, invocation, config surface, traps |
| `.trellis/spec/config/pi-resources.md` | why each package is core, and the *mechanics* of its config (write behaviour, symlink traps, measured paths) |
| `scripts/doctor.sh` (+ one helper) | proof that `docs/` still matches the shipped set |
| `.trellis/spec/config/` | the rules a maintainer follows when adding either |

### The ownership split, stated once

`pi-resources.md` already carries a package inventory (its own "The package
inventory" section) covering all 12 packages with "What it adds" and "Why it is
core", plus per-package mechanics: pi-lens's root and `PI_LENS_DISABLE_*`,
pi-tps-status's `$XDG_CONFIG_HOME` path, pi-timer's "no config file at all",
pi-web-access's `web-search.json`, the i-have-adhd symlink exception.

That is a contributor document. The decision is:

- **`docs/plugins.md` owns the daily-use view**: what it is, when to reach for it,
  what to type, and a **single** config line naming the path and its surface.
- **`pi-resources.md` stays authoritative** for *why* a package is core and for the
  config mechanics (write behaviour, symlink traps, credential warnings,
  compaction). `docs/` links to it rather than restating those.
- **The two accepted overlaps are the config line and the invocation tokens** —
  R4 requires both, the inventory already carries tokens such as `/lens-map` and
  `/tps`, and they are deliberate rather than accidental. Nothing else is
  duplicated, and `pi-resources.md` wins any disagreement.
- **Reconciliation is an explicit step, not an implication.** `implement.md` Step 9
  adds a cross-link from the `pi-resources.md` inventory to `docs/plugins.md` and
  records the division in that file, so a future editor of either knows which one
  to edit.

This is the post-review answer to the review's BLOCKER finding; the requirement
side of it is R6.

## Doc Map

| File | Audience question it answers | Budget |
| ------ | ------------------------------ | -------- |
| `docs/README.md` | "which page do I want?" | ~40 lines |
| `docs/plugins.md` | "the harness has 12 packages — which one does X, and how do I drive it?" | ~220 lines |
| `docs/skills.md` | "I want a review / a research pass / TDD — which skill, and how is it triggered?" | ~110 lines |
| `docs/agents.md` | "what do `trellis-implement` and `/trellis-continue` do, and how do I dispatch them?" | ~90 lines |
| `.trellis/spec/config/pi-resources.md` (existing) | "why is this core, and how does its config actually behave?" | same audience; prose unchanged except a cross-link, the ownership-split statement, and the coverage-check contract |

`docs/README.md` holds the index and a short legend for the entry contract, so
`docs/plugins.md` does not need to repeat the field meanings. It also states the
heading convention, because that convention is parsed.

## Entry Contract

Every entry is an `###` heading whose first backtick-delimited token is the entry's
exact id, followed by fixed-order labels. The heading shape is a **parser
contract** (`scripts/check-docs.mjs`), not styling:

```markdown
### `npm:pi-lens`

**What it is.** Language-aware feedback on every write and edit.

**Reach for it when.** …the model should see a type error or lint finding…

**Invoke.** `/lens-map` …; tools appear automatically on write/edit.

**Config.** `~/.pi-lens/` — ignored (machine-global, outside `PI_DIRS`); mechanics
in `.trellis/spec/config/pi-resources.md`.

**Gotcha.** …
```

Field rules:

- `**What it is.**`, `**Reach for it when.**`, and `**Invoke.**` are required in
  every entry, in that order — this matches R4, and it is the whole point of the
  page. `**Config.**` states either the path plus one of the four surfaces from
  `spec/config/index.md` (tracked / symlinked / generated / ignored), or "none".
- `**Gotcha.**` is optional — an entry with no real trap must not invent one to fill
  the shape.
- The id is the **exact spec string** for plugins (`npm:pi-lens`,
  `https://github.com/ayghri/i-have-adhd`) and the exact `skills.json` name for
  skills. Relaxing this breaks the check, so it is stated once here and once in
  the check's header comment.
- Heading text after the id is allowed; the check reads only the first
  backtick-delimited token.
- **Only entries use `###`.** Pointer sections inside `docs/plugins.md` and
  `docs/skills.md` use `##`, so the check does not read them as entries.
- **No fenced block in either parsed file may contain a line that starts with
  three hashes and a space.** The extractor skips fenced regions, and this rule
  keeps a future extractor change from silently changing the count.

### Sourcing

Each entry is written from the **installed** copy, which is the version Pi is
actually running. This is why no upstream text is copied and why the entries stay
short: only the parts a source confirms may be written down.

| Entry source | Read from |
| -------------- | ----------- |
| `npm:*` packages (11) | `~/.pi/agent/npm/node_modules/<pkg>/README.md` plus the package's own focused docs where they exist |
| `i-have-adhd` | `~/.pi/agent/git/github.com/ayghri/i-have-adhd/` (`README.md`, `AGENTS.md`) |
| 6 skills | `<AGENTS_SKILLS_DIR>/<name>/SKILL.md` — frontmatter **in full** (`description` **and** `disable-model-invocation`) |
| 3 role agents | `.pi/agents/trellis-*.md` frontmatter (`name`, `description`, `tools`) |
| 3 prompts | `.pi/prompts/trellis-*.md` plus the command name the generated extension registers for it |

Measured volume, to set expectations for the implementer:

| Source | Size |
| -------- | ------ |
| Package READMEs (11) | 3,368 lines |
| Sub-docs under those packages | 73 files / 15,835 lines (`pi-lens/docs` 38 / 7,640; `pi-subagents/docs` 10 / 3,623; `pi-permission-system/docs` 17 / 3,638) |
| `i-have-adhd` | `README.md` 104, `AGENTS.md` 72 |
| 6 skills | 243 lines total |
| 3 agents + 3 prompts | 6 files |

So the entries are 8–15 lines each against ~19.6k lines of available source: read
the README first, and open a sub-doc only when the README's claim is unclear or
when the package has no README coverage of its invocation surface. `implement.md`
names the per-package files to prefer.

Two facts that the sourcing step must not flatten:

- **`grill-me` and `improve-codebase-architecture` declare
  `disable-model-invocation: true`.** Their honest description is "you type it; the
  model will not reach for it". `grill-me`'s body is a one-line redirect to the
  `grilling` skill — that redirect is exactly what an optional `**Gotcha.**` line is
  for.
- **Prompt invocation has two spellings in this repo.** `.trellis/workflow.md` and
  `AGENTS.md` say `/trellis:continue` / `/trellis:finish-work`; the generated
  `.pi/extensions/trellis/index.ts` registers the hyphen form. `docs/agents.md`
  states the form the generated extension registers, and the confirmed evidence
  plus the conflicting source goes in `research/check-notes.md` rather than being
  silently resolved.

## Coverage Check

New helper `scripts/check-docs.mjs`, invoked by `doctor.sh` as a new
`==> Docs coverage` section. It exists because the alternative — extracting
backticked headings with `grep` and JSON sets with `node -e` inside `doctor.sh` —
puts structural parsing in bash. `spec/scripts/shell-guidelines.md` says "do not
parse JSON in bash: use a `node -e` one-liner for a single field, or an `.mjs`
helper for anything structural", and `spec/scripts/node-guidelines.md` is where the
argument/exit-code/output contract for such a helper already lives. Two reasons,
both from the specs rather than from preference.

Contract:

| Input | Source of truth | Compared against |
| ------- | ----------------- | ------------------ |
| Plugin ids | `###` headings in `docs/plugins.md`, first backtick-delimited token | `packages` in `pi-agent/settings.core.json` (set) |
| Skill ids | `###` headings in `docs/skills.md`, first backtick-delimited token | `name` of each entry in `skills.json` (set) |

- Extraction walks lines outside fenced code regions, keeps those that start with
  three hashes and a space, and takes the first backtick-delimited token on the
  line. Trailing heading text and pi-lens reflowing the file do not change the
  result. Evidence that the contract holds against pi-lens: commit `b91810a`
  re-spaced Markdown table separators across the spec tree and left every heading
  line untouched.
- Comparison is set-equality **per file**, reported both ways: a package with no
  entry, and an entry for something not shipped.
- **Streams are pinned.** The counts line on success goes to **stdout**; each
  offending id on failure goes to **stderr** via `console.error`, per
  `node-guidelines.md` ("diagnostics use `console.error`; progress uses
  `console.log`"). `doctor.sh` therefore captures with
  `>/tmp/pi-doctor-docs.$$ 2>&1`, matching the existing `install-skills.mjs`
  invocation at `scripts/doctor.sh:224`. Without the `2>&1` the temp file is empty
  and the offending ids land un-indented on the terminal.
- Exit `0` with the counts on success; exit `1` with the offending ids on failure;
  exit `2` on a missing positional argument, per `node-guidelines.md`.

Failure matrix — every path fails loudly, matching the existing bridge check's
stated rule that a check which degrades to `ok` when it stops being able to see is
worse than no check:

| Condition | doctor.sh reports |
| ----------- | ------------------- |
| `docs/plugins.md` or `docs/skills.md` missing | `bad` |
| Zero headings extracted from an existing file | `bad` (formatting drift or emptied file) |
| `settings.core.json` or `skills.json` unreadable / not parseable | `bad` |
| Package shipped with no entry | `bad`, names each |
| Entry for a package that is not shipped | `bad`, names each |
| `node` unavailable | `bad` (the check cannot run — not a silent pass) |
| Both sets equal | `ok docs cover 12 plugins and 6 skills` |

**Why `node` missing is `bad` here when `==> Optional bundles` uses `warn`.** The
`warn "node unavailable or optional/ missing"` at `scripts/doctor.sh:76` (inside
`==> Optional bundles`, `:61-77`) predates this check and covers a listing
convenience. This check is the only thing preventing silent rot in a tracked
document, so an unrunnable check must fail. `node` is already a hard dependency of
`doctor.sh` (`==> Settings` and `==> Skills` both call it, and `setup.sh` /
`optional.sh` treat its absence as fatal), so the `bad` is not a new class of
failure — it is the existing one, reported honestly. The same rule applies to the
other "cannot verify" rows above: seeing nothing is drift too.

`doctor.sh` keeps its shape: `set -uo pipefail` without `-e`, `ok`/`warn`/`bad`
with counters, temp file at `/tmp/pi-doctor-docs.$$` removed with `rm -f` after the
branch, no early `exit`. The `node` preflight is copied from `==> Optional
bundles`, not from `==> Settings` (which calls `node` directly with no preflight
and degrades to a misleading drift message).

## Boundaries

- `docs/` is prose only. It is **not** added to `PI_DIRS`/`PI_FILES` in
  `scripts/lib.sh`: those lists are inputs to the symlink layer, and `docs/` is
  never linked into `~/.pi/agent`. Verified: `docs/` matches no `.gitignore` rule,
  so no ignore change is needed either.
- `docs/` adds no change to `setup.sh` and no change to the render pipeline. The
  only executable change is the new helper plus its `doctor.sh` section.
- The check reads tracked files only, so it is meaningful on a fresh clone and
  needs no network and no `pi`.
- `README.md` gains links; its existing tables and rules are edited only to point at
  the new pages.

## Alternatives Rejected

1. **Expand `README.md` in place.** README is 249 lines and would roughly double
   while mixing install-time and daily-use content. Also makes the coverage check
   parse the file with the highest edit churn.
2. **Vendor/mirror upstream README text into `docs/`.** Nothing would keep it
   current: `setup.sh` re-fetches plugins but never re-syncs prose, so the copy goes
   stale silently and reads as authoritative. Rejected in favour of 8–15 line
   self-authored entries that only state what a source confirms.
3. **No check (docs as plain prose).** Unpinned packages mean renames and removals
   happen without any local edit; a stale entry then looks exactly like a current
   one. The membership check is ~40 lines and catches that class offline.
4. **Check upstream content too** (re-read each plugin README at setup time and
   diff command names). Rejected: needs network, and upstream prose reformatting
   produces constant false positives.
5. **Move the existing `pi-resources.md` inventory into `docs/` instead of adding
   alongside it.** Rejected: that inventory carries contributor rules (write
   behaviour, symlink traps, credential warnings) that do not belong on a daily-use
   page, and moving it would break every existing spec cross-reference.

## Open Risks

- **Rename inside a plugin.** Membership drift is caught; a renamed flag or
  subcommand inside an already-listed plugin is not. The entry surface is therefore
  kept to names that are stable across minor releases, and R5 forbids guessing.
- **Heading convention drift.** If a future edit writes `##` for an entry, the
  check reports zero headings as a `bad`. That is the intended failure, and
  `docs/README.md` documents the convention so the fix is obvious. The same holds if
  a future `pi-lens` release starts normalising headings rather than only re-spacing
  tables: the check fails loudly instead of silently comparing nothing, which is the
  property that matters. The residual risk — that no one can prove a future release
  will not do that — is accepted rather than mitigated.
- **The config line and the invocation tokens can drift from `pi-resources.md`.**
  Nothing checks either. The mitigation is the ownership statement in both files
  plus the propagation-guide row, not a mechanism.

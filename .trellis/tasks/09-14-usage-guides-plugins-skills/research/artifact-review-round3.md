# Artifact review, round 3 — usage guides for shipped plugins and skills

READ-ONLY review of `prd.md`, `design.md`, `implement.md`, `implement.jsonl`,
`check.jsonl` against `research/artifact-review.md` (round 1, 21 findings) and
`research/artifact-review-round2.md` (round 2, 1 new MAJOR + 8 new MINOR).
This file is the only file written by this review; `git diff --cached --name-only`
is empty. The other entries in `git status --short` belong to the sibling task
(environment note below), not to this review.

Method: every measurement below was re-taken in this session with read-only
commands (`find`, `wc`, `grep`, `git ls-files`, `git show HEAD:<file>`, `git status`,
`git diff`, `node -e`) against HEAD `1e45cc7` and the installed copies under
`~/.pi/agent/`. No `setup.sh`, `sync.sh`, `doctor.sh`, or `pi` invocation was run.

**Environment note — an unrelated task is writing this tree while the review runs.**
`.trellis/tasks/09-14-codegraph-mcp-install/` is implementing concurrently: during
this review `scripts/lib.sh` gained `MCP_CFG` (22:43), and the tree now shows
`M README.md`, `M scripts/doctor.sh`, `M scripts/lib.sh`, `M setup.sh`,
`M .trellis/spec/scripts/index.md`, plus untracked `scripts/install-mcp.sh` and
`scripts/register-mcp-server.mjs`. Two consequences: (a) the Context counts in
`prd.md:29-33` are correct **at HEAD** (README 11 mentions / 10 distinct; all 47
tracked `*.md` 58 mentions / 15 distinct — re-measured via `git show HEAD:`), but a
re-count on the current dirty tree reads 12 / 10 and 59 / 15 because the sibling
added a second `/mcp` mention to `README.md`; do not mistake that for a stale
Context. (b) `README.md` (Step 5) and `.trellis/spec/scripts/index.md` (Step 9) are
edit targets of **both** tasks, so this task should rebase or sequence against the
sibling before touching them. AC 9's `All good.` is also unreachable while the
sibling's edits and untracked directory remain (see AC 9 and residual MINOR-5).

---

## Verdict

**GO WITH FIXES** — the round-2 MAJOR is closed and 6 of the 8 round-2 MINORs are fully closed, but the accepted-overlap set is still stated three ways (two in `prd.md`/`implement.md`, one in `design.md`) and `design.md` still calls `pi-resources.md` "unchanged" while its own Step 9 changes it, so fix those two lines plus the small residuals below before `task.py start`.

---

## Round-2 items closed

| # | Round-2 finding | Verdict | Deciding evidence (revised file:line) |
| --- | ----------------- | --------- | --------------------------------------- |
| NF1 | MAJOR — `prd.md:29` "All of them are passing mentions" contradicted the bullet above it | **RESOLVED** | `prd.md:29-33` now reads "`README.md` carries 10 distinct backticked slash commands in 11 mentions, and across tracked docs the tally reaches 15 distinct / 58 mentions. Every one of the **README** instances is a passing mention; the spec tree is the only place that explains any of them". Re-measured at HEAD `1e45cc7` with the same regex `` `(\/[A-Za-z0-9:_-]+)` `` (via `git show HEAD:` so the sibling task's dirty-tree edits cannot skew it): `README.md` = 11 mentions / 10 distinct (matches exactly); all 47 tracked `*.md` = 58 mentions / 15 distinct (matches exactly); the README instances are all table cells or parentheticals (`README.md:100,102-107,147,159`), and the explanations live in `.trellis/spec/` (`pi-resources.md:58-62` + `:64-80`, `guides/cross-layer-thinking-guide.md`). The blanket sentence is gone and the replacement is true; the bullet is now internally consistent with `:21-28`. (Caveat, not a contradiction: the 15 includes `/tmp`, a path, not a command — without it the tally is 14 distinct.) |
| NF2 | MINOR — `design.md` cited `scripts/doctor.sh:88-89` for a `warn` that is a `bad` | **RESOLVED** | `design.md:194` now cites ``warn "node unavailable or optional/ missing"`` at `scripts/doctor.sh:76` "(inside `==> Optional bundles`, `:61-77`)". Verified: `doctor.sh:76` is exactly that `warn`, and `:88-89` is `elif [ -L "$dst" ]; then` / `bad … (points elsewhere)`. |
| NF3 | MINOR — sub-doc volume understated (65/14,680) and "only two packages with large sub-doc trees" false | **RESOLVED** | `design.md:119` now says "73 files / 15,835 lines"; `prd.md:38-40` says "15,835 lines across 73 sub-doc files". Re-measured recursively (`find <pkg>/docs -type f -name '*.md'`): pi-lens 38/7,640, pi-subagents 10/3,623, pi-permission-system 17/3,638, rpiv-todo 3/391, rpiv-ask-user-question 5/543 → **73 / 15,835**. `pi-mcp-adapter` has no `docs/` of its own (the earlier 32/4,938 was nested `node_modules/undici/docs`). The false "only two packages" clause is gone; `implement.md:73-75` now names three large trees. Residual in that sentence → Part 4, MINOR-2. |
| NF4 | MINOR — `implement.jsonl`'s `pi-resources.md` reason named the wrong check inputs | **RESOLVED** | Row 3 of `implement.jsonl` now reads "It is NOT a check input: the coverage check reads `packages` from `pi-agent/settings.core.json` and `name` from the repo-root `skills.json`." This matches `design.md:157-158` (`packages` in `settings.core.json`; `name` of each entry in `skills.json`) and `implement.md:178-179`. |
| NF5 | MINOR — `prd.md` R4 required the "when" line, `design.md` called it optional | **RESOLVED** | `prd.md:58-63` ("what it is (one line), when to reach for it, the exact invocation surface …, and where its config lives with its surface … A gotcha line appears only when the source documents a real trap") now matches `design.md:82-87` verbatim in effect: "`**What it is.**`, `**Reach for it when.**`, and `**Invoke.**` are required in every entry, in that order — this matches R4"; only `**Gotcha.**` is optional. No remaining permissive sentence. |
| NF6 | MINOR — `prd.md:22`'s `(`:64-80`)` was attached to `/lens-map` | **RESOLVED** | `prd.md:21-23` now reads "already documents invocation for several packages — `/mcp` + `/mcp setup`, `/lens-map` (`:58-62`), `/tps`, `/i-have-adhd` — and `:64-80` explains them". `:58-62` is exactly the five inventory rows carrying those tokens (`pi-resources.md:58` mcp, `:59` lens, `:60` tps, `:62` i-have-adhd); `:64-80` explains `/mcp setup` (`:65-66`), pi-lens (`:67-75`) and `/tps` (`:77-80`). One-token imprecision only: `/i-have-adhd`'s explanation is at `:99-113`, outside the cited range — the range still brackets 3 of the 4 tokens named. |
| NF7 | MINOR — R6's "one field" claim narrower than reality, and `design.md` marks `pi-resources.md` "unchanged" | **PARTIAL** | The `prd.md` half is fixed: `prd.md:70-74` now says "**Exactly two** things necessarily appear in both `docs/` and `pi-resources.md`, and no more: the config location and surface, and the invocation tokens", and `implement.md:230-231` agrees ("the two accepted overlaps are the config line and the invocation tokens, per R6"). The `design.md` half is not fixed and is now the minority statement: `design.md:34-36` still says "**The one config line per entry is an accepted, bounded overlap** … *Nothing else is duplicated*", and `design.md:53` still budgets the file as "unchanged, plus a cross-link and the coverage-check contract". See the Overlap-story ruling below; residual MAJOR-1. |
| NF8 | MINOR — Step 9's Installed-skills row dropped `~/.agents/.pi-setup-skills.json` | **RESOLVED** | `implement.md:247-249` lists "`skills.json`, `README.md` "Currently installed", `~/.agents/.pi-setup-skills.json` (generated), `docs/skills.md` entry, `.trellis/spec/config/pi-resources.md` `skills.json` section". Every site the existing row names (`change-propagation-guide.md:77`) is retained, and the two new sites are added; the plugin row (`implement.md:244-246`) likewise retains all three sites from `:75` (`settings.core.json` `packages`, `README.md` plugin table, the owning `optional/*/manifest.json`) and adds two. |
| NF9 | MINOR — two ACs not mechanically checkable; AC 13's grep misses a brace-style edit | **PARTIAL** | Brace-style half is fixed by using the substring `check-docs` instead of `check-docs.mjs`: `prd.md:130` `grep -c 'check-docs' .trellis/spec/scripts/index.md` is ≥1, which a correct edit to `scripts/{render-settings,sync-settings,install-skills,check-docs}.mjs` (`scripts/index.md:14`) will match — measured 0 today (exit 1), so it is not vacuous. Still open: (a) `prd.md:103-105` (AC 3) still has no runnable command, only a prose claim plus "recorded in `research/check-notes.md`"; (b) the AC's "with the helper named in the runtime table itself, not only in a quality-check line" clause is *not* tested by the grep — a quality-check line alone satisfies it, and `implement.md:254` uses a different pattern (`check-docs.mjs`) that only that line would satisfy; (c) AC 12's new grep (`prd.md:126-128`) is line-oriented while its exception is defined per bullet (see AC audit, row 12). |

---

## Overlap-story consistency

The three statements, quoted:

**1. `prd.md:70-75` (R6, "Bounded overlap, not duplication")**

> "Setup, render, symlink, and per-machine config rules stay in `README.md` and
> `.trellis/spec/config/`. Exactly two things necessarily appear in both `docs/`
> and `pi-resources.md`, and no more: the config location and surface, and the
> invocation tokens (R4 requires both, and the inventory already carries tokens
> such as `/lens-map` and `/tps` inside its rationale prose). `pi-resources.md`
> stays authoritative for both, and `docs/` links to it for the mechanics."

**2. `design.md:34-36` ("The ownership split, stated once")**

> "**The one config line per entry is an accepted, bounded overlap** — R4 requires
> it, it is one line, and it is deliberate rather than accidental. Nothing else is
> duplicated, and `pi-resources.md` wins any disagreement."

and the same document two lines earlier, `design.md:31-33`: "**`pi-resources.md`
stays authoritative** for *why* a package is core and for the config mechanics …
`docs/` links to it rather than restating those." The Doc Map then budgets the file
as `design.md:53`: "unchanged, plus a cross-link and the coverage-check contract".

**3. `implement.md:227-234` (Step 9)**

> "`.trellis/spec/config/pi-resources.md`: **reconcile, do not duplicate.** Add a
> cross-link from the package inventory to `docs/plugins.md` and record the
> ownership split (inventory = why-it-is-core + config mechanics; `docs/` = daily
> use). State there that **the two accepted overlaps are the config line and the
> invocation tokens**, per R6, and that this file wins any disagreement. Also add
> the coverage check's contract (heading convention, id source of truth, fail-loud
> rules, exit codes) next to the `skills.json` / `settings.core.json` specs it
> depends on."

**Ruling.**

- *Authority ordering — agreed in all three.* `pi-resources.md` wins any
  disagreement (`prd.md:75`, `design.md:36`, `implement.md:231`), and `docs/` links
  out instead of restating mechanics (`prd.md:75-76`, `design.md:31-33`,
  `implement.md:96-97`). No conflict here.
- *Overlap set — not agreed.* R6 and Step 9 name **two** overlapping things (the
  config line and the invocation tokens). `design.md:34-36` names **one** and then
  asserts "Nothing else is duplicated" — which is false on R6's own evidence and
  on the repo: `pi-resources.md:58-62` already carries `/mcp`, `/mcp setup`,
  `/lens-map`, `/tps`, `/i-have-adhd`, `/skill:i-have-adhd`, and R4
  (`prd.md:59-60`) requires an `**Invoke.**` line in every `docs/plugins.md`
  entry, so the token sets overlap whether or not anyone intends it. This is the
  same "single line" style claim the task asked about, and it sits in the section
  the round-1 BLOCKER was resolved by. The design's own Open Risks repeats the
  narrow view (`design.md:254`: "**The one config line** can drift from
  `pi-resources.md`").
- *"unchanged" — contradicted by the same document.* `design.md:53` budgets
  `pi-resources.md` as "unchanged, plus a cross-link and the coverage-check
  contract", while `design.md:37-40` says Step 9 "records the division in that
  file" and Step 9 itself adds the ownership-split prose **and** the two-overlap
  statement (`implement.md:228-231`) on top of the cross-link and the check
  contract. "Unchanged" plus two named additions is not what Step 9 does.

Fix (one place, both facets): rewrite `design.md:34-36` to
"**The two accepted overlaps are the config line and the invocation tokens** —
R4 requires both, the inventory already carries tokens, and they are deliberate.
Nothing else is duplicated, and `pi-resources.md` wins any disagreement." and
change the `design.md:53` budget to "same audience, prose unchanged except for a
cross-link, the ownership-split statement, and the coverage-check contract".

---

## Acceptance criteria audit

13 criteria in `prd.md:98-132`, in order. "Observed now" is the pre-work state,
measured read-only. Commands that need the implementation (`node
scripts/check-docs.mjs`, `doctor.sh`, `setup.sh`, `render-settings.mjs`) were
**not run**; their pre-work state is inferred from file existence and from
`scripts/doctor.sh`/`setup.sh` as read.

| # | Criterion (line) | Command that verifies it | Observed now (pre-work) | Sound? |
| --- | ------------------ | ------------------------- | ------------------------- | -------- |
| 1 | plugins: 12 entries, 0 extras, pointer sections not read as entries (`:98-100`) | `node scripts/check-docs.mjs .`; `grep -c '^### ' docs/plugins.md` → 12 | `test -f docs/plugins.md` → absent; helper absent → fails | **Yes.** Set-equality catches both directions; a `###` pointer section surfaces as a stray id, so "heading level the check does not read" is genuinely tested. |
| 2 | skills: 6 entries, each states model-invocation status (`:101-102`) | `node scripts/check-docs.mjs .` + read of each entry | file absent → fails | **Partly.** Membership is mechanical; "states whether model invocation is enabled" has no command and is reviewer-read. Distinguishes pass from fail (fails pre-work). |
| 3 | agents: 3+3 covered; prompt form confirmed against the generated extension; evidence in `research/check-notes.md` (`:103-105`) | none given; inspect `docs/agents.md` + `research/check-notes.md` | `docs/agents.md` and `research/check-notes.md` both absent → fails | **Weak.** No runnable command (NF9a). Also the strongest in-extension evidence is a notify string (`.pi/extensions/trellis/index.ts:2088`); no prompt-registration call exists, so "confirmed against the generated extension" rests on that string plus the `.pi/prompts/trellis-*.md` filenames — `implement.md:141-143` does name all three signals, so it is workable, not false. |
| 4 | every entry carries `What it is` / `Reach for it when` / `Invoke` + config location and surface (`:106-110`) | `grep -c '^\*\*Invoke\.\*\*' docs/{plugins,skills,agents}.md` → 12/6/6; `grep -c '^\*\*What it is\.\*\*' docs/plugins.md` → 12 | `grep -c … docs/{plugins,skills,agents}.md` → "No such file or directory" ×3, exit 2 (not 12/6/6) → fails | **Yes for what it counts.** Brace expansion order is `plugins, skills, agents`, so "12 / 6 / 6" is correct as written. Gaps: `**Reach for it when.**` and `**Config.**` are named in the criterion but not counted anywhere (only `Invoke` on three files and `What it is` on plugins). |
| 5 | ≥3 invocation claims spot-checked verbatim, recorded `claim → source file:line` (`:111-113`) | inspect `research/check-notes.md` | file absent → fails | **Yes as evidence, weak as coverage.** 3 of ~19 claims across 12 packages; every mechanical gate can pass while most tokens are unverified (this is round-2's #1 risk, unchanged). |
| 6 | 4 `doctor.sh` failure-mode proofs exit 1 naming the id/file, exit codes recorded (`:114-116`) | the four runs in `implement.md:212-217` | not run (no implementation) | **Yes.** Nothing else in `doctor.sh` fails from those mutations, so exit 1 isolates the new check. One method hazard in proof 1 → Part 4, MINOR-6. |
| 7 | `doctor.sh` exits 0 with the new check reporting expected counts, no new `warn` vs baseline (`:117-118`) | `./scripts/doctor.sh` | not run; `grep -n 'Docs coverage\|check-docs' scripts/doctor.sh` → no match, so the "new check reporting counts" half fails pre-work | **Yes.** The exit-0 half already holds today, but the criterion as a whole cannot pass until the section exists. `warn` count is a real gate: the design routes every failure path to `bad` (`design.md:185-191`). |
| 8 | render `--check` still reports no drift (`:119-120`) | `node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check` | not run (expected pass); the plan touches no render input (`design.md` Boundaries) | **Sound but non-discriminating.** It passes before and after by construction — an explicit regression guard ("still"), not a test of the new work. |
| 9 | `./setup.sh` twice idempotent, `doctor.sh` reports `All good.` on a committed clean tree (`:121-122`) | `./setup.sh && ./setup.sh`; `./scripts/doctor.sh` | not run; both already true today, so non-discriminating. Additionally **unreachable now**: `git status --short` is non-empty from the sibling task's uncommitted edits (`README.md`, `scripts/{lib,doctor}.sh`, `setup.sh`, `.trellis/spec/scripts/index.md`, new `scripts/*`) plus its untracked task dir, and `doctor.sh:30-32` emits one `warn` "uncommitted changes" whenever `git status --short` is non-empty, so step 2 (`implement.md:272-274`) cannot print `All good.` until the sibling task's work is committed or reverted | **Sound in principle, blocked in practice** → Part 4, MINOR-5. |
| 10 | `docs/` never linked: `grep -rn 'docs/' scripts/lib.sh` empty and `./setup.sh` output has no `docs` line (`:123-124`) | `grep -rn 'docs/' scripts/lib.sh`; `./setup.sh` | `grep -rn 'docs/' scripts/lib.sh` → no output, exit 1 ✓; `grep -n docs setup.sh scripts/*.sh` → no matches, so no output line can contain `docs` ✓ | **Vacuous as a discriminator** (both halves are already true and the plan changes neither), sound as a regression guard. The second half has teeth if `docs` were ever added to `PI_DIRS`, because `setup.sh` prints `say link "$dst"` per entry. |
| 11 | `README.md` links to all three pages, every target exists (`:125`) | `grep -n 'docs/' README.md`; `test -f docs/<page>` | `grep -n 'docs/' README.md` → no match, exit 1; targets absent → fails | **Yes.** Fails pre-work, passes only when all three links and files exist. |
| 12 | no per-machine rule restated: `grep -n 'symlink\|PI_DIRS\|PI_NOT_SYNCED\|not stored' docs/*.md` returns nothing or only lines naming `.trellis/spec/config/` or `README.md` in the same bullet (`:126-128`) | the grep itself | `docs/*.md` absent → `grep: docs/*.md: No such file or directory`, exit 2 (not "nothing") | **Ambiguous as written → treat as unsound until clarified.** (a) The exception is defined on a multi-line unit ("the same bullet") but a `grep` line is a physical line; (b) R4/`design.md:84-85` *requires* the surface word, and `symlinked` is one of the four surfaces, so the i-have-adhd entry will match the pattern by design; (c) `design.md:74`'s own canonical Config example puts `PI_DIRS` on the line and the `pi-resources.md` link on the *next* line, so a conforming entry can trip the AC. Fix: make Step 1 state that the `**Config.**` bullet keeps path, surface word, and the `.trellis/spec/config/pi-resources.md` link on one physical line, and drop "outside `PI_DIRS`" from the example (that rationale belongs in the linked spec). |
| 13 | `layout-and-surfaces.md` has a `docs/` file-map row and a decision-tree step; `grep -c 'check-docs' .trellis/spec/scripts/index.md` ≥1 with the helper in the runtime table itself (`:129-132`) | `grep -c 'check-docs' .trellis/spec/scripts/index.md`; inspect `layout-and-surfaces.md` | `grep -c` → 0, exit 1 (`check-docs` appears nowhere outside the task dir); `grep -n 'docs/' layout-and-surfaces.md` → no match → fails | **Partly.** Presence is genuinely tested and the brace-style problem is fixed (substring match). But "named in the runtime table itself, not only in a quality-check line" is *not* tested by that grep, and `implement.md:254`'s variant (`grep -c 'check-docs.mjs'`) is satisfied by a quality-check line alone — the two validation strings disagree. |

No criterion is fully vacuous; ACs 8, 9 and 10 pass before the work and are
regression guards by intent. AC 1–7, 11, 13 fail pre-work and therefore
distinguish. AC 12 is the only one where a *compliant* implementation can fail its
own gate.

---

## Residual defects

**MAJOR-1 — the overlap set is stated three ways; `design.md` says one and calls
the other file "unchanged".** `design.md:34-36` ("The one config line per entry …
Nothing else is duplicated") contradicts `prd.md:70-74` ("**Exactly two** things …
the config location and surface, and the invocation tokens") and
`implement.md:230-231` ("the two accepted overlaps are the config line and the
invocation tokens, per R6"). `design.md:53` additionally budgets `pi-resources.md`
as "unchanged, plus a cross-link and the coverage-check contract" while
`design.md:37-40` and Step 9 require it to gain the ownership-split statement and
the two-overlap statement. Danger: an implementer who reads only the "stated once"
section skips the reconcile prose in Step 9, ships the two overlapping token
inventories with no recorded authority order, and re-creates the round-1 BLOCKER
while every mechanical gate passes. Fix as given in the Overlap-story ruling.

**MINOR-1 — `design.md:124` says "~18k lines of available source" while its own
table two lines above sums to 19,203** (3,368 READMEs + 15,835 sub-docs; +176
i-have-adhd +243 skills = 19,622). This is the pre-correction figure; the table was
fixed, the sentence was not. Fix: "~19.6k".

**MINOR-2 — `implement.md:73-75` pairs three trees with a five-tree total.**
"`pi-lens/docs` holds 38 files (7,640 lines), `pi-subagents/docs` 10 (3,623), and
`pi-permission-system/docs` 17 (3,638) — three large trees, 15,835 sub-doc lines in
total." 7,640 + 3,623 + 3,638 = **14,901**, not 15,835. Fix: "… and
`rpiv-todo`/`rpiv-ask-user-question` add 8 files, 934 lines — 15,835 sub-doc lines
across five trees in total."

**MINOR-3 — AC 12's exception is unenforceable as written.** See the AC audit, row
12: a line-oriented `grep` cannot see "the same bullet", R4 forces the word
`symlinked` into at least one entry, and `design.md:74`'s own example has
`PI_DIRS` and the `pi-resources.md` link on different physical lines.

**MINOR-4 — AC 13 and `implement.md:254` use different patterns for the same
requirement, and neither verifies the half it is quoted for.** `prd.md:130` greps
`check-docs`; `implement.md:254` greps `check-docs.mjs`. The runtime-table clause
("not only in a quality-check line") has no test in either place; a quality-check
line alone satisfies both patterns. Fix: in AC 13, test the table explicitly, e.g.
`grep -n 'install-skills,check-docs}\.mjs\|check-docs\.mjs' .trellis/spec/scripts/index.md`
plus "the first match is on the `| Node ESM |` row".

**MINOR-5 — AC 9's `All good.` is currently unreachable for a reason unrelated to
the work.** `doctor.sh:30-32` emits one `warn` whenever `git status --short` is
non-empty; at the end of this review that output was
` M .trellis/spec/scripts/index.md`, ` M README.md`, ` M scripts/doctor.sh`,
` M scripts/lib.sh`, ` M setup.sh`, `?? .trellis/tasks/09-14-codegraph-mcp-install/`,
`?? .trellis/tasks/09-14-usage-guides-plugins-skills/`, `?? scripts/install-mcp.sh`,
`?? scripts/register-mcp-server.mjs` — all from the sibling task except this task's
own directory. Committing this task's files cannot clear the rest. Fix: qualify
AC 9 / `implement.md:269-274` to "with only unrelated untracked/modified paths
remaining, `doctor.sh` ends `No problems. 1 note(s) above.`; run the `All good.`
check after those are committed, or validate the new section directly with
`./scripts/doctor.sh | grep 'Docs coverage'`".

**MINOR-6 — Step 8 proof 1's method can produce exit 0 on a correct
implementation.** `implement.md:212-213` says "Comment out one `###` entry in
`docs/plugins.md` → `doctor.sh` exits `1`". The extractor is line-based and HTML-
comment-aware only via fences (`design.md:94-98`, `:160-161`); an entry commented
as `<!-- ### \`npm:pi-lens\` … -->` still has a line starting with `### `, so the
check legitimately reports 12 headings and exits 0, and the implementer records a
false failure. Fix: "change one entry heading to four hashes (or delete the line)".

**MINOR-7 — `implement.md:46` names an AC that does not point at the check
notes.** "`prd.md` AC 5, AC 3, AC 6 and AC 4 all point at this file." AC 5
(`prd.md:112`), AC 3 (`:105`) and AC 6 (`:116`) do; AC 4 (`:106-110`) does not
mention `research/check-notes.md` at all. (`implement.md:42-43` separately requires
the per-file counts to be recorded there.) Fix: drop AC 4 from that sentence, or
add "recorded in `research/check-notes.md`" to AC 4.

**MINOR-8 — `check.jsonl`'s `code-reuse-thinking-guide.md` reason can be read as
forbidding what R1 requires.** It says "the docs id sets must not restate the
package list". `docs/plugins.md` *must* contain the 12 ids as headings (R1,
`prd.md:45-47`); what must not be duplicated is a hard-coded list in the checker
(`design.md:157-158`). Fix: "the checker must read the JSON inputs rather than
hard-code the id list".

No BLOCKER.

---

## If implementation starts now

1. **The reconcile step gets skipped or under-delivered, and `docs/` ships a second
   token inventory with no recorded authority order.** The implementer follows the
   canonical "ownership split, stated once" section, which says one overlap and
   calls `pi-resources.md` "unchanged"; Step 9's "state the two accepted overlaps"
   and the ownership-split prose then look optional, so the inventory's token
   column stays as-is while `docs/plugins.md` repeats the same tokens. Every
   mechanical gate still passes — the membership check only compares id sets, and
   no AC greps `pi-resources.md` for the split. Single edit that most reduces it:
   in `design.md:34-36`, replace "The one config line per entry … Nothing else is
   duplicated" with "**The two accepted overlaps are the config line and the
   invocation tokens** … Nothing else is duplicated", and change the `:53` budget
   from "unchanged, plus a cross-link and the coverage-check contract" to
   "unchanged prose, plus a cross-link, the ownership-split statement, and the
   coverage-check contract".
2. **R5 collapses into copying tokens from `pi-resources.md` instead of the
   installed sources.** It is one file with the exact strings (`/mcp`,
   `/lens-map`, `/tps`, `/i-have-adhd`, `/skill:i-have-adhd`), it is already open
   as a Step 9 edit target, and only 3 of ~19 claims are spot-checked (AC 5).
   Single edit that most reduces it: in `implement.md:105-106` (Step 1
   validation), change "Spot-check 3 `Invoke.` lines against their source file" to
   "record one `claim → source file:line` line in `research/check-notes.md` per
   `**Invoke.**` surface written (12+, not 3)", and mirror the same wording in
   AC 5 (`prd.md:111-113`).

Runner-up worth knowing: AC 12 (MINOR-3) and MINOR-6 can each burn a check cycle
on a correct implementation — a fixed grep pattern and "four hashes instead of
comment out" are one-line edits.

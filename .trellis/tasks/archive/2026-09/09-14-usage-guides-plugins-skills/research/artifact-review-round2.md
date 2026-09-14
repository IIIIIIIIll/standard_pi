# Artifact review, round 2 — usage guides for shipped plugins and skills

FIXES VERIFIED WITH GAPS — 18 of the 21 findings in `artifact-review.md` are fully
resolved, 1 (`prd.md` Context counts) is partial, 1 is resolved with the review's
own bad line claim copied forward (`doctor.sh:88-89`), and 1 is resolved with a
narrower fix than the review asked for (R4/R6/R9 ACs). The revision also introduced
1 new MAJOR (a self-contradicting Context section) and 8 new MINORs.

Reviewed read-only on 2026-09-14 against HEAD `1e45cc7`. No file other than this
one was written; `git diff --cached --name-only` is empty and `git status --short`
shows only the untracked task directory.

**Count correction.** The dispatch note says "1 BLOCKER + 12 MAJOR + 6 MINOR = 19".
`artifact-review.md` actually contains 1 BLOCKER + 11 MAJOR + 9 MINOR = **21**
findings (`grep -n '^- \*\*' artifact-review.md` → lines 129, 133-153, 157-173).
All 21 are covered below.

---

## Resolution table

| # | Finding (short) | Verdict | Revised file:line | Deciding evidence |
| --- | --- | --- | --- | --- |
| 1 | **BLOCKER** — `docs/plugins.md` duplicates `pi-resources.md`; `design.md` never names it | **RESOLVED** | `design.md:15`, `:19-38`, `:53`; `implement.md:218-223`; `prd.md:65-71` | `design.md:19-38` is a new "The ownership split, stated once" section: "`docs/plugins.md` owns the daily-use view … `pi-resources.md` stays authoritative for *why* a package is core and for the config mechanics", and `:34` "**The one config line per entry is an accepted, bounded overlap**". `:37` "**Reconciliation is an explicit step, not an implication.**". `design.md:15` adds the doc-map row. Step 9 has the reconcile action: "`.trellis/spec/config/pi-resources.md`: **reconcile, do not duplicate.**" R6 (`prd.md:65-68`) states the same one-field overlap. The three agree on the split. See new findings NF7 for the residual (the "one field" claim is narrower than what the files actually will contain). |
| 2 | MAJOR — "the task's check notes" referenced four times, defined nowhere | **RESOLVED** | `implement.md:26-38` | `implement.md:26` "### The check notes artifact"; `:28` "`research/check-notes.md` under the task directory is where every proof this plan demands is recorded". Content list at `:30-38` (3 claim pairs, prompt form + conflict, 4 exit-code proofs, id counts, omissions). Every reference uses the same path: `prd.md:98,103,107`; `implement.md:28,73,100,136,201,268,286`; `design.md:139` (only `implement.md:14` says "the check notes" generically, under the section that defines it). |
| 3 | MAJOR — `pi-mcp-adapter/README.md + docs/` does not resolve | **RESOLVED** | `implement.md:54` | "| `pi-mcp-adapter` | `README.md` (905) + `OAUTH.md` (no `docs/` dir exists) |". `test -f ~/.pi/agent/npm/node_modules/pi-mcp-adapter/OAUTH.md` → EXISTS. All 14 rows of the source table (`implement.md:49-62`) resolve: every named README, `OAUTH.md`, and each of the 13 specific sub-docs (incl. `pi-lens/docs/{usage,tools,configuration}.md`, `pi-subagents/docs/{tool-reference,agents,workflows}.md`, both rpiv pairs, `pi-permission-system/docs/configuration.md`) returns EXISTS. |
| 4 | MAJOR — volume estimate off by ~4× | **RESOLVED** | `design.md:118`; `implement.md:49-62`, `:68-69` | `design.md:118` "Sub-docs under those packages | 65 files / 14,680 lines (`pi-lens/docs` is 38 files / 7,640; `pi-subagents/docs` 10 / 3,623)". `implement.md:47-48` "Read the README first; open a sub-doc only when…" with a per-package file list, and `:68-69` "Do not read them wholesale." Residual size error → NF3. |
| 5 | MAJOR — failure-path stream contract unstated | **RESOLVED** | `design.md:168-174`; `implement.md:188-190` | `design.md:168-173` "**Streams are pinned.** The counts line on success goes to **stdout**; each offending id on failure goes to **stderr** via `console.error` … `doctor.sh` therefore captures with `>/tmp/pi-doctor-docs.$$ 2>&1`". Step 7 mirrors it verbatim: "run the helper with `>/tmp/pi-doctor-docs.$$ 2>&1` (the redirect is required — the offending ids go to stderr)". Matches the precedent at `scripts/doctor.sh:224`. The two statements agree. |
| 6 | MAJOR — Step 9 misses `scripts/index.md` and `.trellis/spec/index.md` | **RESOLVED** | `implement.md:224-228` | Step 9 now has "`.trellis/spec/scripts/index.md`: add the new `.mjs` helper to the registry row (currently `scripts/{render-settings,sync-settings,install-skills}.mjs`) and a quality-check line to run it." and "`.trellis/spec/index.md`: the "three dependency-free Node ESM helpers" sentence becomes four". Both stales are real today: `.trellis/spec/scripts/index.md:14` = "| Node ESM | `scripts/{render-settings,sync-settings,install-skills}.mjs` | JSON composition and network/git fetch |"; `.trellis/spec/index.md:15` = "- three dependency-free Node ESM helpers that do the JSON work". Both files are in `implement.jsonl`/`check.jsonl`. |
| 7 | MAJOR — the propagation row is itself incomplete | **RESOLVED** | `implement.md:231-238` | Plugin row: "`settings.core.json` `packages` (+ the owning `optional/*/manifest.json`), `README.md` plugin table, `docs/plugins.md` entry, `.trellis/spec/config/pi-resources.md` inventory." Skills row: "`skills.json`, `README.md` "Currently installed", `docs/skills.md` entry, `.trellis/spec/config/pi-resources.md` `skills.json` section." All three review-named omissions are present. The named `skills.json` section exists (`pi-resources.md:191` `## skills.json`). One site the row *loses* → NF8. |
| 8 | MAJOR — prompt invocation form contradicts tracked docs and is unverified | **RESOLVED** | `implement.md:132-136`; `design.md:135-140`; `prd.md:48-52`, `:96-98` | Step 3: "**Confirm the prompt form before writing it.** … Read the generated extension and state the form it registers; put the confirmed evidence and the conflicting source in `research/check-notes.md`. Do not resolve the conflict by guessing." `design.md:135-140` records both spellings. Re-verified: `.pi/prompts/trellis-{start,continue,finish-work}.md` exist; `.pi/extensions/trellis/index.ts:2088` uses `/trellis-start`; `.trellis/workflow.md:239,250,272,672` and `AGENTS.md:13` use `/trellis:continue` / `/trellis:finish-work`. |
| 9 | MAJOR — two skills disable model invocation; uniform story flattens it | **RESOLVED** | `implement.md:109-116`; `design.md:130-134`; `prd.md:44-47` | Step 2: "Read each `SKILL.md`'s **complete frontmatter**, not just `description`" and "`grill-me` and `improve-codebase-architecture` declare `disable-model-invocation: true` — their entries say so" plus "`grill-me`'s body is a one-line redirect to the `grilling` skill; that redirect belongs in its `**Gotcha.**` line." Re-measured: `~/.agents/skills/grill-me/SKILL.md:4` and `~/.agents/skills/improve-codebase-architecture/SKILL.md:4` both carry `disable-model-invocation: true`; grill-me's body is exactly `Call the Skill tool with "grilling".` R2 (`prd.md:47`) now requires the statement per entry. |
| 10 | MAJOR — `.agents/skills/trellis-*` pointer target is gitignored/generated | **RESOLVED** | `implement.md:118-121`; `prd.md:142-145` | Step 2: "Anchor it on paths that exist on a fresh clone (`.trellis/workflow.md`, `AGENTS.md`); describe `trellis-meta`'s references as available after `trellis init`, and do not link the gitignored `.agents/skills/trellis-*` path as if it were guaranteed." `prd.md:142-145` says the same in Out Of Scope. `.gitignore:57` is `.agents/` (confirmed). |
| 11 | MAJOR — `prd.md` Context counts wrong in two places | **PARTIAL** | `prd.md:21-27` (fixed), `prd.md:29` (still wrong) | Prose half fixed: `prd.md:21-27` now says "The gap is discoverability, not absence …" and "`README.md` gives prose to only three packages clearly (`pi-vcc`, `auto-compact`, `i-have-adhd`), one paragraph to `pi-subagents`, and a bare linking table cell to `pi-permission-system`; the other seven get a single table row." Re-measured and correct (`README.md:114-132`, `:135-147`, `:109`, `:98`). Slash-command half still holds the old claim: `prd.md:29` "`README.md` carries 10 distinct backticked slash commands; across tracked docs the tally is ≥17 mentions / ≥13 distinct. **All of them are passing mentions.**" — the last sentence contradicts `prd.md:21-23` two lines above (`pi-resources.md` *documents* `/lens-map`, `/tps`, `/mcp setup`), which the review's finding (b) was specifically about. See NF1. Counts themselves re-measured: README 10 distinct / 11 mentions (backtick-closed), tracked docs 15 distinct / 58 mentions — the cited `≥17`/`≥13` are true lower bounds. |
| 12 | MAJOR — Step 10's `All good.` cannot hold at Step 10 | **RESOLVED** | `implement.md:252`, `:258-263`; `prd.md:112-113` | The battery line is now "`./scripts/doctor.sh # see the note below on exit 0 vs `All good.``", followed by "**`All good.` only prints on a fully clean run** (`scripts/doctor.sh:242-248` requires `problems == 0 && notes == 0`). Until the change is committed, the `==> Repo` section contributes an "uncommitted changes" note … So: run the battery, then commit (Phase 3.4), then re-run `./scripts/doctor.sh` once on the committed tree and confirm `All good.` That second run is the AC." AC 9 now reads "and `doctor.sh` reports `All good.` on a committed, clean tree." Condition verified at `scripts/doctor.sh:243-246`. |
| 13 | MINOR — Step 1 claims an order it does not use | **RESOLVED** | `implement.md:78-88` | "the check compares them as a **set**, so the order here is not an invariant, but keep `settings.core.json`'s order to avoid a misleading hand-diff". The list (`implement.md:82-88`) read row-major reproduces `settings.core.json` indices 0-11 exactly (subagents, web-access, ask-user-question, rpiv-todo, permission-system, vcc, auto-compact, mcp-adapter, lens, tps, timer, i-have-adhd). The false "exact order" invariant is gone. |
| 14 | MINOR — pointer sections not told to avoid `###` | **RESOLVED** | `implement.md:93`, `:118`, `:22`; `design.md:93-94` | Step 1: "Close the file with two `##` pointer sections"; Step 2: "End with a `##` pointer section"; Ground rules `:22` "**Only entry headings use `###`.** Pointer sections inside the two parsed files use `##`". `design.md:93-94` states it as a contract. |
| 15 | MINOR — parser not fence-aware | **RESOLVED** | `design.md:160-161`, `:95-97`; `implement.md:22-24` | `design.md:160` "Extraction walks lines outside fenced code regions, keeps those that start with three hashes and a space"; `:95-97` "**No fenced block in either parsed file may contain a line that starts with three hashes and a space.** The extractor skips fenced regions". Both belt and braces; the implementer is bound by the same rule in Ground rules. |
| 16 | MINOR — R6, R9 and half of R4 have no AC | **RESOLVED** | `prd.md:117-121`, `:99-101` | New AC 12 (R6): "`docs/*.md` states no per-machine ignore/symlink rule of its own…". New AC 13 (R9): "`layout-and-surfaces.md` has a `docs/` row in its file map and a step in its decision tree, and `grep -c 'check-docs.mjs' .trellis/spec/scripts/index.md` is ≥1". AC 4 now requires the `**What it is.**`/`**Invoke.**` labels plus `grep -c '^\*\*Invoke\.\*\*' docs/plugins.md`. Gaps: no grep AC for `docs/skills.md` (only Step 2's validation, `implement.md:124`) and `**What it is.**` is asserted but never counted → NF9. |
| 17 | MINOR — AC 11 (R10) is vacuous | **RESOLVED** | `prd.md:114-115` | "`grep -rn 'docs/' scripts/lib.sh` returns nothing, **and** `./setup.sh` output contains no `docs` line — `docs/` is never linked into `~/.pi/agent` (R10)." The added half has teeth: `setup.sh:126` prints `say link "$dst"` for every `PI_DIRS`/`PI_FILES` entry, so a `docs` entry in `scripts/lib.sh:17` would surface in the run output. (The `grep` half is still vacuous on its own — `PI_DIRS`/`PI_FILES` hold bare names, no slash.) |
| 18 | MINOR — `check.jsonl` cross-layer reason overstates the file | **RESOLVED** | `check.jsonl` last row | Now "Map the docs -> helper -> doctor.sh -> spec chain and its contracts, then walk the reviewer checklist against it." The sections it points at exist: `cross-layer-thinking-guide.md:21` (Map the Data Flow), `:44` (Define Contracts), `:56/:74` (Mistake 1 / Mistake 4), `:105` (Checklist for Cross-Layer Features). The bogus "clean-path run and reverted failure-mode proofs" clause is gone. |
| 19 | MINOR — shell-guidelines citation imprecise | **RESOLVED** | `design.md:146-152` | "`spec/scripts/shell-guidelines.md` says "do not parse JSON in bash: use a `node -e` one-liner for a single field, or an `.mjs` helper for anything structural", and `spec/scripts/node-guidelines.md` is where the argument/exit-code/output contract for such a helper already lives. Two reasons, both from the specs rather than from preference." Re-measured: `shell-guidelines.md:408-409` reads "- **Do not parse JSON in bash.** No `jq` is available; use a `node -e` one-liner / for a single field, or an `.mjs` helper for anything structural." Citation now accurate and the second reason added. |
| 20 | MINOR — `node`-missing → `bad` unexplained | **RESOLVED** | `design.md:192-199` | "**Why `node` missing is `bad` here when `==> Optional bundles` uses `warn`.** … an unrunnable check must fail. `node` is already a hard dependency of `doctor.sh` … so the `bad` is not a new class of failure — it is the existing one, reported honestly." Justification present and correct; but the sentence contains a wrong line reference → NF2. |
| 21 | MINOR — Step 7's preflight is misattributed | **RESOLVED** | `implement.md:188-189`; `design.md:203-205` | Step 7: "Copy the `node` preflight from `==> Optional bundles`, and the temp-file branch shape from `==> Skills`". `design.md:203-205` adds "not from `==> Settings` (which calls `node` directly with no preflight and degrades to a misleading drift message)." Verified: the preflight (`command -v node`) is at `scripts/doctor.sh:62`; the `==> Settings` section calls `node` unguarded. |

---

## New findings

### MAJOR

- **`prd.md:29` contradicts `prd.md:21-23` inside the same section.** `prd.md:29`
  still asserts "All of them are passing mentions." while the bullet two lines above
  says "**The gap is discoverability, not absence.** `.trellis/spec/config/pi-resources.md`
  already documents invocation for several packages — `/lens-map` (`:64-80`),
  `/tps`, `/mcp setup`". The blanket sentence is exactly the premise finding 11(b)
  was raised against, and the revision left it in place while adding its refutation
  above it. Verified: `pi-resources.md:58` gives `/mcp` + `/mcp setup`, `:59`
  `/lens-map`, `:60` `/tps`, `:62` `/i-have-adhd` + `/skill:i-have-adhd`, and
  `:64-80` *explains* `/mcp setup` and the `/tps` persistence path. An implementer
  reading only the lower bullet can still conclude that `docs/` is the first place
  any invocation appears, which is the framing the fix was meant to remove.
  Fix: delete or qualify the last sentence ("the passing mentions are in
  `README.md`; the spec tree documents the four packages noted above").

### MINOR

- **`design.md:193` cites a line that is not a `warn`.** "The `warn` at
  `scripts/doctor.sh:88-89` predates this check". `scripts/doctor.sh:88-89` is
  `elif [ -L "$dst" ]; then` / `bad "$name -> $(readlink "$dst")  (points elsewhere)"`
  — a `bad` in the *Symlinked resources* section. The `warn "node unavailable or
  optional/ missing"` the sentence means is at `scripts/doctor.sh:76`, inside
  `==> Optional bundles` (`:61-77`). The claim is right, the citation is wrong, and
  it is inherited from `artifact-review.md:171` rather than re-measured.
- **The sub-doc volume is understated and the "only two packages" clause is false.**
  `design.md:118` / `prd.md:34-35` say "65 files / 14,680 lines". Measured
  recursively (`.md` only) under the five core packages that ship `docs/`:
  `pi-lens/docs` 38 / 7,640, `pi-subagents/docs` 10 / 3,623,
  `@gotgenes/pi-permission-system/docs` 17 / 3,638, `rpiv-todo/docs` 3 / 391,
  `rpiv-ask-user-question/docs` 5 / 543 → **73 files / 15,835 lines**. The 65/14,680
  figure reproduces the first review's inconsistent tally (it counted 3 directories
  in `pi-permission-system/docs` as "files" and omitted their 11 nested `.md` files).
  Consequently `implement.md:69` "these are the only two packages with large sub-doc
  trees" is wrong: `@gotgenes/pi-permission-system/docs` is 17 files / 3,638 lines,
  comparable to `pi-subagents/docs` at 3,623. The source table does route the
  implementer to `pi-permission-system/docs/configuration.md`, so the practical
  instruction is fine; only the asserted numbers are off.
- **`implement.jsonl`'s reason for `pi-resources.md` misstates the check's inputs.**
  The reason says "its packages and skills.json sections are the id source of truth
  the coverage check reads". The check reads `packages` in
  `pi-agent/settings.core.json` and `name` in the repo-root `skills.json`
  (`design.md:157-158`, `implement.md:184-186`, `prd.md:91-95`). `pi-resources.md` is
  a *documentation* site that must be reconciled, never a check input. A check agent
  following this reason will look in the wrong file.
- **`prd.md` R4 and `design.md` disagree on whether the "when" line is required.**
  `prd.md:53-54` "Every entry states, in this order: what it is (one line), **when to
  reach for it**, the exact invocation surface …, and where its config lives".
  `design.md:85-86` "`**Reach for it when.**` and `**Gotcha.**` are optional". The
  design is the operative writer contract and Step 1's shape (`implement.md:89`) lists
  `Reach for it when`, so entries will contain it in practice — but a checker reading
  R4 literally can fail an entry the design explicitly permits.
- **`prd.md:22`'s inline citation is attached to the wrong token.** "`/lens-map`
  (`:64-80`)" — `/lens-map` appears at `pi-resources.md:59`; `:64-80` is the prose
  covering `/mcp setup` and the `pi-lens`/`pi-tps-status` config roots. Harmless, but
  it is a citation a reader will try to follow.
- **The R6 "one field" claim is narrower than what the files will contain, and the
  design marks the other file "unchanged".** `prd.md:66-68` says "The **one** field
  that necessarily appears in both `docs/` and `pi-resources.md` is the config
  location and surface". But `design.md:53` budgets `pi-resources.md` as
  "unchanged, plus a cross-link", and its inventory "What it adds" column already
  carries invocation tokens for at least five packages (`pi-resources.md:58-62`:
  `/mcp`, `/mcp setup`, `/lens-map`, `/tps`, `/i-have-adhd`, `/skill:i-have-adhd`)
  that `docs/plugins.md`'s `**Invoke.**` lines will repeat. So on delivery the overlap
  is two fields, not one, and the review's proposed "drop the invocation token column
  in favour of a link" was not adopted. Relatedly, `implement.md:221-223` adds the
  coverage-check contract to `pi-resources.md`, which is more than the doc map's
  "plus a cross-link". Either narrow R6's wording or say the inventory's token column
  becomes a link.
- **Step 9's proposed Installed-skills row drops a currently-listed site.** The
  existing row at `change-propagation-guide.md:77` is "`skills.json`, `README.md`
  "Currently installed", `~/.agents/.pi-setup-skills.json` (generated)".
  `implement.md:236-237` lists only "`skills.json`, `README.md` "Currently installed",
  `docs/skills.md` entry, `.trellis/spec/config/pi-resources.md` `skills.json`
  section" — the generated provenance file is gone. The step does say "extend the two
  existing rows", but the bullet reads as the replacement text, and nothing tells the
  implementer to keep the fourth site.
- **Two ACs are still not mechanically checkable, and AC 13's grep does not test what
  it names.** `prd.md:96-98` (AC 3: prompt form "confirmed against the generated
  extension", evidence in check-notes) and `prd.md:117-118` (AC 12: `docs/*.md`
  "states no per-machine ignore/symlink rule of its own") have no runnable command.
  `prd.md:119-121` (AC 13) greps for the literal `check-docs.mjs` in
  `.trellis/spec/scripts/index.md`, but the registry line there is brace-style
  (`scripts/{render-settings,sync-settings,install-skills}.mjs`,
  `scripts/index.md:14`), so a correct brace-style edit
  (`…,install-skills,check-docs}.mjs`) would not match; the AC actually passes only
  because Step 9 also adds a quality-check line. The registry bullet itself stays
  unverified.

---

## Left-open items

**Prompt namespace conflict (`/trellis-start` vs `/trellis:start`) — handled
acceptably.** The plan no longer chooses a spelling: `prd.md:48-52` R3 requires "the
form the generated extension actually registers, not the form this repo's prose
happens to use"; `implement.md:132-136` requires reading the generated extension,
recording the confirmed form *and* the conflicting source in
`research/check-notes.md`, and forbids guessing; `design.md:135-140` records both
spellings; `prd.md:96-98` makes the record an AC; `implement.md:283-285` has a
Stop-And-Report entry if the form cannot be confirmed. Residual, not a gap: the only
in-extensions evidence is a UI notify string, not a registration call
(`.pi/extensions/trellis/index.ts:2085-2088`: `ctx?.ui?.notify?.("… Use
/trellis-start to bootstrap or /trellis-continue to resume.")`). `design.md:111`
names the prompt filenames as the second signal but Step 3's confirm instruction does
not; naming both would make the confirmation stronger.

**pi-lens heading-normalisation risk — handled as an accepted, evidence-backed risk,
but the unverifiable part is not recorded as a gap.** `design.md:160-165` states the
contract and its evidence ("commit `b91810a` re-spaced Markdown table separators
across the spec tree and left every heading line untouched"); `design.md:95-97` and
`implement.md:22-24` add the fence rule; `prd.md:129-131` puts the pi-lens constraint
in Constraints; `design.md:243-247` lists "Heading convention drift" as an open risk.
What is *not* carried forward is the first review's honest caveat that prettier is
config-gated and no one can prove a future pi-lens release will not normalise
headings — the Open Risks entry covers a human writing `##`, not pi-lens rewriting
`###`. This is an accepted risk with a documented failure mode (zero headings → `bad`),
not a silent one, so it does not block implementation; a one-line "if pi-lens ever
normalises headings the check fails loudly rather than silently" would close it.

---

## Ready to implement

The single most likely thing to go wrong is **R5 accuracy in the plugin entries**.
The coverage check only proves *membership* (`design.md:157-158`), the entry field
contract is prose-enforced, and AC 5 (`prd.md:102-104`) spot-checks only 3 of the ~19
invocation claims across 12 packages sourced from ~18k lines. The tempting shortcut
is `pi-resources.md` itself: it is authoritative-looking, already carries the exact
tokens (`/mcp`, `/lens-map`, `/tps`, `/i-have-adhd`), and is one file instead of 14 —
so an implementer under budget pressure will copy invocation tokens from a *repo
document* rather than from the installed source the plan requires, satisfying neither
R5 ("copied from the installed package source") nor R6 (it re-creates the duplication
the BLOCKER was about), while every mechanical gate still passes. The runner-up is the
R6 boundary itself (NF7): even a careful implementer ships two overlapping inventories
because `design.md:53` says `pi-resources.md` stays "unchanged".

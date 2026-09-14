# Final review — the whole change (implement.md Step 10 review gate)

Independent verification of every acceptance criterion, the two executable
artifacts, all five failure-mode proofs (re-derived on my own fixture), the spec
propagation sweeps, and the round-1 docs fixes.

Constraints I worked under, as instructed: no edit to anything but this file;
`./setup.sh` and `./scripts/sync.sh` were **not** re-run (so AC 9 and the
`setup.sh` half of AC 10 rest on source inspection plus the parent's recorded
runs); no `git add`/`commit`/`checkout`/`stash`; the other two in-flight tasks
(`09-14-codegraph-mcp-install`, `09-14-omp-agent-hub-port`) are judged only where
this task's own claims depend on them, never as defects of this task.

## Verdict

**READY WITH FIXES** — the repo deliverables (`docs/`, `scripts/check-docs.mjs`,
the `doctor.sh` section, the `README.md` links, the six spec files) are correct,
verified end to end, and commit-ready; the four MINOR findings are two wrong
evidence line numbers and one stale scope sentence in the task-local
`research/check-notes.md`, plus one surface-vocabulary word in `docs/agents.md`,
none of which changes a single stated fact.

## Acceptance criteria audit

Every command below was run in this session against the working tree.

| # | Criterion | Command | Real output | Ruling |
| - | --------- | ------- | ----------- | ------ |
| 1 | `docs/plugins.md`: one entry per `settings.core.json` package, zero extras, pointer sections not read as entries | `grep -c '^### ' docs/plugins.md` + extractor vs `packages` + `grep -n '^## ' docs/plugins.md` | `12`; ids set-equal to all 12 spec strings, `missing: []`, `stray: []`, `dupes: []`; pointer headings `146:## Enabled-only bundles`, `156:## Hand-placed extensions` | **MET** |
| 2 | `docs/skills.md`: one entry per `skills.json` name; each states model-invocation status | extractor vs `skills.json` + read all six `**Invoke.**` lines | `6`; ids set-equal, `missing: []`, `stray: []`; `grill-me` and `improve-codebase-architecture` say "may not reach for this one" (`disable-model-invocation: true`), the other four say "may also reach for it automatically" | **MET** |
| 3 | `docs/agents.md` covers 3 agents + 3 prompts; prompt form confirmed against the generated extension; evidence in `check-notes.md` | `ls .pi/prompts/` (3 files), `sed -n '1,6p' .pi/agents/*.md`, `grep -n 'trellis-start' .pi/extensions/trellis/index.ts`; read `check-notes.md` §2 | prompt files are `trellis-{start,continue,finish-work}.md`; extension `index.ts:2088` notify string uses the hyphen form; check-notes §2 records three signals plus the conflicting `AGENTS.md:13` / `.trellis/workflow.md:239` spelling | **MET** |
| 4 | Label contract: `What it is` / `Reach for it when` / `Invoke` present and ordered; counts 12/6/6 and 12 | `grep -c '^\*\*Invoke\.\*\*' docs/{plugins,skills,agents}.md`; `grep -c '^\*\*What it is\.\*\*' docs/plugins.md`; order walker over all entries | `12 / 6 / 6`; `12`; every entry reads `What it is > Reach for it when > Invoke > Config [> Gotcha]` (12 + 6 + 6 entries, zero order violations) | **MET** |
| 5 | One `claim → source file:line` row per `**Invoke.**` surface (12+, not a sample) | read `check-notes.md` §1 and spot-open ~30 cited lines in the installed copies | 41 plugin rows + 10 skill rows + 9 agent rows = 60 (numbered 1–60, no gaps); 30 opened: 28 exact, pair 25 and pair 27 line-number-wrong (content right — see Findings) | **MET** (evidence content correct; two citations need the line numbers fixed) |
| 6 | 4 `doctor.sh` failure modes exit `1` naming the offending id/file, exit codes recorded | re-derived on a `mktemp` fixture — see the proof table below | missing entry `exit=1`, stray entry `exit=1`, missing file `exit=1`, `###`→`##` demotion `exit=1`; each names the id or file; check-notes §8 has the same four plus the unparseable-JSON case | **MET** |
| 7 | `./scripts/doctor.sh` exits `0`, new check reports expected counts, no new `warn` | `./scripts/doctor.sh`; `./scripts/doctor.sh \| grep -A2 'Docs coverage'` | `✓ docs cover 12 plugins and 6 skills`; `exit=0`; `No problems. 1 note(s) above.` and the single note is `! uncommitted changes:` (pre-existing dirty tree — 3 tasks in flight) | **MET** |
| 8 | `render-settings.mjs … --check` still reports no drift | `node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check` | `ok       /home/tan/.pi/agent/settings.json` / `state    optionals: opencode-go` / `exit=0` | **MET** |
| 9 | `./setup.sh` twice idempotent; `doctor.sh \| grep -A2 'Docs coverage'` shows the counts | doctor half run here; `setup.sh` **not** re-run (constraint) | doctor half: `==> Docs coverage (docs/ against what ships)` / `✓ docs cover 12 plugins and 6 skills`. `setup.sh` half: taken from the parent's recorded double run (identical output, exit 0) plus my own checks — `git check-ignore docs/plugins.md` → *not ignored*, `setup.sh` contains no `docs` reference, and doctor's symlink/render sections are green | **MET WITH CAVEAT** — the `setup.sh` half is not independently re-verified by me; no acceptance claim depends on the un-re-run half, and the docs work adds no `setup.sh` surface to break idempotency |
| 10 | `grep -rn 'docs/' scripts/lib.sh` empty; `./setup.sh` output has no `docs` line | `grep -rn 'docs/' scripts/lib.sh`; `grep -n 'docs' setup.sh`; `grep -n 'PI_DIRS\|PI_FILES' scripts/lib.sh` | both greps: no output, `exit=1`; `scripts/lib.sh:17,19` still `PI_DIRS=(themes prompts tools skills agents extensions)` / `PI_FILES=(AGENTS.md i-have-adhd.json)` | **MET** |
| 11 | `README.md` links to all three pages, every target exists | `grep -n 'docs/' README.md`; link resolver over `README.md` + the four `docs/` files | pointers at `README.md:68, 83, 100, 124-125, 303`; all targets exist; 15 relative links in README + 6/13/5/4 in the docs files, **0 broken** | **MET** |
| 12 | `grep -n 'PI_DIRS\|PI_NOT_SYNCED\|gitignore\|not stored' docs/*.md` returns nothing | same | no output, `exit=1` | **MET WITH CAVEAT** — the grep passes, but the substituted word (`untracked`, not the banned `gitignored`) means the pattern no longer proves "no per-machine rule restated". See the honesty ruling below |
| 13 | `layout-and-surfaces.md` has a `docs/` row + decision-tree step; `\| Node ESM \|` row names the helper | `grep -n 'docs/' …layout-and-surfaces.md`; `grep -n '\| Node ESM \|' .trellis/spec/scripts/index.md` | map row 33 marks `docs/` as **Tracked prose**, "read directly; never symlinked"; decision tree step 7 now routes usage docs to `docs/` and says it never enters `PI_DIRS`/`PI_FILES`; the Node ESM row at `scripts/index.md:14` lists `scripts/{render-settings,sync-settings,install-skills,register-mcp-server,check-docs}.mjs` with role "… docs coverage check" | **MET** (the decision-tree site is a rewritten existing step 7, not a newly numbered step — the AC says "a step", and step 7 is where "is it an explanation?" is answered) |

### The AC 12 substitution — honest disclosure, or rationalisation?

Honest, and I judge it on the substance rather than on the record's own claim.
`docs/agents.md:5-8` states the fact plainly ("Both sets are **generated by the
`trellis` CLI** … which this repository does not track, and `trellis update` owns
them"), `docs/plugins.md:108` and `docs/skills.md:92` say "untracked". The R6
question — does `docs/` restate a per-machine rule that `README.md` or
`spec/config/` owns? — is answered no by reading: the only per-machine statements
are the required config location + surface lines, which R4 mandates and R6
explicitly permits. Nothing is concealed: `prd.md`'s review record and
`check-notes.md` §6 and §10 all disclose the word change and admit the grep is no
longer load-bearing. That is the correct handling of a criterion the
implementation legitimately outgrew.

Two rider notes, neither a defect: (a) `ignored` was never a banned token — only
`gitignore` is — so the substitution was not strictly forced by AC 12; and
(b) the AC as written cannot be repaired without editing `prd.md`, so the honest
record in the Review Record is the right place for it.

## Node helper review

`scripts/check-docs.mjs` judged against `.trellis/spec/scripts/node-guidelines.md`.

| Rule | Result | Evidence |
| ---- | ------ | -------- |
| ESM `.mjs`, `node:`-prefixed builtins only, zero dependencies | pass | `:35-36` `import fs from "node:fs"; import path from "node:path";` — no other import, no `package.json` touched |
| Synchronous I/O only | pass | `readFileSync`, `existsSync`; `grep -n 'await\|Promise\|async' scripts/check-docs.mjs` → nothing |
| Header comment is a contract document (exact invocation line, every flag, exit codes) | pass | `:6` `node check-docs.mjs <repo>`; `:9` Positional; `:11-12` exit codes 0/1/2; `:14-15` streams; `:17-31` heading convention, fence rule, id source of truth. No flags exist, so none to document |
| Positional args first, flags after | pass | `:38` `const [repoRoot] = process.argv.slice(2);` — one positional, no flag parsing (none needed) |
| Missing positional → usage on stderr, exit `2` | pass | `node scripts/check-docs.mjs` → stderr `usage: check-docs.mjs <repo>`, `exit=2` |
| Exit `1` on any problem, `0` on success | pass | `exit=0` on the real tree; every fixture failure below `exit=1` |
| Two-space / 9-column verb format | pass | `ok       docs cover 12 plugins and 6 skills`; problem lines `missing  …`, `error    …` — 9 columns in every case |
| Canonical verbs only | pass | `ok`, `error`, `missing` — all three are in `node-guidelines.md`'s canonical list |
| Diagnostics on `console.error`, progress on `console.log`, nothing machine-parseable on stdout | pass | `grep -n 'console\.' scripts/check-docs.mjs` → one `console.log` (the success line) and three `console.error`; `node scripts/check-docs.mjs . 2>/dev/null` still prints the counts, so the split is real |
| `path.join` rooted at the argv `repoRoot`; never `process.cwd()` / `import.meta.url` | pass | `:42` `const root = path.resolve(repoRoot);`, then `path.join(root, relPath)` at `:49`, `:61`; `grep -n 'cwd\|import.meta' scripts/check-docs.mjs` → nothing |
| No write anywhere | pass | no `writeFileSync`/`mkdirSync`/`rmSync`; `--check`-style purity holds by construction (read-only helper) |
| Failure collection: accumulate, report all, exit once; never throw out of the loop | pass | `problems[]` + `readJson` try/catch (`:47-56`); the per-file walk cannot throw; one exit at `:138` |
| No fifth verb-format variant / no unknown-flag rejection | pass | format matches; extra argv is ignored by the positional slice, as the contract allows |

No node-guidelines rule is broken.

## doctor.sh review

Only the `==> Docs coverage` block (`scripts/doctor.sh:269-283`) is this task's.

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `set -uo pipefail` without `-e` preserved | pass | `scripts/doctor.sh:4` unchanged; the section adds no `set` |
| No early `exit` | pass | the only `exit`s in the file are `:43` (pre-existing missing-`lib.sh` guard) and `:292` (the final `N problem(s)` exit); the docs section has none |
| Uses `ok`/`bad` with the counters | pass | `bad` on node-missing, `bad "docs/ is missing"`, `bad "docs/ coverage does not match the shipped set:"`, `ok "$(sed …)"`; no bare `echo`, no new `warn` |
| Temp file `/tmp/pi-<purpose>.$$` + `rm -f` after the branch on every path | pass | `>/tmp/pi-doctor-docs.$$ 2>&1` at `:277`; `rm -f /tmp/pi-doctor-docs.$$` at `:283` is a top-level statement after the whole `if/elif/elif/else`, so it runs on success, mismatch, missing-docs, and node-missing alike |
| `node` preflight present; absence is `bad`, not `warn` | pass, and the right call | `:270-275`; `==> Optional bundles` uses `warn` for a listing convenience, whereas this check is the only guard on a tracked document, `node` is already a hard dependency of `==> Settings`/`==> Skills`, and `design.md`'s argument is recorded in the section comment. A silent pass here would be the worse failure |
| Adds **no new `warn`** on a healthy tree | pass | real run: the only `!` is the pre-existing `uncommitted changes:` note; `No problems. 1 note(s) above.`, `exit=0` |
| Reports the helper's counts rather than hard-coding 12/6 | pass | `ok "$(sed 's/^ *ok *//' /tmp/pi-doctor-docs.$$)"` — the counts come from the helper's stdout; `grep -n '12\| 6' scripts/doctor.sh` matches no docs line |
| `bash -n scripts/doctor.sh` | pass | `bash -n OK` |
| Failure branch names the offender and indents it | pass | fixture run: `✗ docs/ coverage does not match the shipped set:` then (6-space indented) `missing  docs/plugins.md has no entry for npm:pi-timer` / `error    docs coverage has 1 problem` — the `2>&1` capture is what makes the stderr ids visible |

## Failure-mode proofs, re-derived

My fixture: `mktemp -d` with `pi-agent/settings.core.json`, `skills.json`, and
copies of the four `docs/*.md`; the real `docs/` was never touched. Commands:
`node scripts/check-docs.mjs "$FIX"`, then `./scripts/doctor.sh` inside a copied
repo tree for the two `doctor.sh` branch proofs.

| Case | Exit | Output | §8 agreement |
| ---- | ---- | ------ | ------------ |
| baseline | `0` | `ok       docs cover 12 plugins and 6 skills` | agrees |
| 1 missing entry (id renamed) | `1` | `missing  docs/plugins.md has no entry for npm:pi-timer` + `error    docs/plugins.md documents npm:pi-timer-renamed, which settings.core.json does not ship` + `error    docs coverage has 2 problems` | agrees in substance (§8 dropped the block, so it saw the 1-problem form) |
| 2 stray entry (`npm:not-a-real-package`) | `1` | `error    docs/plugins.md documents npm:not-a-real-package, which settings.core.json does not ship` + `1 problem` | agrees |
| 3 `docs/skills.md` missing | `1` | `missing  docs/skills.md does not exist` + six `missing … has no entry for <skill>` + `error    docs coverage has 7 problems` | agrees, exactly |
| 4 heading demoted `###`→`##` (one entry) | `1` | `missing  docs/plugins.md has no entry for npm:pi-timer` + `1 problem` | agrees |
| 4b all headings demoted | `1` | `error    docs/plugins.md has no entry headings (formatting drift, or the file was emptied)` + 12 missing-entry lines + `13 problems` | new case, correct |
| 5 unparseable `settings.core.json` | `1` | `error    pi-agent/settings.core.json is unreadable or unparseable: Unterminated string in JSON at position 7 (line 1 column 8)` | agrees |
| 6 `docs/plugins.md` exists but is **empty** (not in §8) | `1` | `error    docs/plugins.md has no entry headings (formatting drift, or the file was emptied)` + 12 missing-entry lines + `13 problems` | correct — the emptied-file guard fires, it is not reported as "missing file" and never as a silent `ok` |
| 7 duplicate entry (not in §8) | `1` | `error    docs/plugins.md documents npm:pi-lens more than once` | correct, and matches the fail-loud row in `pi-resources.md` |
| 8 example heading inside a ```` ``` ```` fence (not in §8) | `0` | `ok docs cover 12 plugins and 6 skills` (the 13th heading is not counted) | correct — the fence rule really is applied |
| 9 unparseable `skills.json` (not in §8) | `1` | `error    skills.json is unreadable or unparseable: Unexpected end of JSON input` | correct |
| usage, no argument | `2` | stderr `usage: check-docs.mjs <repo>` | agrees |

`doctor.sh` branch proofs (copied repo tree, so the real `docs/` stayed intact):

- one heading demoted → `✗ docs/ coverage does not match the shipped set:` + indented `missing  docs/plugins.md has no entry for npm:pi-timer`;
- `docs/` moved aside → `✗ docs/ is missing` (the `[ ! -d ]` guard), and neither case printed `ok`.

**No disagreement with §8.** Every one of the five recorded proofs reproduces,
and the four extra cases (§8 has none of them) also fail loudly and correctly.

## Spec propagation audit

Sweeps run (change-propagation guide Step 0 shape, minus `.trellis/tasks` and
the vendored `.trellis/scripts`):

```bash
grep -rn "docs/plugins.md\|docs/skills.md\|docs/agents.md\|check-docs" --include='*.md' --include='*.sh' --include='*.mjs' --include='*.json' .
grep -rn 'install-skills.mjs' --include='*.md' .          # the other helpers' site list
grep -rn 'doctor.sh' .trellis/spec/                        # every place the checker is named
grep -rn 'mjs' .trellis/spec/guides/*.md
grep -n 'docs/' README.md
```

Sites checked and the ruling on each:

| Site | Ruling |
| ---- | ------ |
| `.trellis/spec/config/index.md` | Updated (Quality Check line + link to the contract). The "Four surfaces" overview correctly does **not** gain `docs/` — it is not a config file, and the map already carries extra non-surface values. No further edit needed |
| `.trellis/spec/config/layout-and-surfaces.md` | Map row + step 7 done. No `PI_DIRS`/`PI_FILES` entry added (correct, R10) |
| `.trellis/spec/config/pi-resources.md` | Ownership split + coverage-check contract + `skills.json` cross-link done; the contract text matches the helper and `doctor.sh` behaviour (section 7 verdict below) |
| `.trellis/spec/config/optional-bundles.md` | Checked: it does **not** claim to be the complete list of config surfaces, and it names no helper/script list that `docs/` or `check-docs.mjs` changes. No edit needed |
| `.trellis/spec/scripts/index.md` | `\| Node ESM \|` row names `check-docs`; Quality Check line added for exit 0 / exit 2. No other enumeration of helpers exists there (no `.mjs` count sentence) |
| `.trellis/spec/scripts/node-guidelines.md` | Checked: no helper inventory and no verb-format table entry that a new flag-less helper changes. No edit needed |
| `.trellis/spec/scripts/shell-guidelines.md` | Checked: it enumerates no `doctor.sh` sections, and its Failure Policy table is illustrative ("intentional in each case"), not exhaustive — a new `bad` check needs no row there. The `bad`-vs-`warn` reasoning for this check is recorded in `doctor.sh` itself and in `pi-resources.md`. No verbatim `doctor.sh` snippet needed resyncing (none of the quoted blocks were touched) |
| `.trellis/spec/index.md` | Helper count sentence and the "One Rule To Internalize" copy-list both updated. The Quality Check block runs `doctor.sh`, which now runs the checker — no separate line needed |
| `.trellis/spec/guides/change-propagation-guide.md` | Plugin-list and Installed-skills rows both extended and both name the `docs/` entry **and** `check-docs.mjs` **and** the `pi-resources.md` section. Other rows: "a user-facing string" is generic and the new strings (`docs coverage has N problems`) are covered by "Output verb vocabulary"; "the name of a script or path" is generic and `scripts/check-docs.mjs` is named in `README.md`, `doctor.sh`, and three specs. No row is left stale **by this task** |
| `README.md` | Layout table row, plugin-table pointer, skills pointer, role-agent pointer, `check-docs.mjs` script row, and the `doctor.sh` row all present. The "not stored here" table correctly gains nothing (`docs/` is tracked) |
| `docs/README.md` | States the convention, the legend, and the ownership split; links to `README.md`, `pi-resources.md`, and `spec/config/index.md`. It is the user-facing half of the parser contract and it matches the helper |

**No site missed by this change.** The one stale multi-site fact I did find —
`change-propagation-guide.md:80` still says "all four shell scripts" for
destination defaults, and `install-mcp.sh` makes five — is the MCP task's
omission, not this task's (this task neither adds a shell script nor changes a
destination default), so it is listed under residual risks rather than as a
finding here.

## Findings

### BLOCKER

None.

### MAJOR

None.

### MINOR

**m1 — `research/check-notes.md` pair 25 cites the wrong line (content correct).**
`check-notes.md:44` claims `/auto-compact-config` needs TUI mode and cites
`@thunstack/auto-compact/README.md:81` for the sentence `The settings command
requires TUI mode.` That sentence is at `:51`; `:81` is a different sentence
("Use `/auto-compact-config` instead of editing the file when TUI mode is
available…"). Why it matters: R5's evidence file is the only proof for the
invocation tokens, and a wrong line is what a future verifier opens. Smallest
fix: change `:81` to `:51` in that row.

**m2 — `research/check-notes.md` pair 27 is off by one line.** Pair 27 quotes
`name: "mcpScript",` and cites `pi-mcp-adapter/index.ts:1125`; the quoted text is
at `:1126` (`:1125` is the `registerTool` call it belongs to). Same class as the
three drifts round 1 already fixed; the fix is `:1125` → `:1126`.

**m3 — `research/check-notes.md`'s scope sentence contradicts §8.**
`check-notes.md:9-10` says "Scope: `implement.md` Steps 1–4 only. The four
`doctor.sh` failure-mode proofs belong to Step 8 and are **not** in this file",
but §8 in the same file is exactly those proofs (plus the fifth unparseable-JSON
case), and the title on `:1` says "Steps 1–9". Why it matters: AC 3, AC 5 and AC 6
all point at this file, so a reader trusting its header would conclude the Step 8
evidence is missing. Smallest fix: replace `:9-10` with "Scope: `implement.md`
Steps 1–4, plus the Step 6–8 `doctor.sh` proofs in §8 and the Step 9 spec edits in
§9."

**m4 — `docs/agents.md` names a surface the spec vocabulary does not contain, for
a path the spec classifies differently.** `layout-and-surfaces.md:32` classifies
`.pi/`, `.agents/` as **Ignored** (Trellis-generated adapters). The six
`**Config.**` lines in `docs/agents.md` (`:22, 32, 42, 52, 62, 72`) say "generated
under the **untracked** `.pi/agents/`" / "`.pi/prompts/`", and `docs/README.md`'s
legend defines only the four terms tracked / symlinked / generated / ignored, with
`generated` meaning "rendered per machine from tracked inputs by `./setup.sh` or
`scripts/sync.sh`" — which is not what produces `.pi/`. Why it matters: R4 asks for
the surface "per `spec/config/index.md`", and the words used here match neither
that file's meaning of `generated` nor its term for this path. Smallest fix: use
the spec's own term, e.g. `**Config.** None — ignored;`.pi/agents/` is
Trellis-generated and `trellis update`owns it.` (`ignored` is not one of AC 12's
banned substrings, so the grep stays clean; nor is "tracked", in "does not track").
Tiers with nothing in them: no BLOCKER, no MAJOR, and no MINOR about ids,
membership, label counts or order, config location/surface for any of the 24
entries outside `agents.md`, heading/pointer levels, fenced-block safety, link
resolution, the helper's contract, or the `doctor.sh` section.

## Residual risks

- **Rename inside a package stays invisible** (design's open risk, restated): the
  check proves membership only. A renamed flag in an already-listed package is
  caught by nobody.
- **`doctor.sh`'s success message is coupled to the helper's verb format.** `ok
  "$(sed 's/^ *ok *//' …)"` assumes the 9-column `ok` line; that format is
  spec'd in `node-guidelines.md`, so this is a convention coupling rather than a
  bug, but a reformat would silently degrade the label rather than fail.
- **AC 9's `setup.sh` half and AC 10's `setup.sh`-output half are not
  independently re-run in this review** (constraint, not a gap in the change);
  both were green in the parent's recorded runs, and this change adds no
  `setup.sh` input.
- **The two accepted overlaps can still drift** from `pi-resources.md`
  (config line, invocation tokens). Mitigated by the ownership statements in both
  files and the propagation-guide rows — not by a mechanism.
- **Not this task, but adjacent and live:** `change-propagation-guide.md:80`
  ("all four shell scripts") is stale now that `install-mcp.sh` exists, and the
  MCP task's committed edits in `scripts/lib.sh`, `doctor.sh`, `README.md` and
  `scripts/index.md` sit in the same uncommitted tree. Commit this task's paths
  first; do not sweep those files wholesale.

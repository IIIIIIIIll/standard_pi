# Artifact review — usage guides for shipped plugins and skills

READY WITH FIXES — the plan is implementable, but one requirements-level overlap
with an existing spec is unresolved, the extraction/doctor wiring contract has an
unstated stream detail, and the "effort" premise undercounts the source volume by
~4×.

Reviewed read-only on 2026-09-14 against this checkout (HEAD `1e45cc7`). No repo
file other than this one was written.

---

## Commands run

All commands below were run from `/home/tan/my_pi_setup` unless noted. Output is
trimmed to the lines that carry the claim.

```console
$ node -e 'const s=require("./pi-agent/settings.core.json"); console.log(s.packages.length); s.packages.forEach(p=>console.log(p))'
12
npm:pi-subagents
npm:pi-web-access
npm:@juicesharp/rpiv-ask-user-question
npm:@juicesharp/rpiv-todo
npm:@gotgenes/pi-permission-system
npm:@sting8k/pi-vcc
npm:@thunstack/auto-compact
npm:pi-mcp-adapter
npm:pi-lens
npm:pi-tps-status
npm:pi-timer
https://github.com/ayghri/i-have-adhd
# → prd Context "12 always-on packages" is correct.

$ node -e '…skills.json….skills.map(s=>s.name)'
code-review, grill-me, grilling, improve-codebase-architecture, research, tdd   # 6, correct

$ for p in <11 npm pkgs>; do wc -l ~/.pi/agent/npm/node_modules/$p/README.md; ls $p/docs; done
DIR-OK for all 11. README lines: pi-subagents 127, pi-web-access 1010,
permission-system 241, rpiv-todo 122, rpiv-ask-user-question 94, pi-vcc 186,
auto-compact 119, pi-mcp-adapter 905, pi-lens 359, pi-tps-status 146, pi-timer 59
pi-subagents/docs 10 files 3623 lines
permission-system/docs 9 files 2483 lines
rpiv-todo/docs 3 files 391 lines
rpiv-ask-user-question/docs 5 files 543 lines
pi-lens/docs 38 files 7640 lines
pi-mcp-adapter: NO docs/ directory
pi-web-access, pi-vcc, auto-compact, pi-tps-status, pi-timer: NO docs/
# → design's 1010/905/359 are exact; "pi-lens + ~20 docs" is wrong (38 files);
#   implement.md's "pi-mcp-adapter/README.md + docs/" does not resolve.

$ ls ~/.pi/agent/git/github.com/ayghri/i-have-adhd/ ; wc -l README.md INSTALL.md AGENTS.md
dir exists; 104 / 898 / 72

$ for s in <6 skills>; do test -f ~/.agents/skills/$s/SKILL.md; done
all 6 present (87/7/28/71/12/38 lines). Frontmatter: grill-me and
improve-codebase-architecture carry `disable-model-invocation: true`.

$ test -f .pi/agents/trellis-{implement,check,research}.md ; test -f .pi/prompts/trellis-{start,continue,finish-work}.md
all 6 present.

$ git ls-files | grep -E '^\.(pi|agents)/'
(empty)
$ git check-ignore -v .pi/agents/trellis-check.md .agents/skills/tdd/SKILL.md
.gitignore:56:.pi/	.pi/agents/trellis-check.md
.gitignore:57:.agents/	.agents/skills/tdd/SKILL.md
# → prd Context "gitignored, zero git ls-files entries" is correct.

$ git check-ignore -v docs/plugins.md ; echo $?
(no output) ; 1        # docs/ is not ignored anywhere → .gitignore needs no change.

$ grep -rn 'docs/' scripts/lib.sh ; echo $?
(empty) ; 1            # trivially true; lib.sh entries are pi-agent/<name> names.

$ node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check
  ok       /home/tan/.pi/agent/settings.json
  state    optionals: opencode-go
exit=0               # the AC's render command runs as written.

$ ./scripts/doctor.sh ; echo exit=$?
==> Repo
  ! uncommitted changes:
      ?? .trellis/tasks/09-14-usage-guides-plugins-skills/
… ==> Skills  (/home/tan/.agents/skills)
  ✓ 6 skill(s) installed from upstream
No problems. 1 note(s) above.
exit=0
# → on a dirty tree doctor.sh prints "No problems. 1 note(s) above.", never "All good.".

$ cat .trellis/spec/config/pi-resources.md | sed -n '47,126p'
### The package inventory   (table of all 12 packages + per-package prose)
$ sed -n '83,86p' .trellis/spec/config/layout-and-surfaces.md
7. **Is it an explanation of any of the above?** → `README.md` … `optional/<name>/README.md` … or this spec tree
$ sed -n '408,409p' .trellis/spec/scripts/shell-guidelines.md
- **Do not parse JSON in bash.** No `jq` is available; use a `node -e` one-liner
  for a single field, or an `.mjs` helper for anything structural.
$ grep -n 'Node ESM' .trellis/spec/scripts/index.md
14:| Node ESM | `scripts/{render-settings,sync-settings,install-skills}.mjs` | …
$ grep -n 'three dependency-free' .trellis/spec/index.md
15:- three dependency-free Node ESM helpers that do the JSON work
$ grep -n 'Plugin list\|Installed skills' .trellis/spec/guides/change-propagation-guide.md
75:| Plugin list | `settings.core.json` `packages`, `README.md` plugin table, the owning `optional/*/manifest.json` | …
77:| Installed skills | `skills.json`, `README.md` "Currently installed", `~/.agents/.pi-setup-skills.json` (generated) | …
$ sed -n '224,230p' scripts/doctor.sh
  if node "$REPO_DIR/scripts/install-skills.mjs" "$REPO_DIR" --check >/tmp/pi-doctor-skills.$$ 2>&1; then
  rm -f /tmp/pi-doctor-skills.$$
```

README slash-command measurement (from `grep -rnoE '`/…`' --include='*.md'`):
`README.md` has **10 distinct** backticked slash commands (`/reload`,
`/auto-compact-config`, `/auto-compact`, `/mcp`, `/lens-map`, `/tps`,
`/i-have-adhd`, `/skill:i-have-adhd`, `/go-status`, `/go-usage`) in 11 mentions.
Across tracked docs the tally is ≥17 mentions / ≥13 distinct, and
`.trellis/spec/config/pi-resources.md:64-80` *explains* `/mcp setup` and where
`/tps` persists rather than passing over them.

README prose audit (`grep -n <pkg> README.md` minus table rows):
`pi-vcc` 114-132, `auto-compact` 114-131, `i-have-adhd` 135-147, `pi-subagents`
109 (one paragraph + link into `pi-agent/extensions/README.md`). `permission-system`
has **no** README prose — only a table cell linking to
`pi-agent/extensions/README.md#permission-policy`.

---

## Findings

### BLOCKER

- **`docs/plugins.md` duplicates `.trellis/spec/config/pi-resources.md`, and `design.md` never mentions it** — evidence: `pi-resources.md:47-126` already ships a "The package inventory" table naming all 12 packages with "What it adds" *and* invocation/behaviour tokens (`/reload`, `/mcp`, `/mcp setup`, `/lens-map`, `/tps`, `/i-have-adhd`, `/skill:i-have-adhd`), then per-package prose at lines 64-125 covering pi-lens (`~/.pi-lens/`, `PI_LENS_DISABLE_*`), pi-tps-status (`$XDG_CONFIG_HOME/pi-tps-status/config.json`), pi-timer ("no config file"), pi-web-access (`web-search.json`), i-have-adhd; `design.md` has no row for that file in its doc map and its R6 paragraph only names `README.md` and `.trellis/spec/config/` generically. Why it matters: `prd.md` R6 says `docs/` must link to `.trellis/spec/config/` instead of restating it, while R4 *requires* every entry to state its config location **and surface** — those already live in `pi-resources.md`, so implementing as written produces a second 12-package inventory that must be hand-synced forever and that a reviewer can flag as an R6 violation. Proposed fix: `design.md` must add `pi-resources.md` to the doc map and state the division explicitly — `docs/plugins.md` owns *daily-use invocation* (what to type, when to reach), `pi-resources.md` owns *why it is core + the config-surface rules*, and the inventory table drops its invocation token column in favour of a link; `implement.md` Step 9 needs a reconciliation sub-step for `pi-resources.md:47-125`, and the propagation row must name it.

### MAJOR

- **"the task's check notes" is referenced four times and defined nowhere** — evidence: `implement.md` Step 1 ("record the pair in the task's check notes"), Step 8 ("recorded in the check notes"), Stop And Report ("report it as a coverage gap in the check notes"), and `prd.md` AC 5 ("recorded in the task's check notes"); `.trellis/tasks/09-14-usage-guides-plugins-skills/` contains only `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, `check.jsonl`, `task.json` and has **no `research/` directory**. Why it matters: AC 5 (the only evidence for R5) cannot be satisfied or reviewed because the artifact that must hold it does not exist. Proposed fix: name the path in all four places — `research/check-notes.md` under the task dir (the `trellis-research` agent's declared output directory) — with the required content listed (3 source/claim pairs, 4 exit-code proofs, per-file id counts).

- **Source list entry that does not resolve: `pi-mcp-adapter/README.md + docs/`** — evidence: `ls ~/.pi/agent/npm/node_modules/pi-mcp-adapter/docs` → no such directory; the package ships `README.md`, `OAUTH.md`, `CHANGELOG.md` only. Why it matters: `implement.md` "Ground rules" says every entry in the source table must be read in this session, and a missing path trips the Stop-And-Report rule for no reason. Proposed fix: change the line to `pi-mcp-adapter/README.md + OAUTH.md` (the MCP auth flow is the one gotcha a daily-use entry needs).

- **Volume estimate is off by ~4× and the design uses it to justify delegation** — evidence: `design.md` says "~3400 lines of upstream README plus sub-`docs/` (`pi-web-access` 1010, `pi-mcp-adapter` 905, `pi-lens` 359 + ~20 docs)". Measured: READMEs total 3368 (correct), but sub-`docs/` total 14,680 lines across 65 files, and `pi-lens/docs` is **38** files (7640 lines), not ~20; `pi-subagents/docs` is a further 10 files (3623 lines). Why it matters: the 8-15-line entry budget and the "delegate extraction" decision are argued from this number, so an implementer expecting ~3.4k lines will either skip sources or blow the budget. Proposed fix: correct `design.md` to "~3.4k README + ~14.7k sub-doc lines", and in `implement.md` name the specific sub-docs to read per package (e.g. pi-lens `README.md` + `docs/usage.md` + `docs/tools.md`; pi-subagents `docs/agents.md` + `docs/tool-reference.md`) instead of `+ docs/*.md`.

- **Failure-path stream contract is unstated; doctor.sh will not capture the helper's diagnostics** — evidence: `implement.md` Step 7 says "run the helper to `/tmp/pi-doctor-docs.$$`; … `bad` with `sed 's/^/      /'` output on failure" with no `2>&1`, while `design.md`'s helper contract says "exit `1` and print each offending id" without naming a stream and `node-guidelines.md:148-152` mandates `console.error` for diagnostics; the existing precedent is `scripts/doctor.sh:224` (`>/tmp/pi-doctor-skills.$$ 2>&1`). Why it matters: if the helper follows the node-guidelines convention (problems on stderr) and `doctor.sh` mirrors Step 7 literally, the temp file is empty, `bad` prints with no detail, and the offending ids spray un-indented onto the terminal — the opposite of `design.md`'s "One line per problem, so doctor.sh can indent and pass it through". Proposed fix: pin both ends — helper prints the offending ids to **stdout** (one per line, per design) and doctor.sh uses `>/tmp/pi-doctor-docs.$$ 2>&1`; state it in `design.md`'s contract table and Step 7.

- **Step 9's spec-update list misses two spec files that go stale** — evidence: `grep -n 'Node ESM' .trellis/spec/scripts/index.md` → line 14 lists exactly `scripts/{render-settings,sync-settings,install-skills}.mjs`; `.trellis/spec/index.md:15` says "three dependency-free Node ESM helpers"; Step 9 names only `config/layout-and-surfaces.md`, `config/pi-resources.md`, `config/index.md`, `guides/change-propagation-guide.md`. Why it matters: a fourth `.mjs` helper that neither the scripts-layer spec nor the top-level inventory knows about is exactly the "half-applied change" the propagation guide exists to prevent. Proposed fix: add to Step 9 — `.trellis/spec/scripts/index.md` (registry row + a quality-check line to run `node scripts/check-docs.mjs .`) and `.trellis/spec/index.md` ("three → four helpers"; the "One Rule" plugin-list sentence now has a fourth copy); add both to `implement.jsonl`/`check.jsonl`.

- **The propagation row Step 9 adds is itself incomplete** — evidence: `.trellis/spec/guides/change-propagation-guide.md:75` ("Plugin list") currently names `settings.core.json packages`, `README.md` plugin table, `optional/*/manifest.json`; line 77 ("Installed skills") names `skills.json`, `README.md` "Currently installed", `~/.agents/.pi-setup-skills.json`; `implement.md` Step 9 proposes "both JSON inputs, the matching `docs/` entry, `README.md` tables". Why it matters: it drops `pi-resources.md`'s inventory (the second 12-package table), the owning `optional/*/manifest.json` for the plugin row, and the README "Currently installed" sentence for the skills row — the three sites most likely to be forgotten. Proposed fix: replace the row with the full list: for a package — `settings.core.json packages` (+ the owning `optional/*/manifest.json`), `README.md` plugin table, `docs/plugins.md` entry, `.trellis/spec/config/pi-resources.md` inventory; for a skill — `skills.json`, `README.md` "Currently installed", `docs/skills.md` entry, `.trellis/spec/config/pi-resources.md` `skills.json` section.

- **Prompt invocation form contradicts the repo's own tracked docs and is not verified** — evidence: `implement.md` Step 3 and `prd.md` AC 3 assert `/trellis-start`, `/trellis-continue`, `/trellis-finish-work`; `.trellis/workflow.md:239,250,272,672` and `AGENTS.md:13` use `/trellis:finish-work` / `/trellis:continue`; only `.pi/extensions/trellis/index.ts:2088` uses the hyphen form. Why it matters: R5 forbids guessing an invocation token, and `docs/agents.md` is a tracked page that will outlive whichever namespace is current — shipping the wrong form is a wrong-output defect that a check cannot catch. Proposed fix: add a Step 3 instruction to confirm the form from the generated prompt filenames plus `.pi/extensions/trellis/index.ts`, record the confirmed form and the conflicting source in the check notes, and (if the two namespaces are both valid per platform) state that explicitly in the entry.

- **Two of the six skills disable model invocation; the uniform `/skill:<name>` story flattens that** — evidence: `~/.agents/skills/grill-me/SKILL.md:1-7` (`disable-model-invocation: true`, body is just `Call the Skill tool with "grilling".`) and `~/.agents/skills/improve-codebase-architecture/SKILL.md:1-4` (same flag); `implement.md` Step 2 says only "invocation is the skill dispatch surface (`/skill:<name>`) plus how the model is expected to reach for it". Why it matters: for these two the honest "Reach for it when" is "only when you type it" — writing "the model reaches for it automatically" would be a fabricated claim under R5, and the grill-me→grilling redirect is the kind of real trap the entry contract's optional `Gotcha.` line exists for. Proposed fix: Step 2 must read each `SKILL.md`'s full frontmatter (not just `description`) and say for each skill whether model invocation is enabled; add `disable-model-invocation: true` to the two entries and note the redirect in grill-me's gotcha.

- **The `.agents/skills/trellis-*` pointer target is a gitignored, CLI-generated path that may not exist** — evidence: `implement.md` Step 2 points at `.agents/skills/trellis-*` and `trellis-meta/references/`; the repo-root `.agents/` is gitignored (`.gitignore:57`) and generated by the `trellis` CLI, and a fresh clone has none of it; the *installed* skills dir (`$HOME/.agents/skills/`) contains only the six mattpocock skills — no `trellis-*`. Why it matters: a tracked page linking to an ignored path that a fresh clone does not have is a link the ACs never test, and `prd.md` Out-Of-Scope calls the set `trellis-meta`'s references while the design's source table says skills live under `<AGENTS_SKILLS_DIR>`, so the two artifacts disagree about which directory is meant. Proposed fix: state the absolute, always-present anchor (`.trellis/workflow.md` / `AGENTS.md`) as the pointer, and treat `trellis-meta/references/` as "present after `trellis init`" rather than a required link target.

- **`prd.md` Context counts are wrong in two places** — evidence: (a) "only 4 packages (`auto-compact`, `pi-vcc`, `i-have-adhd`, `pi-permission-system`) get prose" — `pi-permission-system` has no README prose at all (only `README.md:98`, a table cell linking into `pi-agent/extensions/README.md#permission-policy`), while `pi-subagents` does get a paragraph at `README.md:109`; (b) "All 10 slash-command mentions across every doc are passing mentions" — 10 is exactly `README.md`'s distinct backticked commands, but across tracked docs the tally is ≥17 mentions / ≥13 distinct, and `pi-resources.md:64-80` *explains* `/mcp setup` and `/tps`. Why it matters: premise (b) is the whole justification for the task ("a reader can see that `pi-lens` exists but not what to type") and it is false for the four packages the spec tree already documents — a reader who finds `pi-resources.md` does get `/lens-map`, `/tps`, `/mcp setup`; the real gap is discoverability from `README.md`, which changes the framing and strengthens the BLOCKER above. Proposed fix: correct both sentences — prose table 3 clear + 2 partial, and state the real gap as "the spec tree documents invocation, `README.md` does not; `docs/` is the front-door daily-use copy".

- **Step 10's clean-path expectation cannot hold at Step 10** — evidence: `implement.md` Step 10 runs `./scripts/doctor.sh # All good.` with every new tracked file still uncommitted; my run of `./scripts/doctor.sh` on the current dirty tree prints `No problems. 1 note(s) above.` (the `==> Repo` "uncommitted changes" note) and only prints `All good.` when `problems == 0 && notes == 0` (`scripts/doctor.sh:242-248`). Why it matters: an implementer following Step 10 literally would see a mismatch and might "fix" the check or the note counting. Proposed fix: reorder Step 10 to commit first, or change the comment to `# No problems. (notes only, uncommitted changes)` and move the `All good.` expectation onto the committed-tree AC.

### MINOR

- **`implement.md` Step 1 claims an order it does not use** — evidence: Step 1 says the ids are "in this exact order and with these exact ids (they are `settings.core.json`'s spec strings)", but its two-column list reads `…pi-web-access, @gotgenes/pi-permission-system, @juicesharp/rpiv-ask-user-question…` while `settings.core.json:4-6` is `…ask-user-question, rpiv-todo, pi-permission-system`. Why it matters: harmless to the check (set equality per `layout-and-surfaces.md:154-158`) but the plan's own invariant is false, and a hand-diff of the two lists will look like a defect. Proposed fix: either paste `settings.core.json`'s order or drop the word "exact".

- **Pointer sections in `docs/plugins.md` are not told to avoid `###`** — evidence: `implement.md` Step 1 says "Close the file with two short pointer sections" with no heading level, while the helper counts every `^### ` line as an entry. Why it matters: `### Enabled-only bundles` would be reported as "an entry for a package that is not shipped" and fail AC 7 for a correct file. Proposed fix: state "pointer sections use `##`; only id entries use `###`".

- **The parser is not fence-aware** — evidence: `design.md` "Extraction reads each line that starts with three hashes and one space, then takes the first backtick-delimited token". Why it matters: any fenced example (`design.md` itself shows one) inside `docs/plugins.md`/`docs/skills.md` would be counted, so the two files must contain no fenced `### ` line. Proposed fix: add "no fenced `###` examples in either file" to Step 1 and Step 2, or make the extractor skip fenced blocks.

- **R6, R9 and half of R4 have no acceptance criterion** — evidence: `prd.md` ACs cover R1 (AC 1), R2 (AC 2), R3 (AC 3), R4 partially (AC 4 tests config-location only, not the field order/required `**What it is.**`/`**Invoke.**` labels), R5 (AC 5), R7 (ACs 6-8), R8 (AC 12), R10 (AC 11); R6 and R9 appear only in prose and in the plan's review gates. Why it matters: the design makes the heading id a parser contract but leaves the *required field* contract unenforced, so an entry missing `**Invoke.**` passes every mechanical gate. Proposed fix: add an AC for R9 ("the `docs/` surface row and decision-tree entry exist in `layout-and-surfaces.md`, and no `PI_DIRS`/`PI_FILES` change") and one for R6 ("`docs/*.md` contains no `~/.pi/agent/*.json` ignore/symlink rule text; it links to the owning spec instead"), plus extend AC 4 to `grep -c '^\*\*Invoke\.\*\*'` per file.

- **AC 11 is vacuous** — evidence: `grep -rn 'docs/' scripts/lib.sh` returns nothing unconditionally because `PI_DIRS`/`PI_FILES` hold only bare names consumed as `$PI_SRC/$name` (`scripts/lib.sh:17-19`); no implementation of this task could make it fail. Why it matters: it is listed as the evidence for R10 but tests nothing. Proposed fix: replace with a positive test — `grep -rn 'ln -s' setup.sh | grep docs` is empty **and** `setup.sh` run output contains no `docs` line — or drop the AC and rely on the `PI_DIRS` review.

- **`check.jsonl`'s cross-layer reason overstates the file** — evidence: the stated reason includes "the clean-path run and the reverted failure-mode proofs", but `.trellis/spec/guides/cross-layer-thinking-guide.md` has no section on clean-path runs or reverting proofs (its `grep -n` headings are data-flow mapping, contracts, template consistency, versioned-docs). Why it matters: a check agent following the manifest will look for guidance that is not there and may skip the sections that do apply. Proposed fix: reword to "Map the docs → helper → doctor.sh → spec chain, its contracts (`Mistake 1/4`), and the reviewer checklist".

- **The shell-guidelines citation is imprecise** — evidence: `design.md` says the alternative "puts regex-parsing of Markdown in bash, which `spec/scripts/shell-guidelines.md` calls out as an anti-pattern", but the cited bullet (`shell-guidelines.md:408-409`) is "**Do not parse JSON in bash.** … use a `node -e` one-liner for a single field, or an `.mjs` helper for anything structural". Why it matters: the decision is still right, but a reviewer who reads the spec sees the citation overreach and discounts the rest of the design. Proposed fix: quote it accurately — "the helper clause of the 'Do not parse JSON in bash' anti-pattern (`anything structural` belongs in an `.mjs` helper)" — and add the second, stronger reason: `.mjs` is where the repo's argument/exit-code contract lives (`node-guidelines.md:52-125`).

- **`node`-missing → `bad` is defensible but unexplained against an existing `warn`** — evidence: `design.md`'s matrix says `node` unavailable → `bad`; `scripts/doctor.sh:88-89` (`==> Optional bundles`) uses `warn "node unavailable or optional/ missing"`; `scripts/doctor.sh:71-75` (`==> Settings`) and `:220-228` (`==> Skills`) call `node` with no preflight and degrade to a misleading `bad "settings.json has drifted"` / `bad "missing skills"`. Why it matters: the plan's new `bad` is a third treatment of the same condition; a future maintainer "harmonising" the two sections could weaken the new check, and AC 6's "no new warn" does not pin the node path. Proposed fix: add one sentence to the design justifying `bad` with the fail-loud rule (node is already a hard dependency of doctor.sh, and `setup.sh`/`optional.sh` treat it as fatal), and note the pre-existing `warn` as the exception, not the model.

- **Step 7's "mirror the existing `render-settings.mjs --check` pattern: `node` preflight" is misattributed** — evidence: `scripts/doctor.sh:64-76` calls `node render-settings.mjs … --check` directly with no preflight; the preflight precedent is `scripts/optional.sh`/`setup.sh` (`shell-guidelines.md:120-126`). Why it matters: an implementer copying the render-settings block will omit the preflight and the node path will not fail cleanly. Proposed fix: cite `==> Optional bundles` for the preflight and `==> Skills` for the temp-file branch.

---

## Verdicts per artifact

**`prd.md`** — Requirements R1-R10 and the supporting counts are mostly accurate, but the Context section's two measurements (README prose count, slash-command count) are wrong and, worse, the "all mentions are passing" premise is the justification the whole task rests on. Most important change: replace that premise with the honest gap — the spec tree already documents `/lens-map`, `/tps`, and `/mcp setup` (`pi-resources.md:54-80`), so `docs/` is about a front-door daily-use surface, not about writing the first invocation hints; then make the R6 division explicit so `docs/plugins.md` cannot be read as a second inventory.

**`design.md`** — The doc map, entry contract, decision to move Markdown parsing into an `.mjs` helper, and the fail-loud matrix are sound, and the heading contract survives pi-lens (its docs show prettier/markdownlint formatting only, and the repo's own pi-lens commit `b91810a` re-spaced table separators while leaving headings alone). Most important change: give the existing `pi-resources.md` inventory a row in the doc map with an explicit ownership split, and move the reconcile step from "implied" to a stated one; the ~4× source-volume correction and the stderr/stdout contract for the temp file are the next two.

**`implement.md`** — Steps are ordered correctly (1-4 create the docs, 5 links, 6 helper, 7 wiring, 8 proofs, 9 specs, 10 battery) and each step has a cheap validation, with two exceptions: the source list contains a path that does not exist, and "the task's check notes" is never defined. Most important change: define the check-notes artifact path and its required contents, then fix the `pi-mcp-adapter` source line and add the two omitted spec files to Step 9.

---

## What I could not verify

- **That `prettier` actually runs on this repo's Markdown.** No `.prettierrc`/`prettier.config.*` exists at the repo root and `pi-lens` documents prettier as "config-gated (`docs/features.md:32`)". I relied on the repo's own evidence instead: pi-lens re-spaced the table separators in `.trellis/spec/config/index.md` in commit `b91810a` while leaving every heading line untouched. The heading contract holds for *that* rewrite; I cannot prove a future pi-lens release will not add prose wrapping or heading normalisation.
- **Whether Pi exposes project prompts as `/trellis-start` or `/trellis:start`.** The generated prompts carry no frontmatter command name (I read `.pi/prompts/trellis-start.md` and `trellis-continue.md`), `.pi/extensions/trellis/index.ts:2088` says `/trellis-start`, and `.trellis/workflow.md` / `AGENTS.md` say `/trellis:continue` / `/trellis:finish-work`. I did not invoke `pi`, so which namespace resolves cannot be settled from this checkout.
- **The exact top-level `task` parameter of the `subagent` tool.** The installed `pi-subagents` docs confirm `subagent({ agent: "gpt-pro" })` and `runs.run(key, { agent, task })`, and `docs/tool-reference.md` shows `{ action, agent }` management forms; I did not find a table of the direct-call fields, so `subagent({ agent: "trellis-implement", task: "Active task: <path>" })` is `implement.md`'s assertion, not a verbatim quote.
- **That no warn appears on the clean path after implementation.** My `./scripts/doctor.sh` baseline has one `warn` (uncommitted task dir); the new check's contribution can only be measured once Steps 6-7 exist.
- **Repo files I did not read in full:** `setup.sh`, `scripts/optional.sh`, `scripts/sync.sh`, `scripts/render-settings.mjs` (read via the specs' quoted excerpts only), and `.pi/extensions/trellis/index.ts`.

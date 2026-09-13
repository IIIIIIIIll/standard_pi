# Execution Plan — early percentage compaction

Ordered. §4 is the load-bearing part: the trigger is easy, the resumption question is
the actual risk.

## 0. Preconditions

- [ ] `git status --short` shows only the expected drift: `~/.pi/agent/settings.json`
      differs because `npm:@sting8k/pi-vcc` was installed without `sync.sh`.
      Confirm with:
      `./scripts/doctor.sh` → expect `✗ settings.json has drifted from the repo`.
- [ ] Record the before-state of the package list:
      `node -e 'console.log(JSON.parse(require("fs").readFileSync("pi-agent/settings.core.json","utf8")).packages)'`
- [ ] Confirm the settings key is absent (it must stay absent):
      `grep -c reserveTokens pi-agent/settings.core.json ~/.pi/agent/settings.json` → `0` and `0`.

## 1. Install the trigger

- [ ] `pi install npm:@thunstack/auto-compact`
      (unpinned, matching the existing six). It must be installed **before** the
      sync in §2 so both packages are in the live settings when core is folded back.
      **Corrected after implementation:** core held **five** packages; the sixth
      (`npm:@oscarfalero/pi-opencode-go`) is contributed by the optional
      `opencode-go` manifest and is not a core entry.
- [ ] `pi list` shows both `npm:@thunstack/auto-compact` and `npm:@sting8k/pi-vcc`.

## 2. Fold live settings into the repo

- [ ] `scripts/sync.sh` — this is the repo's documented flow for `pi install`, and it
      also resolves the pre-existing pi-vcc drift.
- [ ] **Assert the diff is additive.** `git diff pi-agent/settings.core.json` must show
      exactly two added `packages` lines and no removals:
      ```bash
      git diff pi-agent/settings.core.json
      ```
      `sync-settings.mjs` strips the enabled optional's contributions
      (`defaultProvider`/`defaultModel` belong to `opencode-go`) and deletes
      `lastChangelogVersion`. Those are expected and must not reappear in core. If
      any other key disappears, stop and report it.
- [ ] `./setup.sh --skip-skills --skip-plugins` re-renders the live file from core +
      the enabled optional; `git status` must be clean afterwards (the drift is gone).

## 3. Configure the trigger

- [ ] Write `~/.pi/agent/auto-compact.json`. Start at `thresholdPercent: 1` for the §4
      test — the final value is 30, written in §5:
      ```json
      { "version": 1, "enabledAtSessionStart": true, "thresholdPercent": 1, "autoResume": false }
      ```
- [ ] Leave `~/.pi/agent/pi-vcc-config.json` as-is (`overrideDefaultCompaction: true`
      keeps pi-vcc as the summarizer).
- [ ] Do **not** add `reserveTokens` anywhere.

## 4. R3 test — resumption must happen exactly once (mandatory)

Purpose: settle whether `autoResume: false` is correct on Pi 0.85.1, where pi-vcc's
docs say core resumes the run itself.

**Do not let the test touch paths outside the repo.** The permission policy sets
`external_directory: "ask"`, and an `ask` in non-interactive mode can hang or deny.
Use a session dir under `/tmp` for the log (a CLI argument, not a tool call), but keep
every *tool call* inside the repo.

> **Corrected after implementation — the `pi -p` vehicle below is not viable.**
> Two independent reasons: (a) three `wc -l` calls never reach
> `keepRecentTokens` (default 20000), so no cut point exists and the trigger
> cannot fire — the session must first read large files, because tool results are
> not cut points and so leave compactable history behind the cut; (b) `pi -p`
> disposes as soon as the aborted prompt resolves, before the fire-and-forget
> `ctx.compact()` settles, so **both** `autoResume` values look like a stall.
> The R3 test was run with `pi --mode rpc` (drive JSONL on stdin; wait for
> `agent_settled`), `thresholdPercent: 1`, and a prompt that reads
> `.pi/extensions/trellis/index.ts` then `.trellis/workflow.md` before four
> separate bash `wc -l` steps. The assertions below are unchanged.

The original command, kept for the record:

```bash
# 1. multi-step, tool-driven work so several response boundaries occur
timeout 300 pi -p --session-dir /tmp/ac-test-sessions \
  "Do these three steps in order, using bash for each: (1) wc -l README.md, \
   (2) wc -l setup.sh, (3) wc -l .trellis/spec/index.md. Then report the three numbers. \
   Do not ask questions." ; echo "exit=$?"
```

Then, against the session JSONL under `/tmp/ac-test-sessions`:

| Assertion | Expectation with `autoResume: false` |
|-----------|--------------------------------------|
| Work completed | the final assistant message contains all three line counts |
| Self-queued resume | `grep -c "Continue the unfinished work from the compaction summary" <jsonl>` → **0** |
| Compaction happened | exactly one `compactionSummary` entry |
| No ghost turn | no duplicated resumption / no second continuation after the summary |

- [ ] All four assertions hold → `autoResume: false` is correct. Record the counts.
- [ ] If the run **stalls** (exit 0, work incomplete, no completion after the summary),
      core did not resume: set `"autoResume": true`, re-run the same command, and assert
      the instruction text now appears **exactly once** and the work completes. Record
      that finding.
- [ ] If the run produces **two** continuations with `autoResume: true`, that is the
      ghost-turn failure mode both READMEs warn about: revert to `false`, and record
      that auto-compact must not queue its own resume at Pi ≥0.84.4.
- [ ] Whichever branch is taken, the outcome goes into
      `.trellis/spec/config/pi-resources.md` (§R5) as a fact with the Pi version and
      the observed counts — not as advice to re-test.

## 5. Finalise the config

- [ ] Set `thresholdPercent: 30` (accepted range 1–99; package default 60).
- [ ] Keep the §4-decided `autoResume` value.
- [ ] `enabledAtSessionStart: true`.
- [ ] Verify strict JSON: `node -e 'JSON.parse(require("fs").readFileSync(process.env.HOME+"/.pi/agent/auto-compact.json","utf8"))'`
- [ ] Remove the temporary test session dir: `find /tmp/ac-test-sessions -type f -delete`
      (avoid `rm -rf` — the permission policy denies `rm -rf *`).

## 6. Declare the per-machine config files

- [ ] `.gitignore` — add explicit entries, in the existing machine-local group:
      `pi-agent/auto-compact.json` and `pi-agent/pi-vcc-config.json`.
      No glob. Match the surrounding style.
- [ ] `scripts/lib.sh` — add both filenames to `PI_NOT_SYNCED`, in a new group with a
      comment (the array order **is** the report order). Files, so **no trailing
      slash** — the ignore-coverage check validates the exact string.
- [ ] `./scripts/doctor.sh` must now report
      `✓ all 16 reported-skipped paths are gitignored` (14 + 2) and end in `All good.`
- [ ] `git ls-files | grep -E "auto-compact|pi-vcc"` → nothing.

## 7. Propagate the documentation

- [ ] `README.md` — always-on plugin table: one row each, matching the existing
      "What it adds" style. Also document the per-machine threshold step (the exact
      JSON from §5) since `auto-compact.json` is untracked and therefore not
      reproducible from the repo.
- [ ] `.trellis/spec/config/pi-resources.md` — package inventory gains two rows; add a
      short **Compaction** subsection recording: who owns the trigger
      (`auto-compact`, percentage), who owns the summarization (`pi-vcc`,
      `overrideDefaultCompaction: true`, no LLM call), that `reserveTokens` must stay
      untouched and why, and the R3 resume rule with its observed evidence.
- [ ] `.trellis/spec/config/layout-and-surfaces.md` — add the convention
      `~/.pi/agent/<extension>-config.json` → per-machine, untracked, declared in both
      `.gitignore` and `PI_NOT_SYNCED`, **never symlinked** (cite the `rename(2)`
      reason from `design.md`).
- [ ] Check the propagation guide's "Known Multi-Site Facts" table: the plugin list row
      already names `settings.core.json` + README + manifests, so no new row is needed —
      confirm rather than assume.

## 8. Gates

```bash
bash -n setup.sh scripts/*.sh
node --check scripts/*.mjs
./setup.sh --skip-skills --skip-plugins && ./setup.sh --skip-skills --skip-plugins   # identical
./scripts/sync.sh          # same pi-agent/settings.core.json + Already up to date.
./scripts/doctor.sh        # All good. (16 reported-skipped paths)
pi list                    # both compaction packages present
git status --short         # clean
```

- [ ] `./scripts/doctor.sh` exits 0 with `All good.`
- [ ] No `reserveTokens` in either settings file.

## 9. Commit

Single commit. Style: sentence-case imperative, no conventional-commit prefix, body
explaining the trigger arithmetic, the pi-vcc drift, and the R3 finding.

- [ ] Files: `pi-agent/settings.core.json`, `.gitignore`, `scripts/lib.sh`, `README.md`,
      the spec files, and this task's directory.
- [ ] The commit body must state the resolved `autoResume` value **and** the observed
      evidence for it, since that is the one decision a reader cannot re-derive from
      the code.

## Rollback Points

| After step | Rollback |
|-----------|----------|
| 1–2 | `pi remove npm:@thunstack/auto-compact && scripts/sync.sh` |
| 3–5 | delete `~/.pi/agent/auto-compact.json` → extension falls back to in-memory defaults (60%); `/auto-compact` toggles it per session without touching config |
| 6 | `git checkout -- .gitignore scripts/lib.sh` |
| 7 | `git checkout -- README.md .trellis/spec/` |
| 9 | `git revert <commit>` |

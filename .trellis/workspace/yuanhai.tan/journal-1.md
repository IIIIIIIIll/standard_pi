# Journal - yuanhai.tan (Part 1)

> AI development session journal
> Started: 2026-09-13

---



## Session 1: Spec bootstrap, then repair the drift it exposed
<!-- trellis-session: v=2 fp=e4b581867a6bed60 -->

**Date**: 2026-09-13
**Task**: Spec bootstrap, then repair the drift it exposed
**Branch**: `main`

### Summary

Two phases in one session. First, the `trellis init` spec bootstrap: the repo had 13 template placeholder files split into `backend/` and `frontend/`, but it is a Pi harness config store with no such layers. Replaced them with evidence-backed specs derived from the actual bash, Node ESM, and JSON. Second, the bootstrap's own honesty cost: it recorded three defects as "current reality" instead of fixing them, so those became a parent task with three children — and the check pass on the first child uncovered a fourth that nobody had spotted.

### Main Changes

- Replaced the trellis init backend/frontend spec template (13 placeholder files) with layers matching this repo: scripts/ (bash + Node ESM conventions), config/ (tracked/symlinked/generated/ignored surfaces, optional-bundle contract, Pi resources + permission policy), and a new change-propagation guide. Took the three defects that bootstrap documented as current reality and fixed them as a parent task with three children: stale scripts/install.sh references in user-facing output; PI_DIRS/PI_FILES duplicated across setup.sh+sync.sh+doctor.sh; and the three machine-local path lists disagreeing (trust.json was reported as intentionally-skipped while git would stage it).

### Git Commits

| Hash | Message |
|------|---------|
| `cf49aa7` | Write project specs that match the repo instead of the template |
| `a72e47d` | Plan the harness drift repair as a parent task with three children |
| `d44289e` | Fix user-facing references to a script that no longer exists |
| `819bfa1` | Define the symlinked resource lists once instead of three times |
| `5997e94` | Make a reported-skipped path impossible to commit, and check it |
| `63e0724` | Record the fourth requirement and close the parent's acceptance criteria |

### Testing

- [OK] bash -n, node --check, ./setup.sh twice byte-identical, ./scripts/sync.sh, ./scripts/doctor.sh All good. Four negative tests on the new ignore-coverage check: unignored reported path, a directory entry that lost its slash, a new array entry with no .gitignore rule, and a clean run with no false positives. doctor.sh outside a git repo exits 1 without an unbound-variable error.

### Status

[OK] **Completed**

### Next Steps

- 00-bootstrap-guidelines is complete (checkboxes ticked, Completion Record written) but still in_progress -- archive it once you have skimmed the specs. Optionally: shellcheck is not installed, so the # shellcheck directives in scripts/*.sh remain documentation rather than tooling.


## Session 2: Compact at 30% instead of 98%, and track the compaction extensions
<!-- trellis-session: v=2 fp=60a7d0e1e76318de -->

**Date**: 2026-09-13
**Task**: Compact at 30% instead of 98%, and track the compaction extensions
**Branch**: `main`

### Summary

Session summary was not supplied.

### Main Changes

- Native auto-compaction triggers at contextWindow - reserveTokens, which on the active 1M-token model is ~98% full. Raising reserveTokens was the obvious fix and the wrong one: Pi overloads it as the summarization output budget (0.8x), and the trigger is window-relative so the same value goes negative on a 500k model. Instead added npm:@thunstack/auto-compact (owns when: thresholdPercent 30, proportional) alongside the already-installed but untracked npm:@sting8k/pi-vcc (owns how: overrideDefaultCompaction true, algorithmic, no LLM call) -- which also resolved pre-existing settings.json render drift. Both packages tracked unpinned in settings.core.json. Declared both per-machine extension config files in .gitignore and PI_NOT_SYNCED rather than symlinking them.

### Git Commits

| Hash | Message |
|------|---------|
| `ed3dd8b` | Compact at 30% of context instead of 98%, and track both compaction extensions |

### Testing

- [OK] doctor.sh: all 16 reported-skipped paths gitignored, no render drift. reserveTokens and keepRecentTokens absent from both settings files. setup.sh twice byte-identical. The resumption question was settled empirically rather than from the READMEs, which disagree: pi --mode rpc with thresholdPercent 1 gave 0 resume messages and 2 of 4 tool steps with autoResume false, versus 1 resume message and all 4 steps with it true -- so true is shipped. Reproduced independently by the check agent in a second RPC session. Mechanism verified in dist/: AgentSession.compact() aborts and never resumes the interrupted turn, and ctx.compact() is that manual fire-and-forget path; Pi core self-resumes only on the native threshold path.

### Status

[OK] **Completed**

### Next Steps

- One shared spec file took hunk-level staging to avoid committing another agent's in-flight work; their permission_request hunk is still uncommitted. Optional follow-ups: auto-compact's additionalCompactionInstruction is dropped under pi-vcc (blanked in the live config to silence a per-compaction extension_error, worth reporting upstream), and 00-bootstrap-guidelines is complete but still unarchived.


## Session 3: Close out the bootstrap task; no work commits this round
<!-- trellis-session: v=2 fp=0c2211eaeb0aeb31 -->

**Date**: 2026-09-13
**Task**: Close out the bootstrap task; no work commits this round
**Branch**: `main`

### Summary

Session summary was not supplied.

### Main Changes

- Finalised 00-bootstrap-guidelines and archived it. Before archiving I verified the deliverables rather than trusting the checkboxes: no placeholder prose anywhere under .trellis/spec, index parity across all four index.md files (no orphans), 12 spec files present, and relatedFiles pointing at the reshaped tree. Amended the task's Completion Record, whose 'known issues documented rather than fixed' section had gone stale -- three of its four items were fixed later in the session by the drift-repair work (d44289e, 819bfa1, 5997e94), and the PI_DIRS duplication count had been eight places, not seven as the record claimed. They are now struck through with commit references so the entry reads as history rather than as a live defect list. Checked safe_commit.py before archiving: it stages a specific path allowlist (journal, index.md, task dir, archive dir) and never the .trellis/ tree, so the other window's dirty pi-resources.md hunk was never at risk. Archive commit 009a3de touched only the task's own prd.md and task.json.

### Git Commits

(No commits - planning session)

### Testing

- [OK] Verification was static, not behavioural: grep for placeholder markers across .trellis/spec (only legitimate hits), index-to-file parity check per spec directory, and inspection of the archive commit's file list to confirm it contained exactly the two task files. doctor.sh reports No problems. with a single note, which is the other window's uncommitted hunk rather than anything from this session.

### Status

[OK] **Completed**

### Next Steps

- No work of mine is outstanding: all commits are local and origin/main is still at 873d85c, so a push is the only remaining action if wanted. Two things belong to other workstreams and were deliberately left alone: the other window's uncommitted permission_request.session_approved hunk in .trellis/spec/config/pi-resources.md, and its in-progress task 09-13-pi-subagents-dispatch. Earlier loose end worth considering: auto-compact's additionalCompactionInstruction is silently dropped under pi-vcc's overrideDefaultCompaction and emits an extension_error per compaction -- blanked in the live config, but it is an interaction bug between two now-tracked packages and would be worth reporting upstream.

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


## Session 4: Route Pi Trellis role dispatch through pi-subagents
<!-- trellis-session: v=2 fp=e6d9a09f87b06ef8 -->

**Date**: 2026-09-14
**Task**: Route Pi Trellis role dispatch through pi-subagents
**Branch**: `main`

### Summary

Made pi-subagents the Pi dispatch path for Trellis role agents at the harness layer, without editing any generated file. One tracked global extension replaced the shipped trellis_subagent path; the shipped tool is now uncallable.

### Main Changes

- Added pi-agent/extensions/trellis-subagents-bridge/index.ts. The parent publishes its context key and refreshes it on subagent tool calls, so a task activated earlier in the same turn is visible; each child writes its own runtime session pointer. The generated extension then resolves the real task unmodified - correct breadcrumb, correct injected context, correct bash key, nothing stripped or rewritten.
- Deactivated the shipped trellis_subagent tool with pi.setActiveTools, re-applied every turn, so only pi-subagents can dispatch and its competing promptGuidelines are no longer injected. Added scripts/doctor.sh checks for the bridge and for pi-subagents' discovery input, with the failure path proven.
- Documented the bridge in pi-resources.md, pi-agent/extensions/README.md and README.md, including the two conventions the check phase taught: role predicates must be exhaustive rather than selective, and idempotency guards must match a whole injected constant rather than a bare tag that ordinary prose also contains.

### Git Commits

| Hash | Message |
|------|---------|
| `d7f0f3e` | Make pi-subagents children resolve the active Trellis task |
| `a8f6603` | Record verification evidence and correct two acceptance criteria |
| `343b8d7` | Disable the shipped trellis_subagent tool so only pi-subagents can dispatch |
| `f7718aa` | Fix a latent regression in the shipped tool's children, and harden the bridge |
| `866ab1b` | Fix the guidance guard matching a bare tag, and record both check rounds |
| `8b95cd9` | Record the conditional AC9 correction, and the two lessons for this layer |

### Testing

- [OK] Nine live probes plus two independent check rounds. Full chain green: bash -n and node --check clean, setup.sh twice byte-identical, sync.sh 'Already up to date.' mutating nothing, doctor.sh 'All good.' exit 0, tree clean.

### Status

[OK] **Completed**

### Next Steps

- Upstream prelude relaxation so the generated preludes' 'first line is Active task:' rule survives pi-subagents' 'Task: ' prefix, instead of the in-repo adapter note.
- The shipped trellis_subagent code paths in the generated extension are now dead weight; worth raising upstream now that the harness deactivates the tool.


## Session 5: Fail loudly when generated Pi tools drift from the bridge
<!-- trellis-session: v=2 fp=12a8fe6bc949fa11 -->

**Date**: 2026-09-14
**Task**: Fail loudly when generated Pi tools drift from the bridge
**Branch**: `main`

### Summary

Closed the residual coupling left by the subagent bridge: it deactivated the shipped Trellis dispatch tool by one hard-coded name with nothing tying that name to the generated extension. The name is now a list and doctor.sh fails when the generated extension registers a tool the list does not cover.

### Main Changes

- SHIPPED_TOOLS replaces the single SHIPPED_TOOL constant, and doctor.sh compares it against the names the generated extension registers, naming both the offending tool and the bridge file when one is missing.
- The check fails whenever it cannot verify, not only when it sees a mismatch: zero extracted names from a readable extension that calls registerTool, an unreadable file, and an unreadable SHIPPED_TOOLS declaration are all problems. A readable extension that registers no dispatch tool warns rather than claiming coverage, so the check cannot print a clean pass in a state worse than the absent-file case.
- The comparison reads the SHIPPED_TOOLS declaration line rather than matching the name anywhere in the bridge, so a mention in the tool_call guard cannot stand in for deactivation. Recorded the new coupling in change-propagation-guide.md and the measured brittleness boundary in design.md.

### Git Commits

| Hash | Message |
|------|---------|
| `8bec04c` | Fail loudly when the generated Pi tools drift from the bridge |
| `2cee4e0` | Stop the drift check reporting ok when it cannot verify |

### Testing

- [OK] Eight mutations of the generated extension and of the bridge, each restored and re-verified against .trellis/.template-hashes.json. Full chain green: bash -n, node --check, setup.sh twice byte-identical, sync.sh 'Already up to date.', doctor.sh 'All good.', tree clean.

### Status

[OK] **Completed**

### Next Steps

- Extraction is all-or-nothing: partial reformatting of the generated registrations is invisible, and a tool registered from a sibling file is never scanned. Recorded as a boundary rather than fixed.


## Session 6: Make the render drift check insensitive to package order
<!-- trellis-session: v=2 fp=5c5d0b9c42f91d87 -->

**Date**: 2026-09-14
**Task**: Make the render drift check insensitive to package order
**Branch**: `main`

### Summary

Option 1 from design.md: --check in render-settings.mjs now compares packages as a sorted multiset, so a set-equal array reordered by pi install is no longer drift; duplicates, membership, key order and every other value stay strict, and the write path is untouched so setup.sh still canonicalises. Rule documented in layout-and-surfaces.md. Verified with 17 offline cases, two byte-identical setup.sh runs, and sync.sh reporting same. b91810a resynced the shell-guidelines.md snippets that pi-lens autoformatting had invalidated.

### Git Commits

| Hash | Message |
|------|---------|
| `dbdc8a6` | Compare packages as a set in the render drift check |
| `b91810a` | Apply pi-lens formatting and resync the spec snippets it invalidated |

### Status

[OK] **Completed**


## Session 7: Daily-use docs layer + a docs coverage check
<!-- trellis-session: v=2 fp=583d1813f07a325b -->

**Date**: 2026-09-14
**Task**: Daily-use docs layer + a docs coverage check
**Branch**: `main`

### Summary

Added a tracked docs/ layer (plugins, skills, agents) with one entry per shipped item, and scripts/check-docs.mjs wired into doctor.sh as a fail-loud membership check. Three review rounds; the only BLOCKER was a false fact (the permission system does register /permission-system), closed with the installed-source citations.

### Main Changes

- docs/{plugins,skills,agents}.md + docs/README.md: 12 plugin entries, 6 skill entries, 3 role agents and 3 prompts, each with What it is / Reach for it when / Invoke / Config, every invocation token read from the installed package
- scripts/check-docs.mjs: compares ### entry ids as sets against settings.core.json packages and skills.json names, reporting a missing entry and a stray entry separately; doctor.sh runs it as ==> Docs coverage, and an unreadable input or an emptied file is a bad, never a silent pass
- README.md: pointers into docs/ from the plugins and skills sections, a Layout row, and the new helper in the script table; six spec files record docs/ as a tracked prose surface, the checker contract, and both change-propagation rows
- Committed with line-selective staging because three tasks shared one working tree; the staged-value decisions and two staging hazards are recorded in the task check-notes section 12

### Git Commits

| Hash | Message |
|------|---------|
| `0f46c9f` | feat(docs): daily-use guides for the shipped plugins, skills, and agents |
| `d042603` | chore(task): record commit provenance for 09-14-usage-guides-plugins-skills |

### Testing

- [OK] ./setup.sh twice, both fully and with --skip-plugins --skip-skills --skip-mcp: identical output, exit 0
- [OK] ./scripts/doctor.sh: exit 0 with the Docs coverage section reporting 12 plugins and 6 skills, no new warn against the pre-change baseline
- [OK] node scripts/check-docs.mjs . exit 0; five failure modes on a mktemp fixture each exit 1 naming the offending id or file; no-argument usage exits 2; node --check and bash -n pass
- [OK] render-settings --check reports no drift; the commit checked out in isolation runs every doctor.sh section with no unbound variable

### Status

[OK] **Completed**

### Next Steps

- The other two tasks still hold the shared files (README.md, doctor.sh, four spec files) uncommitted; their commits complete the combined state - none of this task lines are pending
- Observation for the MCP task: doctor.sh references $MCP_CFG while scripts/lib.sh defining it is still uncommitted, so the two must land together; a commit with only one of them dies under set -u
- Observation: doctor.sh guards its git sections with [ -d "$REPO_DIR/.git" ], which is false in a linked worktree (.git is a file there), so git worktree verification silently skips Repo, secret-scan and ignore-coverage; git -C ... rev-parse --git-dir is the portable test


## Session 8: Install and register the codebase-memory MCP server
<!-- trellis-session: v=2 fp=0963db3acf1bdec7 -->

**Date**: 2026-09-14
**Task**: Install and register the codebase-memory MCP server
**Branch**: `main`

### Summary

Added scripts/install-mcp.sh and scripts/register-mcp-server.mjs, wired setup.sh behind --skip-mcp, added doctor.sh's MCP section, and put MCP_CFG in lib.sh as the single definition following the adapter's homedir resolver rather than XDG. Verified end to end: doctor.sh green with 18 covered ignore paths, mcp({ search }) returns the registered server's tools, and cbcf93d checked out in isolation runs doctor.sh to completion. Also added the adapter's runtime mcp-cache.json to .gitignore and PI_NOT_SYNCED, the only agent-dir file of its kind missing from both.

### Git Commits

| Hash | Message |
|------|---------|
| `cbcf93d` | feat(mcp): install and register codebase-memory-mcp as an always-on server |

### Status

[OK] **Completed**


## Session 9: Restore Pi's footer by re-homing the run timer on the status line
<!-- trellis-session: v=2 fp=d05fe7587ca3253f -->

**Date**: 2026-09-15
**Task**: Restore Pi's footer by re-homing the run timer on the status line
**Branch**: `main`

### Summary

Removed npm:pi-timer, which installed its per-run timer by replacing Pi's entire footer with a hand-written copy of an older one — silently dropping core's CH<rate>% cache-hit segment — and re-homed the timer as a ctx.ui.setStatus("run-timer") string published by a new pi-agent/extensions/run-timer.ts. Added a doctor.sh "==> Footer ownership" section that fails when any extension source calls ctx.ui.setFooter(), deleted the hand-placed cache-hit-rate.ts repair extension that existed only to compensate for pi-timer, and propagated the 12->11 package change through README.md, docs/plugins.md, docs/README.md and the spec. All nine acceptance criteria verified on 707f017, including the two only a human can observe: CH is back on footer line 2 and the timer counts on line 3 ahead of the TPS meter. Two failures were found and fixed on the way: the task's own plan claimed the spec's quoted settings.core.json block was machine-checked when no script reads that file (the block had already drifted, and the false claim caused string-equality to be reported without being measured), and the new footer check used a one-level glob that printed ok for nested sources it never read.

### Git Commits

| Hash | Message |
|------|---------|
| `707f017` | feat(status): replace pi-timer with a setStatus-only run timer |

### Status

[OK] **Completed**

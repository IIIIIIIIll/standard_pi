# Design — early percentage compaction

## Who owns what

The two extensions split the compaction decision cleanly, which is why they pair
rather than conflict:

| Concern | Owner | Setting |
|---------|-------|---------|
| **When** to compact | `auto-compact` | `thresholdPercent: 30` |
| **How** to summarize | `pi-vcc` | `overrideDefaultCompaction: true` |
| Final backstop | Pi core | `reserveTokens: 16384` (untouched, ~98%) |
| Resuming the run | Pi core (≥0.84.4) | see the R3 test |

Consequences that must not be re-litigated later:

1. **No LLM summarization call exists**, so the summarization output budget
   (`0.8 × reserveTokens`, `compaction.js:489`) is irrelevant. Nobody should
   "tune" `reserveTokens` for summary-length reasons in this configuration.
2. `reserveTokens` stays at 16384, so the native backstop still fires around 98%
   if the percentage trigger is disabled via `/auto-compact` for a session.
3. `thresholdPercent` is proportional, so it stays meaningful if the model changes
   to a smaller window. This is the property that a raised `reserveTokens` would
   have destroyed — see the PRD's Background section for the arithmetic.

## Design Decision: the config files are NOT symlinked into the repo

`PI_FILES` exists precisely for "a repo file that should appear in `~/.pi/agent`",
so symlinking `auto-compact.json` and `pi-vcc-config.json` looks like the
consistent choice. It is a trap, and the reason is in the extension's source.

`writeAutoCompactConfig` (`@thunstack/auto-compact@0.2.3`, `index.ts:133-166`)
writes atomically:

```ts
const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
descriptor = openSync(temporaryPath, "wx", 0o600);
writeFileSync(descriptor, `${JSON.stringify(...)}\n`, "utf8");
fsyncSync(descriptor); closeSync(descriptor);
renameFile(temporaryPath, path);      // renameSync
```

`rename(2)` **replaces the symlink itself**, not its target. So if
`~/.pi/agent/auto-compact.json` were a symlink to `pi-agent/auto-compact.json`:

1. The first `/auto-compact-config` save replaces the symlink with a regular file.
   The repo file is left untouched and now disconnected.
2. `doctor.sh` reports `! auto-compact.json exists but is not linked (run ./setup.sh)`.
3. `setup.sh`'s `link()` sees a real file, moves it to
   `auto-compact.json.bak-<stamp>`, and re-links the repo version — **discarding the
   settings the user just saved**, recoverable only from the backup.

> **Corrected after implementation:** the rename-atomic mechanism above is specific
> to `auto-compact`. `pi-vcc` writes `pi-vcc-config.json` with a plain
> `writeFileSync` (`@sting8k/pi-vcc@0.7.2`, `src/core/settings.ts:82,97`), which
> *follows* a symlink and would write per-machine settings into the tracked repo
> file. Both files must stay unsymlinked, but for different reasons.

The symlinked resources that work today (`themes/`, `prompts/`, `AGENTS.md`) are
directories or files edited by *us* and by Pi itself, not rewritten by a
rename-atomic third-party extension. Files written that way must live outside the
repo.

So: per-machine, untracked, declared in `.gitignore` + `PI_NOT_SYNCED`. The cost is
that `thresholdPercent: 30` is not reproducible from the repo — `README.md` must
document the exact JSON as a per-machine setup step, the same way credentials are
documented rather than committed.

This is now a **class** of file, not a one-off:

```
~/.pi/agent/<extension>-config.json   →  per-machine, untracked, declared in
                                          both .gitignore and PI_NOT_SYNCED
```

Two instances exist (`auto-compact.json`, `pi-vcc-config.json`), which is the right
moment to write the rule down — in
`.trellis/spec/config/pi-resources.md`, next to the package inventory.

## Design Decision: `autoResume` starts `false` and is settled by test

Both extensions describe resumption, and their descriptions are inconsistent at
the installed Pi version (0.85.1):

- pi-vcc: from 0.84.4 onward "pi core resumes the run itself, so pi-vcc never sends
  its own continue (a second one would land as a ghost turn)".
- auto-compact: "Pi's public compaction API stops the current agent loop before
  summarizing", and queues its own follow-up via `autoResume` (default `true`).

If core resumes and auto-compact also queues a follow-up, the failure mode is a
duplicated resumption — the agent continues the task twice, or a stray turn
appears. It is not recoverable by reasoning from the READMEs, because they disagree.

Starting `false` is the conservative choice for a **testable** reason: the test
asserts that work completes exactly once. If `false` is wrong, the test fails
visibly (the run stalls) and `true` is applied. If `true` is wrong, the failure is
a subtle duplicate that only shows up as odd behaviour later — the strictly worse
direction to guess in.

The test protocol is in `implement.md` §4. It is mechanical: the follow-up text is a
known string (`resumptionInstruction`), so a self-queued resume is countable in the
session JSONL. Assert: tool work completed, `resumptionInstruction` occurrences 0,
exactly one compaction entry, final answer reflects the tool result.

## Design Decision: explicit ignore entries, not a glob

`pi-agent/*-config.json` would cover both files and any future one. Rejected:

- It hides files nobody has seen. The task that reconciled the path lists settled
  this: do not ignore speculatively, because a too-broad pattern can hide a real
  file and `doctor.sh`'s coverage check validates *named* entries, not globs.
- The existing style is explicit per path (`pi-agent/models-store.json`,
  `pi-agent/trust.json`, …), with globs reserved for genuinely unbounded sets
  (`*.log`, `*.bak-*`, `extensions/*/logs/`).

Extension config files are bounded and few, so they are named individually. The
convention is documented instead, so the next one is recognised rather than
forgotten.

## Ordering

`pi install npm:@thunstack/auto-compact` must happen **before** `scripts/sync.sh`,
so the live settings contain both packages when core is folded back. Writing
`auto-compact.json` is independent of the install (the extension does not create
it; defaults are in-memory until a setting is saved).

`PI_NOT_SYNCED` must be updated **before** the `doctor.sh` run that is expected to
pass — adding a name to the array without a matching `.gitignore` entry makes the
ignore-coverage check fail by design. That failure is a feature here: if the two
edits are split across commits, `doctor.sh` reports it.

## Risks

| Risk | Mitigation |
|------|-----------|
| Duplicate resumption (the R3 risk) | `autoResume: false` plus the §4 test; outcome recorded in the spec |
| `sync.sh` silently dropping a core key while folding | Assert the `settings.core.json` diff is additions-only for the two package specs |
| Compaction 3× more often is chattier | pi-vcc is 30–470 ms with no API call; `vcc_recall` searches raw JSONL, so recall does not depend on the summary |
| A future maintainer "fixes" the untracked config by symlinking it | Recorded above with the `rename(2)` evidence, and in the spec |
| Native compaction still fires at ~98% and both paths run | Intended: the backstop is the safety net if `/auto-compact` is toggled off for a session |
| `auto-compact 0.2.3` is tested against Pi 0.84.4, installed is 0.85.1 | The §4 test exercises the exact version-sensitive behaviour (resumption); packages stay unpinned per repo convention |

## Rollback

- Packages: `pi remove npm:@thunstack/auto-compact` and, if desired,
  `pi remove npm:@sting8k/pi-vcc`, then `scripts/sync.sh`.
- Threshold: `/auto-compact` toggles per session without touching config;
  `enabledAtSessionStart: false` disables it for new sessions; deleting
  `~/.pi/agent/auto-compact.json` reverts to in-memory defaults (60%).
- Repo: single commit; `git revert` restores the package list, `PI_NOT_SYNCED`, and
  the docs. No state or rendered artefact to unwind.

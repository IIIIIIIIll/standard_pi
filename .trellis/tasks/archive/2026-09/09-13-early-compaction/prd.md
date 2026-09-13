# Enable early percentage compaction, and track the compaction extensions

## Goal

Make Pi compact at ~30% context usage instead of ~98%, by adding a percentage
trigger, and leave the repo consistent: both compaction extensions tracked, both
per-machine config files declared, `doctor.sh` green.

## Background — why native settings cannot do this

Auto-compaction triggers at `contextTokens > contextWindow - reserveTokens`
(`dist/core/compaction/compaction.js:163`), default `reserveTokens: 16384`. On the
active model (`opencode-go/deepseek-v4.1-flash`, window 1,000,000) that is
**983,616 tokens — about 98% full**.

Raising `reserveTokens` to 700,000 does produce a 300,000 trigger, but it is the
wrong lever because the setting is overloaded — `compaction.js:489` reuses it as
the summarization output budget:

```js
const maxTokens = Math.min(Math.floor(0.8 * reserveTokens), model.maxTokens);
```

so 700,000 would move the summary ceiling from 13,107 to 384,000 tokens. It is also
global and window-relative: on `grok-4.6` (500,000, also in the catalog) the
threshold would go negative and compaction would fire on every check.

## Requirements

### R1 — Install and track both compaction extensions

- `npm:@thunstack/auto-compact` — provides the percentage trigger. Install it, then
  fold the live settings back into the repo so it is tracked.
- `npm:@sting8k/pi-vcc` — **already installed but untracked**, which currently makes
  `doctor.sh` fail with `✗ settings.json has drifted from the repo`. Track it in the
  same pass.
- Both go in `pi-agent/settings.core.json` `packages`, **unpinned**, matching the
  existing six. Both apply to every machine.

  > **Corrected after implementation:** core held **five** packages, not six. The
  > sixth (`npm:@oscarfalero/pi-opencode-go`) belongs to the optional
  > `opencode-go` manifest and only reaches the live `settings.json` when that
  > bundle is enabled; it is not a core entry. The requirement is unchanged.
- Use the repo's documented flow (`pi install` then `scripts/sync.sh`) rather than
  hand-editing core, and verify sync did not drop anything unintended.

### R2 — Configure the trigger

- `thresholdPercent: 30` in `~/.pi/agent/auto-compact.json`. Accepted range is
  integer 1–99; the package default is 60.
- **Do not change `reserveTokens`.** Native compaction stays enabled as the
  backstop at ~98%; the percentage trigger simply fires first.
- Because `pi-vcc` sets `overrideDefaultCompaction: true`, it replaces Pi's
  summarization call with algorithmic extraction. There is therefore **no LLM
  summarization call**, and the summary output budget is irrelevant. R2 does not
  need to account for it — record that reasoning so a future reader does not
  "fix" a non-problem.
- `keepRecentTokens` stays at its default; both extensions read it (auto-compact
  re-reads the effective value per decision, pi-vcc's `smartKeepTail` reads the tail).

### R3 — Resolve the resume-duplication risk (mandatory test)

The two packages make contradictory claims about who resumes the agent run after
compaction:

- `pi-vcc` config doc: `continueAfterThresholdCompact` "only applies to pi < 0.84.4
  — from 0.84.4 on, pi core resumes the run itself, so pi-vcc never sends its own
  continue (a second one would land as a ghost turn)".
- `auto-compact` README: its `autoResume` queues one follow-up because "Pi's public
  compaction API stops the current agent loop before summarizing".

The installed Pi is **0.85.1**, above the version where core took over resumption.
So a self-queued follow-up from auto-compact may be a duplicate.

- Start with `autoResume: false` and test empirically (see `implement.md` §4).
- The test must show the tool work **completes exactly once**. If it stalls — core
  did not resume — flip to `autoResume: true`, re-test, and record the finding.
- Whichever way it resolves, the outcome must be written into the spec: the next
  person must not have to re-derive it.

### R4 — Declare the per-machine config files

`~/.pi/agent/auto-compact.json` and `~/.pi/agent/pi-vcc-config.json` are extension-owned
and must not be committed:

- `.gitignore` — one explicit entry each, following the existing `pi-agent/<name>`
  style. Do not add a broad `pi-agent/*-config.json` glob.
- `scripts/lib.sh` — add both to `PI_NOT_SYNCED`, so the `sync.sh` report names them
  and `doctor.sh`'s ignore-coverage check enforces that they are gitignored. Then
  run `doctor.sh` and confirm it reports the new count and passes.
- Neither file is symlinked from the repo. See `design.md` for why that option was
  rejected — it is not an oversight.

### R5 — Propagate the change

Per the repo's own change-propagation guide:

- `README.md` — the always-on plugin table gains two rows.
- `.trellis/spec/config/pi-resources.md` — the package inventory gains two rows, and
  a short subsection records the compaction pair: who owns the trigger, who owns the
  summarization, and the resume rule from R3.
- The per-machine extension-config convention (`~/.pi/agent/<ext>-config.json`, not
  symlinked) is worth stating once, now that there are two instances of it.

## Acceptance Criteria

- [ ] `pi list` shows `npm:@sting8k/pi-vcc` and `npm:@thunstack/auto-compact`.
- [ ] `pi-agent/settings.core.json` `packages` contains both, and `git diff` on that
      file shows **only** additions of those two specs (nothing silently dropped by
      `sync.sh`).
- [ ] `~/.pi/agent/auto-compact.json` exists with `thresholdPercent: 30` and
      `enabledAtSessionStart: true`, and the R3-decided `autoResume` value.
      `pi-vcc-config.json` still has `overrideDefaultCompaction: true`.
- [ ] `reserveTokens` is unset in both `settings.core.json` and the live
      `settings.json` (i.e. native default 16384, untouched).
- [ ] `scripts/lib.sh` `PI_NOT_SYNCED` contains both config filenames; the
      `sync.sh` report lists `skip pi-agent/auto-compact.json` and
      `skip pi-agent/pi-vcc-config.json`.
- [ ] `doctor.sh` ends in `All good.` — including the ignore-coverage check now
      counting both new entries, and no render drift.
- [ ] `git check-ignore -q pi-agent/auto-compact.json` and
      `... pi-agent/pi-vcc-config.json` both succeed; `git ls-files` contains neither.
- [ ] The R3 test result is recorded: work completed exactly once, with the observed
      count of self-queued resumption messages and compaction entries in the test
      session's JSONL.
- [ ] README plugin table and the spec inventory both name the two packages.
- [ ] `./setup.sh` twice leaves a clean tree; one commit.

## Out Of Scope

- Raising `keepRecentTokens`, or any other native compaction tuning.
- Changing `pi-vcc`'s summarization behaviour, or moving it off
  `overrideDefaultCompaction: true`.
- The unrelated untracked task directory `09-13-pi-subagents-dispatch` and anything
  belonging to the pi-subagents dispatch work.
- Writing a custom compaction extension. `auto-compact` already implements the
  trigger, resume, failure-disarm, TUI config panel, and session toggle; a
  hand-rolled one would be strictly worse.

## Constraints

- `settings.core.json` and `auto-compact.json` must remain **strict JSON** — the
  permission system and both extensions parse them without comments or trailing commas.
- Do not unpin or pin versions; the repo deliberately leaves package specs unpinned so
  `pi update --extensions` can advance them. Note for the record: `auto-compact` 0.2.3
  states it is tested against Pi 0.84.4 and the installed Pi is 0.85.1, which is
  precisely why R3 must be tested rather than assumed.

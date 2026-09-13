# Route Pi Trellis role dispatch through pi-subagents

## Goal

Make `pi-subagents` the dispatch path for Trellis role agents on Pi, implemented
**entirely at the harness layer** (`my_pi_setup`), without editing any
Trellis-generated file.

`pi-subagents` is already a core package and already discovers
`.pi/agents/trellis-{implement,check,research}.md` as project agents. What it
does *not* do is give those children the parent's active Trellis task. Today a
child dispatched through `subagent(...)` gets `Status: no_task`, `CURRENT TASK
(none)`, and a `task.py current` that exits 1 — while the same role dispatched
through the generated `trellis_subagent` tool gets correct context.

This task closes that gap with one new tracked global extension and no changes
to generated files.

## Requirements

**R1 — Children must resolve the parent's active task.**
`python3 ./.trellis/scripts/task.py current --source` inside a pi-subagents child
must resolve the parent session's task. Root cause (probed): the parent never
publishes `TRELLIS_CONTEXT_ID` into `process.env` — the generated extension
injects it only per-bash-call via its `tool_call` hook — and the child's own copy
of that extension derives a key from the *child's* `PI_SESSION_ID`.

**R2 — Children must not receive stale/wrong Trellis context.**
A background child loads the project-local Trellis extension and is told
`Status: no_task` with the instruction "ask for task-creation consent". For a
role child that has already been given a task, that text is actively wrong and
must not reach its system prompt.

**R3 — The child-side bash hook must not clobber the inherited key.**
The generated extension prefixes `export TRELLIS_CONTEXT_ID='pi_<child key>';`
onto every bash call whose command does not already carry the variable. Once the
parent key is inherited, that prefix would undo it for every command.

**R4 — The `Active task:` contract must survive pi-subagents' prompt prefix.**
The generated agent preludes say "If its **first line** is `Active task: <path>`".
pi-subagents prefixes every child prompt with `Task: `, so the first line is
actually `Task: Active task: <path>`. Either the child must be told the real
shape, or an upstream prelude change is required — this task must not leave the
contract silently broken.

**R5 — Parent dispatch guidance must name `subagent`, not `trellis_subagent`.**
Trellis role dispatch on Pi should route through
`subagent({ agent: "trellis-…", task: "Active task: …" })`.

**R6 — No generated file may be edited.**
`.pi/extensions/trellis/index.ts`, `.pi/agents/trellis-*.md`,
`.trellis/workflow.md`, and `.agents/skills/**` are all template-hash-tracked
and/or gitignored (`.pi/`, `.agents/` produce zero `git ls-files` entries). The
solution must be reproducible from tracked harness inputs and must not make
`trellis update` report local drift on files this repo does not own.

**R7 — The new surface must be documented where the layer is specified.**
`.trellis/spec/config/pi-resources.md` is the spec for `pi-agent/extensions/`;
`README.md` and `pi-agent/extensions/README.md` describe the same layer.

**R8 — The harness must verify itself.**
`scripts/doctor.sh` must fail loudly if the bridge is missing, and the check must
have a proven failure path — a check that always prints `ok` does not satisfy this.

**R9 — The bridge must be inert outside its remit.**
It is loaded globally in every Pi project on the machine. With no `.trellis/`
project, or with no active task, it must publish nothing, inject nothing, write no
file, and block nothing.

## Non-Goals

- Removing or unpatching the generated `trellis_subagent` tool.
- Upstream changes to `@mindfoldhq/trellis` (no template edits, no PR).
- Any non-Pi platform.
- Adopting pi-subagents worktrees, lanes, missions, or schedules for Trellis
  roles — this task only restores context correctness.
- Adding a test suite; this repo's verification is its command chain.

## Acceptance Criteria

Every AC must be checkable by a third party from an artifact, and must be capable
of failing. AC1 in particular is written around the mid-turn case, because a probe
run in a later turn passes whether or not that case works.

- [ ] **AC1** A child dispatched **in the same turn as a task activation**
      resolves that task: it reports `Current task: <that task path>` and
      `Source: session:pi_<parent session id>`. The probe records the task path
      used, so the criterion does not depend on a path that stops existing when
      the task is archived.
- [ ] **AC2** The same child's system prompt carries a `<workflow-state>`
      breadcrumb naming **that task** with its real status — not
      `Status: no_task` — and no `<session-overview>` whose `CURRENT TASK` is
      `(none)`. The probe records the child's run mode (background), because a
      foreground child has no ambient extensions and would pass vacuously.
- [ ] **AC3** Inside that child, an ordinary bash call's `$TRELLIS_CONTEXT_ID`
      resolves to the task through the child's own runtime pointer, and the
      pointer file the bridge wrote exists at the child's derived key.
- [ ] **AC4** A `trellis-check` (or `trellis-implement`) child dispatched with
      only `Active task: <path>` reads the task's `prd.md` and its `.jsonl`
      manifest entries, **and** its system prompt contains the bridge's
      dispatch-adapter note for the `Task: ` prefix. The second clause is the only
      new artifact for R4; without it this AC cannot fail (it already passed
      before any change).
- [ ] **AC5** A parent-role probe's system prompt contains the bridge's constant
      dispatch guidance naming `subagent({agent:"trellis-…"})`; no **tracked**
      document presents `trellis_subagent` as the Pi dispatch path; and
      `design.md` records the advisory choice together with the blocking
      fallback. (Whether the model *chooses* the right tool is not an AC — it is
      not falsifiable from an artifact.)
- [ ] **AC6** With no active Trellis task: nothing is published to `process.env`,
      no pointer is written, no guidance is injected, and nothing is blocked.
- [ ] **AC7** `.trellis/spec/config/pi-resources.md` §`pi-agent/extensions/` and
      `pi-agent/extensions/README.md` both name `trellis-subagents-bridge`, and
      `git diff --name-only` includes both files.
- [ ] **AC8** `./scripts/doctor.sh` reports the bridge check as passing, **and**
      its failure path is proven: with the bridge moved aside (or
      `PI_CODING_AGENT_DIR` pointed at an empty dir) the check prints `bad` and
      the script exits 1.
- [ ] **AC9** Verification chain passes: `bash -n setup.sh scripts/*.sh`;
      `node --check scripts/*.mjs`; `./setup.sh` twice with identical output;
      `./scripts/sync.sh` reporting `Already up to date.`; `./scripts/doctor.sh`
      ending in `All good.`
- [ ] **AC10** `git diff --name-only` touches no file listed in R6, and
      `.trellis/.template-hashes.json` is unchanged. `git status --short` shows
      only this task's intended files, and is clean after the commit.

### Coverage

| Requirement | ACs |
|---|---|
| R1 | AC1, AC3 |
| R2 | AC2 |
| R3 | AC3 (dissolved by construction, not patched) |
| R4 | AC4 (second clause) |
| R5 | AC5 |
| R6 | AC10 |
| R7 | AC7 |
| R8 | AC8 |
| R9 | AC6 |

## Notes

The mechanism and the rejected alternative are in `design.md` and
`research/dispatch-bridge-mechanisms.md`; the three planning reviews that produced
this revision are in `research/validation-findings.md`. The evidence table (E1–E13)
is reproduced from source or live children, not asserted.

# Design — Pi Trellis role dispatch via pi-subagents

Superseded mechanism: `research/dispatch-bridge-mechanisms.md` records the
rejected Path A and why. Review findings: `research/validation-findings.md`.

## Purpose

Make `pi-subagents` the dispatch path for Trellis role agents on Pi, entirely in
the tracked harness layer, without editing any Trellis-generated file.

## The invariant

> A pi-subagents child of a Trellis session resolves **the same active task as its
> parent**, through every channel the generated Trellis extension and the Trellis
> Python scripts consult.

There are four channels, and three of them are consequences of one value:

| # | Channel | Decided by |
|---|---------|-----------|
| 1 | Python (`task.py current`, `get_context.py`) | `TRELLIS_CONTEXT_ID` → `.trellis/.runtime/sessions/<key>.json` (`active_task.py:548` before `:569`) |
| 2 | Generated extension `readTaskDir(root, key)` | `contextKey()` from the **child's own** session id |
| 3 | Generated extension bash hook (`index.ts:2096-2107`) | the same `contextKey()` value |
| 4 | Generated extension `systemPrompt` + `trellis-runtime-context` message | driven by (2) |

The design fixes the **value**, not its three consequences. Nothing is rewritten
or stripped, because nothing is wrong once the child's key resolves.

## Evidence

All rows are reproduced from source or a live child; see
`research/validation-findings.md` for the full verdicts.

| # | Fact | Evidence |
|---|------|----------|
| E1 | A detached child inherits the parent's process env | `pi-subagents/src/runs/background/async-execution.ts:603-609` spawns with `env: { ...omitExtensionBindingsEnv(process.env), … }`; `extension-bindings.ts:75-78` strips only `PI_SUBAGENT_EXTENSION_BINDINGS` |
| E2 | `TRELLIS_CONTEXT_ID` is **not** in the parent env; it is command text | `ps`/`cmdline` shows `/bin/bash -c export TRELLIS_CONTEXT_ID='pi_…'; …` |
| E3 | A child inherits no key; its own extension derives a child-scoped one | child's injected value was `pi_<child PI_SESSION_ID>` ≠ `PI_SUBAGENT_PARENT_SESSION` |
| E4 | A child's `task.py current` exits 1 today | reproduced: `Current task: (none)` / `Source: none` |
| E5 | The project extension **does** load in a background child | the reviewing child carried `<workflow-state>Status: no_task` in its own prompt |
| E6 | The agent prelude's `Active task:` path works | child read `prd.md`/`design.md` from the dispatched path alone |
| E7 | pi-subagents prefixes every child prompt with `Task: ` | `src/runs/background/subagent-runner.ts:1190`; seen live |
| E8 | `TRELLIS_CONTEXT_ID` outranks the session key in Python | `active_task.py:548` (return 549-550) before `_lookup_env_context_key` at `:569`; reproduced locally |
| E9 | pi-subagents already discovers the three roles | `.pi/agents/**/*.md` project discovery; frontmatter tool lists intact |
| E10 | Permission forwarding already works | `PI_SUBAGENT_PARENT_SESSION` present in parent and child |
| **E11** | **Resolution is purely "does the runtime file exist"** — the key need not be a real session | wrote a fabricated `pi_bridge_probe_test.json`; `TRELLIS_CONTEXT_ID=pi_bridge_probe_test task.py current --source` → resolves the task, exit 0 |
| **E12** | **The child's derived key is `pi_` + its `PI_SESSION_ID`, stable, unhashed** | live child: injected prefix byte-identical to `pi_01a09b26-…`; same key at two shell pids; no `_<hash>` suffix |
| E13 | Project-local extensions load before global ones | `dist/core/package-manager.js:1990` before `:2007-2008`, sorted by `resourcePrecedenceRank`; hook chaining at `dist/core/extensions/runner.js:890-931` |

**Method note (E12).** `ps -o args= -p $$` is *blind* to the injected prefix —
bash exec-optimises the final command and replaces its image with `ps`. The prefix
is observable via `/proc/$$/cmdline` from a non-optimisable `{ …; }` compound.
This matters: it makes the derived key directly checkable rather than a silent
guess.

## Architecture

One new tracked global extension,
`pi-agent/extensions/trellis-subagents-bridge/index.ts` (already covered by
`PI_DIRS` in `scripts/lib.sh:17`; `setup.sh` symlinks it to
`~/.pi/agent/extensions/`). No new wiring, no generated file touched.

### Parent role

1. Resolve the active task path from `<root>/.trellis/.runtime/sessions/<own key>.json`,
   applying the same containment rule as `containInRoot` (refuse a pointer that
   resolves outside the project root, and refuse a missing/dangling one).
2. Publish `process.env.TRELLIS_CONTEXT_ID = <own key>`; `delete` it when no task
   resolves. The parent's *own* behaviour is unaffected — its `contextKey()` never
   reads this variable.
3. **Re-resolve in `tool_call` when `toolName === "subagent"`.** This is the
   mid-turn fix: `task.py start` runs as a bash call during a turn, and the
   dispatch normally follows later in that same turn. `emitToolCall` is awaited
   before the tool executes, so the env is correct before the runner spawns.
4. Append a **constant** dispatch-guidance string naming
   `subagent({agent:"trellis-…", task:"Active task: …"})`. Constant, because the
   generated extension deliberately freezes what it injects — provider prefix
   caches invalidate from byte 0 on any change (`index.ts:1877-1895`). Gated on
   the same predicate as (2), so it is inert with no active task.

### Child role

Predicate: `PI_SUBAGENT_CHILD === "1" && process.env.TRELLIS_SUBAGENT_CHILD !== "1"`.
The second clause matters: `buildChildEnv` sets **both** markers for its own
children (`index.ts:1552-1559`), and those children already have a correct key.

On `session_start`:

1. Derive the child's own key exactly as `contextKey()` does — normalise to
   `[A-Za-z0-9._-]`, append `_${sha256(id).slice(0,24)}` when normalisation
   changed anything, fall back to `pi_transcript_<hash>`, and never substitute a
   random `pi_process_<hash>` (the generated extension does; the bridge must
   publish nothing instead).
2. Read `process.env.TRELLIS_CONTEXT_ID` → `.trellis/.runtime/sessions/<that>.json`
   → `current_task`. Validate the directory exists and is inside the root.
3. Write `<root>/.trellis/.runtime/sessions/<own key>.json` with
   `{platform:"pi", last_seen_at, current_task, current_run:null}`.

Delete that file on `session_shutdown`.

**Why this fixes channels 2–4 without touching them.** `readTaskDir` reads exactly
that path, so the child's extension resolves the real task: the breadcrumb becomes
`Task: <id> (in_progress)` instead of `no_task`, the task context is injected
correctly, and the bash hook prefixes the child's own key — which now resolves.
Nothing needs stripping, filtering, or rewriting.

### Foreground children

A foreground child (`host:"parent"`) loads no ambient extensions
(`child-launch.ts:286`), so it has no channel 2–4 at all — which also means Path A's
corrections could pass its ACs while doing nothing. Path B covers it through
channel 1: the inherited `TRELLIS_CONTEXT_ID` makes `task.py` resolve, which is the
only channel such a child has. The probe must record which mode it ran in.

### The `Task: ` prefix (R4)

pi-subagents rewrites the child prompt to ``Task: ${task}``, so the generated
preludes' "first line is `Active task:`" rule no longer matches literally. The
bridge appends one short constant note to the child's system prompt stating the
real shape, plus "do not run `task.py finish`" (the child now appears as the task's
own session). Upstream prelude relaxation remains the cleaner long-term fix and is
recorded as a follow-up, not done here.

### Dispatch steering (R5) and removing the shipped tool (R10)

Two changes, because they address different halves of the same problem.

1. **Advisory guidance (R5).** A constant `<trellis-pi-dispatch>` block naming
   `subagent({agent:"trellis-…", task:"Active task: …"})`. The generated tool's own
   guideline already says `Use subagent for task delegation…`
   (`index.ts:1931-1932`) while its name is Trellis-themed, so the competition is
   real.
2. **Deactivation (R10).**
   `pi.setActiveTools(pi.getActiveTools().filter((n) => n !== "trellis_subagent"))`,
   applied on `session_start` and on every `before_agent_start`.

**Why deactivation rather than patching the generated file.** Patching
`.pi/extensions/trellis/index.ts` was considered, and is the option that was
initially requested. It is rejected on four grounds:

| | Patch the generated extension | Deactivate via `setActiveTools` |
|---|---|---|
| Versioned in this repo | **no** — `.pi/` is gitignored, so the patch is machine-local and unreproducible | yes, tracked harness code |
| Survives `trellis update` | shows as local drift and prompts every upgrade; the patch must be re-applied after each regeneration | yes |
| Reproducible on a fresh clone / another machine | no | yes |
| Removes the tool's injected `promptGuidelines` | yes | yes — Pi includes guidelines only while the tool is active |
| Failure mode | the patch must keep matching generated text that upstream may change | a recomputed active set between turns could re-add the tool |

Mitigations for the last row: the removal is re-applied on **every**
`before_agent_start`, not just at session start, and the filter is idempotent and
cheap. `setActiveTools` ignores unknown names, so an already-removed tool is a
no-op.

Deactivation keeps R6 intact — no generated file is edited — and is the only one
of the two that a fresh clone reproduces. Rationale for the rejected advisory-only
variant: `research/dispatch-bridge-mechanisms.md`.

## Risks

| Risk | Severity | Handling |
|------|----------|----------|
| The pointer filename is a derived key; a wrong derivation fails **silently** | High | Replicate all four `contextKey()` branches; E12 settles the actual shape empirically; the probe asserts it end-to-end rather than trusting the derivation |
| A crashed child leaves a stale pointer | Low | `.trellis/.runtime/sessions/` already holds a dangling pointer (`.trellis/tasks/09-13-early-compaction`); cleanup on `session_shutdown`; accept residual litter, do not add a prune pass |
| `_resolve_single_session_fallback` requires exactly one pointer file | None now | Already inactive on this machine (two files already exist); record, do not "fix" |
| `clear_task_from_sessions` will also clear child pointers | Desirable | `task_store.py:1459-1461`; a pointer to a finished task should not survive |
| A global extension writes into `.trellis/.runtime/` | Medium | Validate root containment and directory existence before writing; delete on shutdown |
| Mid-turn staleness **after** a dispatch within the same turn (e.g. task switched between two dispatches) | Low | `tool_call` re-resolution covers dispatch ordering; document the residual window |
| Stripping/rewriting is gone, so the extension cannot over-correct | — | This is the point: the generated extension is left to do its job |

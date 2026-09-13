# Verification evidence — Pi Trellis role dispatch via pi-subagents

Commit `d7f0f3e`. All probes below are raw output from live Pi processes; none are
inferred. The three static reviews that preceded implementation are in
`validation-findings.md`.

## How the child role was tested without `/reload`

Extensions load at session start, so the parent (this interactive session) could
not observe the bridge without a `/reload`. Instead each probe ran a fresh Pi
process with `--session-id <pinned>`, which lets the test control whether an
active-task pointer exists for that session, and lets the child be reached by
setting `PI_SUBAGENT_CHILD`/`TRELLIS_CONTEXT_ID` directly.

## T1 — child role: pointer written, task resolved

```
$ PI_SUBAGENT_CHILD=1 PI_SESSION_ID=aaaaaaaa-… TRELLIS_CONTEXT_ID=<parent key> \
    pi -p "… python3 ./.trellis/scripts/task.py current --source"
Current task: .trellis/tasks/09-13-pi-subagents-dispatch
Source: session:pi_01a09b4c-e51e-704c-b759-54679e7ae1e7
```

The `Source` key is **not** the injected `PI_SESSION_ID` (`aaaaaaaa-…`) — it is
the id `sessionManager.getSessionId()` returns. This is the single most valuable
result in the set: the first implementation derived the key at module scope, where
only the environment fallback is reachable, and would have written the pointer
under `pi_aaaaaaaa-…` while the generated extension looked for
`pi_01a09b4c-…` — a silent no-op. Deriving from `ctx` at event time fixed it.

## T2 — child role: pointer content mid-session

```
$ … sh -c 'ls .trellis/.runtime/sessions/; echo ---; cat .trellis/.runtime/sessions/*.json'
pi_01a09ab6-…json
pi_01a09af3-…json
pi_01a09b4d-5964-7306-a186-d829738e108c.json      <- written by the bridge
---
{"platform":"pi","last_seen_at":"2026-09-13T15:05:33Z",
 "current_task":".trellis/tasks/09-13-pi-subagents-dispatch","current_run":null}
```

Absent after the run (`session_shutdown` removed it).

## T3 — inertness outside a Trellis project (R9 / AC6)

From `/tmp`: exit 0, no `.trellis` created, no pointer, no error.

## T4 — parent role publishes, with a real control

| Session | Pointer for the pinned id | Reply |
|---|---|---|
| `ffffffff-…` | present | `<trellis-pi-dispatch>` + first line, byte-exact from source |
| `eeeeeeee-…` | absent | `NONE` |

Run as two **independent** session ids. The first attempt reused one id for both
arms, which resumed the first session's history and contaminated the control; the
model additionally volunteered that it had "confabulated" the earlier block — an
unfounded self-correction, since the block existed only during the arm where the
pointer was present. Self-report about one's own system prompt is not evidence;
the byte-exact quote plus an independent control is.

**Superseded by T12 — do not rely on this arm.** A later mechanical probe showed
the model answering `NONE` for a block that was demonstrably present in the
assembled prompt, so a model's report about its own system prompt is not evidence
in *either* direction. The positive arm here was probably genuine when it ran — at
`d7f0f3e` `design.md` did not yet contain the literal `<trellis-pi-dispatch>` tag,
which a later docs edit introduced — but that is exactly why it could not detect
the defect that edit caused.

## T5 — P0: activate a task and dispatch in the same turn (AC1)

Precondition verified: zero pointers for the pinned parent id, so nothing was
published at turn start. The session then ran `task.py start` and dispatched:

```
Current task: .trellis/tasks/09-13-pi-subagents-dispatch
Source: session:pi_01a09b4f-4c66-7634-805d-76092eecf487
```

Proves three things at once: the parent's `tool_call` refresh published the key
mid-turn, the child inherited it, and the child resolved the task **through its own
pointer** (the `Source` key is the child's own session id).

## T6 — AC2: the breadcrumb the child receives

```
Task: pi-subagents-dispatch (in_progress)
```

Was `Status: no_task` before the change.

## T7 — AC4: the `Task: ` adapter note

```
(a) PRESENT — opening line: On Pi, pi-subagents prefixes your dispatch prompt with "Task: ".
(b) ABSENT  — no <trellis-pi-dispatch> block exists in my system prompt.
```

The child gets its own note and **not** the parent's dispatch guidance — the role
split holds.

## T8 — AC8: doctor failure path

Bridge moved aside:

```
==> Trellis subagent bridge
  ✗ pi-agent/extensions/trellis-subagents-bridge/index.ts missing
1 problem(s) found.
doctor exit=1
```

Restored afterwards. Without this, a check that always prints `ok` would have
satisfied the plan.

## T9 — verification chain

| Command | Result |
|---|---|
| `bash -n setup.sh scripts/*.sh` | ok |
| `node --check scripts/*.mjs` | 3/3 ok |
| `./setup.sh` ×2 | exit 0 both, **byte-identical output** |
| `./scripts/sync.sh` | exit 0 |
| `./scripts/doctor.sh` | 0 problems, 1 note |

## T10 — AC11: the shipped tool is uncallable (R10)

The tool list was read and the call was attempted in two fresh sessions. The
subagent run directory count is the deterministic part: it cannot move unless a
child was actually dispatched.

```
subagent runs before: 20

probe 1 (tool list, with a control):
  TRELLIS=no        # "trellis_subagent" is absent
  SUBAGENT=yes      # the list is readable and still contains extension tools

probe 2 (attempt the call):
  NOT AVAILABLE

subagent runs after: 20  ->  new runs created: 0
```

The `SUBAGENT=yes` control is what makes probe 1 meaningful: it rules out "the
model could not see any tool list". Zero new runs proves no dispatch occurred.

An earlier attempt at a detector is worth recording because it was wrong: session
JSONL files appeared to contain `trellis_subagent` in 27 files, but tool
definitions are not persisted in the session — the single hit per file was this
task's own `task.json` description text. That detector would have reported a false
negative after the change and a false positive before it. An attempted call plus
the run-count delta replaced it.

Removing the tool also removes its injected `promptGuidelines`, because Pi
includes a tool's guidelines only while the tool is active (`docs/extensions.md`).

## T11 — AC12: the shipped tool's own child keeps its key (B1 fix)

The check phase found that a child of the shipped `trellis_subagent` tool failed
`isBridgeChild()`, fell into the parent branch, and had its inherited key deleted.
Re-run of the reviewer's A/B after the fix, with the generated extension inert in
that child (so the environment is its only channel):

```
$ env -u PI_SESSION_ID PI_SUBAGENT_CHILD=1 TRELLIS_SUBAGENT_CHILD=1 \
    TRELLIS_CONTEXT_ID=pi_01a09af3-… pi -p '…'
Current task: .trellis/tasks/09-13-pi-subagents-dispatch
Source: session:pi_01a09af3-7c1e-74af-97fb-818681afa9b1
```

Before the fix the same invocation produced an empty `TRELLIS_CONTEXT_ID`,
`Current task: (none)` and exit 1. The `Source:` key is the inherited parent key,
which is what proves the variable survived.

Regression checks in the same pass: a normal pi-subagents child still resolves via
its own pointer (exit 0, pointer removed on shutdown), and R10 still holds
(`NOT AVAILABLE`, run count 21 → 21).

## T12 — AC5 verified mechanically (supersedes the T4 arm)

A probe extension loaded with `-e` registered `before_agent_start` and `agent_end`
handlers and appended whatever `ctx.getSystemPrompt()` returned — the final
assembled prompt — to a file. The session's runtime pointer targeted **this** task,
whose injected docs contain the bare opening tag: the collision case.

```
BEFORE len=17509  bareTag=false guidance=false
END    len=132507 bareTag=true  guidance=true
```

`guidance=true` is the fix. The idempotency guard now tests the whole constant, so
the bare tag appearing in `design.md` prose no longer suppresses the block. Before
the fix the same measurement was `bareTag=true, guidance=false` — the block was
missing precisely for the session that most needed it.

Method note: this escalation was necessary because the model-based arm reported
`NONE` for a prompt that provably contained the text. Read the assembled prompt; do
not ask the model what it was given.

## Two things the ACs got wrong, found by running them

**1. `sync.sh` and `doctor.sh` are clean-tree assertions, not sync assertions.**
`sync.sh` prints `Already up to date.` only when `git status --short` is empty
(`sync.sh:73`); `doctor.sh` prints `All good.` only when there are no notes, and
warns on *any* uncommitted change. Both are therefore unreachable while any other
task's work is uncommitted in the same checkout. AC9 was copied from a sibling
task's chain and asserted those strings without that condition.

**Resolved later in the same session.** The other task committed (`b55ff03`), the
tree went clean, and both assertions then passed **exactly as originally
written**: `sync.sh` reported `Already up to date.` and mutated nothing, and
`doctor.sh` ended in `All good.` with exit 0. So that correction was *conditional*,
not a permanent weakening — the strings are real, they simply cannot be verified
from a dirty checkout.

The transient `settings.json has drifted from the repo` failure the second checker
round saw was the same task mid-flight: it was adding `npm:pi-mcp-adapter` and
`npm:pi-lens` to core, which is why `render-settings.mjs --check` now reports `ok`.

**2. Running `./scripts/sync.sh` as a verification step mutated a file owned by
another task.** It folds live settings into core by design, and the live
`settings.json` now carries two packages added by the in-flight
`09-13-early-compaction` work:

```diff
-    "npm:@gotgenes/pi-permission-system"
+    "npm:@gotgenes/pi-permission-system",
+    "npm:@sting8k/pi-vcc",
+    "npm:@thunstack/auto-compact"
```

This change was left uncommitted rather than reverted or claimed — it is that
task's work, not this one's. It is a genuine hazard worth recording: `sync.sh` is
not read-only, so using it as a verification step can absorb unrelated live state
into a commit. Its optional-bundle stripping behaved correctly (the
`@oscarfalero/pi-opencode-go` entry was *not* folded into core).

# Implement Plan — Pi Trellis role dispatch via pi-subagents

Read `prd.md` (R1–R9, AC1–AC10) and `design.md` (mechanism + evidence E1–E13)
first. `implement.jsonl` lists the specs governing the touched layer; the three
planning reviews are in `research/validation-findings.md`.

## Constraint reminder

Do **not** edit anything under `.pi/`, `.agents/`, or `.trellis/workflow.md`.
Those are generated and/or gitignored. Everything lands in `pi-agent/`,
`scripts/`, `README.md`, or `.trellis/spec/`.

## Step 1 — Bridge skeleton and the key derivation

Create `pi-agent/extensions/trellis-subagents-bridge/index.ts`.

- Default-export factory taking the `pi` API object, registering via
  `pi.on?.(...)`. Zero dependencies, `node:` builtins only, no build step.
- Guard: resolve the project root from `ctx.cwd` (fall back to `process.cwd()`);
  return immediately unless `<root>/.trellis` is a directory. This is AC6/R9.
- Implement `contextKey()` **as an exact copy of the four branches** at
  `.pi/extensions/trellis/index.ts:1063-1079`:
  normalise to `[A-Za-z0-9._-]`; if empty → `pi_${sha256(id).slice(0,24)}`; else
  `pi_${normalized}` plus `_${sha256(id).slice(0,24)}` when normalisation changed
  anything; transcript fallback `pi_transcript_<hash>`.
  **Do not** reproduce the generated extension's random `pi_process_<hash>`
  fallback (`index.ts:1847`) — return `null` and publish nothing instead.

Verification: the file loads without error under Pi. Do not rely on a manual
inspection here — Step 5's probe is the real check.

## Step 2 — Parent role: publish, and refresh at dispatch time

On `session_start` and on every `before_agent_start`:

- Resolve the active task from `<root>/.trellis/.runtime/sessions/<own key>.json`
  (`current_task`). Apply the same containment rule as `containInRoot`
  (`index.ts:1093-1101`): refuse a pointer that resolves outside the root, and
  refuse one whose target directory does not exist (a dangling pointer must not be
  published — `.trellis/tasks/09-13-early-compaction` shows these exist).
- Set `process.env.TRELLIS_CONTEXT_ID = <own key>` when a task resolves; `delete`
  it otherwise.

On `tool_call`, when `event.toolName === "subagent"`, **re-run that same resolve
and publish before returning.** This is the mid-turn fix (validation finding D1):
`task.py start` is a bash call during the turn, and the dispatch follows later in
that same turn. `emitToolCall` is awaited before the tool executes, so the env is
correct by the time the runner spawns.

Do not publish on every `tool_call`; gate on the dispatch tool names.

## Step 3 — Child role: write and remove the runtime pointer

Predicate: `process.env.PI_SUBAGENT_CHILD === "1" &&
process.env.TRELLIS_SUBAGENT_CHILD !== "1"`.

**Updated after the check phase.** There are three roles, not two, and the third
is an explicit no-op. A child of the shipped `trellis_subagent` tool sets **both**
markers (`buildChildEnv`, `index.ts:1552-1559`); its generated extension sets
`TRELLIS_CONTEXT_ID` itself and is then inert there, so the environment is that
child's only channel. Such a child must return early **before any role logic**:
falling through to the parent branch runs `publish()`, finds no pointer at the
child's own key, and deletes the key the shipped tool just set. See
`research/check-phase-findings.md` § B1.

On `session_start`:

1. `key = contextKey(...)`; if `null`, do nothing.
2. Read `process.env.TRELLIS_CONTEXT_ID` → `.trellis/.runtime/sessions/<that>.json`
   → `current_task`. If unset or unresolvable, do nothing.
3. Validate `current_task` inside the project root **and** that the task directory
   exists.
4. Write `<root>/.trellis/.runtime/sessions/<key>.json` as
   `{platform:"pi", last_seen_at, current_task, current_run:null}`.

On `session_shutdown`: delete exactly that file.

No `systemPrompt` manipulation, no bash rewriting, no message filtering — the
generated extension resolves correctly through this file and does all of it
natively. If you find yourself writing a strip or a rewrite, stop: the design
rejects that path (`research/dispatch-bridge-mechanisms.md`).

## Step 4 — Constant notes for R4 and R5

Two **constant** strings (no task path, no per-turn state — the generated
extension freezes its injections because provider prefix caches invalidate from
byte 0; `index.ts:1877-1895`):

- **Child role** (`before_agent_start`): the dispatch-adapter note — pi-subagents
  prefixes the prompt with `Task: `, so `Task: Active task: <path>` means
  `Active task: <path>`; plus "do not run `task.py finish`", since the child now
  resolves as the task's own session.
- **Parent role**: the dispatch guidance naming
  `subagent({agent:"trellis-…", task:"Active task: …"})`, gated on the same
  resolved-task predicate as Step 2 so AC6 holds.

**Updated by R10 (supersedes "advisory only").** The bridge now also calls
`disableShippedTool(pi)` on `session_start` and on every `before_agent_start`, so
the shipped tool is not merely out-competed but uncallable, and its
`promptGuidelines` are no longer injected. Do not add a blocking `tool_call` hook
for it — deactivation makes one unnecessary, and a hook would fire only if
deactivation had already failed.

## Step 5 — Behavioural probes (AC1–AC5)

**Run `/reload` first.** Extensions load at session start or `/reload`; without it
the probes test the old code and fail for the wrong reason.

**5a — the mid-turn probe (AC1, AC2, AC3).** This is the AC that the earlier plan
could not fail, so construct it deliberately:

1. Create a scratch task and `task.py start` it **in the same turn** as the probe
   dispatch, so the publish must come from the Step 2 `tool_call` refresh rather
   than from turn start.
2. Dispatch one background child that reports: `task.py current --source`; its own
   `$TRELLIS_CONTEXT_ID`; its own `PI_SESSION_ID`; whether its system prompt
   contains a `<workflow-state>` naming the scratch task; and its run mode.
   Have it read the injected key from `/proc/$$/cmdline` inside a `{ …; }`
   compound — `ps -o args= -p $$` is blind (E12 method note), and a probe that
   uses the blind method will report "no prefix" and look like a failure.
3. The child must resolve the **scratch** task. If it resolves the previous task,
   the `tool_call` refresh is not running.
4. Restore the original active task and delete the scratch task and its pointer.

**5b — the role probe (AC4).** Dispatch `trellis-check` with only
`Active task: <task>` plus a read-only task; confirm it reads `prd.md` and the
`.jsonl` entries **and** that its system prompt contains the adapter note.

**5c — scope (AC2 honesty).** Repeat 5a once with `async:false` (foreground) and
record that a foreground child has no ambient extensions; its pass proves only
channel 1. Do not count it as evidence for AC2/AC3.

Paste raw outputs into the task notes. Do not summarize them.

## Step 6 — doctor.sh check (AC8, R8)

Add a check following `.trellis/spec/scripts/shell-guidelines.md`:

- Assert the bridge file exists in the repo **and** is linked into the config dir.
  Target the env-overridable `$PI_DST` (already defined at `doctor.sh:15`), never
  `$HOME/.pi/agent`.
- Assert the discovery input pi-subagents actually consumes:
  `.pi/agents/trellis-{implement,check,research}.md` exist. Do **not** try to call
  `subagent({action:"list"})` — that is a model-facing tool, not callable from
  bash.
- Missing bridge ⇒ `bad` (R8 says fail loudly). A missing `.pi/` in a fresh clone
  ⇒ `warn` with a reason.
- Never `exit` early; branch on `${#arr[@]}` rather than a bare `"${arr[@]}"`.

Then prove the failure path: move the bridge aside (or point
`PI_CODING_AGENT_DIR` at an empty dir) and confirm the check prints `bad` and the
script exits 1. Restore afterwards. Without this, a check that always prints `ok`
would satisfy the plan.

## Step 7 — Documentation (AC7, R7)

- `.trellis/spec/config/pi-resources.md` §`pi-agent/extensions/` — add
  `trellis-subagents-bridge/` to the table and say what it does and why it is
  global.
- `pi-agent/extensions/README.md` — same, in that file's voice.
- `README.md` — only if a user-visible fact changes; R7 names it, so either update
  it or state in the task notes why no change was needed.

Note: a repo-wide grep finds **zero** tracked docs presenting `trellis_subagent`
as the Pi dispatch path, so there is nothing to correct there — do not fabricate
an edit to satisfy the AC.

## Step 8 — Verification chain (AC9, AC10)

```bash
bash -n setup.sh scripts/*.sh
node --check scripts/*.mjs
./setup.sh          # twice; output must be identical
./scripts/sync.sh   # must end "Already up to date."
./scripts/doctor.sh # must end "All good."
git status --short
```

Confirm `git diff --name-only` lists nothing from the Constraint reminder, and that
`.trellis/.template-hashes.json` is unchanged.

## Step 9 — Commit

One commit: bridge, doctor check, docs, task artifacts. Parent session owns the
commit — a dispatched child must not run `git commit`.

## Done When

AC1–AC10 are checked with pasted evidence; the 5a probe demonstrably resolved the
scratch task activated in its own turn; the doctor failure path was observed; and
`design.md` § Risks still describes the derivation risk accurately — if 5a
resolved nothing, fix the derivation rather than relaxing the AC.

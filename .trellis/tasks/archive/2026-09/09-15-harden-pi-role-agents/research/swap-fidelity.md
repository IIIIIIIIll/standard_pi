# Swap fidelity — what a pi-subagents child actually receives

Measured 2026-09-15 by reading `pi-subagents` (`~/.pi/agent/npm/node_modules/pi-subagents`)
and the generated Trellis extension, then by two dispatches of `trellis-check` from
this task: one blocking (`async: false`) and one async, each asked to report raw
facts and change nothing. Session and run artifacts were inspected afterwards.

This file answers the question the PRD's structure assumed rather than measured:
**does using the bridge to swap the subagent system faithfully reproduce what the
shipped `trellis_subagent` tool gave a child?**

Short answer: the swap is correct about the *task key* and wrong about almost
everything else, and the artifacts understated it.

---

## 1. The child's system prompt is assembled upstream, in the parent

`pi-subagents/src/runs/shared/effective-system-prompt.ts` (33 lines) composes the
child's system prompt from five sources, in this order, and the file's own comment
says the order is hashed for launch identity:

```text
agent.systemPrompt            ← the agent definition body (.pi/agents/trellis-check.md)
+ buildSkillInjection(...)    ← resolved skills, only when non-empty
+ buildAgentMemoryInjection() ← only when the agent declares `memory:` frontmatter
+ appendAgentRefinementOverlay()
+ injectOutputPathSystemPrompt()
```

It runs in the **parent** (`src/runs/background/async-execution.ts:1057`), is
serialized into the run configuration, and the runner passes it to the child
session as its system prompt (`src/runs/background/runner-child-launch.ts:58`).

Everything the bridge or the generated extension adds arrives **after** this, at
child session start, through Pi's extension hooks — and so is outside that hashed
prompt identity.

## 2. Ambient extension loading is host-dependent — and that decides everything

```ts
// pi-subagents/src/runs/shared/child-launch.ts:295
const ambientExtensions = input.host === "runner" && !toolPlan.disableAmbientExtensions;
```

with the field's own doc at `:116-118`: *"The parent never loads ambient
extensions … the runner loads ambient extensions when the tool plan allows."*
`child-session.ts:68` describes them as *"the agent dir, project, settings the way a
normal session would"*.

So there are two different children, and the PRD treats them as one:

| | blocking dispatch (`async: false`) | async dispatch (default) |
| --- | --- | --- |
| host | `parent` | `runner` |
| ambient extensions | **none** | loaded — bridge **and** generated extension |
| `PI_SUBAGENT_CHILD` | **unset** (measured) | `1` (measured) |
| `TRELLIS_SUBAGENT_CHILD` | unset | unset |
| `TRELLIS_CONTEXT_ID` | the **parent's** key, inherited from the parent's env | the **child's own** key, exported by the generated extension's bash wrapper |
| `PI_SUBAGENT_PARENT_SESSION` | parent session id | parent session id |
| bridge note `<trellis-pi-dispatch-adapter>` | **absent** | present |
| `### Curated Spec / Research Context` | **absent** | present |
| `<trellis-pi-dispatch>` | absent | present (as prose inside injected spec text) |
| `<trellis-task-context-update>` | absent | absent |

The `PI_SUBAGENT_CHILD=1` line is `src/runs/background/subagent-runner.ts:173` — a
module side effect inside the runner. When the parent hosts the child, that module
never loads, which is why the variable is absent rather than "0".

Default behaviour is async: `resolveAsyncByDefault` returns
`config.asyncByDefault !== false` (`src/extension/config.ts:209`) and this machine
has no pi-subagents `config.json` overriding it. **A blocking dispatch therefore
gets no bridge, no generated extension, and no injected context at all** — the
"foreground children miss the bridge note" item that earlier drafts recorded as a
vague revisit trigger, now measured with a cause and a trigger.

## 3. The check child is fed `implement.jsonl` — now proven, not inferred

The async check child's injected `### Curated Spec / Research Context` block named
exactly these seven paths, in order:

```text
.trellis/spec/index.md
.trellis/spec/config/index.md
.trellis/spec/scripts/index.md
.trellis/spec/scripts/node-guidelines.md
.trellis/spec/config/pi-resources.md
.trellis/spec/config/layout-and-surfaces.md
.trellis/spec/guides/change-propagation-guide.md
```

That is this task's `implement.jsonl` (7 entries) verbatim. `check.jsonl` holds 9
entries and this note plus `skill-delivery-probe.md` are in it; **both were reported
absent from the block**. So `check.jsonl` is never injected, and the hardcoded
literal at `.pi/extensions/trellis/index.ts:2132` —
`buildContext(root, "trellis-implement", k)` — is confirmed end to end.

A check child is therefore curated with one manifest and injected with another.

## 4. The child also receives main-session instructions that contradict its role

The child's session file contains a `custom_message` of `customType:
trellis-runtime-context`, `display: false`, whose content is the **planning
breadcrumb for the active task**:

```text
<workflow-state>
Task: harden-pi-role-agents (planning)
Load `trellis-brainstorm`; stay in planning.
...
```

plus the full `<session-overview>`. A dispatched check child is told to *stay in
planning* and to load the brainstorm skill, while its own agent definition carries a
recursion guard against dispatching and reviewing instead. That is the unfaithful
swap showing up as a concrete instruction conflict, not a theoretical difference:
the child runs the parent's per-turn session path because only the shipped tool's
`buildChildEnv()` ever set the marker that switches it off.

## 5. The two upstream overlay points are closed to this repo

`buildEffectiveSystemPrompt` has exactly two project-scoped overlay inputs, and both
are name-keyed **and** inside a gitignored tree:

| Overlay | Path | Why unusable |
| --- | --- | --- |
| Refinements | `<root>/.pi/subagents/refinements/<agent>.md` (`PROJECT_SUBAGENTS_RELATIVE_DIR = ".pi/subagents"`, `src/shared/artifacts.ts:6`) | file is named after the agent; `.pi/` is gitignored here |
| Agent memory | `<root>/.pi/agent-memory/<path>/MEMORY.md` (`src/agents/agent-memory.ts`) | needs `memory:` frontmatter on the agent definition (generated file), and lives under `.pi/` |

Both would be outstanding carriers otherwise — upstream built them for exactly
"project rules for one agent" — so the closure is worth recording rather than
rediscovering. Neither can be shipped by git from this repo.

## 6. The injected prompt is not persisted anywhere

This decided how AC6 can honestly be written. Measured on the async run:

- The **child's session file** (`~/.pi/agent/sessions/.../run-0/session.jsonl`)
  stores messages, model/thinking changes, and `custom_message` records — but not
  the system prompt. Every `Curated Spec / Research Context` occurrence in it is
  inside a `message` record, i.e. written by the child or by the dispatch prompt.
- The **async run directory** (`/tmp/pi-subagents-*/async-subagent-runs/<id>/`)
  holds `events.jsonl` (52 KB), `status.json`, `output-0.log`, logs. Every
  occurrence of that heading in `events.jsonl` resolves to
  `.message.content[].text` or `.message.content[].thinking` — again message
  content, again polluted by the child's own answer, which repeated the seven paths.

There is no on-disk record of what a child's system prompt contained. The
`PromptAuditView` machinery (`src/runs/foreground/prompt-audit.ts`) exposes
*effective / authored / runtime* views, but its store is an in-memory `WeakMap`
keyed by a foreground run control, so it is a TUI view, not a file.

Consequence for the artifacts: **any delivery check is a probe plus a self-report
unless the bridge is changed to dump what it injected.** That is the honest label
(R5) — not "grep the transcript", which does not work.

## 7. What this means for the design

1. **Tier 1 (bridge injection) is viable for async children only.** The bridge loads
   there, and it is the only repo-owned component inside the child. For a blocking
   child there is no carrier at all, and none is available without editing upstream.
2. **Role-correct manifest selection is reachable without naming a role.** The parent
   sees the dispatched agent in the `subagent` `tool_call` input, and the child
   inherits the parent's env at spawn
   (`async-execution.ts:751` spreads `process.env`; confirmed by the child reading
   the parent's `TRELLIS_CONTEXT_ID` in the blocking run). Relaying that value is not
   naming a role; selecting `{agent}.jsonl` from it restores upstream's own rule.
3. **Making the child inert is feasible but is not a one-liner.** Upstream sets
   `TRELLIS_SUBAGENT_CHILD=1` in the child; the bridge cannot set it in-process after
   the extension factory has run (`trellis/index.ts:1843` is load-time, inside
   `trellisExtension()` at `:1828`), but the **parent** can set it before spawning and
   the child inherits it. That also disables the bridge's own child branch, whose
   predicate currently requires `TRELLIS_SUBAGENT_CHILD !== "1"` — so the bridge
   would need its own marker and to own the child's context entirely.
4. **The foreground gap is a decision, not a detail.** Async is the default, so the
   bridge route covers normal dispatches; a blocking dispatch gets whatever the agent
   definition and the agent's own reads provide, and the gates would reach it only
   through the spec tree if it chooses to read.

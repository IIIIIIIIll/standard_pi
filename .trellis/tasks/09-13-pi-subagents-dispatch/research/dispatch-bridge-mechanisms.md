# Dispatch bridge: two mechanisms compared

Status: **decision document**, written after three independent reviews blocked the
original design. Supersedes the architecture section of `../design.md` once a
path is chosen.

Review evidence and the full findings list: `validation-findings.md`.

---

## The invariant to satisfy

> A pi-subagents child of a Trellis session resolves **the same active task as its
> parent**, through every channel that the generated Trellis extension and the
> Trellis Python scripts consult.

There are exactly four channels, and they split into two groups by *what decides
the answer*:

| # | Channel | Decided by |
|---|---------|-----------|
| 1 | Python (`task.py current`, `get_context.py` → `resolve_context_key`) | `TRELLIS_CONTEXT_ID` override → `.trellis/.runtime/sessions/<key>.json` |
| 2 | Generated extension `readTaskDir(root, key)` | `contextKey()` — derived from the **child's own** session id |
| 3 | Generated extension bash hook (`index.ts:2096-2107`) | same `contextKey()` value |
| 4 | Generated extension system-prompt + `trellis-runtime-context` message | driven by (2) |

Channels **2, 3 and 4 are all consequences of one value**: `contextKey()` as
computed inside the child. Channel 1 is independent.

That asymmetry is the whole argument. The two paths differ in *which* value they
repair:

- **Path A** leaves `contextKey()` wrong and patches each of its three
  consequences separately, plus channel 1.
- **Path B** makes the child's own `contextKey()` resolve correctly, and all four
  channels then work **unmodified**.

---

## Path A — patch the channels

Parent publishes `TRELLIS_CONTEXT_ID`; child corrects the damage:

1. inherit the parent key → fixes channel 1
2. rewrite `TRELLIS_CONTEXT_ID=…` inside every child bash command → fixes channel 3
3. remove the child-scoped `<workflow-state>` / `<session-overview>` /
   `<trellis-workflow>` / `<first-reply-notice>` blocks from `systemPrompt`
   → fixes channel 4
4. additionally filter the `customType: "trellis-runtime-context"` message, which
   carries the same text through a second channel (`index.ts:2136-2176`)

### Findings this path must still solve

| Finding | Status under Path A |
|---|---|
| Key derivation not byte-identical (normalisation + `_<hash>`) | must reimplement `contextKey()` verbatim |
| Bash rewrite was conditional, not insert-or-replace | must fix or channel 3 breaks in reverse order |
| Child gate catches `trellis_subagent` children | must add `TRELLIS_SUBAGENT_CHILD !== "1"` |
| Strip missed the custom message | must add a `context` hook |
| Strip missed `<trellis-workflow>` + `<first-reply-notice>` | replace the whole startup block instead |
| **Load order** (project-local before global) | **retained** — the strip and the message filter both depend on running *after* the generated extension |

Four channels, four patches, one retained High-severity ordering dependency, and
a reimplementation of a private key-derivation function that must stay in sync
with an upstream template this repo does not own.

---

## Path B — make the child's key correct

The parent does not send a key; it sends the **task path**. The child writes its
own runtime session pointer:

```jsonc
// .trellis/.runtime/sessions/<child's own contextKey>.json
{ "platform": "pi", "last_seen_at": "…",
  "current_task": ".trellis/tasks/09-13-pi-subagents-dispatch", "current_run": null }
```

Because `readTaskDir` reads exactly that path, the generated extension — running
**unmodified** — now resolves the real task. Consequently:

- channel 2 resolves → correct
- channel 3 prefixes a **correct** key → nothing to rewrite
- channel 4 injects the **real** `<workflow-state>Task: …(in_progress)</workflow-state>`
  and the real task context, instead of `no_task` → nothing to strip
- channel 1 works as a side effect (`TRELLIS_CONTEXT_ID` becomes the child's own
  key, which now resolves)

### Evidence that this works

Verified directly, not reasoned:

```
$ printf '{"platform":"pi","current_task":".trellis/tasks/09-13-pi-subagents-dispatch"}' \
    > .trellis/.runtime/sessions/pi_bridge_probe_test.json
$ TRELLIS_CONTEXT_ID=pi_bridge_probe_test python3 ./.trellis/scripts/task.py current --source
Current task: .trellis/tasks/09-13-pi-subagents-dispatch
Source: session:pi_bridge_probe_test          # exit 0
```

The key need not correspond to a real session — resolution is purely
"does the runtime file exist and name a task". The extension's `readTaskDir`
performs the same file read (`.pi/extensions/trellis/index.ts:1103-1123`), and
both reviewers confirmed `_context_path` and `readTaskDir` agree on the filename.

### Bridge responsibilities shrink to

**Parent role** — resolve the active task path; export it (one env var); re-resolve
in `tool_call` when `toolName === "subagent"` so a task activated *earlier in the
same turn* is still visible to the child (this is the P0 finding); append a
**constant** dispatch-guidance string.

**Child role** — `PI_SUBAGENT_CHILD === "1" && TRELLIS_SUBAGENT_CHILD !== "1"`:
compute the child's own context key, then write the pointer if the task path
resolves and the directory exists; delete it on `session_shutdown`.

No bash rewriting. No system-prompt surgery. No custom-message filtering. No
load-order dependency.

**Correction (found while designing the deciding probe).** Path B still needs the
key, because the pointer filename *is* the key. It therefore still replicates
`contextKey()`, and the earlier claim that B avoids that reimplementation was
wrong. What B actually changes is how much rests on it: Path A has **four**
corrections whose correctness all depends on the derivation matching an upstream
template this repo does not own, while Path B has **one** filename. And in B that
one is directly observable — the key the generated hook injects is visible in the
child's own `ps` output — so a mismatch is detectable rather than silent.

### Costs and open questions (Path B is not free, and not yet fully probed)

| Cost / risk | Assessment | Handling |
|---|---|---|
| A global extension writes into `.trellis/.runtime/sessions/` | Real. This is more coupling than an env var — it treats the child as a first-class Trellis session. | Cleanup on `session_shutdown`; validate the target dir exists before writing. |
| A crashed child leaves a stale pointer | Runtime dir already holds a dangling pointer (`.trellis/tasks/09-13-early-compaction`); litter is pre-existing, not novel. | Accept + document; optional prune pass is scope creep, not required. |
| `_resolve_single_session_fallback` requires exactly one pointer file | `active_task.py:703-731`. This machine **already has two**, so the fallback is already inactive — Path B changes nothing here. | Record it; do not "fix" it. |
| `clear_task_from_sessions` will also clear child pointers on finish/archive | `task_store.py:1459-1461` | Desirable: a child pointer to a finished task should not survive. |
| Does the child's `ctx.sessionManager.getSessionId()` equal its `PI_SESSION_ID`? | Observed once (the hook injected `pi_<child PI_SESSION_ID>`), not proven in general. If they diverge, the pointer filename would miss. | **Decisive pre-implementation probe** — see below. |
| Ordering: pointer must exist before the first context build | `session_start` precedes `before_agent_start` in Pi's documented lifecycle; writing at module load is even safer. | Use `session_start`; both generated and bridge handlers run before any context build. |
| The pointer filename is the derived key | Both paths need `contextKey()`; B needs it once. If the bridge derives a key the generated extension does not use, the pointer is written under the wrong name and resolution fails **silently**. | Replicate all four branches verbatim, and settle the derivation empirically with the deciding probe rather than by reading the source. |
| Child becomes a "real" Trellis session | The child's `<session-overview>` will list the task as its own; `task.py finish` from a child would clear it. | Role agents are already forbidden from committing; add "do not run task.py finish" to the adapter note. |

### The one probe that decides it

Before writing any bridge code, prove the filename matches in a live child:

1. dispatch one child that reports `printf '%s' "$PI_SESSION_ID"` **and** the value
   the generated hook injected into its bash command (visible via `ps -o args -p $$`);
2. confirm `pi_<PI_SESSION_ID>` is byte-identical to the injected key.

If they match, Path B's mechanism is fully confirmed end-to-end. If they do not,
Path B needs the pointer keyed on the *injected* value instead — still no
ordering dependency, but the child must read it from its own command line.

---

## Comparison

| Criterion | Path A | Path B |
|---|---|---|
| Channels fixed | 4 separate patches | 1 value; all 4 inherit |
| Load-order dependency | **retained (High)** | none |
| Reimplements upstream-private `contextKey()` | yes — 4 corrections depend on it staying in sync | yes — 1 pointer filename depends on it, and it is observable in a child |
| Handles the P0 mid-turn activation | needs the same `tool_call` fix | needs the same `tool_call` fix |
| Handles R4 (`Task: ` prefix) | adapter note | adapter note (unchanged) |
| New failure surface | 4 patches × 2 orderings | pointer write/cleanup + stale pointers |
| Size of bridge | large | small |
| Verified end-to-end | partly (channels probed separately) | one probe remaining |

Both paths still owe: the P0 fix, the AC rework (validation finding 6), and the
`Task: ` adapter note for R4.

---

## Recommendation

**Path B**, for three reasons:

1. It fixes the channels *by construction* instead of correcting four outputs of a
   wrong value — and three of those four corrections exist only because the key is
   wrong.
2. It removes the design's only High-severity dependency, on a Pi implementation
   detail that is not a documented contract.
3. It reduces the bridge's dependence on an upstream-private function from four
   corrections to one filename — and that one is empirically checkable in a live
   child, whereas Path A's four fail silently when wrong.

**Path A does not fail on correctness** — with all six fixes it can be made to
work. It is rejected on fragility, not on wrongness. If the deciding probe above
shows the child's session id and injected key diverge in some hosts, Path A
becomes the safer default and this recommendation flips.

Either way the P0 finding and the AC rework must land, so the choice is not
blocking: it can be made after the probe.

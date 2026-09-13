# Validation findings — planning artifacts review

Three independent reviewers, dispatched in parallel as fresh-context pi-subagents
children. Workflow run `628b9841-6d9e-4574-a96d-14430e2ff980`.

| Key | Agent | Seam | Verdict |
|---|---|---|---|
| `facts` | `trellis-check` | re-derive the evidence table from source | **all 10 rows CONFIRMED, none wrong** |
| `design` | `reviewer` | adversarial: assume the bridge is broken | **BLOCK** — 1 P0, 5 significant |
| `conform` | `reviewer` | artifacts vs repo conventions | **BLOCK** — 6 defects |

The architecture survived; the *specification of it* did not. Two findings were
reached independently by both reviewers, which is the strongest signal in the set.

---

## Convergent (both reviewers, source-verified)

**C1 — "the bash correction is order-independent" was false.**
`cmdHasTrellisCtx()` (`index.ts:473-480`) is `^`-anchored, and the plan's rewrite
was *conditional* ("if the command carries an assignment that is not the
inherited key"). If the bridge runs first, the common case (the model types no
assignment) no-ops; the generated hook then prefixes the child key.
Blast radius is **both** child-side corrections, not just the strip — the risk row
understated it.
*Fix:* insert-or-replace, and state that the bridge intentionally overrides an
explicit user-supplied value (the generated hook deliberately does not).

**C2 — the child gate also matches `trellis_subagent` children.**
`buildChildEnv` sets **both** `TRELLIS_SUBAGENT_CHILD: "1"` and
`PI_SUBAGENT_CHILD: "1"` (`index.ts:1552-1559`). Gating on the latter alone means
the one path that already works would have its correct key overwritten.
*Fix:* `PI_SUBAGENT_CHILD === "1" && TRELLIS_SUBAGENT_CHILD !== "1"`.

**C3 — AC5 is not falsifiable.** "trellis_subagent is not chosen in practice" is a
claim about model behaviour, unmeasurable by a third party; Step 4 named no
verification at all.
*Fix:* restate AC5 as an artifact assertion (guidance present in a parent-role
probe; no tracked doc presents `trellis_subagent` as the Pi path) and add a probe
line to Step 4.

**C4 — the documented key derivation is incomplete.**
`contextKey()` normalises to `[A-Za-z0-9._-]`, appends `_${sha256(id).slice(0,24)}`
when normalisation changed anything, and falls back to `pi_transcript_<hash>`
(`index.ts:1063-1079`). Python's `_sanitize_key` (`active_task.py:257-260`) does
**not** repair that, so a non-UUID id yields a key whose runtime file does not
exist → publish nothing → R1 fails silently.
*Fix:* copy `contextKey()` verbatim and gate publication on `existsSync(runtimeFile)`.

---

## From the `design` reviewer only

**D1 — P0. R1 fails in the exact flow this task exists for.**
The parent publishes only in `session_start`/`before_agent_start`, i.e. only when a
task *already* resolves. `task.py start` runs as a bash call during turn N, and the
`subagent` dispatch normally follows later in that same turn — so the publish
decision was taken before the task existed and the child inherits nothing.
Phase 1.4 → Phase 2 is the workflow's own breadcrumb path, so this is the common
case, and the AC1–AC4 probe (run in a later turn) is structurally blind to it.
*Fix:* re-resolve and publish in the parent's `tool_call` hook for
`toolName === "subagent"`; `emitToolCall` is awaited before the tool executes.

**D2 — the strip misses the second channel.** The generated extension emits the
same runtime context as a `customType: "trellis-runtime-context"` message
(`index.ts:2136-2176`) *as well as* into `systemPrompt`. AC2 as worded ("system
prompt contains no … breadcrumb") would **pass** while R2 is unmet.
*Fix:* a `context` hook that drops child-scoped custom messages — or adopt Path B,
which removes the need to inject anything wrong in the first place.

**D3 — the strip set is incomplete.** `<trellis-workflow>` and
`<first-reply-notice>` also survive, and `<trellis-workflow>` carries workflow.md's
Phase Index prose including "ask only whether this turn should create a Trellis
task" (`workflow.md:155-159`; `workflow_phase.py:90-99` strips only
`[workflow-state:*]` tags).
*Fix:* replace the whole startup block in the child role rather than deleting
block by block.

**D4 — the fallback is stronger than the primary mechanism.** Writing the child's
own session pointer removes D2, D3, C1's bash half **and** the load-order
dependency together. Promoted to a first-class option; see
`dispatch-bridge-mechanisms.md`.

**D5 — the E1 evidence row does not support its claim.** Pi's bash tool *deletes*
and re-synthesises `PI_SESSION_ID` / `PI_SESSION_FILE` / `PI_PROVIDER` / `PI_MODEL`
/ `PI_REASONING_LEVEL` per session (`core/tools/bash.js:119-135`), so a child's
values are indistinguishable from inheritance. The conclusion is correct — the real
proof is `async-execution.ts:603-609` — but the *evidence cited* was wrong.
*Fix:* cite the spawn site, or re-probe with a purpose-built marker variable.

**D6 — foreground children are outside the model but inside the ACs.**
`ambientExtensions` is runner-only (`child-launch.ts:286`), and `PI_SUBAGENT_CHILD`
is set only in the runner (`subagent-runner.ts:185`). A foreground child loads no
ambient extensions, so AC2/AC3 could pass *without the bridge doing anything*.
*Fix:* require the probe to record its run mode; add one foreground sanity case.

**D7 — AC6 contradicted by the plan.** Step 1 says "no active task ⇒ publish
nothing, inject nothing"; Step 4 appends dispatch guidance unconditionally.
*Fix:* gate the advisory on the same predicate.

**D8 — systemPrompt stability.** The generated extension deliberately freezes what
it injects because provider prefix caches invalidate from byte 0 on any change
(`index.ts:1877-1895`). The advisory must be a **constant string appended last**,
never embedding the task path or per-turn state.

---

## From the `conform` reviewer only

**F1 — manifest discipline.** `implement.jsonl:1` registers
`.trellis/spec/config/pi-resources.md`, which Step 7 edits — the step-1.3 rule
excludes "files you're about to modify". *Fix:* drop it (all 11 other entries are
clean).

**F2 — `check.jsonl:2` lists the same file.** Defensible, because the checker runs
*after* Step 7 and should validate the updated table. *Fix:* make the exception
explicit in the `reason` rather than removing it.

**F3 — Step 6 is not implementable as written.** "pi-subagents reports the three
roles as discoverable agents" is only observable through the model-facing
`subagent({action:"list"})` tool; bash cannot call it, and the package's bin is a
network-dependent installer. *Fix:* assert the discovery *input* —
`.pi/agents/trellis-{implement,check,research}.md` exist — guarded on `.pi/`
existing.

**F4 — Step 6's degrade-to-`warn` contradicts AC7.** `doctor.sh` prints
`All good.` only when `problems == 0 && notes == 0`, so any `warn` from the new
check makes AC7 unachievable. *Fix:* missing bridge is `bad` (R8 says "fail
loudly"); restate AC7's doctor clause.

**F5 — AC4 cannot fail.** E6 records it passing *before any change*. The only new
artifact for R4 is the bridge's adapter note, which no AC asserted.
*Fix:* extend AC4 to assert the note.

**F6 — coverage gaps.** R7 (documentation) has no AC; AC6 traces to no R; Step 7
makes `README.md` conditional while R7 names it.

**F7 — no negative test for the doctor check.** A check that always prints `ok`
satisfies the plan as written. *Fix:* move the bridge aside and confirm `bad` +
exit 1.

**F8 — Step 6 misses three shell-guidelines clauses:** target the env-overridable
`$PI_DST` (never `$HOME/.pi/agent`), never `exit` early (doctor reports every
problem in one pass), and branch on `${#arr[@]}`.

**F9 — Step 3.2's strip was looser than the design.** Strip `<workflow-state>`
only when the body says `Status: no_task`, `<session-overview>` only when
`CURRENT TASK` is `(none)`; the literal removal target is the full two-sentence
line at `index.ts:1267`.

**F10 — Step 5 must `/reload` before probing**, since extensions load at session
start or `/reload`.

**F11 — Step 1 understates `contextKey()`** (same root cause as C4).

**F12 — AC1/AC8 wording.** AC1 hardcodes a task path that stops existing on
archive; AC8 says "clean" where reality is "clean apart from the intended commit".

---

## Corrected claims to carry forward

- **E1** — the conclusion stands, the cited evidence does not. Cite
  `async-execution.ts:603-609`; the probe variables are re-synthesised by Pi's
  bash tool.
- **Order independence (C1)** — not true as specified. True only with
  insert-or-replace semantics.
- **Load order** — confirmed by *two* code paths (`lastExported` in the original
  design cited `loader.js`, while the live path is `package-manager.js:1990`
  before `:2007-2008`, sorted by `resourcePrecedenceRank`). Conclusion unchanged,
  citation corrected.
- **`implement.jsonl:4`'s reason** overstates the propagation risk: a repo-wide
  grep finds **zero** tracked docs mentioning `trellis_subagent` — only generated
  `.pi/**` and `.agents/**`.
- **Already safe:** `task.py finish` and archive clear session pointers
  (`task.py:281` → `active_task.py:783-800`; `task_store.py:1459-1461`), so only the
  *create/activate* direction of the mid-turn window is broken.

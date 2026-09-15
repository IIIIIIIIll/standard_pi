# Implementation Plan — spec prose + bridge injection

Design: [`design.md`](./design.md). Requirements: [`prd.md`](./prd.md). Evidence:
[`research/skill-delivery-probe.md`](./research/skill-delivery-probe.md),
[`research/manifest-selection-finding.md`](./research/manifest-selection-finding.md).

Order matters in exactly one place: **step 2 captures the AC5 baseline, so it must run
before steps 3-8 edit anything.** Everything else is order-independent.

## Ordered Checklist

**1. Read the two upstream skills as sources, not as targets.**

`.agents/skills/trellis-before-dev/SKILL.md` step 7 and
`.agents/skills/trellis-check/SKILL.md` steps 4-5 hold the authoritative gate text.
Read them; do not edit them. The next content step rewrites them in this repo's
vocabulary, which is a deliberate divergence recorded in `design.md`.

**2. Record the AC5 baseline; the manifest finding is already measured.**

```bash
trellis update --dry-run | grep -A6 "Modified by you\|User data (preserved)"
```

Expected, captured before any edit: `.trellis/spec/` under **User data
(preserved)**, and no `.trellis/spec/**` entry under **Modified by you**.

AC6(a) was measured on 2026-09-15 and does not need re-running: an async
`trellis-check` child reported its injected block as this task's 7
`implement.jsonl` entries, with the two `check.jsonl`-only files absent. Method and
raw result: `research/swap-fidelity.md` §3. Re-run it only if the bridge's selection
logic is disputed — and dispatch it **async**, because a blocking child loads no
extensions at all (`research/swap-fidelity.md` §2).

**3. Add the gates to `.trellis/spec/index.md`.**

G1 goes in `## Pre-Development Checklist`, phrased as the action to take before the
first edit. G2, G3, and the G4 reference go in `## Quality Check`, phrased as items
to confirm before reporting. Keep the existing items in place — this is an addition,
and the file's current shape is what the layer indexes mirror. Translate rather than
copy: this repo has no test suite, so "run lint, type-check and tests" becomes the
verify chain, and "Storage → Service → API → UI" becomes config / scripts / spec /
docs plus the extension surface.

**4. Add the layer-specific instances.**

`.trellis/spec/config/index.md` gains the config-shaped forms ("is this a tracked
input or a generated output", "did the render/sync pair stay symmetric").
`.trellis/spec/scripts/index.md` gains the scripts-shaped forms (`set -e` exception,
the verb vocabulary, "name a command the user can run"). Neither restates the whole
gate set.

**5a. Relay the dispatched agent, then select its manifest.**

In `pi-agent/extensions/trellis-subagents-bridge/index.ts`:

- In the existing `tool_call` handler for the dispatch tool, read the agent name from
  `event.input.agent` and publish it into the process environment — the same channel
  that already carries `TRELLIS_CONTEXT_ID`, and the reason the child sees the
  parent's key today. Then, in the child branch's `before_agent_start` handler — the
  one that already appends `CHILD_ADAPTER_NOTE` — do the rest of this step.

- Resolve the task dir the child already resolved when it wrote its session pointer,
  and keep it in a local for reuse — do not re-derive it.
- Read the relaying value and select a manifest from the task directory by **stem
  suffix**: try `{name}.jsonl` first, then each tail of the name after a `-`
  (`trellis-check` → `trellis-check.jsonl` then `check.jsonl`), and take the first
  file that exists. Fall back to every `*.jsonl` in the directory, sorted, when
  nothing was relayed or no candidate exists. **Do not write the upstream table.**
  `.pi/extensions/trellis/index.ts:90-95` selects by a hardcoded role map, so it is
  the wrong model here twice over: it names roles (R1 forbids it) and it makes
  `{agent}.jsonl` wrong — measured 2026-09-15, `{agent}.jsonl` resolves to
  `trellis-check.jsonl`, misses, and silently falls through to the union on every
  dispatch. The suffix rule is what reproduces upstream's *outcome* without its
  mechanism. Parse one JSON object per line and skip rows without a `file` field
  (the seed shape `task.py create` writes). **No role literal appears in the
  bridge** — the value is relayed from what pi-subagents was already told.
- Resolve each `file` against the repo root and **refuse a path that escapes it**.
- Skip a file whose body already appears verbatim in the current system prompt.
- Append one block: each entry as its path, then its body. Read the caps from
  `.trellis/config.yaml`'s `context_injection` section with the same minimal
  line-scan the generated extension uses (`max_file_bytes` 32768, `max_total_bytes`
  131072 as fallbacks when the key or the file is absent). Truncate a body over the
  per-file cap with a notice; once the total is reached, degrade the remaining
  entries to path lines.
- Test the whole block for presence before appending; never test a bare tag.
- Wrap everything so a failure returns `undefined` and the child is unaffected.

No role name, no skill name, and no `pi-subagents` field name may appear in 5a.

**5b. Make the child inert, and restructure the predicate.**

Injecting the right manifest is half the swap; the child also receives the parent's
per-turn session context, including a `<workflow-state>` breadcrumb that tells a
check child to stay in *planning* (`research/swap-fidelity.md` §4). Upstream's tool
prevented that by marking its children. Reproduce it:

- Set the child-inert marker to `1` in the **parent's** environment, so every child
  inherits it before its extensions load. It cannot be set in-process inside the
  child: `trellis/index.ts:1843` is read at extension load, inside
  `trellisExtension()` at `:1828`, which has already run by the time any handler
  fires. **Set it through `CHILD_INERT_MARKER` as declared in the bridge** — the
  sibling task `09-15-doctor-child-inert-guard` landed that declaration in
  `afb4237` (archived at
  `.trellis/tasks/archive/2026-09/09-15-doctor-child-inert-guard`) together with a
  `doctor.sh` check that reads the name off it, so a literal here would drift from
  what the check compares. After your edit,
  `grep -c TRELLIS_SUBAGENT_CHILD pi-agent/extensions/trellis-subagents-bridge/index.ts`
  must still return `1` — the declaration line is the only occurrence.
- Introduce a bridge-owned marker and rewrite the child predicate. It currently
  requires `TRELLIS_SUBAGENT_CHILD !== "1"`, which the new marker falsifies; left as
  it is, the child would take the **parent** branch — the failure `pi-resources.md`
  records under "role predicates must be exhaustive, not selective".
- Keep the shipped-tool escape hatch explicit, and confirm `doctor.sh`'s
  `SHIPPED_TOOLS` check still passes.
- Confirm nothing else reads the marker before relying on it:
  `git grep -n TRELLIS_SUBAGENT_CHILD -- .pi/extensions/trellis/index.ts pi-agent/extensions/`
  — today that is one load-time check plus the bridge's own predicate. Measured
  2026-09-15: `pi-subagents` contains **no** reference to that name at all (it reads
  only its own `PI_SUBAGENT_CHILD`), so setting it cannot reach that package.
- **Marker lifetime: set it persistently for the session. Decided on measurement;
  do not switch to a windowed shape without re-measuring.** Both shapes were on the
  table and the deciding question was whether every spawn happens inside the
  `subagent` tool call. It does not. Measured 2026-09-15 in
  `~/.pi/agent/npm/node_modules/pi-subagents`:
  1. The ordinary path *is* inside the call — the tool's `execute`
     (`extension/index.ts:775`) → `executeSubagentCollapsed` → `executeAsyncSingle`,
     with the runner `spawn` at `async-execution.ts:748` and its `env` derived from
     `process.env` via `omitExtensionBindingsEnv`. A windowed marker would cover a
     plain dispatch, and would even cover a workflow, since `runs.run` executes
     inside the same call.
  2. A **scheduled** run is not inside any tool call.
     `runs/background/scheduled-runs.ts:799` arms a `setTimeout` whose callback
     reaches `fire()` at `:825` and `launch(…, "timer", …)` at `:837`, which calls
     `this.deps.launch(...)` at `:883` — wired in `extension/index.ts:517-529` to
     `executorScheduled(...)`. That spawn happens on a timer with nothing in flight,
     so a `tool_call`/`tool_result` window would miss it and that child would keep
     receiving the parent's planning breadcrumb. The `"run-due"` catch-up at `:726`
     and the `"manual"` path at `:704` reach the same `launch`.
  3. Missing it is **silent**: nothing detects a non-inert child. The leak the
     persistent shape causes is **loud**: a nested `pi` reports `no_task` where a
     user sees it. Persistent therefore wins on the repo's own rule — prefer the
     visible failure over the invisible one.

  Because nothing is ever cleared, there is no window to unwind: no `try`/`finally`,
  no cleanup on an error path, and no state that can be left half-set. The `git grep`
  above is the bound on the blast radius: two readers in live code, both repo-owned,
  neither in `pi-subagents`.
- **Carry the rest of the block the child loses.** Going inert removes the generated
  extension's *whole* injection, not just the breadcrumb: `buildContext()` supplies
  the curated files **and** `prd.md` → `design.md` → `implement.md`, with a
  per-artifact cap. So 5b must reproduce the artifact half too, or the child loses
  the task artifacts it has today. With 5a plus this, the bridge is a complete stand-in
  for what the shipped tool's `assemblePrompt()` + `buildContext()` did — role-correct
  curated files, task artifacts, and the agent definition upstream already supplies.

After 5b, the child's context is upstream's assembled system prompt plus exactly
what the bridge supplies — and nothing from the parent's session. No role name, no skill name, and no `pi-subagents` field
name may appear in 5b either.

**6. Update the two documents that describe the bridge.**

`pi-agent/extensions/README.md` §"Trellis subagents bridge" and
`.trellis/spec/config/pi-resources.md` §`trellis-subagents-bridge/`. Both currently
say the bridge "corrects a value, not an output"; the injection adds output, so
each must state what is injected, when, and the caps — otherwise the next
contributor reads that sentence, sees the injection, and concludes the design was
abandoned.

**7. Record the third reader of the budget in the propagation guide.**

`.trellis/config.yaml`'s `context_injection` keys now have three consumers: the
generated extension (`readContextInjectionLimits`), `task.py validate` (warns against
`max_file_bytes`), and the bridge. Add or extend a row in
`.trellis/spec/guides/change-propagation-guide.md` §"Known Multi-Site Facts" to say so
— naming the three readers and the single definition — so a future change to the
limits is not applied in two places out of three.

**8. Check the two one-clause descriptions.**

`README.md:159` and `docs/plugins.md:152` each describe the bridge in a clause. Read
both; update only if the clause becomes false. Do not add a new paragraph.

**9. Run the negative coupling test (AC3, AC4).**

```bash
# Added lines only. A file-scoped grep is the WRONG test here: two pre-existing
# role names live in files this task must edit, and both must be left alone —
#   pi-agent/extensions/trellis-subagents-bridge/index.ts:260  PARENT_DISPATCH_GUIDANCE,
#     the parent-facing instruction telling the main session how to dispatch
#   .trellis/spec/config/pi-resources.md:649  prose recording that a check child
#     verified this repo on 2026-09-14
# Deleting either to make a grep pass is a regression, not a fix.
git diff -U0 -- .trellis/spec/ pi-agent/extensions/trellis-subagents-bridge/index.ts |
  grep '^+' | grep -nE 'trellis-implement|trellis-check|trellis-research|trellis-before-dev|agentOverrides' ;
  echo "added-line hits exit=$?"
git status --short
git diff --name-only      # must not list .trellis/.template-hashes.json
```

Any hit on an **added** line means a role or skill name leaked and R1 is violated.
Fix the wording; do not relax the test, and do not delete pre-existing content to
silence a file-scoped run of it.

**10. Run the seam test (AC5).**

```bash
trellis update --dry-run
```

Same two sections as step 2, unchanged. This is the whole "seamless upgrade" claim.

**11. Run the delivery test (AC6b).**

Dispatch one check child **async** — a blocking dispatch proves nothing, since it
loads no extensions (`research/swap-fidelity.md` §2) — and ask it to list the file
paths in its received context. It must (a) name a `check.jsonl`-only file, which the
pre-change measurement showed absent, and (b) quote at least one of the four gates
as an instruction it received. The first half proves the transport; the second
proves the content. If (b) fails while (a) passes, the gates are in the wrong spec
file; if (a) fails, the relay or the injection did not run.

Also confirm the child **no longer** receives a `<workflow-state>` breadcrumb: ask
it whether the string appears in its context. That is the 5b half, and it is the
only direct evidence that the child's extension went inert.

**12. Confirm the bridge still loads, and that nothing else changed.**

A dispatch that resolves its task in step 11 is the load check: a broken extension
fails at load, and the child would resolve nothing. Then confirm the injection is
confined to children — run a normal session in this repo and check the block is not
present in it. The "absent when no task resolves" arm is **by hand**; no command
checks it (R5).

If 5b chose the **persistent** marker — which step 5b requires — measure the
nested-process case: run `pi -p 'print your task status'` from a bash tool in this
session and confirm the result is understood rather than a silent `no_task`
surprise. It is expected to report `no_task`: that is the recorded cost of the
persistent shape, and the measurement is the evidence for it. **Do not switch to
the windowed shape to avoid it** — step 5b rules windowed out on a measured
scheduled-spawn path, and a leak a user can see is the cheaper failure. Record the
observed output in the task notes.

**13. Run the full verify chain (AC8).**

```bash
bash -n setup.sh scripts/*.sh
node --check scripts/*.mjs
./setup.sh
./setup.sh                              # second run: identical output, no new files
./scripts/sync.sh                       # must report `same pi-agent/settings.core.json`
./scripts/doctor.sh                     # must end in `All good.`
git status --short
```

## Validation Commands

| Check | Command |
| --- | --- |
| Zero coupling (AC3) | `git diff -U0 \| grep '^+' \| grep -nE 'trellis-implement\|trellis-check\|trellis-research\|trellis-before-dev\|agentOverrides'` → exit 1. Added lines only — a file-scoped `git grep` over the same paths exits `0` on the two pre-existing role-name lines (bridge `PARENT_DISPATCH_GUIDANCE`, `pi-resources.md` prose), which step 9 already documents as not a violation |
| Nothing upstream touched (AC4) | `git status --short`; `git diff --name-only` without `.trellis/.template-hashes.json` |
| Seam intact (AC5) | `trellis update --dry-run` → `.trellis/spec/` under "User data (preserved)" |
| Transport (AC6a → AC6b) | one check dispatch before the bridge edit — marker absent; one after — marker present |
| Content (AC6b) | the same dispatch quotes a gate it received |
| Caps (AC7) | read `context_injection` off `.trellis/config.yaml` and confirm the bridge scans that section (no hardcoded pair) |
| Whole store verifies (AC8) | `./scripts/doctor.sh` → `All good.`; `./setup.sh` twice; `./scripts/sync.sh` → `same` |

## Risky Files And Rollback Points

| File | Risk | Rollback point |
| --- | --- | --- |
| `pi-agent/extensions/trellis-subagents-bridge/index.ts` | Loaded in **every** Pi session on this machine; a throw here breaks dispatch everywhere, and the injection adds prompt bytes to every child | After step 5: `git checkout` the file |
| `.trellis/spec/index.md` | Every future dispatched child reads it through the new transport; a badly worded gate propagates into every check that follows | After step 3: revert the file |
| `.trellis/spec/config/index.md`, `scripts/index.md` | Same, scoped to one layer each | After step 4: revert both |
| `pi-agent/extensions/README.md`, `.trellis/spec/config/pi-resources.md` | They are the "must not break" record for the bridge; a stale sentence here misleads the next change | After step 6: revert both |
| `.trellis/tasks/09-15-harden-pi-role-agents/*.jsonl` | Malformed JSONL makes the child's context load fail — and with tier 1 the manifest is also the injection list | Before start: validate with `task.py validate` |

No generated file, no settings render, and no symlink is involved.

## Follow-Ups Before `task.py start`

- [ ] Curate `implement.jsonl` and `check.jsonl`, including
      `.trellis/spec/index.md`, `.trellis/spec/config/pi-resources.md` (the bridge's
      constraints) and both research notes; run `task.py validate`.
- [ ] Confirm there is no other spec index in this repo that a child could land on
      and that would need the same instance.
- [ ] Confirm the AC5 baseline is captured before the edits (step 2), so it compares
      against a measurement rather than a memory. Baseline: `.trellis/spec/` under
      "User data (preserved)", nothing under "Modified by you".
- [ ] `trellis update --dry-run` lists many files in this tree — capture only the two
      sections above, not the whole output.

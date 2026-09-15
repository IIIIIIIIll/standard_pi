# Design — spec prose as the content home, the repo-owned bridge as the transport

## Change Boundary

**Behaviour gap.** A dispatched role child is not instructed by the four gates the
workflow requires of it, because those gates exist only in two `.agents/skills/`
files that no child receives. Measured; see
[`research/skill-delivery-probe.md`](./research/skill-delivery-probe.md).

**Where the behaviour actually lives.** Not in the agent definition, and not in the
skill. Three facts decided this:

- The gates have no carrier of their own — the child's injected context on Pi is
  `buildContext(root, "trellis-implement", k)` (`.pi/extensions/trellis/index.ts:2132`),
  a hardcoded call on the session path, and no agent template on any of the 21
  platforms references `trellis-before-dev`. See
  [`research/manifest-selection-finding.md`](./research/manifest-selection-finding.md).
- The child *is* reachable by one repo-owned component, but **only when the runner
  hosts it**. `child-launch.ts:295` loads ambient extensions only for
  `host === "runner"`, so an async child loads the bridge and a blocking child loads
  neither it nor the generated extension. Measured in
  [`research/swap-fidelity.md`](./research/swap-fidelity.md) §2, with the child's
  own reported environment markers for both shapes.
- Upstream's own prompt builder has five injection points for the child
  (`effective-system-prompt.ts`), two of which are project-scoped overlays — and
  both are name-keyed and live under the gitignored `.pi/`, so neither is
  repo-shippable (`research/swap-fidelity.md` §5).

So the fix has two halves: **content** must live in the spec tree (the only
zero-coupling content home), and **transport** must be the bridge (the only
guaranteed zero-coupling delivery the child already has). Neither half is optional:
prose alone is read-dependent, and an injection with nothing to inject delivers
nothing.

**Files expected to change, and why each is necessary.**

| File | Why | Tier |
| --- | --- | --- |
| `.trellis/spec/index.md` | The entry point a child reads; its Pre-Development Checklist and Quality Check are what the layer indexes and the spec fallback both lead to | content |
| `.trellis/spec/config/index.md` | Layer instance for the config surface | content |
| `.trellis/spec/scripts/index.md` | Layer instance for the scripts surface, where most of this repo's work lands | content |
| `pi-agent/extensions/trellis-subagents-bridge/index.ts` | The transport: appends the task's curated spec files to the dispatched child's system prompt | transport |
| `pi-agent/extensions/README.md` | Documents the extension; the injection is new behaviour a contributor must not break | docs |
| `.trellis/spec/config/pi-resources.md` | The `### trellis-subagents-bridge/` section lists "facts a contributor must not break" — the injection adds one | content |
| `.trellis/spec/guides/change-propagation-guide.md` | A new multi-site fact pair (the bridge's cap constants vs the documented `context_injection` defaults) | content |
| `docs/plugins.md`, `README.md` | One clause each describe what the bridge does; update only if the clause becomes false | docs |

**Explicitly not doing.** No edit to `.pi/`, `.agents/`, `.trellis/agents/`,
`.trellis/workflow.md`, `.trellis/config.yaml`, `.trellis/scripts/`,
`.trellis/.template-hashes.json`, `scripts/`, `setup.sh`, or
`pi-agent/settings.core.json` (R1). No skill selection, no per-role settings, no
revival of the shipped dispatch tool, no `doctor.sh` prose check, no port of
upstream's path-scoped `spec_injection`, no thinking or model pinning.

## The Option Set

Eight routes were weighed. The two chosen are complementary, and every rejected
route is rejected for a reason a future reader would otherwise re-derive:

| # | Route | Guarantees the child receives the rule? | Names a role / skill / `pi-subagents` value? | Survives `trellis update`? | Verdict |
| --- | --- | --- | --- | --- | --- |
| A | Spec prose in `.trellis/spec/**`, reached via manifests | No — read-dependent | No | Yes — "User data (preserved)" | **chosen (content)** |
| B | Bridge injects the task's curated files into the child's system prompt | **Yes** — the content arrives | No — selection is the manifest union | Yes — `pi-agent/**` is outside Trellis's managed set | **chosen (transport)** |
| C | Upstream's own `trellis_subagent` tool | Yes, and role-correct (`TRELLIS_AGENT_JSONL`) | No | n/a | Dead here by choice: the bridge deactivates it, and it is upstream code this repo cannot edit |
| D | `settings.agentOverrides.<role>.skills` | Yes | Yes — role, skill, and a field name | Yes | **Feasible, rejected for coupling** — it also covers project agents, via `applyCustomAgentOverrides`, so the mechanism would work; it is the coupling R1 forbids |
| E | `skills:` in `.pi/agents/*.md` | Yes | Yes, and it edits CLI output | No — "Modified by you"; `install-trellis.sh` regenerates it | Rejected |
| F | Path-scoped `spec_injection` (frontmatter `paths:` on spec files) | Yes, on Read/Edit/Write | No | Yes if ported | **Unavailable on Pi** — implemented as a shared Python hook (`dist/templates/shared-hooks/inject-spec-context.py`), not installed; see the deferred table |
| G | Upstream project-scoped overlays: refinements and agent memory | Yes | Yes — both are keyed by the agent name | n/a | **Closed, measured** — `.pi/subagents/refinements/<agent>.md` and `<root>/.pi/agent-memory/**` are name-keyed and under the gitignored `.pi/`; neither can be shipped by git (`research/swap-fidelity.md` §5) |
| H | Make the child's generated extension inert, as upstream's own tool did | Yes, and it removes the parent's per-turn session context from the child | No | Yes | **Chosen as part of Tier 1** — the parent sets the marker before spawning and the child inherits it; see R6 and the restructure note below |

A and B are complementary, not alternatives: B decides *whether the text arrives*,
A decides *what the text is*. Route B alone would inject nothing; A alone would rely
on the child choosing to read.

## The Delivery Contract

```text
.trellis/spec/index.md  (+ config/, scripts/ indexes)      ← the four gates live here
        │
        │  the repo's own manifests are curated per task (workflow Phase 1.3)
        ▼
.trellis/tasks/<task>/implement.jsonl   .trellis/tasks/<task>/check.jsonl
        │                                        │
        │  TIER 1 — the bridge relays the dispatched agent name from the
        │  dispatch tool_call and selects the manifest whose stem is a
        │  suffix of it (`trellis-check` -> `check.jsonl`), falling back to
        │  the union of every *.jsonl in the task dir when nothing was
        │  relayed; it appends
        │  the file bodies to the child's system prompt in before_agent_start
        ▼
   dispatched child (implement or check) gets the gates in its prompt
        │
        │  TIER 2 — the manifests also remain readable, and an empty
        │  manifest falls back to `get_context.py --mode packages`,
        │  whose entry point is the spec index
        ▼
.trellis/spec/<layer>/index.md                             ← layer instance
```

Three properties, stated with their strength:

- **Tier 1 is a guarantee about the transport, not about compliance.** The content
  is in the prompt. Whether the model applies a checklist item is not mechanizable
  and is not claimed (R5).
- **Tier 1 is role-blind by construction.** It reads the directory, not a role
  table. There is no role name anywhere in the change.
- **There is one content home and two transports.** The same `.trellis/spec/**`
  files are what Tier 1 pushes into the prompt and what Tier 2 lets any reader
  reach. The tiers differ only in *transport*, never in *content* — so the spec
  tree is now load-bearing twice over, not replaced by the bridge. What stops
  being relied on is the gates' previous home (`.agents/skills/*/SKILL.md`, which
  is CLI-generated, gitignored, and measured unreachable from a child) and the
  hardcoded `implement.jsonl` selection at `.pi/extensions/trellis/index.ts:2132`.
  *Scope of "the content home":* it is **this repo's** spec tree. Another repo owns
  its own, which is the boundary two bullets down — "one home" means one home
  *per repo*, not one home for the machine.
- **Tier 2 is the fallback for any path without the bridge**, including a future
  platform and a task whose manifests are still seed-only.

## Tier 1 — The Bridge Injection, In Detail

All of this happens inside the existing child branch, which is already gated by
`PI_SUBAGENT_CHILD === "1" && TRELLIS_SUBAGENT_CHILD !== "1"` (R6). The child branch
already appends one constant to the system prompt, so the mechanism is not new.

**Selection: relay, do not guess.** The parent sees the dispatched agent in the
`subagent` `tool_call` input, and the child inherits the parent's environment at
spawn — `async-execution.ts:751` spreads `process.env`, which is already the
mechanism the bridge relies on for `TRELLIS_CONTEXT_ID`. So the parent publishes
that value and the child picks the task's manifest whose stem is a **suffix** of
the relayed name — the full name first, then each tail after a `-`, first file that
exists wins, so `trellis-check` selects `check.jsonl`. When no value was relayed —
an older child, a workflow step, a name with no matching manifest — the bridge falls
back to the union of every
`*.jsonl` in the task directory, sorted. Parsing a manifest means one JSON object
per line; a row without a `file` field is skipped, the repo's existing contract for
the seed rows `task.py create` writes (and the rule
`.trellis/scripts/common/task_context.py` follows).

This is what makes the swap faithful rather than merely additive: a check child
gets `check.jsonl` because the dispatcher said `trellis-check`, exactly as it did
under the shipped tool.

**Corrected 2026-09-15, after reading the source.** An earlier draft called
`{agent}.jsonl` "upstream's own rule" and justified it as conformance. Measured:
upstream has no such rule. `.pi/extensions/trellis/index.ts:90-95` is a hardcoded
table naming both roles —

```ts
const TRELLIS_AGENT_JSONL: Record<string, string> = {
  "trellis-implement": "implement.jsonl",
  implement: "implement.jsonl",
  "trellis-check": "check.jsonl",
  check: "check.jsonl",
};
```

— and `:1274` looks the agent name up in it. So `{agent}.jsonl` would have resolved
to `trellis-check.jsonl`, missed, and fallen through to the union for **every**
dispatch, silently defeating the very selection this section describes. There is
also no rename-free way to copy upstream's *mechanism*, because its mechanism is a
role table and R1 forbids one. The suffix rule reproduces upstream's *outcome* from
the relayed name instead. Conformance in behaviour, divergence in implementation —
recorded rather than glossed.

**Path safety.** A row's `file` is resolved against the repo root, and a path that
escapes the root is refused — the same containment rule the generated extension
applies to its task pointer, because duplicate/malformed manifests are exactly how
a task dir pointer has gone wrong here before.

**Deduplication.** A file whose body already appears in the current system prompt is
skipped. This matters: `:2132` already injects the implement manifest, so without
per-file dedup an implement child would receive those files twice. The presence test
is on the whole body, never on a bare tag — the bridge's own comments record the
lesson that a tag like `<trellis-…>` also occurs in ordinary prose, and matching it
suppressed the note for the one task that needed it.

**Budget: read it, do not restate it.** The bridge reads the
`context_injection` section of `.trellis/config.yaml` (`max_file_bytes`, default
`32768`; `max_total_bytes`, default `131072`) with the same minimal line-scan the
generated extension uses, falling back to those documented defaults when the file or
the section is absent. A file over the per-file cap is truncated with a notice; once
the total is reached, the remaining entries degrade to a path + reason line rather
than a body.

Read, not restated. Measured: `task.py validate` also reads those keys and warns
against them —

```text
implement.jsonl:5: Warning: .trellis/spec/config/pi-resources.md is 41265 bytes,
  exceeds context_injection.max_file_bytes (32768); injection will truncate it
```

— so the value already has two consumers plus the config as its single definition,
and a third that restated the numbers would diverge the moment someone lowered the
limit: the validator would warn while the bridge injected the full file. Reading the
same source costs twenty lines of duplicated scanning, which is what the generated
extension itself chose over importing.

**Idempotency and cost.** The block is appended only when not already present, tested
whole. The honest cost, which the bridge's own comments already flag for its
constants: content derived from files can change mid-session if a curated spec is
edited during the child's run, and that invalidates the provider prefix cache from
byte 0 for the child's remaining turns. Accepted: a child session is short-lived,
the injected text is stable for most of its life, and this task's own change is the
degenerate case (the gates are edited while children are dispatched). Written here so
it is a decision rather than a surprise.

**Failure handling.** Every step sits behind the bridge's existing style: a failure
returns `undefined` from the handler and the child behaves as it did before the
bridge existed. An injection failure must never take a session down.

### Making the child inert — the rest of the faithful swap

Injecting the right manifest is half the swap. The child currently also receives
the **parent's per-turn session context**: its session file holds a
`trellis-runtime-context` message containing the planning breadcrumb — *"Task:
harden-pi-role-agents (planning) / Load `trellis-brainstorm`; stay in planning"* —
plus the whole `<session-overview>` (`research/swap-fidelity.md` §4). A dispatched
check child is thereby told to keep planning while its own definition tells it to
review. Upstream never had this, because its tool set `TRELLIS_SUBAGENT_CHILD=1` for
its children and the child's copy of the extension returned before registering
anything.

Reproducing that contract:

- **The parent sets the marker before spawning**, because the child inherits the
  parent's environment. The bridge cannot do this in-process: `trellis/index.ts:1843`
  is read at extension load, inside `trellisExtension()` at `:1828`, which has
  already run by the time any handler fires.
- **The bridge therefore needs its own marker** for the parent/child decision. Its
  present predicate requires `TRELLIS_SUBAGENT_CHILD !== "1"`, which the marker
  would falsify, dropping the bridge into the parent branch inside the child — the
  same class of bug the `pi-resources.md` section records as "role predicates must
  be exhaustive, not selective".
- **The bridge then owns the child's context**, since the generated extension no
  longer contributes any: the role-correct curated files, and nothing else. Task
  resolution for bash still works — the parent's `TRELLIS_CONTEXT_ID` is inherited,
  which is what the blocking child demonstrated when it reported the parent's key.

This is a larger bridge change than injection alone, and it is the part that makes
the result a *swap* rather than an overlay. It is separable: injection without it
still delivers the gates, while leaving the breadcrumb conflict in place.

## Blast Radius — what each edit can reach

Answering "does this touch Trellis or pi-subagents themselves?" by surface, so the
claim is checkable rather than reassuring:

| Edited surface | Who reads it | Reaches Trellis? | Reaches pi-subagents? |
| --- | --- | --- | --- |
| `.trellis/spec/index.md`, `config/index.md`, `scripts/index.md` | the child's injected context, and the agent's own fallback read | No — it is data Trellis *reads*, and `trellis update` classes the tree as *User data (preserved)* | No |
| `pi-agent/extensions/trellis-subagents-bridge/index.ts` | Pi, in every session on this machine | Only through the environment marker (below), never by editing its code | No |
| `pi-agent/extensions/README.md` (its `## Trellis subagents bridge` section), spec prose naming the bridge | humans and the check phase | No | No |

**No file that Trellis or `pi-subagents` owns is edited, at all.** Not the generated
extension under `.pi/`, not `.pi/agents/*.md`, not `.agents/skills/*`, not any file
under the `pi-subagents` package. `pi-subagents` is reached only through two
behaviours it already documented and already applies today: it exports the
dispatched agent in the dispatch tool's input (which the bridge now reads), and it
propagates the parent's environment into the child (`async-execution.ts:751`, which
the bridge already relied on for `TRELLIS_CONTEXT_ID`). Nothing about the delegation
mechanism, the agent resolution, or the run lifecycle changes for either package.

> **Portability boundary — measured 2026-09-15.** The *mechanism* travels; the
> *content* does not, and the mechanism already adapts without configuration
> because it **discovers** rather than assumes. Three measured pieces:
>
> 1. `trellis init` scaffolds the spec layer set from the detected project type
>    (`dist/commands/init.js:267-272`) and this repo pruned `backend/`+`frontend/`
>    in favour of `config/`/`scripts/`/`guides/`.
> 2. `python3 .trellis/scripts/get_context.py --mode packages --json` prints the
>    repo's own layer list **at runtime** — here
>    `{"mode":"single-repo","specLayers":["config","scripts"]}`, and in a
>    backend/frontend repo `["backend","frontend"]`. Nothing has to be told the
>    layer names.
> 3. The child's own agent definition — generated per repo — already carries the
>    discovery instruction (`.pi/agents/trellis-check.md:27`): *"if `check.jsonl`
>    has no curated entries … list available specs with `get_context.py --mode
>    packages`, and pick the specs that match the task domain yourself."*
>
> So a second repo needs no bridge change, no config, and no path known in advance:
> the bridge relays that repo's manifest, and where the repo has not curated one,
> the child discovers that repo's spec layers itself. What does **not** travel is
> the gate *text* in `.trellis/spec/**`, which is project-owned prose (Trellis says
> so directly: the spec tree is the user's project spec, not a copy of built-in
> templates). A second repo writes its own gates in its own vocabulary. A
> genuinely portable home for the wording would be `~/.pi/agent/AGENTS.md` (already
> a `PI_FILES` symlink target, currently absent), which applies to every project on
> the machine — a different decision with its own cost, and out of scope here.

The one indirect effect on Trellis's *behaviour* is deliberate and is the point of
5b: with the marker set, the child's copy of the generated extension returns at load
(`:1843`) instead of running the parent's per-turn session path. Its source is
untouched; its behaviour in a child changes exactly as upstream's own tool made it
change. The residual shape is the nested-process case in the risk table below.

## Risks And Rollback

| Risk | Detection | Mitigation |
| --- | --- | --- |
| The injected block inflates the child's prompt | AC7's cap assertion; observe a dispatch | Caps, per-file truncation, degradation to lines |
| Cache invalidation on a mid-task spec edit | Observed behaviour, not detectable mechanically | Accepted and documented; a child session is short-lived |
| The injected gates drift from upstream's skills | A future probe finds the catalog delivered, or an upstream skill renames a gate | Revisit triggers in `prd.md`; both research notes are repeatable methods |
| Duplicate content against `:2132`'s injection | Read a dispatched child's prompt; AC6(b) | Per-file whole-body dedup |
| A model reads the gate and does not apply it | Not mechanizable | Placement, and the check role's report format already requires an issues list |
| The gates drift from the propagation guide's site list | `git grep` for the guide's filename from the changed sections | G4 references the guide instead of restating its list |
| The bridge change touches every Pi session on the machine | R6 predicate unchanged; the injection sits inside the child branch only | Gate is pre-existing; the change adds no new entry point |
| A curated spec is larger than the per-file cap, so the child's injected copy is truncated | `task.py validate` warns at planning time; the child's block ends with the truncation notice | Pre-existing and accepted: the manifest entry still delivers the head of the file, and the child can read the whole file itself. This task's own `pi-resources.md` is in that state (41,265 bytes vs 32,768), and its bridge section sits deep in the file — the check agent must read it directly rather than trust the injected copy |
| **A child is told to stay in *planning*** and to load the brainstorm skill (measured) | Dispatch a child and read its `trellis-runtime-context` message | Making the child inert, above. Until then this is a live instruction conflict, not a cosmetic one |
| A blocking (`async: false`) child gets nothing from either extension | `research/swap-fidelity.md` §2's environment-marker comparison | Stated as a boundary in R6 rather than papered over; such a child relies on Tier 2 |
| The parent-set marker leaks into processes that are not children | Any subprocess of the parent inherits it | The marker has exactly **two readers in live code**, both repo-owned: the generated extension at `:1843` (load-time early return) and the bridge at `:223`/`:230` (predicate). Measured 2026-09-15: `grep -rn TRELLIS_SUBAGENT_CHILD` finds no reader anywhere in `pi-subagents` — it reads only its own `PI_SUBAGENT_CHILD`, so that package is unaffected by the marker. The one shape that *is* affected is a **new `pi` process started from a bash tool in the session** (a nested session, a `pi -p` probe, an RPC test): it inherits the marker, loads with the generated Trellis extension inert, and reports `no_task`. **Shape decided 2026-09-15: persistent, and the evidence is a spawn that no window can cover.** A windowed marker around the dispatch `tool_call`/`tool_result` *would* cover the ordinary path — the tool's `execute` reaches the runner `spawn` synchronously — but a **scheduled** run fires from a `setTimeout` in pi-subagents' schedule manager (`runs/background/scheduled-runs.ts:799` → `fire()` `:825` → `launch(…, "timer", …)` `:837` → `deps.launch` `:883`, wired to `executorScheduled` at `extension/index.ts:517-529`) with nothing in flight. That window would miss the spawn, and missing it is silent — a child keeps the parent's breadcrumb and nothing detects it — whereas the persistent leak is visible as `no_task`. Loud beats silent. Step 12 measures the nested case and records it as this shape's cost |
| Restructuring the child predicate regresses the shipped-tool escape hatch | The bridge's own probe: a shipped-tool child must be left untouched | Keep the explicit enumeration the `pi-resources.md` section demands, and keep `doctor.sh`'s `SHIPPED_TOOLS` check intact |
| **A marker that is read but never set makes its role unreachable, and nothing fails loudly** — measured 2026-09-15, this defect shipped in the first implementation | The delivery probe: `isOtherChild()` was true in every child because `BRIDGE_CHILD_MARKER` had no assignment anywhere, so the child branch returned at extension load. `doctor.sh` was green, the extension loaded, and the child reported `no_task`; only the probe distinguished it from a working bridge | Set both markers in one function (`markChildren`) and gate them on a resolved task; `pi-resources.md` now carries the class as its third learned convention. The cheap mechanical detector, not yet written: the constant must have an assignment, not only reads — `grep -c 'process.env\[BRIDGE_CHILD_MARKER\] = '` returning 0 is the whole bug. `scripts/` is on this task's forbidden list, so it needs a task of its own (same reasoning as `09-15-doctor-child-inert-guard`) |
| The parent and child halves of the bridge must come from the same revision | Any dispatch made by a session whose in-memory bridge predates the child-side file — an editor's session mid-change, or an older checkout | The child's role is decided by markers the parent sets, so a stale parent leaves the child at the no-op path and it receives nothing. Transient for one session after an edit and cleared by `/reload`; recorded here because it also means **a delivery probe run from a stale session measures nothing** and must not be read as a failure of the child-side code |
| **A `trellis update` changes the load-time marker guard** — renames `TRELLIS_SUBAGENT_CHILD`, deletes the early `return`, or moves it below the work it guards (`.pi/extensions/trellis/index.ts:1843`) | A dispatch probe: the child re-acquires the parent's planning breadcrumb — the pre-change shape in `research/swap-fidelity.md` §4 | Injection still runs, so the failure is the gates **plus** a wrong breadcrumb: degraded, not broken, and 5b is separable (dropping it returns to injection-only, which still delivers the gates). Nothing here checks the guard — R1 forbids adding one to `scripts/` inside this task — so the standing detector lives in the sibling task `09-15-doctor-child-inert-guard`: `doctor.sh` reads `CHILD_INERT_MARKER` off the bridge and compares the guard's line number against the first `pi.registerTool?.(` call. The runtime proof is still step 11's breadcrumb question. Same class of dependency as `contextKey()`, which `pi-resources.md` records as "replicated on purpose". Unlike it, this one now has a standing detector: the sibling task `09-15-doctor-child-inert-guard` landed it in `afb4237`, archived at `.trellis/tasks/archive/2026-09/09-15-doctor-child-inert-guard` — `doctor.sh` reads `CHILD_INERT_MARKER` off the bridge and fails when the guard is gone or sits below the first `pi.registerTool?.(` call. It is **textual**: it proves the guard is textually first, not that Pi calls `trellisExtension()` at load, so step 11's breadcrumb question is still the only runtime proof |
| A layer index gains a gate the umbrella index lacks | Read the three files together at check time | AC1 and AC2 name both sites explicitly |

**Rollback.** Revert three spec files, one extension file, one extension README, and
two spec/doc updates. No generated file, no settings render, no symlink, and nothing
in `.trellis/.template-hashes.json`. The bridge's previous behaviour is restored by
`git checkout` of one file.

## Verification Plan

| AC | Command / observation |
| --- | --- |
| AC1, AC2 | Read the three index files; confirm the gates appear in the named sections |
| AC3 | **added lines only** — `git diff -U0 \| grep '^+' \| grep -nE 'trellis-implement\|trellis-check\|trellis-research\|trellis-before-dev\|agentOverrides'` returns nothing. File scope is deliberately **not** the criterion: the same pattern run as a file-scoped `git grep` exits `0` on the two pre-existing role-name lines this task must leave byte-identical (bridge `PARENT_DISPATCH_GUIDANCE`, `pi-resources.md`'s 2026-09-14 prose), which is not a violation |
| AC4 | `git status --short`; `git diff --name-only` must not list `.trellis/.template-hashes.json` |
| AC5 | `trellis update --dry-run` — no new "Modified by you"; `.trellis/spec/` still under "User data (preserved)" |
| AC6(a) | **Measured 2026-09-15, pre-change**: the async check child's block was this task's 7 `implement.jsonl` entries, with both `check.jsonl`-only files absent. Re-run only if the bridge's selection logic is disputed |
| AC6(b) | After the change: a dispatch that names a `check.jsonl`-only file in its received context, and quotes a gate. A probe plus a self-report — no on-disk source exists (`research/swap-fidelity.md` §6) |
| AC7 | Bridge loads under Pi with no error and a dispatch still resolves; confirm the caps are read from `.trellis/config.yaml` rather than restated; the no-task arm is by hand |
| AC8 | `./setup.sh` twice, `./scripts/sync.sh` (`same`), `./scripts/doctor.sh` (`All good.`), `git status --short` |

AC3 and AC4 are the negative test for R1: they are what makes "zero coupling" a
checkable claim. AC6's two arms are the measurement that replaces inference about what
the child received.

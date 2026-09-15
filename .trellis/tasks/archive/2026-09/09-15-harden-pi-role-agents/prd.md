# Carry the role gates to a dispatched child: spec prose + repo-owned injection

## Goal

A dispatched `trellis-implement` / `trellis-check` child must receive the four
rules the Trellis workflow already requires of it. Today it receives none of
them: the rules live only in two `.agents/skills/` files, no agent template on any
platform references them, and the child's reading path never reaches a skill. Fix
it with two tiers — **the gates written where a child provably reads spec text,
and delivered by the one repo-owned component that runs inside the child** —
without naming a role, a skill, or a `pi-subagents` value anywhere.

## Background

Four measured facts. Each is anchored to an evidence file except the third, which is
the bridge's own tracked source. Read them before planning changes to this task:

1. **The gates never reach the child.**
   [`research/skill-delivery-probe.md`](./research/skill-delivery-probe.md) — one
   probe dispatch reported no skills catalog, no instruction about skills, and no
   mention of `SKILL.md` or `.agents/skills/` in its own definition.
2. **What the child does receive, and which manifest it comes from.**
   [`research/manifest-selection-finding.md`](./research/manifest-selection-finding.md) —
   the child's injected context is `buildContext(root, "trellis-implement", k)`,
   hardcoded at `.pi/extensions/trellis/index.ts:2132`. A **check** child is
   therefore fed `implement.jsonl`; `check.jsonl` arrives only because the agent
   template tells the child to read it (agent pull). Upstream's own
   `trellis_subagent` tool did select by role (`TRELLIS_AGENT_JSONL`, `:91-94`)
   and assembled the child prompt itself, but the bridge deactivates that tool,
   and its `TRELLIS_SUBAGENT_CHILD=1` child marker with it — which is why the
   child's copy of the extension now runs at all.
3. **The repo already owns a component that runs inside the child.**
   `pi-agent/extensions/trellis-subagents-bridge/index.ts` is tracked, symlinked by
   `setup.sh`, and its child branch already appends a constant to the child's
   system prompt (`CHILD_ADAPTER_NOTE`, in `before_agent_start`). It is not part of
   the coupling this task forbids.
4. **What the swap does and does not reproduce.**
   [`research/swap-fidelity.md`](./research/swap-fidelity.md) — measured with two
   dispatches and the child's run artifacts. Ambient extensions load only when the
   runner hosts the child (`child-launch.ts:295`), so an async child gets the bridge
   and a blocking child gets neither the bridge nor the generated extension; the
   check child's injected block was this task's **7 `implement.jsonl` entries** with
   both `check.jsonl`-only files absent; the child is also handed the main session's
   *planning* breadcrumb; and the injected system prompt is persisted nowhere, so
   delivery evidence is a probe plus a report.

Consequence for the design: the gates need a **content home** (a file that a child
reads) and a **transport** (something that puts it in front of the child). The
transport the child already has is the bridge. The transport upstream intended for
Pi — its own tool — is switched off here on purpose, and reviving it is out of
scope.

## Requirements

**R1 — Zero coupling.** No *added or changed line* may name a role agent
(`trellis-implement`, `trellis-check`, `trellis-research`), a skill name
(`trellis-before-dev`, `trellis-check` as a skill), or any `pi-subagents` field or
value. The scope is the **diff, not the file**, and that distinction is measured
rather than convenient: two role names already exist in files this task must edit,
and both are load-bearing —
`pi-agent/extensions/trellis-subagents-bridge/index.ts:260` is
`PARENT_DISPATCH_GUIDANCE`, the parent-facing instruction that tells the main
session how to dispatch (deleting it to satisfy a grep would be a regression), and
`.trellis/spec/config/pi-resources.md:649` is a prose sentence recording that a
check child verified this repo on 2026-09-14. A file-scoped grep cannot tell those
from coupling this change introduces, so AC3 tests added lines; see AC3. No
upstream-owned surface may be edited: `.pi/`, `.agents/`,
`.trellis/agents/`, `.trellis/workflow.md`, `.trellis/config.yaml`,
`.trellis/scripts/`, `.trellis/.template-hashes.json`, `scripts/`, `setup.sh`,
`pi-agent/settings.core.json`

**R1a — What "no coupling" does not mean, stated so it is not smuggled in.** Three
kinds of contact are unavoidable and are *not* the coupling R1 forbids, because they
coordinate rather than configure. Each is listed here with its reason, so a reviewer
can see the whole ledger instead of inferring it from a diff:

| Contact | Where | Why it is not the forbidden coupling |
| --- | --- | --- |
| Reading the dispatched agent from the dispatch tool's own input field | bridge, 5a | It reads a value the caller already passed. It configures nothing, names no role, and survives a rename of every role. The tool name `subagent` is **already** named in the bridge today, and documented in the propagation guide's shipped-tool row |
| Setting an environment variable the child inherits | bridge, 5b | Coordination between two repo-owned processes. The variable is Trellis's, not pi-subagents', and the bridge already reads it in its own predicate — `pi-resources.md` records `contextKey()` as "replicated on purpose" for the same reason |
| Deriving a manifest name from the relayed agent name, by dropping leading `-`-separated segments until a file matches | bridge, 5a | It builds a filename from a value the caller already passed and from a file that already exists on disk. No role literal enters the bridge, and it survives a rename of every role. Honest limit: this is **not** upstream's rule — upstream hardcodes a role table at `.pi/extensions/trellis/index.ts:90-95`, which R1 forbids copying — so it reproduces upstream's selection *outcome* by a name-shape convention rather than its mechanism |

What stays out of the ledger entirely: no role name, no skill name, no
`settings.agentOverrides`, no `skills:`, and no edit to any surface in the list
above.

**R2 — Seamless upgrade.** Every edited file must survive `trellis update` with no
"Modified by you" entry: `.trellis/spec/**` (reported as *User data (preserved)*),
or a surface `trellis` does not manage at all (`pi-agent/**`, which is tracked,
symlinked, and absent from `.trellis/.template-hashes.json`).

**R3 — Two-tier delivery.**

- **Tier 1 — guaranteed transport, async children.** The repo-owned bridge, in its
  child branch, appends the task's curated spec/research files to the child's
  system prompt. Selection relays rather than guesses: the parent already sees the
  dispatched agent in the `subagent` `tool_call` input and the child inherits the
  parent's environment at spawn (`async-execution.ts:751`), so the bridge passes
  that value through and selects the task's manifest whose stem is a **suffix** of
  it — the full name first, then each tail after a `-`, first existing file wins, so
  `trellis-check` selects `check.jsonl` — falling back to the union of the task's
  `*.jsonl` manifests when no value was relayed or nothing matches.

  **Corrected 2026-09-15, measured.** An earlier draft called `{agent}.jsonl "the
  rule upstream itself uses (`TRELLIS_AGENT_JSONL`)"`. Upstream has no such rule:
  `.pi/extensions/trellis/index.ts:90-95` is a hardcoded table naming both roles
  (`"trellis-check": "check.jsonl"`, `check: "check.jsonl"`, …) and `:1274` looks
  the name up in it. `{agent}.jsonl` would have resolved to `trellis-check.jsonl`,
  missed, and fallen through to the union on **every** dispatch — defeating the
  selection silently, which is the failure mode this requirement exists to remove.
  Upstream's *mechanism* is a role table, which R1 forbids copying; the suffix rule
  reproduces its *outcome* from the relayed name instead. **Relaying a value pi-subagents was given is
  not naming a role**; no role literal enters the bridge. Scope is measured, not
  assumed: this tier reaches children the runner hosts (the async default), and
  R6 states what it does not reach.
- **Tier 2 — content home and fallback.** The gates live in `.trellis/spec/`, which
  is what the manifests reference and what the agent definitions' existing fallback
  (`get_context.py --mode packages`) reaches when a manifest is empty.

Tier 1 makes delivery a property of the harness; tier 2 makes the content
reachable by any path, including a future one.

**R4 — The four gates are carried, in this repo's vocabulary.** Each must be
present in a spec file a child reads, phrased without naming a role or a skill:

- **G1 — change boundary, before writing code.** The smallest behaviour gap; where
  that behaviour actually lives; which files will change and why each is necessary;
  what is explicitly not being done.
- **G2 — spec sync, before reporting.** Does `.trellis/spec/`, or any `README.md` /
  `docs/` site, now state something this change made false?
- **G3 — scope discipline.** No tidying the task did not require; no abstraction or
  fallback for a case that cannot occur; no file changed that the acceptance
  criteria do not mention; no workaround at the caller where the behaviour lives.
- **G4 — cross-layer consistency.** This repo's layers are config
  (`settings.core.json`, manifests), scripts (`setup.sh`, `scripts/*.sh`,
  `scripts/*.mjs`), spec, and `docs/`; plus the repo-owned extension surface.
  `.trellis/spec/guides/change-propagation-guide.md` owns the site list — G4
  **references** it rather than restating it.

These are the Trellis gates restated for a repo with no test suite and no
frontend/backend split, whose real gates are the verify chain, the propagation site
list, and `doctor.sh`.

**R5 — Honest checking.** No claim may say a rule is "checked" unless a named
command checks it; where nothing does, say "by hand" (per
`.trellis/spec/guides/change-propagation-guide.md` §"Before You Trust 'Enforced
By'"). The four gates are self-applying — the agent reading them is the check.

Two claims are barred, because both were once believed here and neither is true: that
a child's injected block proves which manifest fed it (today's block is the hardcoded
`implement.jsonl` at `.pi/extensions/trellis/index.ts:2132` — Background 2), and that
delivery can be verified by a command rather than by a probe and a report
(`research/swap-fidelity.md` §6).

**R6 — Global safety, and the boundary of the transport.** The bridge is loaded in
every Pi session on this machine. The new injection must be confined to a child
predicate, must do nothing when no task resolves, and must not change what any
non-child session receives.

Two measured boundaries belong in the requirement rather than in a footnote:

- **A blocking dispatch (`async: false`) is not reachable.** No ambient extension
  loads in a child the parent hosts (`child-launch.ts:295`), so neither the bridge
  nor the generated extension exists there. The gates reach such a child only
  through Tier 2.
- **A child currently receives the parent's per-turn session context**, including a
  `<workflow-state>` breadcrumb that tells it to stay in *planning*. Removing that
  means making the child's copy of the generated extension inert, which the bridge
  cannot do in-process (`trellis/index.ts:1843` runs at extension load) but the
  parent can do before spawning, since the child inherits its environment. That
  change also disables the bridge's own child branch, so the bridge needs its own
  marker and must then supply the child's context itself.

## Acceptance Criteria

- [ ] **AC1** — G1 appears in `.trellis/spec/index.md` `## Pre-Development
      Checklist`; G2, G3 and the G4 reference appear in its `## Quality Check`,
      phrased with no role name and no skill name.
- [ ] **AC2** — `.trellis/spec/config/index.md` and `.trellis/spec/scripts/index.md`
      each carry the layer-specific instance of the gates that matter for that
      layer, without duplicating the whole set.
- [ ] **AC3** — the **added lines** of the change carry no role name
      (`trellis-implement`, `trellis-check`, `trellis-research`), no skill name
      (`trellis-before-dev`), and no `pi-subagents` field name — including in the
      bridge diff and in any injected block text it emits. Test the diff, not the
      file: `git diff -U0 | grep '^+' | grep -nE
      'trellis-implement|trellis-check|trellis-research|trellis-before-dev|agentOverrides'`
      must find nothing. File scope is deliberately **not** the criterion — R1 names
      the two pre-existing hits this task must leave alone, and a failing
      file-scoped grep is not evidence of coupling. Task 2's own check used the same
      diff-scoped form.
- [ ] **AC4** — `git status --short` shows no change under `.pi/`, `.agents/`, and
      no change to any R1-listed path; `.trellis/.template-hashes.json` is
      unchanged (`git diff --name-only` must not list it).
- [ ] **AC5** — `trellis update --dry-run` reports no new "Modified by you" entry and
      still lists `.trellis/spec/` under "User data (preserved)". Baseline captured
      before the edits: `.trellis/spec/` under "User data (preserved)", no
      `.trellis/spec/**` under "Modified by you".
- [ ] **AC6 — delivery, three arms.**
      (a) *Pre-change baseline, measured 2026-09-15*: an async `trellis-check` child
      reported its injected `### Curated Spec / Research Context` block as this
      task's **7 `implement.jsonl` entries**, with the `check.jsonl`-only files
      (`manifest-selection-finding.md`, `skill-delivery-probe.md`) absent — the
      hardcoded manifest at `:2132` confirmed. Result and method:
      `research/swap-fidelity.md` §3. Re-run only if the bridge's selection logic is
      disputed.
      (b) *After the change*: the same dispatch names a `check.jsonl`-only file in
      the context it received, and quotes at least one of the four gates. This half
      is a **probe plus a self-report** — the injected *system prompt* is recorded
      nowhere (`research/swap-fidelity.md` §6), so no command checks it. Do not
      write an acceptance criterion that claims otherwise.
      **Measured 2026-09-15, green**: both `check.jsonl`-only entries —
      `research/skill-delivery-probe.md` and `research/manifest-selection-finding.md`
      — arrived as full bodies, and all four gates were quoted back verbatim from
      `.trellis/spec/index.md`. `pi-resources.md` was truncated at exactly 32768
      (the per-file cap) and `prd`/`design`/`implement` degraded to index lines,
      which is upstream's own order rather than a regression: curated files first,
      artifacts last.
      (c) *Inertness is **not** a self-report — corrected 2026-09-15.* The generated
      extension's per-turn injection persists in the child's session file as a
      `custom_message` of `customType: trellis-runtime-context`, so its **absence**
      is a command:
      `grep -c '"customType":"trellis-runtime-context"' <child session.jsonl>` → `0`.
      Measured A/B on 2026-09-15: the pre-fix probe child carries one, 1857 bytes,
      wrapping the `Status: no_task` breadcrumb plus `<session-overview>`; the
      post-fix child carries none. R5's bar still holds for (b) — the *injected
      prompt* is nowhere on disk — but do not extend that bar to this arm, which has
      a real check. §6 of `swap-fidelity.md` says exactly what it says about system
      prompts and nothing more.
- [ ] **AC7** — the bridge loads without error under Pi (no startup error, dispatch
      still resolves the task), and its injected block: appears only in a child
      session, respects the `context_injection` per-file and total caps it reads from
      `.trellis/config.yaml`, and is absent when no task resolves. The "absent when no
      task resolves" arm is **by hand** — no command checks it.
- [ ] **AC8** — `./scripts/doctor.sh` ends in `All good.`; `./setup.sh` twice is
      idempotent; `./scripts/sync.sh` reports `same pi-agent/settings.core.json`;
      `git status --short` shows only the intended edits.

## Out Of Scope

- Selecting skills per role (`settings.agentOverrides.<role>.skills`, or `skills:`
  anywhere). It guarantees delivery and is exactly the coupling R1 forbids.
- Reviving the shipped `trellis_subagent` tool, or editing anything under `.pi/`.
- Editing `.pi/agents/*.md`, `.agents/skills/*`, or the generated extension's
  prompt constants.
- Porting upstream's path-scoped `spec_injection`
  (`dist/templates/shared-hooks/inject-spec-context.py`) to Pi. It is a new
  mechanism; see the deferred table.
- A `doctor.sh` assertion that spec prose contains the gates, or that the bridge
  injected anything. A prose check that has to match sentences is a fictional
  check; AC3 and AC6 are the real ones.
- Pinning a thinking level or model per role. Measured dead: this repo sets
  `defaultThinkingLevel: "high"`, so the roles already resolve to `high`.
- `trellis channel` work, and the `.trellis/agents/*.md` `provider: claude`
  question.

## Deferred / Revisit Triggers

| Item | Revisit when | Anchors |
| --- | --- | --- |
| Bridge injection replaced by an upstream-provided one | A child's prompt is ever observed to contain a skills catalog, or the generated extension starts selecting a manifest by role on the session path | `research/skill-delivery-probe.md`; `.pi/extensions/trellis/index.ts:2132` |
| Path-scoped `spec_injection` on Pi | The hook implementation is ported to the extension layer, which would inject on Read/Edit/Write instead of per-dispatch | `dist/templates/shared-hooks/inject-spec-context.py`; `.trellis/config.yaml:164-208` |
| Guaranteed skill delivery per role | A hard guarantee is wanted more than zero coupling — then `settings.agentOverrides.<role>.skills` is the only route, accepting the coupling | `pi-subagents` `src/agents/agents.ts:988-1156`, `:1538-1559` |
| Foreground children miss the bridge entirely | A blocking dispatch is used for real work, or `forceTopLevelAsync` is set. Measured cause: `child-launch.ts:295` loads ambient extensions only when `host === "runner"`, so `async: false` reaches neither the bridge nor the generated extension | `research/swap-fidelity.md` §2 |
| No on-disk evidence of a child's system prompt | A delivery claim needs a command rather than a report — then the bridge can dump what it injected, which is a deliberate addition and its own price | `research/swap-fidelity.md` §6; `src/runs/foreground/prompt-audit.ts` (in-memory, foreground only) |
| Project-scoped overlays upstream already provides | Upstream moves refinements or agent memory out of `.pi/`, or this repo becomes willing to ship into a gitignored tree | `research/swap-fidelity.md` §5; `.pi/subagents/refinements/`, `.pi/agent-memory/` |
| Manifest attribution | Any future claim about which manifest fed a child — re-measure with the AC6(a) method | `research/manifest-selection-finding.md` §3 |
| A `doctor.sh` check on the child-inert guard | This task is merged. It mirrors the existing `SHIPPED_TOOLS` section: declare the marker in the bridge, grep `.pi/extensions/trellis/index.ts` for the load-time guard, and `bad` when the guard is absent or when nothing could be extracted. Needs `scripts/doctor.sh`, which is on R1's forbidden list here — so until then the guard is **by hand**, asked as step 11's breadcrumb question | `design.md` §"Risks And Rollback" (the marker row); `scripts/doctor.sh:234-277` (the `SHIPPED_TOOLS` precedent); `.pi/extensions/trellis/index.ts:1843` |
| The gates in a **second repo** | The harness is applied to another Trellis repo. Measured 2026-09-15: **the mechanism already adapts by discovery, not configuration.** `trellis init` scaffolds `.trellis/spec/{backend,frontend}/` from the detected project type (`dist/commands/init.js:267-272`), and `get_context.py --mode packages --json` reports the repo's own layer list at runtime — here `{"mode":"single-repo","specLayers":["config","scripts"]}`. The child's generated agent definition already tells it to use that when a manifest is empty (`.pi/agents/trellis-check.md:27`). So the bridge needs no change per repo; only the gate *wording* is project-owned. Give the second repo its own gates in its own vocabulary, or move them to `~/.pi/agent/AGENTS.md` — deliberately **not** shipped from this repo | `design.md` §"Blast Radius"; `trellis-meta` `references/local-architecture/spec-system.md` (line 102: the spec tree is the user's project spec, not a copy of built-in templates) |

## Open Questions

None.

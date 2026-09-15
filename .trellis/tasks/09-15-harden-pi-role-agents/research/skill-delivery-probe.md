# Probe: does a dispatched role child receive the Trellis skills?

Measured 2026-09-15 by dispatching `trellis-check` (async) on the task
`09-15-harden-pi-role-agents`, instructed to make no edits and write no
artifacts. Run id `793cf310`, child session
`pi_01a0a579-6d40-7652-8065-9dc0c2ed0bae`.

The question this settles: whether the two rules the Trellis workflow requires
of a role child — the change-boundary statement
(`.agents/skills/trellis-before-dev/SKILL.md` step 7) and the check checklist
(`.agents/skills/trellis-check/SKILL.md` steps 4-5) — reach the child through the
skill catalog, or not at all.

## Result

**They do not reach the child.** The catalog is absent, so the rules are absent,
so neither rule runs unless the child is told some other way.

## Evidence

The child was asked to quote its skill catalog verbatim. It reported that no
`<available_skills>` block exists in its context and enumerated the blocks it did
receive: `session-context`, `session-overview`, `trellis-workflow`,
`workflow-state`, `trellis-pi-dispatch-adapter`, the `Curated Spec / Research
Context` block, and `Available tools`. It confirmed none contains the strings
`available_skills`, `<skill>`, `<name>`, `<description>`, or `<location>`, and
that `trellis-check` and `trellis-before-dev` are not present in any catalog it
received.

Its answer to "quote the sentence instructing you what to do with available
skills": no such sentence exists. The only reading instructions it received name
`check.jsonl`, `prd.md`, `design.md`, `implement.md`, and `.trellis/spec/`. It
stated plainly: *"No line in my agent definition instructs me to read a
`SKILL.md` file. No line names `.agents/skills/`."*

It also confirmed it had never seen the `trellis-check` checklist before the
probe made it read the file, and that no part of its input contained the skill
name.

## Why the earlier inference was wrong

`pi-subagents` resolves `inheritSkills ?? true`
(`src/runs/shared/subagent-prompt-runtime.ts:537`), which was read as "the child
receives Pi's skills catalog". That is the wrong conclusion:

- The rewrite that consumes `inheritSkills` is only invoked when one of
  `inheritProjectContext`, `inheritGlobalContext`, `inheritSkills`, or
  `fanoutChild` is explicitly defined. For an ordinary single-agent launch none
  is, so no rewrite runs and the child gets whatever Pi builds for a child
  session.
- `pi-subagents`' own `<available_skills>` example lives in the §Skills section,
  under *selecting* skills. Selection is what populates that block.

So the practical rule is: **a child receives a skill only when it is selected**,
and selection names the skill. Empirical result beats the default-resolution
reading; the default governs a different question.

## What was instead observed to work

The child's `Curated Spec / Research Context` block contained, verbatim, the six
`.trellis/spec/**` files curated into `check.jsonl` for this task:

- `.trellis/spec/guides/index.md`
- `.trellis/spec/guides/change-propagation-guide.md`
- `.trellis/spec/config/layout-and-surfaces.md`
- `.trellis/spec/config/pi-resources.md`
- `.trellis/spec/scripts/shell-guidelines.md`
- `.trellis/spec/scripts/node-guidelines.md`

Its agent definition forces this path in three steps: read
`<task-path>/check.jsonl`, read every `file` it lists, and — if the jsonl has no
curated entries — list available specs with
`python3 ./.trellis/scripts/get_context.py --mode packages` and pick them itself.

Two independent confirmations that the bridge resolved the task for the child:

```text
PI_SUBAGENT_CHILD=1
TRELLIS_CONTEXT_ID=pi_01a0a579-6d40-7652-8065-9dc0c2ed0bae
```

```text
Current task: .trellis/tasks/09-15-harden-pi-role-agents
Source: session:pi_01a0a579-6d40-7652-8065-9dc0c2ed0bae
```

`TRELLIS_CONTEXT_ID` is the child's own context key and the reported `Source` is
that same key, which is the bridge's `CHILD_ADAPTER_NOTE` plus runtime-pointer
path working as designed.

## Consequence for this task

The delivering channel is `implement.jsonl` / `check.jsonl` → `.trellis/spec/**`.
Both ends are repo-owned. `trellis update --dry-run` classifies `.trellis/spec/`
as **User data (preserved)**, against `.pi/agents/trellis-check.md` as
**Modified by you (need your decision)** — measured with a local marker appended
and then reverted, all five agent hashes re-verified `OK` afterwards.

So the rules must be written into the spec tree, not into a skill, a settings
override, or an agent definition. Every one of those three alternatives requires
naming something this repo does not own.

## Residual caveat

The probe is a single observation of one role under one dispatch. It establishes
that the catalog is absent, which is a structural fact about prompt construction
and not a sampling question. It does not establish how often a model reads a spec
it *is* handed; that is a different question and the reason the spec text should
be unmissable at the entry point rather than buried.

## Upstream observation, not actionable here

`.pi/agents/trellis-check.md` states "Read and follow the spec and research files
listed in the task's `check.jsonl`" twice — once in the context prelude, once
under Core Responsibilities. It is a CLI-generated file, so the duplication is
upstream's to tidy.

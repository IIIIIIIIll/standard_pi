# Guard the child-inert contract with a `doctor.sh` check

## Goal

The bridge is about to make a dispatched child inert by setting a marker in the
parent's environment, so the child's copy of the generated Trellis extension
returns at load. That return is a guard inside a file this repo does not own and
cannot edit. Nothing checks it. Add the check to `scripts/doctor.sh`, mirroring the
section that already guards the same shape of dependency.

## Background

Four measured facts (2026-09-15). Each has the command that produced it.

1. **The guard, and where it sits.** `.pi/extensions/trellis/index.ts:1843` is
   `if (process.env.TRELLIS_SUBAGENT_CHILD === "1") return;` — the **first
   statement** of the default export `trellisExtension()` at `:1828`. It is a
   load-time early return: on the marker, the extension registers nothing and no
   handler ever fires.
   `grep -n '^export ' .pi/extensions/trellis/index.ts` → exactly one entry point,
   so the guard's home is unambiguous.
2. **The marker already has two readers in this repo**, and neither is upstream's:
   the guard above, and the bridge's child predicate at
   `pi-agent/extensions/trellis-subagents-bridge/index.ts:223` and `:230`. So the
   bridge already depends on the marker name today — the declaration this task
   adds is used on arrival, not dead code.
3. **`pi-subagents` reads it nowhere.** `grep -rn TRELLIS_SUBAGENT_CHILD` over the
   installed package returns nothing; it reads only its own `PI_SUBAGENT_CHILD`.
4. **The registration call is `pi.registerTool?.(`** (`:1925`) — optional-call
   form. A check written against `pi.registerTool(` matches **zero** calls, and a
   check written against the bare word `registerTool` matches the **type
   annotation** at `:1829`, which is above the guard. Either mistake makes the
   positional test meaningless. This is why the pattern is specified below rather
   than left to the implementer.

**Why this is not in `09-15-harden-pi-role-agents`.** That task's R1 lists
`scripts/` as a forbidden surface, and AC3/AC4 verify no R1 path changed. Widening
R1 would break its own acceptance criteria. The check belongs with the
`SHIPPED_TOOLS` section it mirrors, in this separate task.

**Ordering.** This task lands **before** `09-15-harden-pi-role-agents` implements
its step 5b. The marker declaration is introduced here and consumed there; the
reverse order would leave 5b writing a literal marker name and this check
comparing against something that does not exist yet.

## Requirements

**R1 — The marker has one definition.** The bridge declares
`CHILD_INERT_MARKER`; `doctor.sh` reads the name off that declaration. No literal
`TRELLIS_SUBAGENT_CHILD` in `scripts/`. This is the same rule `SHIPPED_TOOLS`
already follows, for the same reason: a second copy diverges from the first
silently.

**R2 — The check proves the guard is *first*, not merely present.** A guard that
exists but sits after the registration calls registers everything, then returns.
So the check compares line numbers: the guard must precede the first
`pi.registerTool?.({` call.

**R3 — Fail loud, per the section's own rule.** Every path where the check cannot
see is a `bad` (or the existing `warn` when the Trellis CLI is absent): extension
missing, extension unreadable, declaration absent, declaration unreadable or
reformatted, guard not found. The repo's rule is explicit — a check that reports
`ok` after it stopped reading is worse than no check.

**R4 — A legitimate reflow must not trip it.** The guard test matches the marker
name and a `return` on the same line, not the exact string `=== "1"`. Spacing,
quote style, and `== "1"` all survive.

**R5 — The existing section is the home.** The check lives inside
`==> Trellis subagent bridge` (`.scripts/doctor.sh:192`) and reuses `$trellis_ext`,
`$bridge_src`, `$bridge_file`, `$trellis_cli` and their existing absence handling.
No new section, no second `if [ ! -f "$trellis_ext" ]` chain. It must not be hung
off the `SHIPPED_TOOLS` `elif`: skipping one check because the other's input is
missing is the failure R3 exists to prevent.

**R6 — A contributor reading the bridge's rules learns about the check.**
`.trellis/spec/config/pi-resources.md`'s `trellis-subagents-bridge/` list, and the
propagation guide's multi-site table.

## Acceptance Criteria

- [ ] **AC1** — the bridge declares the marker once; the existing predicate uses
      the constant. `grep -c 'TRELLIS_SUBAGENT_CHILD'` in the bridge returns `1`
      (the declaration line) — behaviour-identical, verified by a normal session
      still resolving its task.
- [ ] **AC2** — on the tree as-is, the check reports `ok` naming both line numbers,
      and `./scripts/doctor.sh` still ends in `All good.`
- [ ] **AC3** — **negative, measured.** With the guard line deleted from a scratch
      copy of the extension, the check reports `bad` naming the marker. Run it;
      do not infer it from reading the code.
- [ ] **AC4** — **negative, measured.** With the guard moved below the first
      `pi.registerTool?.(` call in that same scratch copy, the check reports `bad`
      giving both line numbers.
- [ ] **AC5** — **positive, measured.** With the guard's comparison rewritten
      (e.g. `=== "1"` → `== "1"`) in the scratch copy, the check still reports
      `ok` (R4).
- [ ] **AC6** — with the `CHILD_INERT_MARKER` declaration commented out of the
      bridge, the check reports `bad` with a message naming `CHILD_INERT_MARKER`
      and the file, and does **not** suppress the `SHIPPED_TOOLS` result.
- [ ] **AC7** — `bash -n scripts/doctor.sh` passes; `./scripts/doctor.sh` ends in
      `All good.`; `git status --short` shows only the intended edits, and
      `.pi/extensions/trellis/index.ts` is byte-identical to its pre-test state.
- [ ] **AC8** — both prose sites name the check, and the propagation guide carries
      the multi-site fact (declaration → check → the generated extension it reads).

## Out Of Scope

- Runtime proof that the child actually goes inert. That is a dispatch probe, and
  it is `09-15-harden-pi-role-agents` step 11 — no command can check a child's
  system prompt (`research/swap-fidelity.md` §6).
- Step 5b itself, and any change to the shape of the bridge's role predicate.
- Checking `CHILD_ADAPTER_NOTE`, the manifest selection, or the injection budget.
- Asserting that `trellisExtension` is still Pi's load path. A text check cannot
  see that; it is recorded as a revisit trigger instead.

## Deferred / Revisit Triggers

| Item | Revisit when | Anchors |
| --- | --- | --- |
| The guard check upgraded to assert `trellisExtension` is still the load path | Pi changes how extensions are discovered, or a second `export` appears in the generated extension | `.pi/extensions/trellis/index.ts:1828`; `design.md` §"What this cannot prove" |
| The check retired | Upstream provides its own inertness mechanism, or the bridge stops depending on the marker — then this check and the declaration go together | `.trellis/tasks/09-15-harden-pi-role-agents/research/swap-fidelity.md` §7.3 |

## Open Questions

None.

# Detect drift between the generated Pi tools and the subagent bridge

## Goal

Close the residual risk from `09-13-pi-subagents-dispatch`. That task deactivated
the shipped Trellis dispatch tool by **hard-coded name**, so a `trellis update`
that renames the tool — or registers a second dispatch tool — silently ends the
deactivation. The shipped path becomes callable again with its competing prompt
guidance, and nothing reports it.

Make the coupling visible: the bridge names its shipped tools explicitly, and
`doctor.sh` fails when the generated extension registers a `trellis_*` tool the
bridge does not name.

## Background

- The generated extension registers exactly one tool today:
  `.pi/extensions/trellis/index.ts:1925-1926` —
  `pi.registerTool?.({` / `name: "trellis_subagent",`. The file is byte-identical
  to the upstream template (`sha256 7607dd67…`, recorded in
  `.trellis/.template-hashes.json`).
- The bridge deactivates it by filtering on a single constant (`SHIPPED_TOOL`).
- `M5` in the predecessor's check round flagged this coupling. It is the only
  residual risk from that task that is neither fixed nor merely documented.

## Requirements

**R1 — The bridge must name its shipped tools as a list.**
`disableShippedTool` deactivates **every** name in the list. Adding a name is a
one-line change.

**R2 — `doctor.sh` must fail loudly on drift.**
When the generated extension registers a `trellis_*` tool that the bridge does not
name, report `bad` (contributing to exit 1), naming both the offending tool and
the bridge file to edit.

**R3 — The check must never produce a false `ok`.**
If the generated extension exists and contains a `registerTool` call but **no**
tool name can be extracted, that is itself drift: `bad`, never silence. This is
the requirement that makes the check worth having — it must fail when it stops
being able to see, not only when what it sees is wrong.

**R4 — Offline and deterministic.**
No network, and no invocation of the `pi` binary or any model-facing tool. It must
be meaningful on a fresh clone.

**R5 — Absent generated file degrades to `warn`** with a reason, never a failure.

**R6 — No generated file may be edited**, and the check must leave both the
generated file and `.trellis/.template-hashes.json` byte-identical.

**R7 — Documentation updated** in `.trellis/spec/config/pi-resources.md`.

## Non-Goals

- Patching the generated extension, or any upstream `@mindfoldhq/trellis` change.
- Detecting upstream drift unrelated to a registered tool name (hook behaviour,
  context-key derivation, agent preludes).
- Generalizing the bridge into a plugin or config format.
- Adding production surface purely for testability (e.g. a path-override env var).

## Acceptance Criteria

- [ ] **AC1** The no-drift path fires: on the current tree the new check adds no
      `bad` and no new `warn`, and the full chain still ends in `All good.`
      with exit 0.
- [ ] **AC2** The failure path is **proven, not assumed**: with a fake
      `name: "trellis_rogue",` temporarily added to the generated extension,
      `doctor.sh` reports it as a problem naming both the tool and the bridge
      file, and exits 1. The file is then restored and its `sha256` re-verified
      against `.trellis/.template-hashes.json`.
- [ ] **AC3** R3's guard is proven: with the generated file temporarily reduced to
      a `registerTool` call containing no extractable name, the check reports
      `bad`, not `ok`.
- [ ] **AC4** The check is offline and invokes no `pi` binary — verified by
      reading the added lines; `doctor.sh` must remain meaningful on a clone with
      no `pi` present.
- [ ] **AC5** With `.pi/extensions/trellis/index.ts` absent, the check `warn`s
      with a reason and does not fail the run.
- [ ] **AC6** After the full chain, `git diff --name-only` lists no generated file
      and `.trellis/.template-hashes.json` is unchanged.
- [ ] **AC7** `pi-resources.md` names the coupling and the check.

## Notes

Design and rejected alternatives: `design.md`. Steps: `implement.md`.

Predecessor record, including the M5 finding:
`.trellis/tasks/archive/2026-09/09-13-pi-subagents-dispatch/`
(`research/check-phase-findings.md` § M5).

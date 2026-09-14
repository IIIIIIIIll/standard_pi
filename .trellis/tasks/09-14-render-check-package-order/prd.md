# Make the settings render drift check insensitive to package order

## Goal

Stop `doctor.sh` from failing on a `settings.json` that differs from the rendered
result only in the **order** of the `packages` array.

## Problem

`render-settings.mjs --check` compares the rendered settings against the live
file. The `packages` array comparison is order-sensitive, but two legitimate
writers disagree about order:

- `render-settings.mjs` emits **core packages first, then the enabled optionals'
  packages** (core + optional manifest concatenation).
- `pi install` **appends** to the end of the live array. An always-on package
  installed while an optional bundle is already enabled therefore lands *after*
  that optional's package.

When the two orders differ, `doctor.sh` reports
`✗ settings.json has drifted from the repo` and exits `1`, even though the two
arrays are set-equal. That is a false positive: nothing is actually drifted, and
no per-machine choice leaked into core.

This is the documented happy path, not an edge case — `README.md` tells the user
to run `pi install npm:some-plugin && scripts/sync.sh` for an always-on plugin.
The only remedy today is running `./setup.sh` again, which also runs
`pi update --extensions` (network, moves plugin versions) unless `--skip-plugins`
is passed.

## Measured evidence (2026-09-14, Pi 0.85.1)

Triggered for real by installing `npm:pi-tps-status` while the `opencode-go`
optional bundle was enabled:

```text
live   : … "npm:pi-lens", "npm:@oscarfalero/pi-opencode-go", "npm:pi-tps-status"
render : … "npm:pi-lens", "npm:pi-tps-status", "npm:@oscarfalero/pi-opencode-go"
```

- `scripts/sync.sh` folded the live list into `settings.core.json` correctly
  (optional contributions stripped, `lastChangelogVersion` dropped).
- `node scripts/render-settings.mjs . ~/.pi/agent/settings.json ~/.pi/agent/.pi-setup-state.json --check`
  exited `1` with `drift … does not match the repo`.
- Every other key compared equal; the only difference was array order.
- `./setup.sh --skip-skills --skip-plugins` re-rendered in canonical order and
  the check passed again, confirming ordering is the sole cause.

It stayed hidden until now only because `pi-lens` happened to be both the last
core package and the last entry live, so install order and render order coincided.

## Requirements

- A set-equal `packages` array must not be reported as drift, regardless of order.
- A `packages` array that differs by **membership** must still be reported as
  drift (duplicates and missing/extra specs included — a duplicate is a real
  defect, not an ordering difference).
- The fix must not make the two writers agree by *accident*: whichever layer is
  made order-insensitive must be explicit, and any remaining order dependence
  must be documented where it can be read.
- No behaviour change to `setup.sh` rendering beyond what the chosen approach
  requires; `setup.sh` must stay idempotent and its second run must still report
  nothing to do.
- `doctor.sh` must keep failing loudly for every real drift it catches today
  (missing package, extra package, wrong setting value) — the check must not be
  weakened into "compares nothing".
- The change must be verifiable offline, matching `doctor.sh`'s existing
  "no network, no `pi` invocation" constraint.

## Acceptance Criteria

- [ ] With a live `packages` array whose order is core-then-installed (an
      optional's package before a later-installed always-on package),
      `doctor.sh` exits `0` with no drift and reports no problem.
- [ ] With a live `packages` array missing one spec present in the render,
      `doctor.sh` still reports drift and exits `1`.
- [ ] With a live `packages` array containing a duplicate spec, the outcome is
      decided and documented (either reported as drift, or normalised) and a test
      or check proves it.
- [ ] With a live `packages` array containing an extra spec not in the render,
      `doctor.sh` still reports drift and exits `1`.
- [ ] A value difference in a non-`packages` key still reports drift.
- [ ] `./setup.sh` twice in a row remains idempotent, and
      `./setup.sh → ./scripts/sync.sh` still reports
      `same pi-agent/settings.core.json`.
- [ ] Any ordering rule that remains in the system is written down in
      `.trellis/spec/config/layout-and-surfaces.md` (the "settings.json Is
      Generated" section) or `pi-resources.md`, whichever owns it after the
      design is chosen.

## Constraints

- `scripts/lib.sh` is the single definition of the path lists; do not re-declare
  them. Ordering this change touches `render-settings.mjs`, possibly
  `sync-settings.mjs`, `doctor.sh`, and the config specs — see
  `.trellis/spec/guides/change-propagation-guide.md` for the multi-site facts.
- JSON must stay strict (no JSONC) in every file here.
- Whatever is chosen must not require `doctor.sh` to call `pi`.

## Open Question (design decision, not yet made)

The fix could land in any of three places, and they are not equivalent:

1. `render-settings.mjs --check` compares `packages` as an unordered set.
2. `render-settings.mjs` (render) preserves the live order of already-present
   packages and only appends new ones.
3. `sync-settings.mjs` reorders core so that install order is canonicalised on
   the way in.

Option 1 is the smallest and fixes only the false positive; options 2 and 3
change what the two writers emit and so need their own reasoning about whether
`settings.core.json` array order is meaningful to a reader. Decide this in
`design.md` before `task.py start`.

## Out Of Scope

- Any change to how optionals are enabled, disabled, or inferred.
- Making `doctor.sh` detect undeclared files appearing in `~/.pi/agent/` (raised
  during the same audit, deliberately not pursued).
- Reformatting or reordering `settings.core.json` by hand.

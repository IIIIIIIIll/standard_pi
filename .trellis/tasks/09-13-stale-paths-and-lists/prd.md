# Correct stale install.sh references and sync the local-path lists

## Goal

Fix the two user-facing references to `scripts/install.sh` (which does not exist),
and catch the machine-local path lists up with what Pi actually writes under
`~/.pi/agent`.

## Requirements

### R1 — Point the stale references at the real entry point

- `scripts/render-settings.mjs:113` currently prints
  `run scripts/install.sh or scripts/sync.sh` on render drift. It must name
  `./setup.sh` instead of `scripts/install.sh`. This string is user-facing output
  from `doctor.sh`, so it is the instruction a user follows when their settings
  have drifted.
- `.gitignore:10` comments that `settings.json` is rendered "by scripts/install.sh".
  It must name the real mechanism (`./setup.sh`, which calls
  `scripts/render-settings.mjs`).
- Do not rename or add any script. `setup.sh` at the repo root is the entry point.

### R2 — Catch the path lists up with Pi's runtime output

Observed on this machine under `~/.pi/agent`, and currently absent from all three
lists below: `missions/`, `profiles/`, `run-history.jsonl`, `web-search-cache/`.

- `.gitignore` — add ignore patterns for the paths above, in the existing
  "Generated / machine-local Pi state" group, following the existing
  `pi-agent/<name>` prefix style.
- `README.md` — add them to the "What is intentionally *not* stored here" table
  with a one-line reason each, matching the existing table's tone.
- `scripts/sync.sh` — add them to the "Managed elsewhere (not synced)" loop's
  file list so the report is complete.

Constraints:

- The `sync.sh` list is report-only: it prints `skip pi-agent/<name>` for entries
  that exist. Extending it must not change what is copied. Do not turn it into a
  glob or make it delete anything.
- Backup files are already covered: `pi-agent/*.bak-*` matches
  `sol-pi.json.bak-<stamp>`. Do not add a redundant pattern for it.
- Do not add an ignore pattern that would hide a currently tracked file. Verify
  with `git ls-files` afterwards.

### R3 — Update the specs that recorded this as unfixed

The bootstrap spec deliberately documented these as known-stale. Once fixed, that
text becomes wrong:

- `.trellis/spec/scripts/shell-guidelines.md` — the anti-pattern bullet that names
  `render-settings.mjs` and `.gitignore` as referencing a non-existent
  `scripts/install.sh`. Remove or invert it; do not leave a "known instance" of
  something that no longer exists.
- `.trellis/spec/config/layout-and-surfaces.md` — the `.gitignore` Parity section's
  "has already fallen behind" paragraph and the note that the
  `pi-agent/settings.json` comment names a missing script.

## Acceptance Criteria

- [ ] `grep -rn "install\.sh" --include='*.sh' --include='*.mjs' --include='*.md' .gitignore .`
      (excluding `.trellis/scripts`, `.agents`, and `.trellis/tasks` historical
      records) returns no reference to a non-existent `scripts/install.sh`.
- [ ] Rendering drift prints a runnable instruction. Verify by breaking then
      restoring the live file:
      `node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check`
      exits 0 on a clean tree, and the drift message names `./setup.sh`.
- [ ] `for p in missions profiles run-history.jsonl web-search-cache; do grep -q "$p" .gitignore && grep -q "$p" README.md && grep -q "$p" scripts/sync.sh || echo "MISSING $p"; done`
      reports nothing missing.
- [ ] `./scripts/sync.sh` output's "Managed elsewhere (not synced)" section lists
      every machine-local path that exists on this machine under `~/.pi/agent`.
- [ ] `git ls-files | grep -E 'missions|profiles|run-history|web-search-cache'`
      returns nothing (no tracked file was newly ignored).
- [ ] `./setup.sh` runs twice with identical output; `./scripts/doctor.sh` ends in
      `All good.`
- [ ] Exactly one commit, containing only the files this task touches.

## Out Of Scope

- `PI_DIRS` / `PI_FILES` de-duplication — that is the sibling task
  `09-13-single-source-symlink-lists`, which must land after this one because both
  edit `scripts/sync.sh` and `scripts/doctor.sh`.
- Any change to what `setup.sh`, `sync.sh`, or `doctor.sh` *do*.
- `.trellis/tasks/00-bootstrap-guidelines/prd.md` — its Completion Record is a
  historical record of what that task found and deliberately did not fix. Leave it.

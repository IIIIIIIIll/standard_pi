# Single-source PI_DIRS and PI_FILES across the shell scripts

## Goal

Give `PI_DIRS` and `PI_FILES` exactly one definition, consumed by `setup.sh`,
`scripts/sync.sh`, and `scripts/doctor.sh`, so the three cannot diverge — and
update the specs that currently record the duplication as current reality.

## Requirements

- One file defines both arrays. The three scripts contain no literal
  `PI_DIRS=(…)` / `PI_FILES=(…)` assignment of their own.
- The three scripts read the same values they read today:
  `PI_DIRS=(themes prompts tools skills agents extensions)` and
  `PI_FILES=(AGENTS.md)`.
- Behaviour is unchanged. `setup.sh` links the same paths, `sync.sh` copies and
  reports the same paths, `doctor.sh` checks and reports the same paths.
- A missing definition file is a **loud** failure in all three scripts, naming the
  missing path. It must never cause a silent no-op or a partial run.
- A script must not be able to silently override the lists. If a future edit
  re-declares `PI_DIRS` in one script, it must fail rather than diverge — the
  whole point of the change.
- The remaining occurrences that cannot be single-sourced must still be kept in
  sync by hand, and the propagation guide must be updated to say precisely which
  ones remain: the `setup.sh` header comment (its `--help` text), the
  `doctor.sh` "none in repo yet" message, and the two `README.md` lists.
- Update the specs that describe this duplication as unfixed:
  `.trellis/spec/guides/change-propagation-guide.md` (the 7-place table and the
  "If You Want To Fix The Duplication" section),
  `.trellis/spec/scripts/shell-guidelines.md` (the "Exception: PI_DIRS / PI_FILES
  are still hard-coded" note), and `.trellis/spec/scripts/index.md` (the pre-dev
  checklist item about adding a fourth copy).

## Acceptance Criteria

- [ ] `grep -rn "PI_DIRS=" setup.sh scripts/` matches exactly one file and one line.
- [ ] The extracted values are identical to the pre-change ones. Verify by
      comparing against the arrays at `git show HEAD:setup.sh` etc.
- [ ] `bash -n setup.sh scripts/*.sh` passes.
- [ ] `./setup.sh` twice → identical output, clean tree, `./scripts/doctor.sh`
      ends in `All good.`
- [ ] `./scripts/sync.sh` reports `same pi-agent/settings.core.json` and
      `Already up to date.`
- [ ] **Negative test**: move the definition file aside and confirm all three
      scripts fail loudly with a message naming the missing path, then restore it
      and confirm the full chain passes again. `doctor.sh` must exit non-zero, not
      abort with an unbound-variable error from `set -u`.
- [ ] **Drift test**: temporarily adding `PI_DIRS=(bogus)` to the top of one
      script makes that script fail, rather than run with the wrong list.
- [ ] `./scripts/doctor.sh` still reports a correctly linked resource directory as
      a problem when its symlink actually points elsewhere (the check it performs
      did not weaken).
- [ ] The four remaining hard-coded sites are enumerated in the propagation guide
      and the guide's 7-place table is corrected.
- [ ] Exactly one commit, containing only the files this task touches.

## Notes

- This task must be implemented **after** `09-13-stale-paths-and-lists`, because
  both edit `scripts/sync.sh` and `scripts/doctor.sh`. Do not start it on a tree
  where that sibling is uncommitted.
- Do not extend the shared file beyond the two arrays. See `design.md`.

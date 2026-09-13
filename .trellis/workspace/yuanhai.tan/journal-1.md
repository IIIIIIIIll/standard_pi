# Journal - yuanhai.tan (Part 1)

> AI development session journal
> Started: 2026-09-13

---



## Session 1: Spec bootstrap, then repair the drift it exposed
<!-- trellis-session: v=2 fp=e4b581867a6bed60 -->

**Date**: 2026-09-13
**Task**: Spec bootstrap, then repair the drift it exposed
**Branch**: `main`

### Summary

Two phases in one session. First, the `trellis init` spec bootstrap: the repo had 13 template placeholder files split into `backend/` and `frontend/`, but it is a Pi harness config store with no such layers. Replaced them with evidence-backed specs derived from the actual bash, Node ESM, and JSON. Second, the bootstrap's own honesty cost: it recorded three defects as "current reality" instead of fixing them, so those became a parent task with three children — and the check pass on the first child uncovered a fourth that nobody had spotted.

### Main Changes

- Replaced the trellis init backend/frontend spec template (13 placeholder files) with layers matching this repo: scripts/ (bash + Node ESM conventions), config/ (tracked/symlinked/generated/ignored surfaces, optional-bundle contract, Pi resources + permission policy), and a new change-propagation guide. Took the three defects that bootstrap documented as current reality and fixed them as a parent task with three children: stale scripts/install.sh references in user-facing output; PI_DIRS/PI_FILES duplicated across setup.sh+sync.sh+doctor.sh; and the three machine-local path lists disagreeing (trust.json was reported as intentionally-skipped while git would stage it).

### Git Commits

| Hash | Message |
|------|---------|
| `cf49aa7` | Write project specs that match the repo instead of the template |
| `a72e47d` | Plan the harness drift repair as a parent task with three children |
| `d44289e` | Fix user-facing references to a script that no longer exists |
| `819bfa1` | Define the symlinked resource lists once instead of three times |
| `5997e94` | Make a reported-skipped path impossible to commit, and check it |
| `63e0724` | Record the fourth requirement and close the parent's acceptance criteria |

### Testing

- [OK] bash -n, node --check, ./setup.sh twice byte-identical, ./scripts/sync.sh, ./scripts/doctor.sh All good. Four negative tests on the new ignore-coverage check: unignored reported path, a directory entry that lost its slash, a new array entry with no .gitignore rule, and a clean run with no false positives. doctor.sh outside a git repo exits 1 without an unbound-variable error.

### Status

[OK] **Completed**

### Next Steps

- 00-bootstrap-guidelines is complete (checkboxes ticked, Completion Record written) but still in_progress -- archive it once you have skimmed the specs. Optionally: shellcheck is not installed, so the # shellcheck directives in scripts/*.sh remain documentation rather than tooling.

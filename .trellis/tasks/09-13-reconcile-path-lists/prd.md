# Reconcile the ignore, skip-list, and not-stored path lists

## Goal

Make the three lists that track machine-local Pi paths agree, and add a check that
catches the next divergence instead of relying on someone noticing.

## Context

Found while checking `09-13-stale-paths-and-lists`. That task added four paths
(`missions/`, `profiles/`, `web-search-cache/`, `run-history.jsonl`) to all three
lists, and in doing so exposed that the lists had *already* diverged elsewhere.
Measured 2026-09-13:

| Path | `.gitignore` | `sync.sh` skip-list | `README.md` table |
|------|--------------|---------------------|-------------------|
| `cache/` | yes | **no** | **no** |
| `trust.json` | **no** | yes | yes |
| `agent-memory/` | **no** | yes | yes |

`~/.pi/agent/trust.json` exists on this machine. It is reported as "intentionally
not synced" while git would stage it — the two facts that are supposed to be
equivalent are not. Nothing is currently leaking (it is untracked), and
`doctor.sh`'s secret scan would not catch it, because a trust file contains no
key-shaped string.

## Requirements

- Reconcile all three lists for the rows above. `.gitignore` is the
  security-relevant one: a path that `sync.sh` reports as deliberately skipped
  must be impossible to commit.
- Preserve intent rather than making the lists identical: `.gitignore` also
  legitimately covers patterns that are not runtime *paths* (`*.log`,
  `*.bak-*`, `.pi/`), and the `sync.sh` report exists to explain paths a user can
  see in `~/.pi/agent`, so it need not enumerate backup file names.
  Decide and document which list is authoritative for what.
- Add a `doctor.sh` check that fails when a path the skip-list reports as skipped
  is not actually ignored by git. `git check-ignore` is available and needs no
  network. The check must be a `bad` (fatal), not a `warn`.
- The new check must not fire on the legitimate `.gitignore`-only patterns, so
  the "which list is authoritative" decision above has to be encoded, not eyeballed.
- Update `config/layout-and-surfaces.md` §"Common Mistake: assuming the two lists
  have parity" and the propagation guide's pointer once the lists agree.

## Acceptance Criteria

- [ ] No path reported by `sync.sh` as skipped is stageable by git. Verify:
      `for p in $(sed -n 's/^for f in \(.*\); do$/\1/p' scripts/sync.sh); do git check-ignore -q "pi-agent/$p" || echo "NOT IGNORED: $p"; done`
      outputs nothing.
- [ ] `cache/` appears in the `sync.sh` report when `~/.pi/agent/cache/` exists.
- [ ] `trust.json` and `agent-memory/` are covered by `.gitignore`.
- [ ] `doctor.sh` reports a problem when the check is violated: temporarily remove
      `pi-agent/trust.json` from `.gitignore`, confirm a `✗` and exit 1, restore it,
      confirm `All good.`
- [ ] `doctor.sh`'s new check does **not** fire on a clean tree, and does not fire
      for `.gitignore`-only patterns such as `*.log` or `.pi/`.
- [ ] `bash -n setup.sh scripts/*.sh`; `./setup.sh` twice; `./scripts/sync.sh`;
      `./scripts/doctor.sh` ends in `All good.`
- [ ] One commit.

## Out Of Scope

- `PI_DIRS` / `PI_FILES` — sibling task `09-13-single-source-symlink-lists`.
- The four paths added by `09-13-stale-paths-and-lists`; they are already in all
  three lists. Verify, do not re-add.
- Any path that does not exist on at least one machine — do not speculatively
  ignore Pi directories that have never been observed.
- `doctor.sh`'s existing note-vs-problem classification for anything other than
  the new check.

## Notes

- **Ordering**: implement after `09-13-single-source-symlink-lists`. Both edit
  `scripts/doctor.sh` and `.gitignore`, and that task changes `doctor.sh`'s
  prologue (the `PI_DIRS`/`PI_FILES` extraction), which this task's new check must
  be written against.

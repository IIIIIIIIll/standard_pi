# Design — single-sourcing the symlink resource lists

## Problem

`PI_DIRS` and `PI_FILES` are defined identically in three scripts:

```
setup.sh:31-32          PI_DIRS=(themes prompts tools skills agents extensions) / PI_FILES=(AGENTS.md)
scripts/sync.sh:19-20   identical
scripts/doctor.sh:13-14 identical
```

A divergence is not caught by anything. The motivating failure: add a resource
directory to `setup.sh` and `sync.sh` but not `doctor.sh`, and `doctor.sh` reports
a correctly linked directory as `! <name> not linked (run ./setup.sh)` — the
verifier lies, in the direction that makes a user distrust the verifier.

## Options Considered

| Option | Verdict |
|--------|---------|
| **A. Sourced definition file** — `scripts/lib.sh` defines the arrays; each script sources it | **Chosen.** Minimal, no new runtime, no build step, works with the existing entry-point model. |
| B. Generate a small fragment from a single source at setup time | Rejected: `setup.sh` itself consumes the lists, so it would need the fragment before it can render anything — a bootstrap cycle. Adds a generated tracked file for two arrays. |
| C. Keep the duplication, add a `doctor.sh` check that the three agree | Rejected: adds a check for a mechanical fact that can simply be made impossible. Also cannot detect the divergence before `setup.sh` has run. |
| D. Export via environment variables in `setup.sh` | Rejected: `export` does not carry arrays to child processes usefully, and it would make the lists unavailable to a directly-invoked `doctor.sh`, which is its normal usage. |

## Placement

`scripts/lib.sh` — matching the directory of the two scripts that are not the
entry point, and importable by `setup.sh` via `"$REPO_DIR/scripts/lib.sh"`.

The file holds **only** `PI_DIRS` and `PI_FILES`. Its header comment says so
explicitly. The temptation after this change is to move other shared helpers in
(`say`, `note`, the `node` preflight, `link()`); resist it — that would couple
`setup.sh`'s bootstrap path to more of `scripts/`, and the repo's convention is
that each script reads standalone.

## Contract

```bash
#!/usr/bin/env bash
#
# lib.sh — the single definition of the harness resource lists.
#
# Sourced, never executed. Holds ONLY the paths that setup.sh symlinks,
# sync.sh pulls back, and doctor.sh verifies. Do not add helpers here.
#
# Consumers: setup.sh, scripts/sync.sh, scripts/doctor.sh
#
if [ -n "${PI_SETUP_LIB_LOADED:-}" ]; then
  return 0
fi
PI_SETUP_LIB_LOADED=1

# Resource directories symlinked into the Pi config dir when present in the repo.
readonly PI_DIRS=(themes prompts tools skills agents extensions)
# Resource files symlinked the same way.
readonly PI_FILES=(AGENTS.md)
```

Design points, each verified against bash on this machine:

- **`readonly`** is the anti-divergence mechanism. A later `PI_DIRS=(x)` in a
  script fails with `PI_DIRS: readonly variable` and a non-zero exit under
  `set -e`, rather than silently substituting a different list. Verified.
- **The double-source guard** uses `if … then return 0; fi` rather than
  `[ … ] && return 0`. Both work, but the explicit `if` cannot be misread as a
  `set -e` hazard later. `${PI_SETUP_LIB_LOADED:-}` is required — a bare
  `$PI_SETUP_LIB_LOADED` would trip `set -u` in the consumers.
- **The guard variable is the only thing exported into the consumer's namespace**
  besides the two arrays. It is intentionally the same prefix as the file.
- **`lib.sh` does not compute `REPO_DIR` or set shell options.** It is pure data.
  Setting `set -e` inside a sourced file would silently change a consumer that
  deliberately omits it (`doctor.sh`).

## Consumer Shape — `setup.sh` and `scripts/sync.sh`

Both run under `set -euo pipefail`, where a failed `source` aborts with a bare
`No such file or directory`. Load explicitly so the message names the path:

```bash
LIB="$REPO_DIR/scripts/lib.sh"
if [ ! -f "$LIB" ]; then
  echo "missing $LIB — it is part of this repo (re-clone or restore it)" >&2
  exit 1
fi
# shellcheck source=scripts/lib.sh
. "$LIB"
```

`setup.sh` computes `REPO_DIR` from its own directory (repo root); the two
`scripts/` consumers compute it with `/..`. `lib.sh` therefore gets no opinion
about location.

## Consumer Shape — `scripts/doctor.sh`

`doctor.sh` runs `set -uo pipefail` **without `-e`**, deliberately, so it can
report every problem. That changes the failure handling:

- A plain `. "$LIB"` on a missing file would not abort; the script would continue
  and then hit `"${PI_DIRS[@]}"` — which, with `set -u` on an unset array, aborts
  the whole report with `unbound variable`. That is exactly the "abort with a
  confusing error" outcome the PRD forbids.
- Therefore `doctor.sh` performs the existence check first and treats a missing
  `lib.sh` as a fatal `bad`:

```bash
LIB="$REPO_DIR/scripts/lib.sh"
if [ ! -f "$LIB" ]; then
  bad "scripts/lib.sh missing (it defines PI_DIRS/PI_FILES)"
  exit 1
fi
# shellcheck source=scripts/lib.sh
. "$LIB"
```

Exiting immediately is correct here: with the lists undefined, every subsequent
symlink check would report a false problem, so the rest of the report would be
noise rather than information. `doctor.sh` keeps its own exit-code contract
(`1` when anything is `bad`), and this path increments `problems` via `bad`
before exiting.

## What Stays Duplicated

Extracting the arrays removes 3 of the 7 sites. The survivors are not code and
cannot be generated from the array without adding a templating step:

| Site | Form | Enforcement |
|------|------|-------------|
| `setup.sh:8` | header comment (= `--help` text) | manual |
| `scripts/doctor.sh:82` | "none in repo yet" message | manual |
| `README.md:16` | numbered setup step | manual |
| `README.md:134` | Day-to-day prose list | manual |

`change-propagation-guide.md` must be rewritten to state exactly these four, and
to delete the "If You Want To Fix The Duplication" section's speculation about
`lib.sh` (it becomes the description of what *was* done).

## Rollback

Single commit. Revert it: the three arrays reappear verbatim in their original
locations, and deleting `scripts/lib.sh` restores the prior state exactly. There
is no state file, no rendered artefact, and no migration.

## Risks

| Risk | Mitigation |
|------|------------|
| A future script is written without sourcing `lib.sh`, so it has no `PI_DIRS` and trips `set -u` | The failure is loud (`unbound variable`), and `shell-guidelines.md` gains a rule that any script touching resource paths must source `lib.sh` |
| Someone adds unrelated helpers to `lib.sh`, coupling the bootstrap entry point to more of `scripts/` | Comment in the file, plus the extraction constraint recorded in the PRD's Out Of Scope and in `shell-guidelines.md` |
| `doctor.sh`'s fatal exit on a missing lib hides other problems | Accepted: with no lists, every symlink check is a false problem. The message names the file to restore |
| `readonly` breaks a legitimate future need to extend the list per-script | That is the intended behaviour; a per-script list would reintroduce the divergence bug |

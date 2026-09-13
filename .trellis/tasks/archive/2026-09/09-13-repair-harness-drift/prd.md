# Repair harness drift found during spec bootstrap

## Goal

Fix the three defects that the `.trellis/spec/` bootstrap documented as *current
reality* instead of correcting. This parent task owns the source requirements, the
child-task map, and the cross-child verification chain; it has no direct
implementation work.

## Source Requirements

All three were discovered by reading the repo, not reported by a user. Each has a
reproducible location.

**R1 — The store tells users to run a script that does not exist.**

```
scripts/render-settings.mjs:113   run scripts/install.sh or scripts/sync.sh
.gitignore:10                     # settings.json is rendered by scripts/install.sh from settings.core.json
```

`ls scripts/install.sh` fails. The single entry point is `./setup.sh` (commit
`73326fc` folded `install.sh` into `setup.sh`). `render-settings.mjs`'s copy is the
message printed by `doctor.sh`'s render-drift check — the moment a user most needs
a correct instruction.

**R2 — The machine-local path lists have fallen behind Pi.**

`scripts/sync.sh:58` reports "Managed elsewhere (not synced)" for a hard-coded
list (`auth.json models-store.json models.json trust.json sessions npm git bin
agent-memory`). `~/.pi/agent` now also contains `missions/`, `profiles/`,
`run-history.jsonl`, and `web-search-cache/`; none of them appears in that list,
in `README.md`'s "not stored here" table, or in `.gitignore`.

Current impact is cosmetic (`sync.sh` enumerates `PI_DIRS`/`PI_FILES` rather than
globbing, so nothing is wrongly copied), but the report silently omits paths the
user is told are intentionally not synced, and none of them is ignored if
`PI_CODING_AGENT_DIR` points inside the repo.

**R3 — `PI_DIRS` / `PI_FILES` are duplicated across three scripts.**
```
setup.sh:31-32          PI_DIRS=(themes prompts tools skills agents extensions) / PI_FILES=(AGENTS.md)
scripts/sync.sh:19-20   identical
scripts/doctor.sh:13-14 identical
```

The same seven names appear again in `setup.sh:8` (its `--help` text),
`doctor.sh:82`, and `README.md:16,134`. Adding a resource directory requires seven
edits; missing the `doctor.sh` array makes that script report a correctly linked
directory as a problem.

## Task Map

| Child | Owns | Depends on |
|-------|------|-----------|
| `09-13-stale-paths-and-lists` | R1 and R2 | — |
| `09-13-single-source-symlink-lists` | R3 | `stale-paths-and-lists` must be finished first |
| `09-13-reconcile-path-lists` | R4 (discovered during R1/R2's check pass) | `single-source-symlink-lists` must be finished first |

**R4 (added during execution) — the three machine-local path lists disagreed.**
Found by the check pass on R1/R2, which added four paths to `.gitignore`,
`README.md`, and `sync.sh` and in doing so exposed that those lists had already
diverged: `cache/` was gitignored but never reported, while `trust.json` and
`agent-memory/` were reported as "intentionally not synced" yet were stageable by
git. `~/.pi/agent/trust.json` exists on this machine, so the tooling was
telling the user a file was deliberately skipped while git would have taken it.
Fixed by making `.gitignore ⊇ skip-list` a one-directional enforced invariant
checked by `doctor.sh`, not by making the lists equal.

The ordering is not a Trellis dependency (the tasks are siblings, not a chain).
It is a file-ownership constraint: all three children edit `scripts/sync.sh`,
`scripts/doctor.sh`, `.gitignore`, or `README.md` — R1/R2 in the argument lists
and report text, R3 in the array definitions, R4 in `.gitignore` and `doctor.sh`.
One writer per file at a time.

## Cross-Child Acceptance Criteria

- [x] The full verification chain passes after each child, and again after all
      three: `bash -n setup.sh scripts/*.sh`, `node --check scripts/*.mjs`,
      `./setup.sh` twice with identical output, `./scripts/sync.sh` reporting
      `same pi-agent/settings.core.json` and `Already up to date.`,
      `./scripts/doctor.sh` ending in `All good.`
- [x] No behavioural change to setup, sync, or doctor semantics. This was a
      correctness-and-clarity repair, not a feature change. The one observable
      output change is `sync.sh`'s skip report gaining trailing slashes on
      directory entries, which makes it match the pattern shapes the new check
      validates.
- [x] `.trellis/spec/` no longer describes any of R1–R4 as unfixed drift. Each
      child updated the spec text that recorded its own defect, and R4's check
      pass corrected two false claims it found in R3's spec edits
      (`check-ignore` does consult the index; a verification command that matched
      nothing).
- [x] `git status --short` is clean after each child's commit.
- [x] No new file is added to the tracked set that `doctor.sh`'s secret scan or
      ignore-coverage check would flag.

## Out Of Scope

- Installing `shellcheck` or adding any new tool to the verification chain.
- Any Pi runtime directory not observed on this machine.
- New features, new settings, new packages, or new optional bundles.
- Restructuring the scripts beyond the R3 extraction. In particular, do not
  introduce a shared library for anything other than `PI_DIRS` / `PI_FILES`
  while doing R3.

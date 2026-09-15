# Wire Trellis setup into setup.sh

## Goal

`git clone && ./setup.sh` currently produces a working **Pi** harness but a broken
**Trellis** one. `.pi/` and `.agents/` are gitignored, and nothing in this repo
regenerates them, so a fresh clone has no Trellis extension, no `/trellis-*`
prompt commands, and no role agents for `pi-subagents` to discover.

This task adds one step to `setup.sh` that restores those surfaces, so the
documented install path is complete on its own.

## Background — measured on 2026-09-15, commit `73cb810`

Three throwaway clones of this repo:

| Command | Restores `.pi/` + `.agents/skills/`? |
| --------- | --------------------------------------- |
| `trellis update` | **No.** Reports each file under "Deleted by you (preserved)" and ends `✓ Already up to date!` |
| `trellis update --force` | **No.** Same classification; `--force` does not override it |
| `trellis init --pi -y -s` | **Yes.** `.pi/settings.json` byte-identical to the live file; 3 role agents, 3 prompt commands, 9 skill directories |

So `trellis update` — the command the README's update story implies — cannot
repair a clone. `trellis init` can, but it also produces four artefacts that
`.trellis/spec/index.md` already tells us not to keep ("An earlier `trellis init`
generated those template directories; they were deleted during bootstrap because
no such layers exist here. Do not recreate them.").

| # | Side effect | Measured detail |
| --- | ------------- | ----------------- |
| 1 | Creates `.trellis/spec/backend/` + `frontend/` | 13 placeholder spec files, recreated on every run because they are absent |
| 2 | Creates `.trellis/tasks/00-join-<name>/` | An `in_progress` join/onboarding task, when `.trellis/.developer` is absent |
| 3 | Duplicates the developer workspace | Derives the name from `git config user.name` (`Yuanhai Tan`) instead of the system username, creating `.trellis/workspace/Yuanhai Tan/` beside the tracked `yuanhai.tan/` |
| 4 | Rewrites tracked `.trellis/.template-hashes.json` | Drops the `AGENTS.md` hash entry (87 → 86 entries); adds nothing for the new spec directories |

Measured separately, and load-bearing for the design:

- **Seeding `.trellis/.developer` suppresses side effects 2 and 3 entirely.** With
  the file present, `init` takes no "new developer" branch: no join task, no new
  workspace directory, and the tracked `yuanhai.tan/` is left alone.
- **`-u NAME` does not overwrite an existing `.trellis/.developer`.** Verified:
  with `.developer` reading `name=yuanhai.tan`, `trellis init -u tan` echoed
  `Developer: tan` and left the file byte-identical.
- **`.trellis/.developer` carries a non-identity line.** `config.yaml` documents a
  per-developer `workflow=<id>` override in that same file, which takes precedence
  over `default_workflow`. Rewriting the file wholesale would delete it.

## Requirements

### R1 — A new script owns the step

`scripts/install-trellis.sh` restores the Trellis-generated surfaces, and
`setup.sh` calls it as part of its install sequence. `--skip-trellis` skips it,
matching the existing `--skip-skills` / `--skip-plugins` / `--skip-mcp` pattern.

### R2 — `trellis` absent from `PATH` is non-fatal

A machine without the Trellis CLI must still get a working Pi harness. The script
warns and exits `0`, exactly as `install-mcp.sh` behaves when its binary is
missing. `doctor.sh` reports the corresponding gap.

### R3 — Identity is the system username

The developer name written to `.trellis/.developer` is `id -un`. Not
`git config user.name` (that is the measured cause of side effect 3), and not a
name hard-coded in this repo.

An **existing** `.trellis/.developer` is reconciled to that name by rewriting the
`name=` line **in place**; every other line is preserved, so a `workflow=` override
survives. This is a deliberate deviation from "never overwrite a user's file
without a backup": the file is gitignored, one line of derived state, and
`trellis` owns its format. Recorded here because the reviewer sees a mutation of a
file the repo does not own.

Accepted consequence: on a machine whose existing `.developer` disagrees with
`id -un` (including this one, where the tracked workspace directory was
`yuanhai.tan` and `id -un` is `tan`), Trellis session records move to
`.trellis/workspace/<id -un>/`. R8 migrates the tracked directory so that move
carries the existing history rather than orphaning it.

### R4 — The four side effects are neutralized

1. `backend/` and `frontend/` are removed if — and only if — this run of the
   script created them.
2. No join task is created (via R3's seeding).
3. No workspace directory is created (via R3's seeding).
4. `.trellis/.template-hashes.json` is restored to its committed content when the
   script changed it, so `init` becomes hash-neutral and `AGENTS.md` keeps its
   template tracking.

### R5 — The step is a no-op when the surfaces are already present

`setup.sh` is the update path, and re-running it is the repo's central design
constraint. The step must not rewrite `.trellis/` on a machine that already has a
complete `.pi/`. Completeness test: `.pi/settings.json` exists **and** all three
of `.pi/agents/trellis-{implement,check,research}.md` exist.

### R6 — Drift is reported, not silent

`doctor.sh` gains a section that reports a missing `.pi/` adapter set, a missing
Trellis CLI, and `.trellis/.template-hashes.json` differing from its committed
content. A missing surface is a `bad` (it means the harness cannot dispatch
Trellis role agents); a missing CLI is a `warn` (the machine may legitimately not
want Trellis).

### R7 — The change propagates per the repo's own guide

`scripts/install-trellis.sh` is a new user-facing script, so the sites named in
`.trellis/spec/guides/change-propagation-guide.md` are updated in the same
change: `setup.sh`'s header comment (which is its `--help`), `README.md` (setup
step list, flag list, script table, day-to-day table),
`.trellis/spec/scripts/index.md` (runtime table, `100755` list),
`.trellis/spec/config/layout-and-surfaces.md` (the `.pi/` row's "Applied by"
cell), and `.trellis/spec/index.md` (the "five bash scripts" count).

### R8 — The existing developer workspace migrates to the new name

An identity rename that leaves the old workspace directory behind splits the
history in two: `.trellis/workspace/yuanhai.tan/` keeps nine sessions of journal
while new records go to `.trellis/workspace/tan/`. So the tracked directory is
migrated as part of this change:

- `git mv .trellis/workspace/yuanhai.tan .trellis/workspace/tan`, so git records a
  rename and the journal keeps its history.
- The two self-referencing headings inside it (`# Workspace Index - yuanhai.tan`,
  `# Journal - yuanhai.tan (Part 1)`) are updated to the new name.
- `creator` and `assignee` are renamed to `tan` in every `.trellis/tasks/**/task.json`,
  including the archive. This one is **functional, not cosmetic**: `task.py:468,505`
  filters "my tasks" by `assignee == get_developer()`, so without the rename all 13
existing tasks stop being attributed to the current developer.

Dated prose is deliberately **not** rewritten: two archived `prd.md` lines record
"Completion Record (2026-09-13, yuanhai.tan)" and "gate passed, approved by
yuanhai.tan". Those are historical statements about who did something on a date,
not identity references — the line is that **identity fields are renamed, dated
human prose is not**.

This is a one-time migration performed in this task's commit. `scripts/install-trellis.sh`
does **not** implement it: a generic "rename developer directories" rule cannot know
which directory is yours, and this repo has exactly one tracked developer.

## Non-Goals

- Tracking `.pi/` or `.agents/` in git. They stay ignored; the Trellis CLI remains
  their owner.
- Teaching `trellis update` to restore "deleted by you" files. That is upstream
  behaviour; this task works around it rather than patching it.
- Any change to `trellis` itself, or to `.trellis/config.yaml`.
- Renaming the `AGENTS_SKILLS_DIR` skills tree (`~/.agents/skills/`), which holds
  the six upstream `mattpocock` skills and is a different tree from the
  project-local `.agents/skills/trellis-*`.

## Acceptance Criteria

- [ ] `git clone` of this repo into an empty directory, then `./setup.sh`, leaves
      `.pi/settings.json`, `.pi/extensions/trellis/index.ts`,
      `.pi/agents/trellis-{implement,check,research}.md`,
      `.pi/prompts/trellis-{start,continue,finish-work}.md` and
      `.agents/skills/trellis-*` all present.
- [ ] `.pi/settings.json` produced by that run is byte-identical to the one on a
      machine that already had it.
- [ ] After that run, `git status --short` shows no new untracked paths under
      `.trellis/` and no modification to `.trellis/.template-hashes.json`.
- [ ] `.trellis/spec/backend/` and `.trellis/spec/frontend/` do not exist.
- [ ] `.trellis/tasks/` contains no `00-join-*` directory.
- [ ] `.trellis/.developer` contains `name=tan` where `id -un` is `tan`, and a
      pre-existing `workflow=` line in that file survives.
- [ ] `.trellis/workspace/tan/` exists with `index.md` and `journal-1.md`,
      `.trellis/workspace/yuanhai.tan/` does not, and `git status` records the move
      as a rename (R).
- [ ] The first line of both migrated files names `tan`, and no tracked file
      outside dated archived prose still contains `yuanhai.tan`.
- [ ] Every `.trellis/tasks/**/task.json` has `creator` and `assignee` = `tan`
      (14 files, 28 fields), and `git diff` on those files touches no other line.
- [ ] Running `./setup.sh` twice on the same machine produces the same output and
      no new files; the second run reports the step as already satisfied.
- [ ] `./scripts/doctor.sh` ends `All good.` on a complete machine, exits `1` with
      a `bad` when `.pi/agents/` is emptied, and `warn`s (not `bad`) when `trellis`
      is not on `PATH`.
- [ ] `bash -n setup.sh scripts/*.sh` passes, `scripts/install-trellis.sh` is mode
      `100755`, and `git status --short` is clean after a full `./setup.sh`.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- The measured evidence above is the reason this is not a two-line change: each
  of the four side effects was reproduced in a clone before the design was written.

# Design — Wire Trellis setup into setup.sh

> Technical design for [prd.md](./prd.md). Every "measured" claim below was
> reproduced in a throwaway clone of `73cb810` on 2026-09-15; the commands are
> named where the claim is not self-evident.

---

## 1. Boundary

One new script, `scripts/install-trellis.sh`, owns exactly one responsibility:

> Restore the Trellis-generated surfaces that a fresh clone lacks, by invoking
> `trellis init` and removing the by-products of that invocation.

It does **not** own: refreshing templates (`trellis update`), the project's
Pratt spec tree content (tracked, hand-written), task lifecycle (`task.py`), or
the Pi config under `~/.pi/agent` (`setup.sh` + `lib.sh` own that).

Ownership boundaries that keep it small:

| Concern | Owner | Why not this script |
| --------- | ------- | --------------------- |
| `~/.pi/agent/settings.json` | `render-settings.mjs` | per-machine render, unrelated to `.pi/` project adapters |
| `~/.pi/agent/extensions/` symlink | `setup.sh::link()` | repo → live symlink, not CLI-generated |
| `~/.agents/skills/` (6 upstream skills) | `install-skills.mjs` | fetched from a git URL per `skills.json`; Trellis skills are **project-local** `.agents/skills/`, a different tree |
| Template refresh after `trellis upgrade` | `trellis update` | this script's job is "absent, so create", not "present, so advance" |

`scripts/lib.sh` is **not** sourced. The script touches no `PI_DIRS`,
`PI_FILES`, `PI_NOT_SYNCED`, or `MCP_CFG` path, and the shell guidelines are
explicit that `lib.sh` is a data-only contract for those path lists. Sourcing it
for no reason would imply a dependency that does not exist.

**No Node, no git dependency.** Node is not needed (no JSON is read or written).
Git is not needed either — see §5, which snapshots bytes rather than restoring
from the index.

---

## 2. Contract

```text
scripts/install-trellis.sh [--help]
```

Exit codes, matching the repo's failure policy:

| Situation | Behaviour | Code |
| ----------- | ----------- | ------ |
| `--help` | usage to stdout | `0` |
| unknown flag | usage to stderr | `2` |
| surfaces already complete | `say ok`, change nothing | `0` |
| `trellis` not on `PATH` | `note`, change nothing | `0` |
| `trellis init` fails | `say error`, restore the hash snapshot, `exit 1` | `1` |
| success, nothing to prune | `say install` + `say sync` | `0` |
| success, prune needed | the above + one `say prune` per removed path | `0` |

Deliberately **no `--force`.** `install-mcp.sh` has one because a binary can be
present-but-stale; here, a partially-deleted surface already fails the
completeness test in §4, and "refresh an existing surface" is `trellis update`'s
responsibility. A flag with no use case is surface area that every propagation
site has to carry.

---

## 3. Ordering inside `setup.sh`

Appended as a new step 7, after the MCP step and before verification:

```text
1. render ~/.pi/agent/settings.json
2. symlink resource files and dirs
3. seed auth.json
4. skills from upstream
5. Pi plugin packages
6. MCP server
7. Trellis adapters          <- new
8. verify (scripts/doctor.sh)
```

The order is free — steps 1–6 touch `~/.pi/agent` and `~/.config/mcp`, while this
step touches the repo-local `.pi/` and `.agents/`. It is appended rather than
inserted so the existing step numbers, and the two README lists that mirror them,
change by one addition instead of a renumbering.

Verification must stay last: `doctor.sh` checks the surfaces this step creates.

---

## 4. When the step acts

A completeness test gates all work, because `setup.sh` is the update path and
must be cheap to re-run on a working machine (PRD R5).

```bash
trellis_surfaces_complete() {
  [ -f "$REPO_DIR/.pi/settings.json" ] || return 1
  [ -f "$REPO_DIR/.pi/extensions/trellis/index.ts" ] || return 1
  for role in trellis-implement trellis-check trellis-research; do
    [ -f "$REPO_DIR/.pi/agents/$role.md" ] || return 1
  done
  # discovery, not enumeration: template file names are upstream's to change
  compgen -G "$REPO_DIR/.pi/prompts/*.md" >/dev/null || return 1
  compgen -G "$REPO_DIR/.agents/skills/trellis-*/SKILL.md" >/dev/null || return 1
  # the identity is this script's to maintain too
  [ "$(developer_name)" = "$(id -un)" ] || return 1
  return 0
}
```

The gate is the **whole** of what the script owns, identity included, so that
"skipped" and "nothing was left to do" mean the same thing. Two consequences:

- It runs **before** the `trellis` CLI preflight. A machine whose surfaces and
  identity are already correct gets `say ok` and no warning about a CLI it does
  not need to have installed.
- On this machine the gate is false on the first run even though `.pi/` is
  complete, because `id -un` is `tan` and `.trellis/.developer` says
  `yuanhai.tan`. That is intended: the identity is a surface this script owns, and
  the run that reconciles it is also what makes every later run a no-op.

Two different shapes, on purpose:

- **The three role agents are enumerated**, because their names are a real
  contract: `pi-subagents` discovers them from `.pi/agents/` by role name, and
  `pi-agent/extensions/trellis-subagents-bridge/index.ts` dispatches to them.
  `doctor.sh` already enumerates the same three.
- **Prompts and skills are discovered** (`compgen -G`), because their file names
  are upstream template names this repo has no contract with. The shell
  guidelines' "do not enumerate where you can discover" applies here.

`compgen -G` is used rather than `ls | grep` because it is a bash builtin that
takes a glob, needs no subshell, and cannot be confused by a filename containing
a newline.

---

## 5. The four side effects, and how each is neutralized

Each row was reproduced in a clone. "Prevent" means the artefact is never
created; "prune" means it is created by our own `init` call and removed before
the script returns.

| # | Artefact | Mechanism | Why this mechanism |
| --- | ---------- | ----------- | -------------------- |
| 1 | `.trellis/spec/backend/`, `spec/frontend/` | **prune** | `init` recreates the default template layers whenever they are absent. There is no flag that suppresses the workflow-structure step, and `.trellis/spec/index.md` already documents that they must not exist. |
| 2 | `.trellis/tasks/00-join-<name>/` | **prevent** (primary) + prune (backstop) | Measured: writing `.trellis/.developer` before `init` suppresses the "new developer" branch entirely, so no join task is created. |
| 3 | a duplicate `.trellis/workspace/<git-name>/` | **prevent** (primary) + prune (backstop) | Same mechanism. Measured: seeding `.developer` with a name that has no workspace directory creates no directory. |
| 4 | `.trellis/.template-hashes.json` rewritten | **restore snapshot** | Measured: `init` drops the `AGENTS.md` entry (87 → 86) and adds nothing for the new spec layers. Restoring keeps `AGENTS.md` template-tracked; without it, `trellis update` silently stops managing `AGENTS.md`. |

### 5a. The prune rule

One rule covers all three tree roots, and it is the reason the eliminate-step is
safe:

> Remove an entry under `.trellis/{spec,tasks,workspace}/` **only if it did not
> exist before this script's own `trellis init` invocation.**

```bash
# before init — top-level directories only, sorted for a stable comparison
before="$(find "$REPO_DIR/.trellis/spec" "$REPO_DIR/.trellis/tasks" \
  "$REPO_DIR/.trellis/workspace" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)"

# ... run trellis init ...

after="$(find ...same... | sort)"
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  printf '%s\n' "$before" | grep -qxF "$dir" && continue
  rm -rf "${dir:?}"
  say prune "${dir#"$REPO_DIR"/} (created by trellis init; not a layer of this repo)"
done <<<"$after"
```

Properties this buys:

- **It cannot delete tracked content.** Every tracked directory predates the
  invocation, so it is in `before`. The rule is stronger than a name blocklist
  (`backend`, `frontend`, `00-join-*`), which would need updating whenever the
  upstream template set changes.
- **`-maxdepth 1 -type d`** means a file created inside an existing directory
  (an edited `spec/index.md`, a new journal) is never a prune candidate. Only
  whole new top-level directories are.
- **`${dir:?}`** is the same guard `sync.sh` uses before `rm -rf`, so a find that
  returns an empty string cannot become `rm -rf ""`.
- `sort` on both sides makes the `grep -qxF` comparison exact, not order-dependent.
- The `before`/`after` values live in shell variables, not temp files — they are
  small and consumed once.

### 5b. Identity, and the minimal write

PRD R3: the developer name is `id -un`.

`.trellis/.developer` is **not** rewritten wholesale, because `config.yaml`
documents a per-developer `workflow=<id>` line in that same file which takes
precedence over `default_workflow`. Deleting it would silently change a
developer's workflow template. So only the `name=` line is touched, in place:

```bash
identity="$(id -un)"
developer="$REPO_DIR/.trellis/.developer"

if [ ! -f "$developer" ]; then
  printf 'name=%s\ninitialized_at=%s\n' "$identity" "$(date -Iseconds)" >"$developer"
  say create ".trellis/.developer  (name=$identity)"
elif ! grep -qxF "name=$identity" "$developer"; then
  previous="$(sed -n 's/^name=//p' "$developer" | head -n 1)"
  # rewrite only the name= line; every other line survives verbatim
  ...
  say sync ".trellis/.developer  ($previous -> $identity)"
fi
```

`-u "$identity"` is also passed to `trellis init`. It is **redundant** — measured:
with `.trellis/.developer` present, `trellis init -u tan` leaves the file
byte-identical — but `init` prints the developer name from the `-u` value rather
than from the file, so passing it makes the CLI's own output honest instead of
showing the `git config user.name` value that caused side effect 3.

The `initialized_at` line is written only on create, and preserved on update.

**Accepted consequence.** On a machine whose `.developer` disagrees with `id -un`
(including this one, where it said `yuanhai.tan` and `id -un` is `tan`), Trellis
session records move to `.trellis/workspace/<id -un>/`. Leaving the tracked
directory behind would split one developer's history across two directories, so
§5e migrates it in this same change. The printed `sync` verb shows the old → new
value, which is the rollback instruction.

**Deviation from the backup rule.** `setup.sh::link()` backs up a real file before
replacing it. This does not, because the file is gitignored, is one line of
derived state, and `trellis` owns its format — a `.bak-<stamp>` next to a
gitignored identity file is noise. The old value is printed instead. Flagged here
because it is a visible departure from a documented convention rather than an
oversight.

### 5c. The hash manifest is restored from a byte snapshot

```bash
snapshot="/tmp/pi-trellis-hashes.$$"
cp "$REPO_DIR/.trellis/.template-hashes.json" "$snapshot"
# ... trellis init ...
if ! cmp -s "$snapshot" "$REPO_DIR/.trellis/.template-hashes.json"; then
  cp "$snapshot" "$REPO_DIR/.trellis/.template-hashes.json"
  say sync ".trellis/.template-hashes.json  (reverted; init's rewrite drops AGENTS.md)"
fi
rm -f "$snapshot"
```

Snapshot-and-restore rather than `git checkout -- <path>`:

- It needs no git, so the script keeps working in a fresh clone with no commits,
  and cannot touch a staged or user-edited version of the file.
- It is the precise operation wanted: "put back what was there a second ago".
  `git checkout` restores from the index, which is a different question and would
  discard an intentional edit.
- `cmp -s` means the common case (an `init` that changed nothing) prints nothing
  and is a genuine no-op.

`rm -f` runs unconditionally after the branch, and the path uses the repo's
`/tmp/pi-<purpose>.$$` convention. The snapshot is also restored on the
`trellis init` failure path, so a failed run leaves the tree as it found it.

### 5d. Version mismatch is reported, not acted on

`trellis init` writes surfaces generated by the **installed CLI**, not by the
version recorded in `.trellis/.version` (tracked). A machine whose CLI is newer
than the project would have its adapters generated from the newer templates.

The script compares the two and emits a single `note` when they differ. It does
not refuse to run and does not call `trellis update`: advancing the project
version rewrites tracked template files and needs a reviewable diff, which is a
different task and a user decision.

### 5e. The one-time workspace migration

Not done by the script — done once, in this task's commit (PRD R8).

```bash
git mv .trellis/workspace/yuanhai.tan .trellis/workspace/tan
sed -i '1s/yuanhai\.tan/tan/' .trellis/workspace/tan/index.md .trellis/workspace/tan/journal-1.md
```

Why not in the script: a generic rule would have to decide which directory under
`.trellis/workspace/` is the current developer's. This repo has exactly one tracked
developer, so "rename it" is unambiguous **here** and ambiguous in general — the
multi-developer case is precisely the case where guessing is wrong. `git mv` also
gives the migration real history, which a script-time `mv` would not.

`creator` and `assignee` in every `.trellis/tasks/**/task.json` are renamed in the
same commit. This is functional: `task.py:468,505` filters "my tasks" by
`assignee == get_developer()`, so without it all 13 existing tasks silently stop
being attributed to the current developer. Verified prefix-safe: `git diff -U0` on
those files shows **only** the `creator`/`assignee` lines (26 changed lines across
13 tracked files).

Dated prose is not rewritten. Two archived `prd.md` lines read "Completion Record
(2026-09-13, yuanhai.tan)" and "gate passed, approved by yuanhai.tan"; those are
statements about who did something on a date, not identity references.

**Tooling note, disclosed because it inflates the diff.** pi-lens rewrites `*.md`
on write, and its markdownlint autofix collapsed double blank lines (MD012) and
re-spaced table separators (MD060) in the two migrated files: `journal-1.md` goes
301 → 291 lines. **No prose was lost** — the ten lines are blank lines, all nine
sessions and every `@@@auto` and `trellis-session` marker are intact. This is the
behaviour `shell-guidelines.md` documents for any Markdown write here, and it will
recur whenever those files are written.

---

## 6. `doctor.sh` changes

One new section, plus two severity upgrades in existing sections.

### 6a. New section `==> Trellis adapters`, placed after `==> Symlinked resources`

Checks, in order:

| Check | Severity | Reason |
| ------- | ---------- | -------- |
| `trellis` on `PATH` | `warn` if absent | A machine may legitimately not want the Trellis CLI; nothing else can be repaired without it |
| the five surface groups from §4 | `bad` | The harness cannot dispatch Trellis role agents, and `setup.sh` is supposed to have fixed this |
| `.trellis/.template-hashes.json` vs committed content | `bad` | It is a tracked file; drift means an uncommitted rewrite. Checked with `git -C "$REPO_DIR" diff --quiet -- .trellis/.template-hashes.json`, guarded on `[ -d "$REPO_DIR/.git" ]` like the ignore-coverage and secret-scan sections |

### 6b. Two severities change from `warn` to `bad`, under one condition

`doctor.sh` currently reports a missing `.pi/agents/` and a missing
`.pi/extensions/trellis/index.ts` as `warn`, with the message "Trellis adapters
not generated in this checkout". That severity was correct when nothing in this
repo could generate them. It is not correct now.

The new rule is conditional, so it stays honest on a machine without the CLI:

> **Bad when the fix is available and was not applied; warn when the fix is not
> available.**

So `trellis` on `PATH` + missing surface → `bad` ("run `./setup.sh`"). No
`trellis` → `warn` ("Trellis CLI not on PATH; adapters cannot be generated").
This is one branch, computed once, used by both existing sites and the new
section.

The second upgrade matters beyond tidiness: the `SHIPPED_TOOLS` comparison that
deactivates the shipped `trellis_subagent` tool reads
`.pi/extensions/trellis/index.ts`. With that file absent the comparison currently
reports `warn` — a check that has stopped being able to see, which the shell
guidelines call out as worse than no check. Upgrading it to `bad` is a fix for
that anti-pattern, not just a severity tweak.

### 6c. What `doctor.sh` does not do

No repair. It reports and names the command to run (`./setup.sh`), consistent
with `optional.sh` owning bundle state and `doctor.sh` owning nothing but
verdicts.

---

## 7. Data flow

```text
setup.sh
  └─ exec scripts/install-trellis.sh
       │
       ├─ gate       surfaces_complete (adapters AND identity) ── true ─▶ say ok + exit 0
       ├─ preflight  command -v trellis                        ── absent ─▶ note + exit 0
       ├─ identity   id -un
       ├─ snapshot   /tmp/pi-trellis-hashes.$$   (bytes)
       │             .trellis/.developer         (bytes)
       │             .trellis/{spec,tasks,workspace} top-level dirs (variables)
       ├─ reconcile  .trellis/.developer         (name= line only)
       ├─ invoke     trellis init --pi -y -s -u "$identity"
       │                └─ writes .pi/, .agents/skills/trellis-*
       ├─ prune      dirs present after but not before   ─▶ say prune
       ├─ restore    hash manifest if changed            ─▶ say sync
       └─ report     say ok / create / install / sync / prune
```

One-time, in this task's commit rather than at run time: the §5e workspace
migration.

Files written by a successful run, and nothing else:

| Path | Surface after the run |
| ------ | ---------------------- |
| `.pi/settings.json`, `.pi/extensions/trellis/index.ts` | untracked, gitignored (`.gitignore:60` `.pi/`) |
| `.pi/agents/*.md`, `.pi/prompts/*.md` | untracked, gitignored |
| `.agents/skills/trellis-*/` | untracked, gitignored (`.gitignore:61` `.agents/`) |
| `.trellis/.developer` | untracked, gitignored by `.trellis/.gitignore` |
| `.trellis/.template-hashes.json` | **tracked, restored to its pre-run content** |
| `git status --short` | clean |

---

## 8. Rejected alternatives

| Option | Rejected because |
| -------- | ------------------ |
| `trellis update` as the repair command | Measured: classifies every missing surface as "Deleted by you (preserved)" and prints `✓ Already up to date!`. `--force` does not override it. |
| Run `trellis init` in a scratch directory and copy `.pi/` + `.agents/` in | Would remove all four side effects at once, but generates from a default `.trellis/config.yaml` rather than this project's, so the adapters stop reflecting the project's platform set and workflow. It trades a measurable, prunable side effect for an unmeasurable divergence. |
| Track `.pi/` and `.agents/` in git | Contradicts the documented surface (`.trellis/spec/config/layout-and-surfaces.md`: "**Ignored** (Trellis-generated adapters) — `trellis` CLI") and the reason they are ignored: they are template-hash tracked, so a committed copy turns every `trellis update` into a conflict. |
| Hand-write `pi-agent/trellis/` templates in this repo and copy them | Duplicates a generated artefact and immediately begins drifting from whatever the installed CLI emits. |
| Blocklist prune (`backend`, `frontend`, `00-join-*`) | Needs editing whenever upstream changes its default template layers, and it would happily delete a tracked directory whose name happened to match. The before/after rule cannot. |
| `git checkout -- .trellis/.template-hashes.json` to restore | Adds a git dependency, restores from the index rather than from the pre-run bytes, and would discard an intentional staged edit. |
| Leave the tracked `yuanhai.tan/` workspace directory orphaned instead of migrating it | Splits one developer's history across two directories: nine sessions of journal in one, every later session in the other. `git mv` costs one command and keeps the history attached, so there is no argument for orphaning it. |
| Put the workspace migration inside `scripts/install-trellis.sh` | A generic "rename the developer directory" rule cannot know which directory is yours; the multi-developer case is exactly where guessing is wrong. This repo is single-developer, so the rename is unambiguous as a **one-time commit**, which is also the only form that preserves git history. |
| A `--force` flag | No use case: a partial surface fails the completeness test, and refreshing an existing surface is `trellis update`'s job. |
| Put the logic inline in `setup.sh` | `setup.sh` would grow past 250 lines, the repair could not be run on its own after a partial failure, and it diverges from how `install-mcp.sh` is factored. |
| `doctor.sh` repairs instead of reporting | Breaks the reporter contract and the "warn and let the user re-run" failure policy. |

---

## 9. Compatibility, rollout, rollback

**Backward compatible.** Three cases, none of which regress:

1. Machine with `.pi/` present → `say ok`, no writes, unchanged output.
2. Machine without the `trellis` CLI → `note`, no writes. `doctor.sh` `warn`s,
   which is what it did before for these surfaces.
3. Machine with `trellis` and no `.pi/` → the fix. `doctor.sh` goes from `warn`
   to green.

**The one behaviour change on an existing machine** (this one) is the
`.trellis/.developer` name reconciliation, covered in §5b, together with the one-time
workspace migration in §5e. The reconciliation is printed as
`sync  .trellis/.developer  (yuanhai.tan -> tan)`.

**Rollout.** Single commit, no migration, no network. The only artefact created
outside the git tree is `.agents/skills/trellis-*/`, which is untracked and
regenerable.

**Rollback.** `git revert` the commit. On-disk state needs no unwinding:
`.pi/` and `.agents/skills/trellis-*` remain but become unmanaged again (the
pre-change state), and `.trellis/.template-hashes.json` was restored to its
committed bytes so it has nothing to revert. To restore the previous identity,
write the old `name=` value back into the gitignored `.trellis/.developer`; the
workspace rename reverts with the same `git revert`.

---

## 10. Residual risks

| Risk | Mitigation |
| ------ | ----------- |
| `trellis init` writes surfaces from a CLI newer than `.trellis/.version` | A `note` reports the mismatch (§5d). The adapters are gitignored and regenerable, so a mismatch is recoverable with `trellis update` after review. |
| `id -un` is not the identity a developer wants | It is the stated requirement (PRD R3). The printed old → new value is the rollback. A future task can add a `TRELLIS_DEVELOPER`-style override if this bites. |
| An upstream `trellis init` starts writing some **other** new directory under `.trellis/` | It is pruned by the before/after rule and named in the output, so it is visible rather than silent. If the artefact is legitimate, the fix is to stop the prune rule covering that root. |
| The tracked workspace directory is migrated by a one-time commit, not by the script | The next developer to clone this repo gets `workspace/tan/` already; a new machine with a different `id -un` gets its own directory created by Trellis, which is the correct multi-developer behaviour and needs no migration. |
| `creator`/`assignee` were renamed across 13 archived `task.json` files, editing the archive | The alternative is that `task.py` reports zero "my tasks" for every historical task. The change is 26 lines, mechanical, verified prefix-safe by `git diff -U0`, and reverts with the same `git revert`. |
| `doctor.sh`'s conditional severity is confusing | The message states which branch fired, and §6b's rule is quoted in `doctor.sh` and in the spec. |

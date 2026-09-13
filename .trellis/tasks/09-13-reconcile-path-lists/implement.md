# Execution Plan — reconcile the path lists

Ordered checklist. The negative tests are the point: this task adds a *checker*, and
a checker that cannot be made to fail is not evidence of anything.

## 0. Preconditions

- [ ] `09-13-single-source-symlink-lists` is committed (`819bfa1`) — this task
      edits `scripts/doctor.sh`, `scripts/lib.sh`, `scripts/sync.sh`, and
      `.gitignore`, all of which that task changed.
- [ ] `git status --short` is clean.
- [ ] Record the divergence before touching anything:
      `./scripts/doctor.sh` (should be `All good.`) and
      `for p in trust.json agent-memory/ cache/; do printf '%-16s ' "$p"; git check-ignore -q "pi-agent/$p" && echo IGNORED || echo "NOT IGNORED"; done`
      → `trust.json` and `agent-memory/` must print `NOT IGNORED` (the bug), `cache/` must print `IGNORED`.

## 1. `scripts/lib.sh` — add the third array

- [ ] Add `readonly PI_NOT_SYNCED=(…)` exactly as specified in `design.md`
      §"Reconciliation Edits", in **canonical slash-form**: `sessions/`, `npm/`,
      `git/`, `bin/`, `cache/`, `agent-memory/`, `missions/`, `profiles/`,
      `web-search-cache/` get a trailing slash; `auth.json`, `models-store.json`,
      `models.json`, `trust.json`, `run-history.jsonl` do not.
- [ ] Amend the header comment: "Holds ONLY the paths that setup.sh symlinks,
      sync.sh pulls back, and doctor.sh verifies" → the harness path lists, data
      only. Keep the "do not add helpers" sentence.
- [ ] Keep the comment above each array, stating its role and, for
      `PI_NOT_SYNCED`, that **the array order is the report order** and that
      directory entries need the trailing slash.

## 2. `scripts/sync.sh` — consume it

- [ ] Replace the literal list in the `for f in …; do` loop with
      `for f in "${PI_NOT_SYNCED[@]}"; do`.
- [ ] Confirm the loop body is otherwise unchanged: report-only, no glob, no copy,
      no delete.
- [ ] Confirm `lib.sh` is already sourced before the loop (it is — from the
      previous task).

## 3. `.gitignore` — close the committable gap

- [ ] Add `pi-agent/trust.json` and `pi-agent/agent-memory/` to the
      "Generated / machine-local Pi state" group, in the existing style and with a
      short comment (trust decisions and accumulated memory: per-machine).
- [ ] Do **not** add `*.log`-style patterns or anything not observed in
      `~/.pi/agent`. Do not re-add the four paths from the previous task.

## 4. `README.md` — the third list

- [ ] Add a `cache/` row to "What is intentionally *not* stored here" (Pi's scratch
      cache). `trust.json` / `agent-memory/` already have a row.
- [ ] Make the table's directory/file shape consistent with the slash-form used in
      the other two lists.

## 5. `scripts/doctor.sh` — the check

- [ ] Add the `==> Ignore coverage (machine-local paths)` section from `design.md`
      immediately after `==> Secret scan (tracked files)`.
- [ ] Use `bad`, not `warn`. Report **every** offending path with its slash-form
      hint, not just the first.
- [ ] Use `${#not_ignored[@]}` / `${#PI_NOT_SYNCED[@]}` (length form) so the empty
      array is safe under `set -u`.
- [ ] Do not introduce `set -e`, a `trap`, or an early `exit`.
- [ ] Guard on `[ -d "$REPO_DIR/.git" ]` exactly like the secret-scan section, and
      run no `git` command when it is not a repo (the `==> Repo` section already
      reported that). The section header still prints unconditionally, matching
      the secret-scan section; only the result is suppressed.

## 6. Spec updates (same commit)

- [ ] `config/layout-and-surfaces.md` §"Common Mistake: assuming the two lists have
      parity" → rewrite as the resolved state: the invariant, who enforces it, and
      the slash-sensitivity finding kept (it is the non-obvious part). Update the
      divergence table to the post-fix state.
- [ ] `guides/change-propagation-guide.md` — the blockquote warning under "Known
      Multi-Site Facts" → points at the now-enforced invariant; the "Not stored
      here" row names the third array in `lib.sh`.
- [ ] `scripts/index.md` — `lib.sh` guidance: three arrays, all in `lib.sh`.
- [ ] `scripts/shell-guidelines.md` — `lib.sh`'s data-only contract (now three
      arrays) and the new `doctor.sh` check, including the `${#arr[@]}`-under-`set -u`
      note.

## 7. Verification — positive gates

```bash
bash -n setup.sh scripts/*.sh
grep -rn "PI_NOT_SYNCED=" setup.sh scripts/        # exactly one, in lib.sh

# every reported-skipped path is now ignored (doctor.sh enforces this too)
# NB: do not parse the array with a single-line sed — it is multi-line, so
# that matches nothing and the loop passes vacuously. Source it instead:
( . scripts/lib.sh
  for p in "${PI_NOT_SYNCED[@]}"; do
    git check-ignore -q "pi-agent/$p" || echo "NOT IGNORED: $p"
  done )                                            # expect no output

./setup.sh && ./setup.sh                            # identical output
./scripts/sync.sh                                   # same + Already up to date.
./scripts/doctor.sh                                 # All good.
```

- [ ] `./scripts/doctor.sh` prints
      `✓ all N reported-skipped paths are gitignored` with N equal to the array
      length, and exits 0.
- [ ] The skip report lists `cache/`, and every directory entry now prints with its
      trailing slash.

## 8. Verification — negative tests (mandatory)

```bash
# (a) a reported-skipped path that is not ignored -> the real bug this task fixes
cp .gitignore /tmp/gi.bak
sed -i '/pi-agent\/trust.json/d' .gitignore
./scripts/doctor.sh ; echo "exit=$?"      # expect: ✗ with the list, "pi-agent/trust.json", exit 1
cp /tmp/gi.bak .gitignore

# (b) a directory entry that lost its slash -> proves exact-string enforcement
cp scripts/lib.sh /tmp/lib.bak
sed -i 's#sessions/#sessions#' scripts/lib.sh
./scripts/doctor.sh ; echo "exit=$?"      # expect: ✗ names "sessions" and prints the slash hint, exit 1
cp /tmp/lib.bak scripts/lib.sh

# (c) a NEW path added to the array but not to .gitignore -> proves the check
#     covers future additions, not just the three known ones
cp scripts/lib.sh /tmp/lib2.bak
sed -i 's#run-history.jsonl#run-history.jsonl some-new-path/#' scripts/lib.sh
./scripts/doctor.sh ; echo "exit=$?"      # expect: ✗ names "some-new-path/", exit 1
cp /tmp/lib2.bak scripts/lib.sh

# (d) no false positives from .gitignore-only patterns
./scripts/doctor.sh ; echo "exit=$?"      # expect: ✓ and All good.
```

- [ ] (a) fails naming `trust.json`, then passes after restore.
- [ ] (b) fails naming `sessions` *without* its slash — this is the test that would
      have caught the design's slash trap.
- [ ] (c) fails naming the newly added path.
- [ ] (d) passes: `*.log`, `.pi/`, `.idea/`, and the other `.gitignore`-only
      patterns are never iterated, because the check reads the array, not
      `.gitignore`.
- [ ] Restore all three backup files byte-identically (`diff` against
      `git show HEAD:` or `/tmp` copies).

## 9. Verification — not a git repository

- [ ] Confirm by inspection that the new section is inside the `[ -d "$REPO_DIR/.git" ]`
      guard, and that no array expansion inside it can trip `set -u` when the guard
      is false.
- [ ] Preferred: exercise it. Copy the tree to a temp dir without `.git`, run
      `PI_CODING_AGENT_DIR=$HOME/.pi/agent ./scripts/doctor.sh` there, and confirm
      it reports the missing repo and exits 1 **without** an unbound-variable error
      and with no ignore-coverage result (the section header still prints, matching
      the secret-scan section).

## 10. Commit

Single commit. Style: sentence-case imperative, no conventional-commit prefix, body
explaining the failure mode and the invariant.

- [ ] Files: `.gitignore`, `README.md`, `scripts/lib.sh`, `scripts/sync.sh`,
      `scripts/doctor.sh`, the four `.trellis/spec/` files, this task's
      `task.json` (Trellis bookkeeping), and the task's own `design.md` /
      `implement.md` (currently untracked — the archived sibling tasks track them)
      so the tree is clean afterwards.
- [ ] Include the negative-test output in the body — the check's value is that it
      can fail.

## Rollback Points

| After step | Rollback |
|-----------|----------|
| 1–4 | `git checkout -- scripts/ .gitignore README.md` |
| 5 | remove the new `doctor.sh` section, or `git checkout -- scripts/doctor.sh` |
| 6 | `git checkout -- .trellis/spec/` |
| 10 | `git revert <commit>` — additive everywhere except the sync loop and the `.gitignore`/README rows |

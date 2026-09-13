# Execution Plan — single-source the symlink resource lists

Ordered checklist. Do not skip the negative tests; they are the only evidence that
the failure mode this change introduces is handled.

## 0. Preconditions

- [ ] `09-13-stale-paths-and-lists` is committed. `git log --oneline -1` shows its
      commit and `git status --short` is clean. Both tasks edit `scripts/sync.sh`
      and `scripts/doctor.sh`.
- [ ] Capture the before-state so equality can be proven:
      `git show HEAD:setup.sh | sed -n '31,32p'`
      `git show HEAD:scripts/sync.sh | sed -n '19,20p'`
      `git show HEAD:scripts/doctor.sh | sed -n '13,14p'`

## 1. Create `scripts/lib.sh`

- [ ] Header comment naming its purpose and its "data only" constraint.
- [ ] Double-source guard using `if … then return 0; fi` and
      `${PI_SETUP_LIB_LOADED:-}`.
- [ ] `readonly PI_DIRS=(themes prompts tools skills agents extensions)`
- [ ] `readonly PI_FILES=(AGENTS.md)`
- [ ] `chmod +x` is **not** needed (it is sourced). Confirm the file mode matches
      the other sourced-only files rather than becoming executable.

## 2. Wire the two `set -e` consumers

- [ ] `setup.sh` — replace lines 31-32 with the existence check + `. "$LIB"` block
      from `design.md` §"Consumer Shape".
- [ ] `scripts/sync.sh` — same replacement at lines 19-20.
- [ ] `bash -n` both.

## 3. Wire `doctor.sh`

- [ ] `scripts/doctor.sh` — replace lines 13-14 with the existence-check block
      that calls `bad` and `exit 1`. Place it **after** the `ok`/`warn`/`bad`
      helper definitions and before the first use of `PI_DIRS`, and after the
      `==> Repo` section so its output still appears above the failure.
- [ ] `bash -n` it.

## 4. Update the surviving hard-coded sites

- [ ] `setup.sh:8` header comment — unchanged content, still correct.
- [ ] `scripts/doctor.sh:82` message — unchanged content, still correct.
- [ ] Verify nothing else in the three scripts references the arrays by position.

## 5. Update the specs (Phase 3.3 material, done in the same commit)

- [ ] `.trellis/spec/guides/change-propagation-guide.md`
      - the 7-place table → 4 remaining sites, with `scripts/lib.sh` named as the
        single definition;
      - "If You Want To Fix The Duplication" → rewritten as "Where The Lists Live
        Now" describing what was done, keeping the four manual sites as the
        ongoing hazard;
      - the worked example (7 edits for a new directory) → 5 edits.
- [ ] `.trellis/spec/scripts/shell-guidelines.md`
      - the "Exception: `PI_DIRS` / `PI_FILES` are still hard-coded in three
        scripts" note → a rule that resource-path scripts must source
        `scripts/lib.sh`, with the `readonly` and missing-file conventions.
- [ ] `.trellis/spec/scripts/index.md`
      - pre-dev checklist item about not adding a fourth copy → "source
        `scripts/lib.sh`; never re-declare `PI_DIRS`/`PI_FILES`".
- [ ] `.trellis/spec/index.md` and `.trellis/spec/config/layout-and-surfaces.md`
      — re-read the "the list is a whitelist" and "seven places" claims and
      correct any that this change invalidates.

## 6. Verification

```bash
bash -n setup.sh scripts/*.sh
grep -rn "PI_DIRS=" setup.sh scripts/          # exactly one file, one line

./setup.sh && ./setup.sh                       # identical output, clean tree
./scripts/sync.sh                              # same + Already up to date.
./scripts/doctor.sh                            # All good.
```

Negative tests:

```bash
# a) missing definition file — all three must fail loudly, naming the path
mv scripts/lib.sh /tmp/lib.sh.bak
./setup.sh            ; echo "setup exit=$?"      # expect 1, message names lib.sh
./scripts/sync.sh     ; echo "sync exit=$?"       # expect 1, message names lib.sh
./scripts/doctor.sh   ; echo "doctor exit=$?"     # expect 1, "✗ scripts/lib.sh missing"
mv /tmp/lib.sh.bak scripts/lib.sh

# b) drift — a consumer re-declaring the list must fail, not diverge
cp scripts/doctor.sh /tmp/doctor.sh.bak
printf 'PI_DIRS=(bogus)\n' >> scripts/doctor.sh
./scripts/doctor.sh   ; echo "exit=$?"            # expect non-zero, readonly error
cp /tmp/doctor.sh.bak scripts/doctor.sh

# c) the symlink check still bites — point a link somewhere wrong
ln -sfn /tmp ~/.pi/agent/extensions
./scripts/doctor.sh   ; echo "exit=$?"            # expect 1, "points elsewhere"
./setup.sh                                        # restores the correct link
./scripts/doctor.sh                               # All good.
```

- [ ] All three negative tests behave as specified.
- [ ] `git status --short` clean after the final `./setup.sh`.

## 7. Commit

Single commit. Message style follows the repo: sentence-case imperative, no
conventional-commit prefix, body explaining the failure mode.

- [ ] `git add -A` and commit with a message covering: the divergence bug, the
      `readonly` mechanism, the `doctor.sh` no-`set -e` special case, and the
      negative tests performed.
- [ ] Confirm the commit contains only `scripts/lib.sh`, `setup.sh`,
      `scripts/sync.sh`, `scripts/doctor.sh`, and the `.trellis/spec/` files above.

## Rollback Points

| After step | Rollback |
|-----------|----------|
| 1–3 | `git checkout -- setup.sh scripts/ ; rm scripts/lib.sh` |
| 5 | `git checkout -- .trellis/spec/` |
| 7 | `git revert <commit>` — restores the three inline arrays and drops `lib.sh`; no state or rendered artefact to unwind |

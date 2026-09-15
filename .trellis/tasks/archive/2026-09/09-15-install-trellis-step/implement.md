# Implement — Wire Trellis setup into setup.sh

> Execution plan for [prd.md](./prd.md) and [design.md](./design.md).
> Ordered checklist. Each phase ends at a review gate; do not start the next
> phase until the gate passes.

---

## Validation commands

These are the **only** commands this task uses to prove its claims. Every one was
run on the pre-change tree at `73cb810` and exists in this environment.

| # | Command | Proves |
| --- | --------- | -------- |
| V1 | `bash -n setup.sh scripts/*.sh` | shell syntax, no execution |
| V2 | `node --check scripts/*.mjs` | Node syntax |
| V3 | `node scripts/check-docs.mjs .` | `docs/` still matches the shipped plugin and skill sets (exit `0`) |
| V4 | `./scripts/doctor.sh` | the reporter still ends `All good.` (exit `0`) |
| V5 | `./setup.sh && ./setup.sh` | idempotence: same output twice, no new files |
| V6 | `./scripts/sync.sh` | render/sync symmetry: reports `same  pi-agent/settings.core.json` and `Already up to date.` |
| V7 | `git status --short` | nothing accidental became tracked; clean after V5 |
| V8 | `rm -rf`-free fresh-clone ritual (below) | the actual bug is fixed: `git clone` → `./setup.sh` → surfaces present, tree clean |
| V9 | severity probes (below) | `doctor.sh`'s `bad`/`warn` branch is real, not asserted |

`shellcheck` is **not installed** here — V1 is the syntax check, and the shell
guidelines say not to add `# shellcheck` directives without a plain-English reason
in a normal comment.

### V8 — fresh-clone ritual

`rm -rf` is denied by the permission policy, so scratch directories are created
with `mktemp -d` and removed with `rmdir`/left in `/tmp`. `mktemp -d` already
creates the directory, and `git clone` refuses a non-empty target, so the probe
directory is created and then removed with `rmdir` before cloning.

```bash
P="$(mktemp -d /tmp/pi-trellis-v8.XXXXXX)"; rmdir "$P"
git clone -q /home/tan/my_pi_setup "$P"
cd "$P"
./setup.sh                       # full run, including the new step 7
echo "--- surfaces ---"
for p in .pi/settings.json .pi/extensions/trellis/index.ts \
         .pi/agents/trellis-implement.md .pi/agents/trellis-check.md \
         .pi/agents/trellis-research.md; do
  printf '%s: %s\n' "$p" "$(test -f "$p" && echo PRESENT || echo MISSING)"
done
printf '.pi/prompts entries: %s\n' "$(compgen -G '.pi/prompts/*.md' | wc -l)"
printf '.agents/skills/trellis-* entries: %s\n' "$(compgen -G '.agents/skills/trellis-*' | wc -l)"
echo "--- side effects must be absent ---"
test -e .trellis/spec/backend  && echo "FAIL backend exists"  || echo "ok no backend"
test -e .trellis/spec/frontend && echo "FAIL frontend exists" || echo "ok no frontend"
compgen -G '.trellis/tasks/00-join-*' >/dev/null && echo "FAIL join task" || echo "ok no join task"
echo "--- identity ---"; cat .trellis/.developer
echo "--- workspace (R8: migrated, not orphaned) ---"
ls .trellis/workspace/
test -e .trellis/workspace/yuanhai.tan && echo "FAIL old dir still present" || echo "ok no yuanhai.tan"
sed -n '1p' .trellis/workspace/tan/index.md .trellis/workspace/tan/journal-1.md
echo "--- git must be clean ---"; git status --short; echo "(end)"
```

Expected: every surface `PRESENT`, both side-effect `ok` lines, `name=tan`,
`.trellis/workspace/` holding only `index.md` and `tan/` with both headings naming
`tan`, and an empty `git status`.

### V9 — severity probes

Both branches of design §6b, run in a clone so the real tree is never broken.

```bash
# branch 1: trellis on PATH + a surface missing -> bad, exit 1
P="$(mktemp -d /tmp/pi-trellis-v9a.XXXXXX)"; rmdir "$P"
git clone -q /home/tan/my_pi_setup "$P"; cd "$P"
./setup.sh >/dev/null 2>&1
mv .pi/agents/trellis-check.md /tmp/pi-trellis-v9a-check.md
./scripts/doctor.sh; echo "exit=$? (expect 1, with a bad naming the missing agent)"
mv /tmp/pi-trellis-v9a-check.md .pi/agents/trellis-check.md

# branch 2: trellis not on PATH -> warn, exit 0
P="$(mktemp -d /tmp/pi-trellis-v9b.XXXXXX)"; rmdir "$P"
git clone -q /home/tan/my_pi_setup "$P"; cd "$P"
PATH="/usr/bin:/bin" ./scripts/doctor.sh; echo "exit=$? (expect 0, with a warn about the CLI)"
```

Also assert the hash-manifest check fires:

```bash
cd "$P"; printf '\n' >> .trellis/.template-hashes.json
./scripts/doctor.sh; echo "exit=$? (expect 1, bad: template-hashes.json is modified)"
```

---

## Phase 1 — `scripts/install-trellis.sh`

Write the new script. Skeleton and idioms per
`.trellis/spec/scripts/shell-guidelines.md`; no `lib.sh` source (design §1).

- [ ] **1.1** Shebang, `#` separator, header comment block describing the script
      and its single `--help` flag, then `set -euo pipefail`. Resolve
      `REPO_DIR` from `BASH_SOURCE` with the `scripts/*.sh` form (one directory
      deeper).
- [ ] **1.2** `say()` / `note()` in the padded `"  %-8s %s\n"` format. No
      `ok/warn/bad` glyphs — those belong to `doctor.sh`.
- [ ] **1.3** `usage()` via the same `awk 'NR>2 && /^#/ …'` extraction `setup.sh`
      uses, so the header comment *is* the help text.
- [ ] **1.4** Arg loop handling `-h|--help` (stdout, exit `0`) and `*` (usage to
      stderr, exit `2`). No other flags — design §2 rejects `--force`.
- [ ] **1.5** Preflight `command -v trellis`; absent → `note` naming the real
      install command (`npm install -g @mindfoldhq/trellis`, verified against
      `npm ls -g --depth=0`) and `exit 0`.
- [ ] **1.6** `trellis_surfaces_complete()` exactly as design §4 — three
      enumerated role agents, `compgen -G` discovery for prompts and skills.
- [ ] **1.7** Gate on it: complete → `say ok ".pi/ adapters (already present)"`,
      `exit 0`.
- [ ] **1.8** Version mismatch `note` (design §5d) comparing `.trellis/.version`
      with `trellis --version`. The CLI prints a bare single-line version
      (verified), so compare with `sed`-trimmed output, not `head -1` of a
      multi-line banner.
- [ ] **1.9** `.trellis/.developer` reconcile: create when absent, rewrite only
      the `name=` line when it differs, preserve every other line verbatim
      (design §5b). `say create` / `say sync` with the old → new value.
- [ ] **1.10** Snapshot `.trellis/.template-hashes.json` to
      `/tmp/pi-trellis-hashes.$$`; snapshot the top-level directory names under
      `.trellis/{spec,tasks,workspace}` into shell variables (design §5a).
- [ ] **1.11** Run `trellis init --pi -y -s -u "$identity"`, capturing output to
      `/tmp/pi-trellis-init.$$` and printing it indented. On failure: restore the
      hash snapshot, `say error`, `rm -f` both temp files, `exit 1`.
- [ ] **1.12** Prune loop over the three roots with `${dir:?}`, `rm -rf`, and one
      `say prune` line per removal printing the path relative to `$REPO_DIR`
      (design §5a).
- [ ] **1.13** Restore the hash manifest with `cmp -s`; `say sync` only when it
      actually changed. `rm -f` both temp files unconditionally before every exit
      path.
- [ ] **1.14** Final report: `say install` naming what now exists.
- [ ] **1.15** `chmod +x scripts/install-trellis.sh` — git tracks the bit, and
      only `setup.sh` plus `scripts/{optional,sync,doctor,install-mcp}.sh` are
      `100755` today.

**Gate 1:** V1 passes, and a dry probe run of the script on a clone performs
design §7's writes and nothing else.

---

## Phase 2 — propagate (design §3, PRD R7)

Every site below is named in
`.trellis/spec/guides/change-propagation-guide.md` or was found by searching for
the values this change introduces. Search first:

```bash
grep -rn "install-mcp" --include='*.sh' --include='*.mjs' --include='*.md' . \
  | grep -v '^\./\.trellis/scripts' | grep -v '^\./\.agents'
grep -rn "skip-mcp\|skip-skills\|skip-plugins" --include='*.sh' --include='*.md' .
grep -rn "seven things\|five bash scripts" --include='*.md' .
```

- [ ] **2.1** `setup.sh` — add `--skip-trellis` to the arg loop and a
      `SKIP_TRELLIS=0` variable, mirroring `--skip-mcp` exactly.
- [ ] **2.2** `setup.sh` — the header comment block (which **is** `--help`): add
      the new step to the numbered list, add the flag to the usage list, and
      fix the "Does everything" count. One uncommented line in that block
      silently truncates `--help`, so keep it comment-only.
- [ ] **2.3** `setup.sh` — insert the invocation as step 7, after the MCP step and
      before verification, guarded by `if [ "$SKIP_TRELLIS" = 1 ]` for the skip
      branch. **Do not renumber the existing steps** (design §3).
- [ ] **2.4** `scripts/doctor.sh` — compute the `bad`/`warn` branch once
      (design §6b): `trellis` on `PATH` → `bad`, absent → `warn`. Use it in the
      existing `$pi_agents` block and the existing `$trellis_ext` block, changing
      both `warn` calls to the branch. Never `exit` early; never add `set -e`.
- [ ] **2.5** `scripts/doctor.sh` — new `==> Trellis adapters` section after
      `==> Symlinked resources` (design §6a): the CLI check, the five surface
      groups, and the hash-manifest `git diff --quiet` check guarded on
      `[ -d "$REPO_DIR/.git" ]`.
- [ ] **2.6** `README.md` — the numbered "It does seven things" list gains the new
      step and the count changes; the `--help` flag list gains `--skip-trellis`;
      the script table gains a `scripts/install-trellis.sh` row; the day-to-day
      table gains a "Trellis adapters missing after a clone" row.
- [ ] **2.7** `README.md` — if any prose states that a fresh clone is missing the
      Trellis surfaces, or that `trellis update` restores them, correct it. That
      claim is the bug being fixed.
- [ ] **2.8** `.trellis/spec/scripts/index.md` — the bash runtime table gains
      `install-trellis`; the `100755` list in the pre-development checklist gains
      it; the "five currently do" Node-preflight sentence stays true only if the
      new script does **not** need Node (design §1 — it does not), so leave the
      count alone and confirm the wording.
- [ ] **2.9** `.trellis/spec/scripts/shell-guidelines.md` — add `prune` to the
      canonical verb list, plus the one-line `create`/`sync` note if the existing
      entries do not already cover the two verbs §5b uses.
- [ ] **2.10** `.trellis/spec/config/layout-and-surfaces.md` — the `.pi/`,
      `.agents/` row's "Applied by" cell currently reads `trellis` CLI; it becomes
      `trellis` CLI, restored by `scripts/install-trellis.sh`. Add the
      `.trellis/.developer` and `.trellis/.template-hashes.json` surfaces to the
      map (both are newly *owned* by a script, which is a surface change).
- [ ] **2.11** `.trellis/spec/config/layout-and-surfaces.md` — "Intentionally
      Absent" and the decision tree: confirm nothing there contradicts the new
      step; note the `.developer` write behaviour next to the existing
      "read-only → `PI_FILES`; rewritten at runtime → ignored" rule, since
      `.developer` is the third shape (written by a script, gitignored).
- [ ] **2.12** `.trellis/spec/index.md` — the "five bash scripts … five Node ESM
      helpers" count becomes six, and the `wc -l` line's scope still matches.
- [ ] **2.13** `.trellis/spec/guides/change-propagation-guide.md` — add a
      "Known Multi-Site Facts" row for the Trellis surfaces, so the next person
      who touches `.pi/` finds the sites: `scripts/install-trellis.sh` (single
      definition of the completeness test and the role-agent list),
      `scripts/doctor.sh` (the same list, plus the severity branch),
      `README.md`, `spec/scripts/index.md`, `spec/config/layout-and-surfaces.md`.

**Gate 2:** the search commands above return only sites this phase has already
edited or deliberately excluded, **and** the one-time migration below is complete.

### Phase 2b — the one-time workspace migration (PRD R8)

Done once, in this task's commit. Not implemented in the script — see design §5e
for why a generic rule is wrong here.

- [ ] **2.14** `git mv .trellis/workspace/yuanhai.tan .trellis/workspace/tan`, so
      git records a rename rather than a delete-plus-add and the 9 sessions of
      journal keep their history.
- [ ] **2.15** Update the first line of both migrated files to name `tan`
      (`# Workspace Index - tan`, `# Journal - tan (Part 1)`). Verify with
      `git diff --stat` that nothing else moved, other than the pi-lens Markdown
      autofix disclosed in design §5e — `301 → 291` lines in `journal-1.md`, all of
      them collapsed blank lines. Re-read both files after the write: pi-lens
      autofixes them and reports the result as authoritative.
- [ ] **2.16** Rename `creator` and `assignee` to `tan` in every
      `.trellis/tasks/**/task.json` (14 files, 28 fields; 13 tracked + this task's
      own untracked one). Then prove the change is prefix-safe with the command
      below.

```bash
git diff -U0 -- '.trellis/tasks/**/task.json' \
  | grep -E '^[-+][^-+]' | grep -vE '"(creator|assignee)": ' || echo "only identity fields"
```

- [ ] **2.17** Confirm the prose split is deliberate and recorded:
      `git grep -n 'yuanhai\.tan'` returns exactly the two dated archive lines named
      in PRD R8, and nothing else.

---

## Phase 3 — verify (V1–V9)

- [ ] **3.1** `bash -n setup.sh scripts/*.sh` — V1.
- [ ] **3.2** `node --check scripts/*.mjs` — V2.
- [ ] **3.3** `node scripts/check-docs.mjs .` — V3.
- [ ] **3.4** `./scripts/doctor.sh` → `All good.` — V4.
- [ ] **3.5** `./setup.sh` twice; second run must report the Trellis step as
      already satisfied and produce byte-identical output — V5.
- [ ] **3.6** `./scripts/sync.sh` → `same  pi-agent/settings.core.json`,
      `Already up to date.` — V6.
- [ ] **3.7** `git status --short` clean — V7. On this machine the **first**
      `./setup.sh` legitimately rewrites `.trellis/.developer`'s `name=` line
      (`yuanhai.tan` → `tan`); that file is gitignored, so V7 still requires
      clean. If anything tracked moves, stop.
- [ ] **3.8** V8 fresh-clone ritual: every surface `PRESENT`, no `backend`/
      `frontend`, no `00-join-*`, `name=tan`, empty `git status`.
- [ ] **3.9** V9 severity probes: missing agent → exit `1` with a `bad`; no
      `trellis` on `PATH` → exit `0` with a `warn`; modified hash manifest →
      exit `1` with a `bad`.
- [ ] **3.10** Confirm `.pi/settings.json` from a fresh-clone run is
      byte-identical to the live one:
      `diff "$P/.pi/settings.json" /home/tan/my_pi_setup/.pi/settings.json`.
- [ ] **3.11** Confirm the tracked journal survived:
      `git status --short .trellis/workspace/` shows only the two `R` rename rows,
      and `git log --follow -- .trellis/workspace/tan/journal-1.md` reaches the
      pre-migration history.
- [ ] **3.12** Confirm `task.py` still attributes history:
      `python3 ./.trellis/scripts/task.py list-archive | grep -c 'tan'` is non-zero,
      and `python3 ./.trellis/scripts/task.py current` still resolves this task.

**Gate 3:** V1–V9 all pass. Anything failing is a stop, not a note.

---

## Phase 4 — spec capture and commit

- [ ] **4.1** Confirm every new fact landed in a spec, not only in code: the
      `trellis update` cannot-restore finding (→ `spec/config/layout-and-surfaces.md`),
      the before/after prune rule (→ the change-propagation row added in 2.13),
      and the conditional severity rule (→ `spec/scripts/shell-guidelines.md`,
      next to the existing "a check that states it verified something must not lie"
      anti-pattern).
- [ ] **4.2** Review the diff as a whole: `git diff --stat` and
      `git diff -- .trellis/spec/`. A spec edit with no corresponding code change,
      or the reverse, is a miss from Phase 2.
- [ ] **4.3** Commit. Conventional-commit subject in the repo's style, e.g.
      `feat(setup): restore Trellis adapters on a fresh clone`. Stage the new
      script explicitly so the `100755` bit is in the commit.

---

## Rollback points

| After | To undo |
| ------- | --------- |
| Gate 1 | Delete `scripts/install-trellis.sh`. Nothing else has changed. |
| Gate 2 | `git checkout -- setup.sh scripts/doctor.sh README.md .trellis/spec/`, delete the new script, and `git mv .trellis/workspace/tan .trellis/workspace/yuanhai.tan` + `git checkout -- .trellis/tasks/` to undo Phase 2b. `setup.sh` no longer calls it, so the harness returns to the pre-change state. |
| Gate 3 | `git revert` the Phase 4 commit. On-disk state needs no unwinding (design §9): `.pi/` and `.agents/skills/trellis-*` stay but become unmanaged, the hash manifest already holds its committed bytes, and the only non-git change is the gitignored `.trellis/.developer` name line — restore it by writing the old `name=` value back. |

## Stop conditions

Stop and report rather than continuing:

- `./setup.sh` after Phase 2 leaves `git status` non-clean for a **tracked**
  path other than the ones listed in 2.1–2.17.
- `git log --follow` on the migrated journal does not reach the pre-migration
  commits, meaning the rename was recorded as delete-plus-add.
- `doctor.sh` reports `bad` for a surface this task did not touch.
- The prune rule removes a directory that existed before the script ran
  (the design's central safety claim — if it fails, the rule is wrong, not the
  test).
- `trellis init` emits an interactive prompt under `-y`, meaning an upstream flag
  changed meaning.

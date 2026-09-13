# Design — reconciling the path lists and enforcing the invariant

## The invariant

Three lists describe machine-local Pi paths, and they answer different questions.
Making them *identical* is the wrong goal; the correct goal is one **one-directional
invariant**:

> Every path `sync.sh` reports as "not synced" must be impossible to commit.

Formally: `skip-list ⊆ .gitignore`.

Why not equality:

- `.gitignore` legitimately covers things that are not runtime *paths* — `.pi/`,
  `.agents/`, `.idea/`, `*.swp`, `*.log`, `*.bak-*`.
- `sync.sh` legitimately omits two runtime paths that are already reported
  earlier in its own output: `settings.json` and `.pi-setup-state.json`
  (the "Folding live settings" section). Listing them in the skip report would
  double-report them.
- `README.md`'s table groups rows (`~/.pi/agent/{missions,profiles,web-search-cache}/`)
  where the others enumerate.

So the enforced direction is the security-relevant one, and the reverse direction
(a path added to `.gitignore` but not to the report) stays undetectable by design —
it is also harmless, since the failure mode it would hide is `cache/`-shaped:
ignored but unreported.

## Current divergence (measured before this task)

| Path | `.gitignore` | `sync.sh` | Needed change |
|------|--------------|-----------|---------------|
| `cache/` | yes | no | add to skip-list |
| `trust.json` | **no** | yes | **add to `.gitignore`** |
| `agent-memory/` | **no** | yes | **add to `.gitignore`** |

`~/.pi/agent/trust.json` exists on this machine, so this is not hypothetical:
today git would stage a file that `sync.sh` tells the user is deliberately skipped.

## Key finding: `check-ignore` is slash-sensitive

The check has to encode the authoritative decision *exactly* rather than
eyeballing it, because `git check-ignore` distinguishes a directory pattern from
a bare name. Measured in this repo:

```
pi-agent/sessions        not ignored (exit 1)     # .gitignore has pi-agent/sessions/
pi-agent/sessions/       IGNORED
pi-agent/cache/          IGNORED
pi-agent/trust.json      not ignored (exit 1)     # the bug
pi-agent/agent-memory/   not ignored (exit 1)     # the bug
pi-agent/run-history.jsonl  IGNORED
```

Seven of the skip-list's entries are directories. A naive check written against
the skip-list's current bare names (`sessions`, `npm`, `git`, `bin`, `cache`,
`agents`…) would therefore fail for **every directory entry** — a check that cries
wolf is worse than no check, because it trains the reader to ignore `doctor.sh`.

Three consequences, all taken as decisions below: the list must carry the
canonical slash-form, the check must test the exact string, and the failure
message must say which shape is wrong.

## Options Considered For The Invariant Itself

| Option | Verdict |
|--------|---------|
| **A. Enforce `skip-list ⊆ .gitignore`, exact string, `git check-ignore -q`** | **Chosen.** Cheap, offline, uses the real ignore engine including all pattern types, and is self-correcting for the slash problem. |
| B. Require the two lists to be equal | Rejected: would force `settings.json`, `.pi-setup-state.json`, `*.log`, `*.bak-*`, and `.pi/` into the skip report, changing what the report means. |
| C. Parse `.gitignore` and compare pattern sets by hand | Rejected: reimplements glob semantics (negation, anchoring, `**`, directory-only) and would drift from git's own behaviour. |
| D. A test script rather than a `doctor.sh` check | Rejected: there is no test runner, and `doctor.sh` is the documented verification entry point for this repo. |
| E. Make it a `warn` | Rejected: the PRD requires `bad`. A committable path that the tooling claims is skipped is a security-relevant inconsistency, not a note. |

## Options Considered For Getting The List Into `doctor.sh`

`doctor.sh` must iterate the same list `sync.sh` reports. Three ways:

| Option | Verdict |
|--------|---------|
| **A. Third array in `scripts/lib.sh`** | **Chosen.** Single-sourced, no parsing, no new CLI. `doctor.sh` already sources `lib.sh`. |
| B. `sed -n 's/^for f in \(.*\); do$/\1/p' scripts/sync.sh` | Rejected: depends on one line's exact syntax. Guardable (treat an empty parse as a `bad`), but a reformat silently breaks the *check* that exists to catch silent breakage. |
| C. New `sync.sh --list-skipped` flag | Rejected: adds CLI surface to a mutation script so a read-only script can ask it a question about a list neither of them owns. |

### Contract amendment for `scripts/lib.sh`

`lib.sh`'s committed header says it holds "ONLY the paths that setup.sh symlinks,
sync.sh pulls back, and doctor.sh verifies". Adding the not-synced list is an
amendment to that contract, and it is a deliberate one:

- The constraint that matters is **data only, no behaviour**. `say`, `note`, the
  `node` preflight, and `link()` stay out, because moving them would couple
  `setup.sh`'s bootstrap path to more of `scripts/`. A third *array of strings* is
  pure data and adds no behaviour.
- `setup.sh` simply does not read it. Sourcing a data file and using a subset of it
  is fine; the file is not a "load everything" dependency.
- The alternative — a fourth copy of the list, or a syntax-parsing dependency —
  reintroduces exactly the class of bug this parent task exists to remove.

The header comment and the spec must be updated to say "the harness path lists
(data only)" rather than "the two resource arrays", so the next reader does not
think the constraint was quietly broken.

## The Check

New section in `scripts/doctor.sh`, immediately after `==> Secret scan (tracked
files)` — both are git-hygiene checks and both run only in a git repo:

```bash
echo "==> Ignore coverage (machine-local paths)"
if [ -d "$REPO_DIR/.git" ]; then
  not_ignored=()
  for name in "${PI_NOT_SYNCED[@]}"; do
    git -C "$REPO_DIR" check-ignore -q -- "pi-agent/$name" || not_ignored+=("$name")
  done
  if [ ${#not_ignored[@]} -gt 0 ]; then
    bad "path(s) sync.sh reports as not-synced, but git would commit:"
    for name in "${not_ignored[@]}"; do printf '      pi-agent/%s\n' "$name"; done
    printf '      add them to .gitignore (directory patterns need the trailing slash)\n'
  else
    ok "all ${#PI_NOT_SYNCED[@]} reported-skipped paths are gitignored"
  fi
fi
```

Design notes, each load-bearing:

- **`${#not_ignored[@]}` with an empty array is safe under `set -u`** — `${#arr[@]}`
  is the length form, which does not trigger the unbound-variable error the way
  `${arr[@]}` can. `doctor.sh` has `set -u`. This is the same hazard
  `shell-guidelines.md` documents for `RENDER_ARGS`.
- **`git -C "$REPO_DIR"`** — `doctor.sh` runs from an arbitrary working directory.
- **`check-ignore` needs no network**, and works for paths that do not
  exist on this machine (verified above), so the check is meaningful on a fresh
  clone where `~/.pi/agent` lives elsewhere. It *does* consult the index (it is
  not `--no-index`), which is intended: a path force-added despite a matching
  rule is reported as not ignored, so the check catches ignored-and-tracked too.
- **No `-e` introduced.** The `||` capture keeps the loop's exit status neutral.
- The trailing-slash hint is in the failure message because that is the failure
  mode the reader will actually hit when adding a directory.
- It reports **every** offending path, not the first, matching `doctor.sh`'s
  contract of printing the complete picture.

## Reconciliation Edits

1. `.gitignore` — add `pi-agent/trust.json` and `pi-agent/agent-memory/`.
2. `scripts/lib.sh` — add `readonly PI_NOT_SYNCED=(…)` in canonical slash-form,
   with `cache/` included:

   ```bash
   readonly PI_NOT_SYNCED=(
     auth.json models-store.json models.json trust.json
     sessions/ npm/ git/ bin/ cache/ agent-memory/
     missions/ profiles/ web-search-cache/ run-history.jsonl
   )
   ```

3. `scripts/sync.sh` — `for f in "${PI_NOT_SYNCED[@]}"; do`. The report strings
   gain the trailing slash for directories (`skip pi-agent/sessions/`), which is
   more accurate and is what the check validates.
4. `README.md` — add a `cache/` row; `trust.json` / `agent-memory/` rows already
   exist. Align the row grouping with the slash-form already used there.
5. `scripts/doctor.sh` — the check above.

`PI_NOT_SYNCED` is ordered the way the report should read — generated secrets
first, then Pi's runtime directories, then the recently added ones — because the
array's order *is* the report's order. That is now a supported property rather than
an accident: a maintainer adding a path chooses where it appears.

## Spec Updates

- `config/layout-and-surfaces.md` §"Common Mistake: assuming the two lists have
  parity" → rewritten: the divergence is fixed, the invariant is `skip-list ⊆
  .gitignore`, it is enforced by `doctor.sh`, and the reverse direction remains
  undetectable-and-harmless. Keep the slash-sensitivity finding — it is the
  non-obvious part.
- `guides/change-propagation-guide.md` — the warning box under "Known Multi-Site
  Facts" becomes a pointer to the invariant instead of a warning about a live bug;
  the "Not stored here" row is updated to name the third array.
- `scripts/index.md` — the `lib.sh` guidance says "never re-declare `PI_DIRS`/
  `PI_FILES`" → now three arrays, all in `lib.sh`.
- `scripts/shell-guidelines.md` — `lib.sh`'s header contract ("data only") and the
  new `doctor.sh` check (a `bad`, and the `${#arr[@]}`-under-`set -u` note).

## Risks

| Risk | Mitigation |
|------|------------|
| The check cries wolf because a directory entry lost its slash | Self-correcting: the exact-string check fails, and the failure message names the slash. Verified by a negative test. |
| Someone "fixes" the check by loosening it to accept either form | The spec records *why* the exact form is required; `check-ignore`'s slash semantics are quoted in the design and the spec. |
| `lib.sh` grows beyond data | Header comment states data-only; `shell-guidelines.md` repeats it; the PRD forbids extending it further. |
| The check passes but `README.md` is still wrong | Accepted and documented: README is prose, not mechanically checkable. It is named as a hand-maintained site in the propagation guide. |
| Report output changes (`sessions` → `sessions/`) break a consumer | Nothing parses the report; `doctor.sh`'s own check is the only consumer of the names, and it reads the array, not the output. |

## Rollback

Single commit, no state or generated artefact. `git revert` restores the inline
loop list, the two `.gitignore` lines were additive, and deleting the check section
returns `doctor.sh` to its previous behaviour.

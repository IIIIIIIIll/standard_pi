# Change Propagation Guide

> **Purpose**: this repo has no test suite. The only thing standing between a
> half-applied change and a silently broken harness is you searching for every
> occurrence before you edit.

---

## The Problem

This is a configuration store. The same fact is necessarily written down in
several places: a script needs it as a bash array, the renderer needs it as JS,
the user needs it in `README.md`, and git needs it in `.gitignore`.

Nothing checks that those copies agree. `scripts/doctor.sh` catches the
*consequences* (a resource that is not linked, settings that have drifted), but
it cannot catch "you updated the array in two scripts and forgot the third" if
the third one's check happens to pass anyway.

Real example, measured on this repo — the set of symlinked resource directories
(`themes prompts tools skills agents extensions`) appears in **seven places**:

| # | Location | Form |
|---|----------|------|
| 1 | `setup.sh:8` | header comment (`--help` text) |
| 2 | `setup.sh:31` | `PI_DIRS=(…)` |
| 3 | `scripts/sync.sh:19` | `PI_DIRS=(…)` |
| 4 | `scripts/doctor.sh:13` | `PI_DIRS=(…)` |
| 5 | `scripts/doctor.sh:82` | inline message listing the names |
| 6 | `README.md:71` | Layout table: `pi-agent/{themes,prompts,tools,skills,agents,extensions}/` |
| 7 | `README.md:134` | Day-to-day prose list |

Places 1–5 are behavioural; a miss there is a bug. Places 6–7 are documentation;
a miss there is a stale README. Both matter.

---

## Step 0 — Search Before You Edit

Always run this first, with the value you are about to change:

```bash
grep -rn "<value>" --include='*.sh' --include='*.mjs' --include='*.md' --include='*.json' . \
  | grep -v '^\./\.trellis/scripts' | grep -v '^\./\.agents'
```

The two exclusions matter: `.trellis/scripts/` is vendored Trellis runtime code
and `.agents/` is CLI-generated, so a hit in either is not yours to update.

For a structural change, search for the *shape* rather than the value:

```bash
grep -rn "PI_DIRS\|PI_FILES" --include='*.sh' .        # the arrays
grep -rn "^pi-agent/" .gitignore                        # ignored surfaces
grep -n "^| " README.md                                 # the tables
```

---

## Known Multi-Site Facts

| Fact | Sites that must change together | Severity if missed |
|------|--------------------------------|--------------------|
| Symlinked resource dirs (`PI_DIRS`) | `setup.sh` (array + header), `sync.sh`, `doctor.sh` (array + message), `README.md` (table + prose) | a new dir is silently never linked in one direction, or `doctor.sh` reports a false problem |
| Symlinked files (`PI_FILES`) | same three scripts | same |
| "Not stored here" paths | `.gitignore`, `README.md` table, `sync.sh` skip-list | a runtime path becomes commit-able, or the report silently omits it |
| A user-facing string (an error/help message) | the script that prints it, `.gitignore` comments, `README.md` prose, **and every spec file that quotes it verbatim** | a user follows an instruction that cannot work |
| The name of a script or path | its own file, every caller, every message naming it, `.gitignore` comments, `README.md` | stale instructions, as happened when `install.sh` was folded into `setup.sh` |
| Ignores / deny rules | `.gitignore`, `extensions/pi-permission-system/config.json`, `README.md` | a secret or `node_modules` gets committed |
| Plugin list | `settings.core.json` `packages`, `README.md` plugin table, the owning `optional/*/manifest.json` | an undocumented or double-declared plugin |
| Installed skills | `skills.json`, `README.md` "Currently installed", `~/.agents/.pi-setup-skills.json` (generated) | README lists a skill that is never installed |
| `_`-prefix exclusion | `optional.sh` `find`, `render-settings.mjs` `listOptionals`, `doctor.sh` `case`, `optional/_template/README.md` | `_template` becomes an enable-able bundle |
| Destination defaults (`PI_CODING_AGENT_DIR`, `AGENTS_SKILLS_DIR`) | all four shell scripts, `install-skills.mjs`, `README.md` | a script reads or writes the wrong directory |
| Output verb vocabulary | `setup.sh`/`sync.sh` `say`, `doctor.sh` `ok/warn/bad`, every `.mjs` literal | unreadable, unaligned output |
| `optional/*/manifest.json` schema | the manifests, `_template/README.md`, `config/optional-bundles.md`, `scripts/optional.sh scaffold` | scaffold produces a manifest the renderer rejects |

> **The "Not stored here" row is currently not in parity** — `.gitignore` and the
> `sync.sh` skip-list each cover paths the other misses, and `README.md` covers a
> third combination. `trust.json` is reported as "intentionally not synced" while
> git would happily stage it. Read `../config/layout-and-surfaces.md`
> §"Common Mistake: assuming the two lists have parity" before editing any of them.

---

## Worked Example — Adding A Symlinked Resource Directory

Say Pi gains a `themes-plus/` directory that should be versioned here. The full
change set is:

1. `mkdir pi-agent/themes-plus/` and put the content in it.
2. `setup.sh` — add to `PI_DIRS`, **and** to the header comment on line 8 (the
   `--help` text is generated from it).
3. `scripts/sync.sh` — add to `PI_DIRS`.
4. `scripts/doctor.sh` — add to `PI_DIRS`, **and** to the "none in repo yet"
   message on line 82.
5. `README.md` — the Layout table row and the Day-to-day prose list.
6. `.gitignore` — only if Pi writes runtime state into it.
7. `./setup.sh` then `./scripts/doctor.sh` — confirm the new dir links and that
   the round trip `setup.sh → sync.sh` reports `same`.

Seven edits for one directory. That is the shape of a change in this repo; treat
it as normal rather than as a sign something is wrong.

---

## Step N — The Verify Chain

There is no CI. Run these in order; each catches a different class of miss.

```bash
bash -n setup.sh scripts/*.sh        # syntax only (shellcheck is not installed)
node --check scripts/*.mjs           # syntax only

./setup.sh                           # render + link + install + verify; must be re-runnable
./setup.sh                           # second run: same output, no new files, nothing to do
./scripts/sync.sh                    # must report `same pi-agent/settings.core.json`
./scripts/doctor.sh                  # must end in `All good.`
git status --short                   # must be clean, unless you meant to change tracked files
```

What each step actually proves:

| Step | Catches |
|------|---------|
| `./setup.sh` twice | non-idempotent `link()` / render logic, a backup written on every run |
| `./setup.sh` → `./scripts/sync.sh` | asymmetry between render and sync — the highest-value check here, because render/sync are the two directions of the same mapping |
| `./scripts/doctor.sh` | drift, wrong symlink target, `auth.json` mode, a tracked secret, missing skills |
| `git status --short` | a path that should be ignored but is not |

`doctor.sh`'s exit code is meaningful: `0` with `All good.`, `0` with notes
(informational, e.g. no `origin` remote), or `1` with `N problem(s) found.`
Never treat a non-zero exit as noise.

---

## If You Want To Fix The Duplication

The honest structural fix is one shared definition that `setup.sh`, `sync.sh`,
and `doctor.sh` source, e.g. `scripts/lib.sh` holding `PI_DIRS`/`PI_FILES`.
Constraints if you attempt it:

- `setup.sh` is the bootstrap entry point and must keep working when the repo has
  just been cloned. Sourcing a file from `scripts/` adds a dependency but is
  acceptable — the file ships in the same repo.
- `doctor.sh` must not gain `set -e`, and must keep working when the sourced file
  is missing (report it as a `bad`, do not crash).
- Deduplicating bash cannot help `README.md` or `.gitignore`, which are the other
  two sites — so the guide remains necessary even after the refactor.

Until then, **the duplication is real and intentional-ish**: it is cheap to read
and there is no build step. Do not add a *fourth* copy of a script-local list,
and do not restructure the scripts as a drive-by while fixing something else.

---

## Pre-Modification Checklist

- [ ] Ran the `grep` above with the value you are changing.
- [ ] Listed every site and decided whether each one needs the change.
- [ ] Checked whether the value also appears in a comment (header comments are
      executable help text in `setup.sh`).
- [ ] Checked whether it also appears in a user-facing string, not just code.
- [ ] Checked `.gitignore` and the permission config if the value is a path.
- [ ] Ran the full verify chain, including `setup.sh` twice.

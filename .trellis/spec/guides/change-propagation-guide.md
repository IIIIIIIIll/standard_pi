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
(`themes prompts tools skills agents extensions`) now has **one definition** and
**four hand-maintained sites** (five lines — the `README.md` overview is two of
them):

| # | Location | Form |
|---|----------|------|
| — | `scripts/lib.sh:16-18` | **the single definition** — `readonly PI_DIRS=(…)` / `PI_FILES=(…)`, sourced by all three scripts |
| 1 | `setup.sh:8` | header comment (`--help` text) |
| 2 | `scripts/doctor.sh:87` | inline "none in repo yet" message listing the names |
| 3 | `README.md:16,71` | overview: numbered setup step + Layout table |
| 4 | `README.md:134` | Day-to-day prose list |

The three scripts carry no copy of their own: `setup.sh`, `scripts/sync.sh`, and
`scripts/doctor.sh` each source `scripts/lib.sh`, and the arrays are `readonly`,
so a re-declaration in a consumer is rejected instead of diverging.

Sites 1–2 are behavioural (they are printed output); sites 3–4 are
documentation. A miss at any of them is a stale label or README rather than a
broken symlink, which is why this guide still exists.

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
| Symlinked resource dirs (`PI_DIRS`) | `scripts/lib.sh` (the single definition), `setup.sh` (header comment), `doctor.sh` (inline message), `README.md` (setup step, Layout table, Day-to-day prose) | a new dir is never linked in one direction, or `doctor.sh` reports a false problem |
| Symlinked files (`PI_FILES`) | `scripts/lib.sh` (the single definition), plus the same non-code sites whenever the file name is listed | same |
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
2. `scripts/lib.sh` — add to `PI_DIRS`. This is the **only** array edit;
   `setup.sh`, `scripts/sync.sh`, and `scripts/doctor.sh` all pick it up.
3. `setup.sh` — the header comment on line 8 (the `--help` text is generated
   from it).
4. `scripts/doctor.sh` — the "none in repo yet" message on line 87.
5. `README.md` — the overview (numbered setup step + Layout table).
6. `README.md` — the Day-to-day prose list.
7. `.gitignore` — only if Pi writes runtime state into it.
8. `./setup.sh` then `./scripts/doctor.sh` — confirm the new dir links and that
   the round trip `setup.sh → sync.sh` reports `same`.

Five edit steps for one directory — the single array definition plus the four
hand-maintained sites above. Site 3 is two separate `README.md` lines (`16` and
`71`), so the line changes number six. That is the shape of a change in this
repo; treat it as normal rather than as a sign something is wrong.

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

## Where The Lists Live Now

The duplication was removed. `scripts/lib.sh` is the single definition, and
`setup.sh`, `scripts/sync.sh`, and `scripts/doctor.sh` source it. Three
conventions make that safe:

- **The arrays are `readonly` and `lib.sh` has a double-source guard.** A
  consumer that re-declares `PI_DIRS` cannot change the list: the assignment is
  rejected (`readonly variable`). `setup.sh` and `sync.sh` run under `set -e`, so
  the error aborts them with exit `1` before they do anything. `doctor.sh` must
  keep running after a failed check and has no `set -e`, so it prints the error,
  keeps the correct list, and still exits `0` (unless the rejected assignment is
  the script's last command, when bash's exit status is `1`). The *values* cannot
  diverge; the exit code differs by script, which is documented in
  [../scripts/shell-guidelines.md](../scripts/shell-guidelines.md).
- **A missing `lib.sh` is fatal in all three scripts, and names the file.** Do
  not replace the existence check with a bare `source`: under `set -u` a failed
  `source` leaves the arrays unset, and the next `"${PI_DIRS[@]}"` aborts with an
  `unbound variable` instead of naming what is missing. `doctor.sh` reports it
  with its own `bad` + `exit 1`.
- **`lib.sh` holds only the two arrays.** Do not move helpers (`say`, `note`, the
  `node` preflight, `link()`) into it: `setup.sh` is the bootstrap entry point,
  and the repo's convention is that each script reads standalone.

Deduplicating bash cannot help the four hand-maintained sites at the top of this
guide — three are prose and one is a `--help` comment. The guide remains
necessary; what changed is that a change to a script's *behaviour* now
propagates itself, and only the labels have to be chased by hand.

---

## Pre-Modification Checklist

- [ ] Ran the `grep` above with the value you are changing.
- [ ] Listed every site and decided whether each one needs the change.
- [ ] Checked whether the value also appears in a comment (header comments are
      executable help text in `setup.sh`).
- [ ] Checked whether it also appears in a user-facing string, not just code.
- [ ] Checked `.gitignore` and the permission config if the value is a path.
- [ ] Ran the full verify chain, including `setup.sh` twice.

# my_pi_setup — Development Guidelines

> Project-specific coding conventions for AI assistants and humans working here.

---

## What This Project Is

`my_pi_setup` is a **portable configuration store** for a Pi coding-agent harness.
It is not an application: there is no server, no UI, no database, no test suite.

The whole product is:

- four bash scripts that render, symlink, sync, and verify harness state
- three dependency-free Node ESM helpers that do the JSON work
- JSON config files that Pi reads (`settings.core.json`, `optional/*/manifest.json`, `skills.json`)
- Markdown that explains the above

Roughly 600 lines of authored code total. `git clone && ./setup.sh` is the
install path, and **re-running `./setup.sh` is the update path** — idempotency
is the central design constraint, not a nice-to-have.

---

## Spec Layers

| Layer | Covers | Read before |
|-------|--------|-------------|
| [scripts/](./scripts/index.md) | `setup.sh`, `scripts/*.sh`, `scripts/*.mjs` — bash and Node conventions | Changing anything executable |
| [config/](./config/index.md) | Tracked/symlinked/generated surfaces, `optional/*/manifest.json`, `settings.core.json`, `skills.json`, permissions | Changing any `.json` config or adding a resource dir |
| [guides/](./guides/index.md) | Thinking guides, including the [change-propagation guide](./guides/change-propagation-guide.md) which is the most load-bearing one for this repo | Whenever you change a constant that appears in more than one file |

There is no `backend/` or `frontend/` layer. An earlier `trellis init` generated
those template directories; they were deleted during bootstrap because no such
layers exist here. Do not recreate them.

---

## The One Rule To Internalize

**Every fact in this repo is written down in more than one place.** The plugin
list and the "what is not stored here" table are repeated across scripts,
`README.md`, and `.gitignore`. The resource directory list is the exception that
proves the rule: it has a single definition in `scripts/lib.sh`, but it is still
*named* in `setup.sh`'s help text, a `doctor.sh` message, and `README.md`.

There is no test suite catching drift. Drift is caught by
`scripts/doctor.sh`, which is the closest thing to a verifier this project has.

→ Read [guides/change-propagation-guide.md](./guides/change-propagation-guide.md)
before editing a constant, a list, or a name.

---

## Pre-Development Checklist

- [ ] `scripts/doctor.sh` passes on a clean tree before you start (`./scripts/doctor.sh`).
- [ ] Identify which surface you are touching — tracked, symlinked, generated, or gitignored. Getting this wrong is the most common mistake here; see [config/layout-and-surfaces.md](./config/layout-and-surfaces.md).
- [ ] If you are changing a list or constant, search for every occurrence first:
      `grep -rn "<value>" --include='*.sh' --include='*.mjs' --include='*.md' --include='*.json' .`
- [ ] If you are adding an executable script, decide now whether it is a user-facing entry point (repo root, e.g. `setup.sh`) or a helper (`scripts/`), and `chmod +x` it — git tracks the executable bit.
- [ ] If you are adding a config key, decide whether it is core (every machine) or optional (per-machine). It goes in `settings.core.json` or `optional/<name>/manifest.json` respectively — never both.
- [ ] Read the matching layer spec under `scripts/` or `config/`.

---

## Quality Check

Run all of these; there is no CI and no test runner.

```bash
./scripts/doctor.sh          # symlinks, render drift, skills, auth.json, git state, secret scan
./setup.sh                   # must be safe to re-run; this is the real integration test
./scripts/sync.sh            # must report no diff after a clean setup
bash -n setup.sh scripts/*.sh
node --check scripts/*.mjs
```

Expected after a full `./setup.sh` on a clean tree: `doctor.sh` prints
`All good.` If it prints `No problems. N note(s) above.` the notes are
informational (e.g. no `origin` remote); anything else is a real failure.

Additional checks that are not automated:

- Run `./setup.sh` **twice**. The second run must produce the same output and no
  new files. Non-idempotent behaviour is a bug, not a nuisance.
- Run `./scripts/sync.sh` after `./setup.sh`. It must report
  `same  pi-agent/settings.core.json` and `Already up to date.`
- `git status --short` after `setup.sh` must be clean unless you intentionally
  changed a tracked surface.
- Never leave a secret in a tracked file. `doctor.sh` scans for common key
  patterns and fails if `pi-agent/auth.json` is tracked.

---

## Verification Commands Worth Memorising

```bash
# Where does a setting actually live?
node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("pi-agent/settings.core.json"))))'

# What would be rendered on this machine, without writing?
node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check

# Which optional bundles exist, and which are enabled here?
./scripts/optional.sh list

# Are the upstream skills installed? (no network)
node scripts/install-skills.mjs . --check
```

---

**Language**: All documentation in this repository is written in English.

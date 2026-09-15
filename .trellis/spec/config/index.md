# Config Layer

> How the harness configuration in this repo is organized, and where a new piece of configuration belongs.

---

## Overview

There is no application state here — the product **is** the configuration. What
matters is not just the values but which *surface* each file lives on, because
that determines whether it is committed, symlinked, regenerated, or ignored.

Four surfaces exist, and every config file belongs to exactly one of them:

| Surface | Meaning | Lifecycle |
| --------- | --------- | ----------- |
| **Tracked** | Committed, reviewed, shared by every machine | edit + `git commit` |
| **Symlinked** | Lives in the repo, `~/.pi/agent/<name>` points at it | edit + commit (already live) |
| **Generated** | Rendered per machine from tracked inputs | `./setup.sh` or `scripts/sync.sh` |
| **Ignored** | Machine-local runtime state or secrets | never committed, never synced |

Getting this wrong is the single most common mistake in this repo. Two concrete
examples of the failure mode: hand-editing `~/.pi/agent/settings.json` (it is
generated and will be overwritten on the next render), and committing
`~/.pi/agent/auth.json` (it contains live API keys).

---

## Guidelines Index

| Guide | Description |
| ------- | ------------- |
| [Layout And Surfaces](./layout-and-surfaces.md) | The full file map, the decision tree for a new file, and `settings.json` backup/rendering rules |
| [Optional Bundles](./optional-bundles.md) | `optional/<name>/manifest.json` contract, the `_` convention, per-machine state |
| [Pi Resources](./pi-resources.md) | `settings.core.json`, `skills.json`, `extensions/` layout, and the permission policy |

---

## Pre-Development Checklist

- [ ] Determine the surface first (table above). If the answer is "generated",
      you are editing the wrong file — edit the input instead.
- [ ] If it is a setting that should apply to **every** machine, it goes in
      `pi-agent/settings.core.json`. If it should apply **only where enabled**, it
      goes in `optional/<name>/manifest.json`. Never both — `sync-settings.mjs`
      strips optional keys from core, so an overlapping key is silently lost.
- [ ] If it is a package, it goes under `packages` in one of those two files.
      Pi installs `npm:`, `git:`, and path specs; this repo leaves them
      **unpinned on purpose** so `pi update --extensions` can advance them.
- [ ] If it is a secret, it goes in `~/.pi/agent/auth.json` only. `doctor.sh`
      fails if that file is tracked.
- [ ] If you are adding a directory Pi should discover (or a single file it
      should read), it must be added to `PI_DIRS` / `PI_FILES` in
      `scripts/lib.sh` **and** to `.gitignore`/`README.md` as appropriate — see
      [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md).
      For a file, decide from the owner's *write* behaviour, not its location:
      read-only → `PI_FILES`; rewritten at runtime → ignored, not symlinked.
- [ ] `.env` handling is deny-by-default in the permission policy. Do not add a
      rule that allows reading `*.env` to make something work.
- [ ] For a change that adds or renames a key, a bundle, or a path, state the
      boundary before the first edit: the one tracked input that changes, the
      generated or ignored surfaces that follow from it, and the sites that must
      move with it. A change that edits the generated output has the boundary in
      the wrong place.

---

## Quality Check

- [ ] `node scripts/render-settings.mjs . "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json" --check`
      — no drift.
- [ ] `git status --short` is clean after `./setup.sh` (nothing accidental became tracked).
- [ ] `git ls-files | grep auth.json` returns nothing, and
      `ls -l ~/.pi/agent/auth.json` shows mode `600`.
- [ ] New JSON is strict JSON — no comments, no trailing commas. This is required,
      not stylistic: the permission system clamps to `ask` on a parse failure, and
      `readJson` throws on a trailing comma.
- [ ] Any new tracked JSON key is represented in `README.md` if a user would need
      to know about it, and in the relevant `optional/<name>/README.md` if it is
      bundle-specific.
- [ ] `./scripts/optional.sh list` still shows the expected enabled/available split.
- [ ] `node scripts/check-docs.mjs .` exits 0 — every package in
      `settings.core.json` and every skill in `skills.json` still has an entry in
      `docs/`, and no entry documents something that is not shipped. The contract
      is in [pi-resources.md](./pi-resources.md#the-docs-coverage-check).
- [ ] The render/sync pair stayed symmetric: `./setup.sh` then `./scripts/sync.sh`
      reports `same  pi-agent/settings.core.json`. This is the layer's cross-layer
      check — the config surface is one mapping read in two directions, and a key
      handled in one direction only stays invisible until the next sync.
- [ ] Prose that quotes config is still true. The `settings.core.json` block in
      [pi-resources.md](./pi-resources.md) is a hand-maintained copy and nothing
      checks it (`git grep -n 'pi-resources' -- scripts/ setup.sh` finds no
      consumer), so compare it by hand — or correct the claim that it is checked.
      Same for any key quoted in `README.md` or `docs/`.
- [ ] Scope: no key, bundle, or manifest entry added for a machine or a case that
      cannot occur, and no existing value rearranged because it merely looked
      inconsistent.

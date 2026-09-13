# Layout And Surfaces

> The full map of what is tracked, symlinked, generated, and ignored — and how to place a new file.

---

## The Map

| Repo path | Live location | Surface | Applied by |
|-----------|---------------|---------|------------|
| `pi-agent/settings.core.json` | — (input) | Tracked | `render-settings.mjs` reads it |
| `optional/<name>/manifest.json` | — (input) | Tracked | `render-settings.mjs` reads it when enabled |
| `optional/<name>/README.md` | — | Tracked | — |
| `optional/<name>/auth.example.json` | — | Tracked | copied by the user into `auth.json` |
| `skills.json` | — (input) | Tracked | `install-skills.mjs` reads it |
| `pi-agent/AGENTS.md` | `~/.pi/agent/AGENTS.md` | Symlinked | `setup.sh` |
| `pi-agent/{themes,prompts,tools,skills,agents,extensions}/` | `~/.pi/agent/<name>` | Symlinked | `setup.sh` |
| `pi-agent/auth.json.example` | `~/.pi/agent/auth.json` | Tracked template → copied **once** | `setup.sh` |
| `pi-agent/settings.json` | `~/.pi/agent/settings.json` | **Generated** | `render-settings.mjs` |
| `pi-agent/.pi-setup-state.json` | `~/.pi/agent/.pi-setup-state.json` | **Generated, gitignored** | `render-settings.mjs` |
| `~/.pi/agent/auth.json` | — | **Ignored (secret)** | user, mode `600` |
| `~/.pi/agent/{sessions,npm,git,bin,cache,missions,profiles,web-search-cache}/` | — | **Ignored** | Pi |
| `~/.pi/agent/{run-history.jsonl,models-store.json,trust.json}`, `~/.pi/agent/agent-memory/` | — | **Ignored** | Pi |
| `~/.pi/agent/extensions/*/logs/` | — | **Ignored** | the extension |
| `~/.agents/skills/<name>/` | — | **Fetched from upstream** | `install-skills.mjs` |
| `~/.agents/.pi-setup-skills.json` | — | **Generated, outside repo** | `install-skills.mjs` |
| `~/.pi/agent/settings.json.pre-render-<stamp>` | — | **Ignored backup** | `render-settings.mjs` |
| `<path>.bak-<stamp>` | — | **Ignored backup** | `setup.sh::link()`, `render-settings.mjs` |
| `.pi/`, `.agents/` | — | **Ignored** (Trellis-generated adapters) | `trellis` CLI |

Note that `PI_DIRS` lists six resource directories but only `extensions/` exists
in the repo today. The list is defined once, in `scripts/lib.sh`, and is a
**whitelist of allowed symlinked resource directories**, not an inventory —
`link()` silently returns when the source does not exist, so `themes/`,
`prompts/`, `tools/`, `skills/`, and `agents/` will be linked automatically the
moment they appear. Creating one of them by hand is a normal, supported way to add
a resource; adding a seventh name to `scripts/lib.sh` is not.

The **Ignored** rows above are illustrative, not exhaustive — Pi adds runtime
state between releases (`missions/`, `profiles/`, `web-search-cache/`, and
`run-history.jsonl` were all added after this repo was created). The enforcement
points are `.gitignore` and the skip-list in `scripts/sync.sh`; see
[`.gitignore` Parity](#gitignore-parity) for how they relate, and note that they
are **not** currently in parity.

---

## Decision Tree For A New File

1. **Is it a secret?** → `~/.pi/agent/auth.json`. Never in the repo. If a bundle
   needs a credential, commit an `auth.example.json` under
   `optional/<name>/` and document it in that bundle's README.

2. **Does Pi write it at runtime?** → ignored, and it must be added to
   `.gitignore` explicitly (see the parity note below).

3. **Is it per-machine state derived from tracked inputs?** → generated. Do not
   commit it and do not symlink it. Add a render step rather than a file.

4. **Should it exist on every machine?** → `pi-agent/` (symlinked resource) or
   `pi-agent/settings.core.json` (a setting) or `settings.core.json` `packages`
   (a plugin).

5. **Is it opt-in per machine?** → `optional/<name>/`.

6. **Is it fetched from somewhere else?** → an entry in `skills.json`. Do not
   vendor it.

7. **Is it an explanation of any of the above?** → `README.md` for the store as a
   whole, `optional/<name>/README.md` for a bundle, or this spec tree for
   contributor-facing conventions.

---

## `settings.json` Is Generated, Never A Symlink

`~/.pi/agent/settings.json` is the composition of core settings plus the enabled
optional manifests for *that machine*. It is therefore never tracked and never a
symlink — and `setup.sh` actively undoes a symlink if it finds one:

```bash
if [ -L "$PI_DST/settings.json" ]; then
  rm "$PI_DST/settings.json"
  say unlink "$PI_DST/settings.json (now generated)"
fi
```

`doctor.sh` treats a symlinked `settings.json` as a hard failure, and a drifted
one as a hard failure too. The direction of truth is always:

```
pi-agent/settings.core.json + enabled optional manifests  ──render──▶  ~/.pi/agent/settings.json
                                        ▲                                          │
                                        └──────────────sync (strips optionals)─────┘
```

- **`./setup.sh`** renders repo → live. It writes a
  `settings.json.pre-render-<YYYYMMDDHHMMSS>` backup first if the file existed.
- **`./scripts/sync.sh`** folds live → repo, stripping everything contributed by
  an enabled optional so per-machine choices do not leak into core, and dropping
  `lastChangelogVersion` (owned by Pi).

Run `scripts/sync.sh` **before** `setup.sh` if you changed settings inside Pi,
otherwise the render overwrites them. `doctor.sh` flags the resulting drift.

### Enabling-set precedence

`render-settings.mjs` resolves the enabled optional set in this order:

1. explicit `--with NAME` / `--none` flags
2. the saved `~/.pi/agent/.pi-setup-state.json`
3. inferred from the live `settings.json`: an optional is considered enabled when
   **every** package in its manifest is already present

Step 3 exists for the adopt-on-an-existing-machine case and logs
`infer  enabled from existing settings: …`. It only fires when no state file
exists, so once `setup.sh` has run, the state file is authoritative.

---

## `.gitignore` Parity

`.gitignore` is the enforcement point for the "ignored" surface, and it is
hand-maintained. The list is grouped by intent and commented — keep the grouping
when adding to it, and keep the comments accurate (the one above
`pi-agent/settings.json` names `./setup.sh`, the entry point that renders it via
`scripts/render-settings.mjs`).

Two lists must be kept in sync whenever Pi starts writing a new runtime
directory:

- `.gitignore` — so it cannot be committed.
- The `for f in auth.json models-store.json …` skip-list in `scripts/sync.sh` —
  cosmetic only, since `sync.sh` copies specific `PI_DIRS`/`PI_FILES` rather than
  the whole directory, but the report is how a user learns the path is
  intentionally not synced.

Because `sync.sh` enumerates rather than globs, a path missing from either list
is never wrongly copied — but if it is missing from `.gitignore` it becomes
committable, and if it is missing from the skip-list the "Managed elsewhere (not
synced)" report goes silently incomplete. Add a new runtime path to both lists in
the same commit.

### Common Mistake: assuming the two lists have parity

They do not, and neither does the `README.md` table. Measured 2026-09-13:

| Path | `.gitignore` | `sync.sh` skip-list | `README.md` table |
|------|--------------|---------------------|-------------------|
| `cache/` | yes | **no** | **no** |
| `trust.json` | **no** | yes | yes |
| `agent-memory/` | **no** | yes | yes |
| all others (`auth.json`, `sessions/`, `npm/`, `git/`, `bin/`, `models-store.json`, `missions/`, `profiles/`, `web-search-cache/`, `run-history.jsonl`) | yes | yes | yes |

**Consequence:** the interesting failure is the second row, not the first. A path
absent from `.gitignore` is committable, so `trust.json` — which exists on this
machine — is reported as "intentionally not synced" while git would happily stage
it. `cache/` is the opposite and harmless-but-noisy: ignored by git, absent from
the report.

Nothing is leaking today (neither `trust.json` nor `agent-memory/` is tracked),
and `doctor.sh`'s secret scan would not catch them because they contain no key
patterns. Do not "fix" one list without checking the other two, and do not assume
that a path `sync.sh` reports as skipped is therefore ignored by git.

---

## Intentionally Absent

These are excluded for a reason, documented in `README.md`, and `doctor.sh`
actively checks the important one. Do not add them:

| Path | Why |
|------|-----|
| `~/.pi/agent/auth.json` | Live API keys. `doctor.sh` fails if tracked. |
| `~/.agents/skills/` | Fetched from upstream via `skills.json`; vendoring makes it go stale. |
| `~/.pi/agent/models-store.json`, `models.json` | Model catalog cached from `https://pi.dev/api/models/providers/<id>`. |
| `~/.pi/agent/{missions,profiles,web-search-cache}/`, `~/.pi/agent/run-history.jsonl` | Per-machine runtime state Pi writes: mission state, profiles, search cache, and the run log. Added to the two enforcement lists on 2026-09-13. |
| `~/.pi/agent/cache/` | Pi's scratch cache. Ignored by git but **missing from `sync.sh`'s skip-list** — see the parity note above. |
| `~/.pi/agent/trust.json`, `agent-memory/` | Per-machine trust decisions and accumulated memory. Listed here and reported by `sync.sh`, but **not covered by `.gitignore`** — see the parity note above. |
| `~/.pi/agent/sessions/` | Per-machine conversation history. |
| `~/.pi/agent/npm/`, `git/`, `bin/` | Installed `node_modules`, cloned repos, platform binaries. |
| `~/.pi/agent/trust.json`, `agent-memory/` | Per-machine trust decisions and accumulated memory. |
| `settings.json.bak-*`, `settings.json.pre-render-*` | Backups written by the scripts. |

Package *catalogs* are deliberately not stored — only the package **specs**
(`npm:pi-subagents`, …) are. The catalog is re-fetchable, per-machine, and large.

---

## Anti-Patterns

- **Do not commit `~/.pi/agent/settings.json`** or symlink it. It is per-machine output.
- **Do not symlink a secret or a piece of runtime state.** Symlinking is only for
  the tracked resource directories and `AGENTS.md`.
- **Do not add an npm `@version` pin** to a package spec. Unpinned is the
  documented choice so `pi update --extensions` (run by `setup.sh`) can move
  forward; pinning silently disables updates for that spec.
- **Do not put a setting in both `settings.core.json` and a manifest.** The next
  `sync.sh` deletes it from core.
- **Do not add a seventh resource directory to `PI_DIRS` in `scripts/lib.sh`
  without wiring it into the README layout table (and the other hand-maintained
  sites listed in [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md)).**
- **Do not add JSONC.** Every JSON file here must parse with a strict parser —
  see the permission-policy consequence in [pi-resources.md](./pi-resources.md).

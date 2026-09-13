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
| `~/.pi/agent/{sessions,npm,git,bin,cache}/` | — | **Ignored** | Pi |
| `~/.pi/agent/extensions/*/logs/` | — | **Ignored** | the extension |
| `~/.agents/skills/<name>/` | — | **Fetched from upstream** | `install-skills.mjs` |
| `~/.agents/.pi-setup-skills.json` | — | **Generated, outside repo** | `install-skills.mjs` |
| `~/.pi/agent/settings.json.pre-render-<stamp>` | — | **Ignored backup** | `render-settings.mjs` |
| `<path>.bak-<stamp>` | — | **Ignored backup** | `setup.sh::link()`, `render-settings.mjs` |
| `.pi/`, `.agents/` | — | **Ignored** (Trellis-generated adapters) | `trellis` CLI |

Note that `PI_DIRS` lists six resource directories but only `extensions/` exists
in the repo today. The list is a **whitelist of allowed symlinked resource
directories**, not an inventory — `link()` silently returns when the source does
not exist, so `themes/`, `prompts/`, `tools/`, `skills/`, and `agents/` will be
linked automatically the moment they appear. Creating one of them by hand is a
normal, supported way to add a resource; adding a seventh name is not.

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
when adding to it, and keep the comment accurate (the comment above
`pi-agent/settings.json` still says it is rendered by `scripts/install.sh`, a
script that no longer exists; the real command is `./setup.sh`).

Two lists must be kept in sync whenever Pi starts writing a new runtime
directory:

- `.gitignore` — so it cannot be committed.
- The `for f in auth.json models-store.json …` skip-list in `scripts/sync.sh` —
  cosmetic only, since `sync.sh` copies specific `PI_DIRS`/`PI_FILES` rather than
  the whole directory, but the report is how a user learns the path is
  intentionally not synced.

That second list has already fallen behind: Pi now also writes `missions/`,
`profiles/`, and `run-history.jsonl` under `~/.pi/agent/`, which appear in neither
list. Because `sync.sh` enumerates rather than globs, nothing is wrongly copied —
but the "Managed elsewhere (not synced)" report is incomplete, and none of those
paths is covered by `.gitignore`. Add them to `.gitignore` in the same commit if
you ever add one of them to `PI_DIRS`.

---

## Intentionally Absent

These are excluded for a reason, documented in `README.md`, and `doctor.sh`
actively checks the important one. Do not add them:

| Path | Why |
|------|-----|
| `~/.pi/agent/auth.json` | Live API keys. `doctor.sh` fails if tracked. |
| `~/.agents/skills/` | Fetched from upstream via `skills.json`; vendoring makes it go stale. |
| `~/.pi/agent/models-store.json`, `models.json` | Model catalog cached from `https://pi.dev/api/models/providers/<id>`. |
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
- **Do not add a seventh resource directory to `PI_DIRS` without wiring it into
  `.gitignore` and the README layout table.**
- **Do not add JSONC.** Every JSON file here must parse with a strict parser —
  see the permission-policy consequence in [pi-resources.md](./pi-resources.md).

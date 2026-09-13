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
points are `.gitignore` and `PI_NOT_SYNCED` in `scripts/lib.sh`; see
[The `.gitignore` / Skip-List Invariant](#the-gitignore--skip-list-invariant) for
how they relate — they are deliberately **not** identical, and `doctor.sh`
enforces the direction that matters.

---

## Decision Tree For A New File

1. **Is it a secret?** → `~/.pi/agent/auth.json`. Never in the repo. If a bundle
   needs a credential, commit an `auth.example.json` under
   `optional/<name>/` and document it in that bundle's README.

2. **Does Pi write it at runtime?** → ignored, and it must be added to both
   `.gitignore` and `PI_NOT_SYNCED` in `scripts/lib.sh` (see the invariant
   section below).

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

### Per-machine extension config is not symlinked

Some extensions own a settings file under the Pi config dir, named
`~/.pi/agent/<extension>-config.json` (`auto-compact.json`,
`pi-vcc-config.json`). These are **per-machine, untracked**, declared in both
`.gitignore` and `PI_NOT_SYNCED`, and deliberately **not** added to `PI_FILES`.

`PI_FILES` exists for "a repo file that should appear in `~/.pi/agent`", so
symlinking one looks like the consistent choice. It is a trap, for two different
reasons depending on the extension:

- `auto-compact.json` is written with an atomic rename (`writeAutoCompactConfig`
  writes a temp file and `renameSync`s it). `rename(2)` replaces the **symlink
  itself**, not its target, so the first save disconnects the repo copy:
  `doctor.sh` then reports `! … exists but is not linked (run ./setup.sh)`, and
  `setup.sh`'s `link()` moves the real file to `<name>.bak-<stamp>` and re-links
  the repo version — discarding the settings the user just saved, recoverable
  only from the backup.
- `pi-vcc-config.json` is written with a plain `writeFileSync`, which **follows**
  the symlink, so per-machine settings would be written straight into the
  tracked repo file (dirty tree, per-machine state committable).

The resources that do work symlinked (`themes/`, `prompts/`, `AGENTS.md`, …) are
edited by us or by Pi, not rewritten by a runtime config writer. Files rewritten
at runtime must live outside the repo, which is why these two are named
individually in `.gitignore` (no `pi-agent/*-config.json` glob — see the
invariant below) and reported by `sync.sh`.

---

## The `.gitignore` / Skip-List Invariant

`.gitignore` is the enforcement point for the "ignored" surface, and it is
hand-maintained. The list is grouped by intent and commented — keep the grouping
when adding to it, and keep the comments accurate (the one above
`pi-agent/settings.json` names `./setup.sh`, the entry point that renders it via
`scripts/render-settings.mjs`).

Three lists describe machine-local Pi paths, and they answer different questions:

- `.gitignore` — what git may never commit.
- `PI_NOT_SYNCED` in `scripts/lib.sh` — **the single definition** of the paths
  `sync.sh` reports as deliberately not synced. `sync.sh` consumes the array;
  `doctor.sh` checks it. Never re-declare it.
- The `README.md` "What is intentionally *not* stored here" table — prose for the
  user, hand-maintained, not mechanically checked.

The lists are **not** identical, and should not be made identical. The invariant
is one-directional:

> Every path `PI_NOT_SYNCED` reports as not synced must be impossible to commit:
> `PI_NOT_SYNCED ⊆ .gitignore`.

`doctor.sh` enforces it in `==> Ignore coverage (machine-local paths)` and fails
(`bad`, not `warn`) when a reported-skipped path is not ignored. The reverse
direction — a pattern in `.gitignore` that the report does not name — is
undetectable by design and harmless: it is ignored-but-unreported, which is
`cache/`-shaped rather than a leak.

`.gitignore` legitimately covers patterns that are not runtime *paths* (`.pi/`,
`.agents/`, `.idea/`, `*.swp`, `*.log`, `*.bak-*`), and `sync.sh` legitimately
omits `settings.json` and `.pi-setup-state.json`, which it reports earlier in its
own output ("Folding live settings into core"). So do not "fix" a divergence by
copying one list into the other.

Because `sync.sh` enumerates rather than globs, a path missing from the report is
never wrongly copied — but if it is missing from `.gitignore` it becomes
committable. When Pi starts writing a new runtime directory, add it to
`PI_NOT_SYNCED` **and** `.gitignore` in the same commit; the `doctor.sh` check is
there to catch the half you forget.

### Common Mistake: assuming the two lists have parity

They do not, and that is fine — the one-directional invariant above is what
matters. The three lists were reconciled on 2026-09-13. The divergence found
before the fix:

| Path | `.gitignore` (before) | `PI_NOT_SYNCED` (before) | Resolution |
|------|-----------------------|--------------------------|------------|
| `cache/` | yes | **no** | added to `PI_NOT_SYNCED` |
| `trust.json` | **no** | yes | added to `.gitignore` |
| `agent-memory/` | **no** | yes | added to `.gitignore` |

The interesting failure was the second row, not the first: `~/.pi/agent/trust.json`
exists on this machine, so `sync.sh` told the user it was deliberately not synced
while git would happily stage it. `doctor.sh`'s secret scan would not have caught
it — a trust file contains no key-shaped string. It is now impossible to commit,
and the new `bad` check fails if that regresses.

**`git check-ignore` is slash-sensitive**, and this is the non-obvious part of
enforcing the invariant. Measured in this repo:

```
pi-agent/sessions        not ignored (exit 1)     # .gitignore has pi-agent/sessions/
pi-agent/sessions/       IGNORED
```

So `PI_NOT_SYNCED` stores directory entries in **canonical slash-form**
(`sessions/`, `npm/`, `git/`, `bin/`, `cache/`, `agent-memory/`, `missions/`,
`profiles/`, `web-search-cache/`) and `doctor.sh` checks the exact string. A
directory entry that loses its trailing slash makes the check fail, and the
failure message says so. Do not "fix" that by loosening the check to accept
either form — the slash is what git keys on.

The check also catches a path that became tracked *despite* a matching rule:
`git check-ignore` consults the index by default, so a force-added file
(`git add -f pi-agent/trust.json`) is reported as **not ignored**. That is
intended — ignored-and-tracked is exactly the state the invariant forbids — and
it is why the check does not pass `--no-index`.

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
| `~/.pi/agent/cache/` | Pi's scratch cache. Ignored and reported; see the invariant section above. |
| `~/.pi/agent/trust.json`, `agent-memory/` | Per-machine trust decisions and accumulated memory. Ignored and reported; see the invariant section above. |
| `~/.pi/agent/sessions/` | Per-machine conversation history. |
| `~/.pi/agent/npm/`, `git/`, `bin/` | Installed `node_modules`, cloned repos, platform binaries. |
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

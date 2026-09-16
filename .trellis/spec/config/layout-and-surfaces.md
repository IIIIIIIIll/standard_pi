# Layout And Surfaces

> The full map of what is tracked, symlinked, generated, and ignored — and how to place a new file.

---

## The Map

| Repo path | Live location | Surface | Applied by |
| ----------- | --------------- | --------- | ------------ |
| `pi-agent/settings.core.json` | — (input) | Tracked | `render-settings.mjs` reads it |
| `optional/<name>/manifest.json` | — (input) | Tracked | `render-settings.mjs` reads it when enabled |
| `optional/<name>/README.md` | — | Tracked | — |
| `optional/<name>/auth.example.json` | — | Tracked | copied by the user into `auth.json` |
| `skills.json` | — (input) | Tracked | `install-skills.mjs` reads it |
| `pi-agent/AGENTS.md` | `~/.pi/agent/AGENTS.md` | Symlinked | `setup.sh` |
| `pi-agent/i-have-adhd.json` | `~/.pi/agent/i-have-adhd.json` | Symlinked | `setup.sh` |
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
| `~/.agents/skills/.skill-lock.json` | — | **Ignored, outside repo** (Pi's skill-selection lock, written in the fetched-skills dir) | Pi — no repo script reads it and no path list names it |
| `~/.config/mcp/mcp.json` | — | **Generated, outside repo** | `scripts/install-mcp.sh` |
| `~/.local/bin/{codebase-memory-mcp,install.sh}` | — | **Ignored, outside repo** | upstream `install.sh` |
| PATH line appended to a shell startup file — `~/.bashrc` here, `~/.profile` on a fresh 2026-09-16 install | — | **Ignored, outside repo** | upstream `install.sh`; the target file varies by installer version |
| `~/.cache/codebase-memory-mcp/` | — | **Ignored, outside repo** | the binary (its own log dir) |
| `~/.pi/agent/{auto-compact.json,pi-vcc-config.json,web-search.json,mcp-cache.json}` | — | **Ignored** | the owning extension |
| `~/.pi/agent/settings.json.pre-render-<stamp>` | — | **Ignored backup** | `render-settings.mjs` |
| `<file>.bak-<stamp>` — nothing prunes backups, so `sol-pi.json.bak-*` outlives the `SoL-Pi` resource dropped in `741fff4` | — | **Ignored backup** | `setup.sh::link()`, `register-mcp-server.mjs` |
| `.pi/`, `.agents/` | — | **Ignored** (Trellis-generated adapters) | `trellis` CLI, restored by `scripts/install-trellis.sh` |
| `.trellis/.developer` | — | **Ignored** by `.trellis/.gitignore`; the `name=` line is **written** by `scripts/install-trellis.sh` | `trellis` CLI |
| `.trellis/.template-hashes.json` | — | **Tracked**, but rewritten by `trellis init`; restored to its pre-run bytes by `scripts/install-trellis.sh` | `trellis` CLI |
| `docs/` | — | **Tracked prose** | — (read directly; never symlinked) |

Note that `PI_DIRS` lists six resource directories but only `extensions/` exists
in the repo today. The list is defined once, in `scripts/lib.sh`, and is a
**whitelist of allowed symlinked resource directories**, not an inventory —
`link()` silently returns when the source does not exist, so `themes/`,
`prompts/`, `tools/`, `skills/`, and `agents/` will be linked automatically the
moment they appear. Creating one of them by hand is a normal, supported way to add
a resource; adding a seventh name to `scripts/lib.sh` is not.

`PI_FILES` is the same mechanism for *files* rather than directories, and is
today `AGENTS.md` + `i-have-adhd.json` (`pi-agent/AGENTS.md` does not exist, so
only the latter links). Note that `i-have-adhd.json` sits in the agent dir next
to files that are deliberately **ignored** — that contrast is intentional and
argued in [The exception](#the-exception-a-read-only-extension-config-is-symlinked)
below.

The **Ignored** rows above are illustrative, not exhaustive — Pi adds runtime
state between releases (`missions/`, `profiles/`, `web-search-cache/`, and
`run-history.jsonl` were all added after this repo was created). The enforcement
points are `.gitignore` and `PI_NOT_SYNCED` in `scripts/lib.sh`; see
[The `.gitignore` / Skip-List Invariant](#the-gitignore--skip-list-invariant) for
how they relate — they are deliberately **not** identical, and `doctor.sh`
enforces the direction that matters.

`~/.config/mcp/mcp.json` is the second **Generated, outside repo** row, and it is
outside on the same terms as `~/.agents/.pi-setup-skills.json`: the file does not
live under `PI_DST`, so it takes no `PI_DIRS` / `PI_FILES` entry; the
`PI_NOT_SYNCED` entries are checked as `pi-agent/<name>`, so a path outside the
repo cannot be expressed there at all; and there is no repo path for `.gitignore`
to cover. The repo stores the *instruction* to register the server (one line in
`scripts/install-mcp.sh`) rather than the file — see
[pi-resources.md](./pi-resources.md#the-global-mcp-config). Its path in
`scripts/lib.sh` follows the reader's resolution, not the XDG standard; that
section explains why.

---

### The Trellis surfaces are generated, and `trellis update` will not restore them

`.pi/` and `.agents/` hold what the `trellis` CLI generates for the Pi platform: the
Trellis extension, the three role agents `pi-subagents` discovers, the `/trellis-*`
prompt commands, and the bundled `trellis-*` skills. Both paths are gitignored, and
`.gitignore` says why — Trellis tracks its own output in
`.trellis/.template-hashes.json`, so a committed copy would conflict on every
`trellis update`.

The consequence is easy to miss, and is the reason `scripts/install-trellis.sh`
exists:

> **A fresh clone has none of those files, and `trellis update` cannot put them
> back.**

Measured on `73cb810` with `@mindfoldhq/trellis@0.7.0-beta.4`,
`trellis update --dry-run` lists every one of them under

```text
  Deleted by you (preserved):
```

— it reads each absent file as a deletion *you* made — and then exits
`✓ Already up to date!`. `--force` does not override the classification. `trellis
init` is the only command that writes them back, so the script runs
`trellis init --pi -y -s` and then removes exactly what that call also creates:
`.trellis/spec/{backend,frontend}/`, a `.trellis/tasks/00-join-*` task, and a
duplicate `.trellis/workspace/<git-user-name>/`. It also restores
`.trellis/.template-hashes.json`, because `trellis init` drops the `AGENTS.md`
hash entry that keeps `trellis update` managing that file.

Its prune rule is a before/after comparison, not a name blocklist: a directory
under `.trellis/{spec,tasks,workspace}/` is removed only if it did not exist before
that script's own `trellis init` call. **Tracked content therefore cannot be a
prune candidate** — it always appears in the "before" list.

Three rules follow for this surface:

- **Do not commit `.pi/` or `.agents/`.** Un-ignoring them trades one repair step
  for a permanent conflict on every `trellis update`.
- **Do not call `trellis update` to repair a clone.** It reports success and
  changes nothing.
- **Do not hand-write** `.pi/settings.json` or the role agents. They are CLI
  output; a hand-written copy starts drifting from whatever the installed CLI
  emits, and the version it came from is not recorded anywhere.

`doctor.sh`'s `==> Trellis adapters` section is what fails when neither
`./setup.sh` nor the script ran — and it only fails as a `bad` when the `trellis`
CLI is on `PATH`, because a machine without it cannot apply the fix at all.

---

## Decision Tree For A New File

1. **Is it a secret?** → `~/.pi/agent/auth.json`. Never in the repo. If a bundle
   needs a credential, commit an `auth.example.json` under
   `optional/<name>/` and document it in that bundle's README.

2. **Does the extension write it at runtime?** → ignored, and it must be added to
   both `.gitignore` and `PI_NOT_SYNCED` in `scripts/lib.sh` (see the invariant
   section below). "Owned by an extension" is **not** the test — an extension
   config that is only ever read is tracked and symlinked instead; compare
   [`i-have-adhd.json`](#the-exception-a-read-only-extension-config-is-symlinked)
   against `auto-compact.json`.

   A fourth shape sits outside the Pi config dir entirely:
   `.trellis/.developer` is **derived state written by a script** —
   `scripts/install-trellis.sh` reconciles its `name=` line to `id -un` — and is
   ignored by `.trellis/.gitignore` rather than this repo's. It is neither
   symlinked nor rendered, so it belongs in neither `PI_FILES` nor
   `PI_NOT_SYNCED`: those lists are about `$PI_DST`, which is `~/.pi/agent`.

3. **Is it per-machine state derived from tracked inputs?** → generated. Do not
   commit it and do not symlink it. Add a render step rather than a file.

4. **Should it exist on every machine?** → `pi-agent/` (symlinked resource) or
   `pi-agent/settings.core.json` (a setting) or `settings.core.json` `packages`
   (a plugin).

5. **Is it opt-in per machine?** → `optional/<name>/`.

6. **Is it fetched from somewhere else?** → an entry in `skills.json`. Do not
   vendor it.

7. **Is it an explanation of any of the above?** → `README.md` for the store as a
   whole, `docs/` for how to *use* what is installed (one entry per plugin, skill,
   and role agent), `optional/<name>/README.md` for a bundle, or this spec tree for
   contributor-facing conventions. `docs/` is tracked prose read in place: it is
   **not** a Pi surface, so it never enters `PI_DIRS`/`PI_FILES` and is never
   symlinked into `~/.pi/agent`. Membership is checked by
   `scripts/check-docs.mjs` — see
   [pi-resources.md](./pi-resources.md#the-docs-coverage-check).

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

### `packages` Order Is Not Drift

`packages` is a **set**, not a sequence. Two arrays with the same members in a
different order are equal, and no reader — `doctor.sh`, `sync-settings.mjs`, or a
human — may depend on the position of an entry. Two writers legitimately
disagree about the order:

- **Emission is canonical.** `render-settings.mjs` clones `settings.core.json`
  and then appends each enabled optional's packages, so a rendered array is
  always *core members first, then the optionals' members, each in its manifest's
  own order*. That is the order `./setup.sh` writes.
- **`pi install` appends.** It does not choose a position, so a package installed
  while an optional bundle is enabled lands *after* that bundle's package. With
  `opencode-go` enabled and `pi-tps-status` installed afterwards, live reads
  `… pi-lens, pi-opencode-go, pi-tps-status` while the render is
  `… pi-lens, pi-tps-status, pi-opencode-go`.
- **`sync-settings.mjs` inherits the live order** of whatever is left after the
  enabled optionals' packages are stripped, so `settings.core.json` itself is not
  order-canonical either. Do not hand-reorder it to "fix" that.

So `--check` compares `packages` as a set: `render-settings.mjs` sorts a copy of
both sides before comparing, and a set-equal pair is not drift. The
normalisation is that one function (`canonical()`), scoped to the literal key
`packages` — not to "all arrays" — and everything else stays as strict as it was:

- A **membership** difference still drifts: a missing spec and an extra spec both
  exit `1`.
- A **duplicate** is a real defect rather than reordering, so the sort preserves
  duplicates and `["a", "a", "b"]` still differs from the deduplicated render's
  `["a", "b"]`.
- **Every other key** — its value, its presence, and the key order — is compared
  exactly as serialised, and a mismatch still exits `1`.
- `--check` still writes nothing, including the state file, and a missing or
  unparseable live file is still drift.
- The **write** path is untouched: `./setup.sh` still treats a reordered file as
  a change and re-renders it into canonical order, so emission stays canonical
  even though the check tolerates the other order.

One accepted side effect: because the check compares parsed values, a
**reformatted** (whitespace-only) live file is no longer drift. That is
desirable — the two files are semantically identical — and it does not weaken the
check into "compares nothing", because JSONC still fails (`JSON.parse` rejects
it) and every key and value is still compared.

Verify offline — no network, no `pi`:

```bash
# set-equal `packages` in a different order → `ok`, exit 0
node scripts/render-settings.mjs . <live-with-reordered-packages> <state> --check
# a missing, extra, or duplicated spec, or any other key changed → `drift`, exit 1
```

### Per-machine extension config is not symlinked

Some extensions own a settings file under the Pi config dir, named
`~/.pi/agent/<extension>-config.json` (`auto-compact.json`,
`pi-vcc-config.json`), or a differently-named one of their own (`web-search.json`,
owned by `pi-web-access`). These are **per-machine, untracked**, declared in both
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
- `pi-vcc-config.json` and `web-search.json` are written with a plain
  `writeFileSync` (`pi-web-access` does this in its `index.ts`), which **follows**
  the symlink, so per-machine settings would be written straight into the
  tracked repo file (dirty tree, per-machine state committable). For
  `web-search.json` that is worse than a dirty tree: the package documents the
  file as a credential store — it holds API keys for the search providers — so a
  symlinked or committed copy leaks secrets that `doctor.sh`'s shape-based scan
  will not reliably catch.

The `web-search.json` trap is also a reminder that this category is not closed: a
new package can start owning a file in the agent dir at any time, and
`doctor.sh` only knows the names this list declares. Adding one is a two-file
change, never just the ignore rule.

The resources that do work symlinked (`themes/`, `prompts/`, `AGENTS.md`,
`i-have-adhd.json`, …) are edited by us or by Pi, not rewritten by a runtime
config writer. Files rewritten at runtime must live outside the repo, which is
why these are named individually in `.gitignore` (no `pi-agent/*-config.json`
glob — see the invariant below) and reported by `sync.sh`.

### The exception: a read-only extension config *is* symlinked

`~/.pi/agent/i-have-adhd.json`, owned by the `i-have-adhd` package
(`https://github.com/ayghri/i-have-adhd`) is in that same directory and is
**tracked and symlinked**: it is in `PI_FILES`, it is in neither `.gitignore` nor
`PI_NOT_SYNCED`, and `setup.sh` links `pi-agent/i-have-adhd.json` into place.

That is not an inconsistency, because the rule above is mechanical rather than
"anything under the agent dir is per-machine". Measured against the package's
`extensions/i-have-adhd.ts`: the config is read once at startup with
`readFileSync` and the extension contains **no write call at all** — no
`writeFileSync`, no `appendFile`, no `renameSync`, no `mkdirSync`. A session
toggle goes through `pi.appendEntry` into the session history, never into this
file. So neither trap applies, and the two keys (`alwaysOn`, `hideStatus`) are
portable intent rather than machine state — exactly the kind of thing the repo
exists to reproduce with `./setup.sh`.

The failure mode to watch is a package *update*: if upstream ever gains a config
command that writes the file, this flips into the `pi-vcc` case (a
`writeFileSync` follows the symlink and writes per-machine state straight into
the tracked file, `doctor.sh` then reports drift). Before trusting the symlink,
re-measure the package:

```bash
# installed git-spec packages live under ~/.pi/agent/git/<host>/<owner>/<repo>/
grep -rn "writeFileSync\|appendFile\|renameSync\|mkdirSync" \
  "$HOME/.pi/agent/git/github.com/ayghri/i-have-adhd/extensions"
```

So classify an extension config by its **write behaviour**, not by its location.
A read-only one belongs in `PI_FILES`; a rewritten one belongs in `PI_NOT_SYNCED`
**and** `.gitignore`.

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
| ------ | ----------------------- | -------------------------- | ------------ |
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
| ------ | ----- |
| `~/.pi/agent/auth.json` | Live API keys. `doctor.sh` fails if tracked. |
| `~/.agents/skills/` | Fetched from upstream via `skills.json`; vendoring makes it go stale. |
| `~/.pi/agent/models-store.json`, `models.json` | Model catalog cached from `https://pi.dev/api/models/providers/<id>`. |
| `~/.pi/agent/{missions,profiles,web-search-cache}/`, `~/.pi/agent/run-history.jsonl` | Per-machine runtime state Pi writes: mission state, profiles, search cache, and the run log. Added to the two enforcement lists on 2026-09-13. |
| `~/.pi/agent/cache/` | Pi's scratch cache. Ignored and reported; see the invariant section above. |
| `~/.pi/agent/trust.json`, `agent-memory/` | Per-machine trust decisions and accumulated memory. Ignored and reported; see the invariant section above. |
| `~/.pi/agent/auto-compact.json`, `pi-vcc-config.json`, `web-search.json`, `mcp-cache.json` | Extension-owned per-machine config, rewritten at runtime. `web-search.json` is `pi-web-access`'s provider/proxy/credential store — committing it leaks keys. `mcp-cache.json` is `pi-mcp-adapter`'s cache of each registered server's tool schemas and instructions: remote content, not a credential. Ignored and reported; see the invariant section above. |
| `~/.pi/agent/sessions/` | Per-machine conversation history. |
| `~/.pi/agent/npm/`, `git/`, `bin/` | Installed `node_modules`, cloned repos, platform binaries. |
| `<file>.bak-*`, `settings.json.pre-render-*` | Backups written by the scripts; never pruned. |

Package *catalogs* are deliberately not stored — only the package **specs**
(`npm:pi-subagents`, …) are. The catalog is re-fetchable, per-machine, and large.

---

## Anti-Patterns

- **Do not commit `~/.pi/agent/settings.json`** or symlink it. It is per-machine output.
- **Do not symlink a secret or a piece of runtime state.** Symlinking is only for
  the tracked resource directories, `AGENTS.md`, and a config file that its owner
  only ever *reads* (`i-have-adhd.json` — see
  [The exception](#the-exception-a-read-only-extension-config-is-symlinked)).
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

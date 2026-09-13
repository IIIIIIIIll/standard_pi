# Optional Bundles

> The `optional/<name>/` contract: what a bundle is, how it is enabled per machine, and what it must provide.

---

## Model

An optional bundle is a named, **per-machine** opt-in. It contributes packages
and settings to `~/.pi/agent/settings.json` on machines where it is enabled, and
nothing anywhere else. The choice is a machine fact, so it is recorded outside
the repo.

```
optional/<name>/manifest.json  ──enabled here?──▶  ~/.pi/agent/settings.json
        (tracked)                    │
                                     └─ recorded in ~/.pi/agent/.pi-setup-state.json (gitignored)
```

Existing bundles:

| Bundle | Status | Notes |
|--------|--------|-------|
| `optional/opencode-go/` | real bundle | OpenCode Zen Go plan: status bar + `/go-usage`, `/go-status`; sets `defaultProvider`/`defaultModel` |
| `optional/_template/` | scaffold | Ignored by all tooling because of the `_` prefix |

---

## The `_` Prefix Convention

Any directory under `optional/` starting with `_` is invisible to every discovery
path. This is implemented in three places that must agree:

```bash
# scripts/optional.sh :: names()
find "$OPT_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_*' \
  -exec test -f '{}/manifest.json' \; -print | xargs -r -n1 basename | sort
```

```js
// scripts/render-settings.mjs :: listOptionals()
fs.readdirSync(optionalDir)
  .filter((n) => !n.startsWith("_") && fs.existsSync(path.join(optionalDir, n, "manifest.json")))
```

`doctor.sh` uses the same `case "$name" in _*) continue ;; esac` guard.
A directory is only a bundle if it has a `manifest.json`, so a stray or
half-created directory is skipped rather than breaking the tooling.

---

## `manifest.json` Contract

```json
{
  "name": "opencode-go",
  "description": "OpenCode Zen Go plan — usage status bar plus rolling 5h / weekly / monthly quota commands.",
  "packages": [
    "npm:@oscarfalero/pi-opencode-go"
  ],
  "settings": {
    "defaultProvider": "opencode-go",
    "defaultModel": "deepseek-v4.1-flash"
  }
}
```

| Key | Required | Rules |
|-----|----------|-------|
| `name` | yes | Must equal the directory name. `optional.sh scaffold` rewrites it for you; nothing validates it at runtime. |
| `description` | yes | One line. Printed by `optional.sh list` and used as the prompt text during interactive `setup.sh`. An empty description renders as a blank prompt. |
| `packages` | yes | Package specs in `pi install` syntax (`npm:`, `git:`, or a path). **Unpinned** — no `@version` — so `pi update --extensions` can advance them. |
| `settings` | yes | Flat settings keys applied via `Object.assign`, i.e. they **override** core settings while enabled. Use `{}` when the bundle only adds packages. |

Strict JSON only: no comments, no trailing commas. `readJson` throws on a
trailing comma and `setup.sh` would abort mid-render.

### The `settings` / `settings.core.json` Non-Overlap Rule

`render-settings.mjs` merges manifest settings over core; `sync-settings.mjs`
deletes them from core again:

```js
// sync-settings.mjs — strip everything an enabled optional contributes
for (const key of Object.keys(manifest.settings ?? {})) delete out[key];
```

So if a key is present in both, it renders from the manifest and is then removed
from `settings.core.json` on the next `sync.sh` — the core value is lost with no
error. Keep every settings key in exactly one place. `defaultProvider` /
`defaultModel` live only in `optional/opencode-go/manifest.json` precisely
because disabling the bundle should restore whatever core defines.

Packages are deduplicated by exact string equality (`JSON.stringify`), so a
manifest may re-list a package that is already in core without producing a
duplicate entry — but it should not; adding the package to core is the correct
move once two bundles want it.

---

## Files A Bundle Must Ship

| File | Required | Purpose |
|------|----------|---------|
| `manifest.json` | yes | the contract above |
| `README.md` | yes | when to enable it, the exact enable/disable commands, credentials, and what it adds |
| `auth.example.json` | for bundles needing credentials | a copyable shape with placeholder values only |

`optional.sh scaffold <name>` creates **only** `optional/<name>/manifest.json`.
The `README.md` is written by hand. Use `optional/opencode-go/README.md` as the
model: it states the subscription prerequisite, the enable command, the rendered
effect (package + setting keys), the `auth.json` shape with `chmod 600`, and the
disable command including the optional `pi remove <package>`.

A credential's placeholder goes in `auth.example.json`; the real value only ever
goes in `~/.pi/agent/auth.json`. `doctor.sh`'s secret scan exempts files matching
`example`.

---

## Lifecycle Commands

```bash
scripts/optional.sh list                     # [*] = enabled here
scripts/optional.sh enable   <name> [<name>…]
scripts/optional.sh disable  <name> [<name>…]
scripts/optional.sh scaffold <name>
./setup.sh --with <name>                     # one-shot: exactly this set
./setup.sh --none                            # one-shot: no bundles
```

Semantics to preserve:

- **`enable` unions, `disable` subtracts.** Both recompute the full enabled list
  from the current state, then re-render with `--with` for each remaining name
  (or `--none`). Neither is a toggle of the whole set, so multiple names are safe
  in one invocation.
- **Unknown names are rejected before any render.** `require_known` refuses to
  render with a name that has no manifest, printing the known set.
- **`disable` does not uninstall.** Files stay on disk; the command says so and
  points at `pi remove <package>`. Deleting files behind Pi's back is worse than
  leaving them.
- **Rendering is the only side effect.** `enable`/`disable` rewrite
  `settings.json` and the state file; they do not run `pi install`. Pi installs
  missing packages on its next start, which the command's output states.

State file shape — the only record of what is enabled on this machine:

```json
{
  "optionals": [
    "opencode-go"
  ]
}
```

It is written by `render-settings.mjs` (including when nothing changed) and is
`.gitignore`d as `pi-agent/.pi-setup-state.json`. Any command that renders
without an explicit selection keeps the saved set, so the state file is the
source of truth once it exists.

---

## Adding A Bundle — Checklist

- [ ] `scripts/optional.sh scaffold <name>` then edit `manifest.json`
      (`name` is already set; fill `description`, `packages`, `settings`).
- [ ] Write `optional/<name>/README.md` following the `opencode-go` shape.
- [ ] Add `auth.example.json` if the bundle needs a credential, and document the
      `chmod 600` step.
- [ ] Confirm no key in `settings` already exists in `pi-agent/settings.core.json`.
- [ ] Enable it here and verify: `scripts/optional.sh enable <name>` then
      `git diff pi-agent/settings.core.json` — the diff must be **empty**, because
      the contribution belongs to the manifest, not to core.
- [ ] Run `./scripts/doctor.sh`; the bundle must appear as `(enabled)`.
- [ ] Add a row to the optional-bundle table in `README.md`.

---

## Anti-Patterns

- **Do not add a bundle to a tracked settings file.** Per-machine is the whole point.
- **Do not put `defaultProvider`/`defaultModel` in core and also in a manifest.**
- **Do not pin a package version** in `packages`.
- **Do not commit the state file.** It is one machine's choice and would leak
  between machines.
- **Do not write a real credential into `auth.example.json`**, and do not name a
  file containing a placeholder anything other than `*example*` — the secret scan
  only exempts paths matching `example`.
- **Do not rely on `scaffold` to create the README.** It creates the manifest only.
- **Do not delete the `_` prefix from `_template`.** It would immediately become a
  real, enable-able bundle offering `npm:REPLACE_ME`.

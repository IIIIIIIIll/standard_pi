# Pi extensions (global auto-discovery)

`~/.pi/agent/extensions/` is Pi's global, hand-placed extension directory —
auto-discovered for every project and hot-reloadable with `/reload`.

`setup.sh` symlinks it to this directory, so anything added here is versioned
with the rest of the harness.

## Layout

| Path | What it is |
|------|------------|
| `<name>.ts` | A single-file extension |
| `<name>/index.ts` | A multi-file extension |
| `<name>/config.json` | Conventional per-extension config the extension reads |

Installed Pi *packages* (`pi install …`) do **not** live here — they go to
`~/.pi/agent/npm/` or `~/.pi/agent/git/`, and are tracked by package spec in
`settings.core.json` (always-on) or `optional/<name>/manifest.json`.
This directory is only for extensions placed by hand **and** for the handful of
packages that read their config from under here.

## Permission policy

[`@gotgenes/pi-permission-system`](https://github.com/gotgenes/pi-permission-system)
is npm-installed but reads its policy from
`extensions/pi-permission-system/config.json`:

```jsonc
{
  "permission": {
    "*": "ask",
    "path": { "*.env": "deny", "*.env.example": "allow" },
    "bash": { "*": "ask", "rm -rf *": "deny" }
  }
}
```

Every rule resolves to one of three states:

| State | Behavior |
|-------|----------|
| `allow` | Permits the action silently |
| `ask` | Prompts for confirmation (forwarded to the parent session from a headless subagent) |
| `deny` | Blocks the action with an error |

If no config file exists the package uses its built-in defaults. The package's
own `config/config.example.json` is a deliberately **strict sample**, not the
default — copy it only after deciding each rule, or you will deny `write`,
`edit`, and `npm` wholesale.

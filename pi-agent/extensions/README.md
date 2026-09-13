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
is npm-installed but reads its policy from `extensions/pi-permission-system/config.json`
— which is why the policy is committed here and travels with the rest of the harness.

The committed policy is **permissive on purpose**:

```json
{
  "permission": {
    "*": "allow",
    "path": { "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
    "bash": { "rm -rf *": "deny" },
    "external_directory": "ask"
  }
}
```

Pi itself has **no permission prompts** — it runs tools with your full user
permissions. This extension is the only gate, so `"*": "allow"` means "stop
gating everything, keep only the few rules below". What survives is the part
that matters: the `path` deny and the `rm -rf` deny are enforced *unconditionally*,
including when the extension's own `yoloMode` is on.

### The least-privilege trap

The package's built-in default is deliberate: **omitting `"*"` means `ask` for
everything**, and its docs describe the default as least privilege. So a missing
config file is not "no policy" — it is "interrupt the user on every single tool
call". That is the failure mode this file exists to prevent.

The same trap fires on a malformed file: *any* parse failure falls back to `ask`
for all categories, and a config that fails validation clamps every `allow` up to
`ask` (deny-preserving). This file is therefore **strict JSON** — no comments, no
trailing commas. Don't "tidy" it into JSONC.

### States

| State | Behavior |
|-------|----------|
| `allow` | Permits the action silently |
| `ask` | Prompts for confirmation (forwarded to the parent session from a headless subagent) |
| `deny` | Blocks the action with an error, naming the rule that decided |

Four layers compose with **most-restrictive-wins**: `path` (cross-cutting) →
`external_directory` (CWD boundary) → per-tool patterns → `bash` patterns. A
`path` deny cannot be loosened by a per-tool `allow`; patterns match both the
referenced path and its symlink-resolved form, so a deny can't be evaded through
a symlink alias.

### Tuning the remaining prompts

`external_directory: "ask"` is the one rule that still prompts, and it fires for
anything outside the working directory — including Pi's own infrastructure, which
the agent touches constantly. If it gets noisy, allow reads outside CWD while
still gating writes (precedence keeps `path` denials on top):

```json
{
  "permission": {
    "external_directory": { "*": "ask" },
    "external_directory_read": { "*": "allow" }
  }
}
```

Or name specific directories to auto-allow for reads via `piInfrastructureReadPaths`.
Note that a broad read allowance is *more* permissive than the extension's
conservative default — but never more permissive than stock Pi, which gates nothing.

### Logs

The extension writes its review log to `extensions/pi-permission-system/logs/`,
which is `.gitignore`d — the log records bash command strings unredacted, so it
is machine-local by design.

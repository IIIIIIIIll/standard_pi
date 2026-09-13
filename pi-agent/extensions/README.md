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

## Trellis subagents bridge

`trellis-subagents-bridge/` makes `pi-subagents` children resolve their parent's
active Trellis task.

`pi-subagents` already finds the role agents in `.pi/agents/`, but a dispatched
child runs as its own Pi session — and the generated Trellis extension resolves
the active task from `.trellis/.runtime/sessions/<key>.json`, where the key comes
from the **child's** session id. Left alone, the child is told `Status: no_task`
and `task.py current` exits 1.

The bridge fixes that by correcting the *value* rather than patching each of its
consequences: the parent publishes its context key, and the child writes a
runtime session pointer under its own key. The generated extension then resolves
the real task through its normal path — correct breadcrumb, correct injected
context, and a bash key that resolves — with nothing stripped or rewritten.

It also **deactivates the shipped `trellis_subagent` tool** with
`pi.setActiveTools(...)`, so pi-subagents is the only dispatch path and the
shipped tool's competing prompt guidance is not injected (Pi includes a tool's
guidelines only while it is active). The generated extension is deliberately not
edited: `.pi/` is gitignored and template-hash tracked, so a patch there would be
machine-local, unreproducible, and reverted by `trellis update`.

Because it is global, it is careful about scope: outside a `.trellis/` project,
or with no active task, it publishes nothing, injects nothing, and writes no file.

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
    "external_directory": { "*": "ask", "/tmp/*": "allow" },
    "external_directory_read": { "*": "allow" }
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

### The outside-CWD boundary

`external_directory` is the only surface still under policy, and it is split by
direction rather than left as a single `ask`:

```json
{
  "permission": {
    "external_directory": { "*": "ask", "/tmp/*": "allow" },
    "external_directory_read": { "*": "allow" }
  }
}
```

Reads outside the working directory no longer prompt: the boundary gate is
answered per direction, and a proven read clears it. The agent reads other
checkouts, caches, and build output constantly, and Pi's own infrastructure
already sits outside the tree — a CWD-boundary prompt on a read is almost never
the decision the user wants to be asked. Writes still `ask`, with one exception:
`/tmp`, so scratch files live where they belong instead of being parked inside
the repo to dodge the gate.

A path whose direction cannot be proven — an opaque command's argument, say —
still consults both directions and so still asks, which is the extension's
fail-closed base case. Nothing here can make an unprovable access silent.

Two details make this compose rather than conflict:

- **Bare `external_directory` is sugar.** It expands into
  `external_directory_read` and `external_directory_write` with its entries
  placed first, so the explicit `external_directory_read` has the final say on
  reads while the sugar map alone decides writes. Collapsing that directional
  key back into a string would put writes behind one undifferentiated `ask`.
- **`/tmp/*`, not a bare `/tmp`.** A trailing `*` is greedy and crosses
  directory boundaries, while a bare directory pattern matches only the
  directory entry itself — which is not the path a tool call carries. The
  single entry is all macOS needs too: `/tmp` resolves to `/private/tmp`, and
  patterns match both the path and its symlink-resolved form.

Nothing here loosens the `path` layer — it is cross-cutting and
most-restrictive-wins, so `*.env` reads and `rm -rf` are denied wherever they
happen.

The extension's own `piInfrastructureReadPaths` auto-discovery is unchanged and
still applies; name extra directories there if a future read needs to be
recognized as infrastructure rather than merely external.

### Logs

The extension writes its review log to `extensions/pi-permission-system/logs/`,
which is `.gitignore`d — the log records bash command strings unredacted, so it
is machine-local by design.

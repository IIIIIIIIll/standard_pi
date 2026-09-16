# Pi extensions (global auto-discovery)

`~/.pi/agent/extensions/` is Pi's global, hand-placed extension directory —
auto-discovered for every project and hot-reloadable with `/reload`.

`setup.sh` symlinks it to this directory, so anything added here is versioned
with the rest of the harness.

## Layout

| Path | What it is |
| ------ | ------------ |
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

It also **supplies the child's task context**, because it makes the child's own
copy of the generated extension inert (the parent sets a child marker the generated
extension returns on at load, the same thing the shipped dispatch tool did for its
children). An inert extension injects nothing, so the child would otherwise lose
the context it receives today. In the child's first `before_agent_start` the bridge
appends, after the constant dispatch note:

- the curated spec/research files of the role that was dispatched — the manifest is
  the task-dir file whose stem is a **suffix** of the agent name the dispatcher
  already passed (a name whose last `-`-separated segment is `check` selects
  `check.jsonl`), falling back to every `*.jsonl`
  in the task directory when nothing was relayed or nothing matches. There is no
  role table here on purpose: the name is relayed, never enumerated;
- the task's `prd.md` → `design.md` → `implement.md`, with a per-artifact cap.

The budget is **read** from `context_injection` in `.trellis/config.yaml` when
that block is uncommented — never restated — so this third consumer cannot drift
from the generated extension's reader and `task.py validate`. That block ships
**commented out** in this repo (`.trellis/config.yaml:158-161`), so today the
bridge's built-ins apply: `DEFAULT_CONTEXT_INJECTION_LIMITS` at
`pi-agent/extensions/trellis-subagents-bridge/index.ts:319-323`, read by
`readContextInjectionLimits()` at `:354-393` — `max_file_bytes` **32768** per
curated file, `max_artifact_bytes` **65536** per artifact, `max_total_bytes`
**131072** for the whole block. A body over its cap is truncated with a notice;
once the total is reached the remaining entries degrade to a path line. A file
whose body is already in the prompt verbatim is skipped, and the block is
appended only when it is not already there, tested whole rather than by a tag.
Nothing is appended outside a child session, and nothing at all when no task
resolves.

It also **deactivates the shipped `trellis_subagent` tool** with
`pi.setActiveTools(...)`, so pi-subagents is the only dispatch path and the
shipped tool's competing prompt guidance is not injected (Pi includes a tool's
guidelines only while it is active). The generated extension is deliberately not
edited: `.pi/` is gitignored and template-hash tracked, so a patch there would be
machine-local, unreproducible, and reverted by `trellis update`.

Because it is global, it is careful about scope: outside a `.trellis/` project,
or with no active task, it publishes nothing, injects nothing, and writes no file.

The child marker is **persistent for the session**, not a window around the
dispatch call: a scheduled run reaches its spawn from a timer with nothing in
flight, and a window would miss it silently. The cost is visible instead — a `pi`
process started from a bash tool in the session inherits the marker, loads with the
generated extension inert, and reports no task.

## Run timer

`run-timer.ts` shows how long the current run has been going. It publishes one
`ctx.ui.setStatus()` line — `⏱ 12s`, `⏱ 1m 05s`, `⏱ 1h 02m` — in the accent
colour while the agent is working, and dim once the run has ended so the finished
value stays on screen until the next run or the next session. Nothing is shown
before the first run of a session.

The value is **wall-clock elapsed time** from `agent_start` to now, ticking once
a second. No session statistic is read or recomputed: this extension counts, and
nothing else. The minutes and seconds are zero-padded (`1m 05s`) so a counting
timer does not change width, and therefore layout, every second.

The status key is `run-timer`, which sorts before `tps`. That ordering matters
because a footer renders the status line by sorting keys, joining them with a
space, and truncating the **whole joined line** — so the leftmost entry is the one
a narrow terminal keeps. The timer is never the thing that gets cut; the TPS
meter loses its tail instead.

It is global, so it stays passive: no config file, no `fs`, nothing persisted.
No path list in `scripts/lib.sh` or `.gitignore` is changed by it.

### The rule for this directory

> **No extension under `pi-agent/extensions/` may call `ctx.ui.setFooter()`.**

Line 2 belongs to Pi core. A replacement footer is a hand-written copy of one,
and a copy goes stale: `npm:pi-timer` used `ctx.ui.setFooter()` to add its timer,
its rebuild pushed `↑ ↓ R W $ ctx%`, and installing that package silently deleted
Pi core's `CH<rate>%` cache-hit segment and its `(sub)` subscription case.
Nothing warned, and no upstream release adds them back.

The package was removed for exactly that reason, and the hand-placed
`cache-hit-rate.ts` — which republished `CH` as a status line to compensate — was
removed with it. Pi core's footer is the only footer again, so `CH` is back
because core prints it, not because anything here recomputes it.

`ctx.ui.setStatus(key, text)` is the composable surface instead: one key per
extension, sorted and joined by whoever owns the footer, withdrawn with
`setStatus(key, undefined)`. Adding a segment to line 2 is an upstream Pi change,
never a local `setFooter()` call.

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
| ------- | ---------- |
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

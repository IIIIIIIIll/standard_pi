# Switch MCP from `pi-mcp-adapter` to Pi's built-in extension

## Goal

MCP (Model Context Protocol) support in this harness should come from Pi's own
built-in `mcp` extension rather than the `npm:pi-mcp-adapter` package. The user
gets native `mcp__<server>__<tool>` tools, Pi's `/mcp` panel, `pi mcp add|list|login`,
OAuth and `mcp.log`, and the repo keeps one consistent story for how the MCP
server (`codebase-memory-mcp`) is registered.

## Background (confirmed facts)

- Pi 1.1.0 ships MCP as a **built-in, replaceable** extension, `builtin:mcp`. It
  registers `/mcp`, so while `pi-mcp-adapter` is installed Pi drops the built-in
  one and warns (`docs/mcp.md:266`, `dist/extensions/index.js`).
- The two are mutually exclusive: only one extension can own `/mcp`. Core
  settings currently carry `"extensions": ["-builtin:mcp"]` (added in commit
  `ec4d473`) precisely to silence that warning, so the adapter is active today.
- Built-in MCP reads Pi's own config only: `~/.pi/agent/mcp.json` (user) and
  `.pi/mcp.json` (project, trusted). It does **not** read
  `~/.config/mcp/mcp.json` (`docs/mcp.md` "Configure servers").
- `codebase-memory-mcp` is currently registered in the shared, machine-global
  `~/.config/mcp/mcp.json` by `scripts/install-mcp.sh` via
  `scripts/register-mcp-server.mjs`, using the adapter-shaped entry
  `{ command, args: [], lifecycle: "lazy" }`.
- Built-in exposure modes are `codemode` (default), `deferred`, `direct`,
  `hidden`; `codemode` auto-activates the `codemode` tool when such a server
  connects (`docs/mcp.md` "Control tool exposure").
- The repo enforces its own documentation and path invariants mechanically:
  `scripts/render-settings.mjs --check` (settings must match core + optionals),
  `scripts/check-docs.mjs` (`docs/plugins.md` headings must equal core
  `packages[]` exactly), and `scripts/doctor.sh` (path lists, `.gitignore`
  pairing, Vault-path hygiene).

## Requirements

- **R1** — Core settings ship built-in MCP: `npm:pi-mcp-adapter` leaves `packages[]`
  and `"extensions": ["-builtin:mcp"]` is removed, so `builtin:mcp` loads.
- **R2** — `codebase-memory-mcp` is registered for Pi in `~/.pi/agent/mcp.json`
  as `{ command: "codebase-memory-mcp", args: [], exposure: "codemode" }`.
- **R3** — `scripts/register-mcp-server.mjs` writes the built-in MCP entry shape
  (no adapter-only `lifecycle` key) and its guards/messages describe Pi's reader,
  not the adapter's.
- **R4** — `scripts/lib.sh` owns the new destination: `MCP_CFG` points at
  `$HOME/.pi/agent/mcp.json`; the `pi-mcp-adapter` commentary goes; the
  machine-local path lists cover `mcp.json` and `mcp.log`.
- **R5** — `scripts/install-mcp.sh` and `scripts/doctor.sh` follow `MCP_CFG`
  (binary install/verification unchanged; the obsolete `XDG_CONFIG_HOME` warning
  goes; the doctor section checks Pi's file).
- **R6** — `.gitignore` drops the `pi-agent/mcp-cache.json` entry and ignores
  `pi-agent/mcp.json` and `pi-agent/mcp.log*`, keeping the doctor-enforced
  `PI_NOT_SYNCED` ↔ `.gitignore` pairing intact.
- **R7** — `docs/plugins.md` loses its `npm:pi-mcp-adapter` section (the plugin no
  longer exists here), and `README.md` describes the built-in flow instead.
- **R8** — The tracked spec matches the new reality: `spec/config/pi-resources.md`
  (package table + MCP section), `spec/config/layout-and-surfaces.md` (path map
  rows), `spec/guides/change-propagation-guide.md` (the MCP-registration change
  sites, which now legitimately include `.gitignore` / `PI_NOT_SYNCED` /
  `~/.pi/agent/mcp.json`), `spec/scripts/shell-guidelines.md` (the `MCP_CFG`
  contract).
- **R9** — The pre-existing `~/.config/mcp/mcp.json` entry is **left untouched**:
  it stays available to every other MCP-aware tool on the machine and is simply no
  longer written by this repo.
- **R10** — No live tracked file mentions the adapter, `mcp-cache.json`,
  `mcpScript`, or `lifecycle: "lazy"` after the change (archives, journal and the
  permission-system log are history and stay).

## Acceptance Criteria

- [ ] **AC1** — Rendered live settings load built-in MCP: a
      `DefaultResourceLoader` probe over `builtInExtensions` lists
      `builtin:mcp` and reports `warnings: []`; `~/.pi/agent/settings.json` has
      no `npm:pi-mcp-adapter` and no `-builtin:mcp`.
- [ ] **AC2** — `pi mcp list` resolves `codebase-memory-mcp` to `connected` (or
      reports only a PATH warning on a shell that has not re-read its profile)
      and lists the server's tools (the CLI prints base names; the registered
      tool ids are `mcp__codebase_memory_mcp__*`).
- [ ] **AC3** — `scripts/install-mcp.sh` is idempotent: a second run reports
      `keep`/`ok`, rewrites nothing, and writes no backup.
- [ ] **AC4** — `scripts/render-settings.mjs … --check` exits 0, `doctor.sh`
      reports no problems, and `check-docs.mjs` passes with 10 plugins.
- [ ] **AC5** — `~/.config/mcp/mcp.json` still contains its
      `codebase-memory-mcp` entry, byte-identical to before the change.
- [ ] **AC6** — `git grep` over tracked files finds no live reference to
      `pi-mcp-adapter`, `mcp-cache`, `mcpScript`, or `lifecycle: "lazy"`
      (`git grep -n -E 'pi-mcp-adapter|mcp-cache|mcpScript|"lifecycle"'`).
- [ ] **AC7** — `./setup.sh` re-runs cleanly from a clean `git status`: it
      symlinks what it owns, registers the server, and leaves the repo clean.

## Out of Scope

- Uninstalling `pi-mcp-adapter` from `~/.pi/agent/npm/` or deleting the existing
  `~/.pi/agent/mcp-cache.json`. The package simply leaves `packages[]`; Pi stops
  loading it, and the leftover files are inert per-machine state.
- Removing `codebase-memory-mcp`'s entry from `~/.config/mcp/mcp.json` (R9
  deliberately keeps it).
- Provisioning additional MCP servers, changing exposure for tools inside
  `codebase-memory-mcp`, or configuring MCP OAuth.
- The permission policy (`pi-agent/extensions/pi-permission-system/config.json`
  names no MCP tools, so it needs no change).
- Rewriting archived tasks or the journal.

## Open Questions

None — all user-owned decisions are resolved (see `design.md` D1–D3).

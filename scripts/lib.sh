#!/usr/bin/env bash
#
# lib.sh — the single definition of the harness path lists.
#
# Sourced, never executed. Holds the harness path lists (data only) that
# setup.sh symlinks, sync.sh pulls back and reports, and doctor.sh verifies,
# plus the global MCP config destination. Do not add helpers here.
#
# Consumers: setup.sh, scripts/sync.sh, scripts/doctor.sh, scripts/install-mcp.sh
#
if [ -n "${PI_SETUP_LIB_LOADED:-}" ]; then
  return 0
fi
PI_SETUP_LIB_LOADED=1

# Resource directories symlinked into the Pi config dir when present in the repo.
readonly PI_DIRS=(themes prompts tools skills agents extensions)
# Resource files symlinked the same way.
readonly PI_FILES=(AGENTS.md i-have-adhd.json)

# Machine-local Pi paths that are deliberately never synced. sync.sh reports
# them under "Managed elsewhere"; doctor.sh checks that every one is covered by
# .gitignore. Directory entries need the trailing slash: `git check-ignore`
# treats `pi-agent/sessions` and `pi-agent/sessions/` differently.
# The array order is the report order, so a new path goes where it should read.
readonly PI_NOT_SYNCED=(
  auth.json models-store.json models.json trust.json
  sessions/ npm/ git/ bin/ cache/ agent-memory/
  missions/ profiles/ web-search-cache/ run-history.jsonl
  # Extension-owned per-machine config. Files, so no trailing slash. Each one
  # also has an explicit .gitignore entry; `doctor.sh` enforces that pairing.
  # `web-search.json` is pi-web-access's provider/proxy/credential store.
  # `mcp-cache.json` is pi-mcp-adapter's per-server tool-metadata cache: not
  # config, but the same rule — rewritten at runtime, never repo material.
  auto-compact.json pi-vcc-config.json web-search.json mcp-cache.json
)

# Global MCP server config, shared by every MCP-aware tool on this machine.
# Outside PI_DST on purpose: it is not a Pi surface, so it appears in neither
# PI_DIRS/PI_FILES nor PI_NOT_SYNCED. Deliberately not `PI_`-prefixed — that
# prefix marks a harness path, and sync.sh must not consider this one.
#
# The path deliberately follows the READER's resolution, not the XDG standard:
# pi-mcp-adapter hardcodes join(homedir(), ".config", "mcp", "mcp.json")
# (dist/config.js:14 in pi-mcp-adapter 2.34.0) and ignores XDG_CONFIG_HOME, so
# honouring the variable here would register the server where the adapter never
# looks — and doctor.sh would read this same constant back and report green.
# No `$HOME` default either: scripts are invoked from arbitrary working
# directories, and the reader is what decides. doctor.sh warns when
# XDG_CONFIG_HOME is set to something else.
#
# Written by scripts/install-mcp.sh and checked by scripts/doctor.sh.
readonly MCP_CFG="$HOME/.config/mcp/mcp.json"

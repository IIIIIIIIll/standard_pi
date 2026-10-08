#!/usr/bin/env bash
#
# lib.sh — the single definition of the harness path lists.
#
# Sourced, never executed. Holds the harness path lists (data only) that
# setup.sh symlinks, sync.sh pulls back and reports, and doctor.sh verifies,
# plus the MCP config destination. Do not add helpers here.
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
  auto-compact.json pi-vcc-config.json web-search.json
  # Built-in MCP's per-machine state. `mcp.json` is the server list Pi rewrites
  # from `/mcp` and `pi mcp add`; `mcp.log` is the log the MCP extension appends
  # to and rotates to `mcp.log.1`. Neither is repo material. The log is listed
  # concretely because this array is probed with `[ -e ]`, not as a glob;
  # `.gitignore` carries `mcp.log*`, so the rotated file is ignored too.
  mcp.json mcp.log
)

# A Pi harness path, so it carries the `PI_`-style destination rather than a
# global one: this is the file Pi's built-in MCP extension reads and rewrites,
# not the shared `~/.config/mcp/mcp.json` that every other MCP-aware tool on
# this machine uses. That global file is no longer this repo's to write; the
# entry it holds stays there for the other tools and is untouched (see
# .trellis/spec/config/pi-resources.md, "The MCP config").
#
# It is deliberately not symlinked: `/mcp` saves exposure and enabled-state
# changes and `pi mcp add` appends servers, so a symlink would route Pi's own
# writes into the git working tree — the same trap recorded for
# `auto-compact.json`. It is named in PI_NOT_SYNCED so sync.sh reports it and
# doctor.sh checks that .gitignore covers it.
#
# `$HOME` is deliberate, matching Pi's own default even when
# `PI_CODING_AGENT_DIR` is overridden.
#
# Written by scripts/install-mcp.sh and checked by scripts/doctor.sh.
readonly MCP_CFG="$HOME/.pi/agent/mcp.json"

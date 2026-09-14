#!/usr/bin/env bash
#
# install-mcp.sh — install the codebase-memory-mcp binary and register it in
# the machine-global MCP config.
#
# The binary is installed with upstream's `--skip-config` flag, which is
# mandatory rather than tidy: without it the installer writes
# ~/.pi/agent/AGENTS.md, ~/.pi/agent/skills/ and ~/.pi/agent/extensions/cbmem.ts,
# and ~/.pi/agent/extensions is a symlink into this repo — so the generated
# extension would land inside the git working tree.
#
# Re-running is safe: a binary that is already present is kept, and the
# registration is rewritten only when it differs.
#
# `--skip-config` does not stop every upstream side effect. The install step
# also appends a PATH line to ~/.bashrc and leaves a copy of itself at
# ~/.local/bin/install.sh. Both are outside this repo and invisible to
# `git status` and to doctor.sh; this repo does not edit files it does not own,
# so remove them by hand if you do not want them.
#
# The binary lands in ~/.local/bin, so the post-install `command -v` re-check
# below depends on ~/.local/bin being on PATH. A shell that was started before
# the install re-read ~/.bashrc will fail that re-check; re-run it from a fresh
# shell if that happens.
#
# Usage:
#   scripts/install-mcp.sh             install if absent, then register
#   scripts/install-mcp.sh --force     reinstall the binary (the update path)
#   scripts/install-mcp.sh --quiet     suppress the upstream installer output
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_URL="https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh"

LIB="$REPO_DIR/scripts/lib.sh"
if [ ! -f "$LIB" ]; then
  echo "missing $LIB — it is part of this repo (re-clone or restore it)" >&2
  exit 1
fi
# shellcheck source=scripts/lib.sh
. "$LIB"

FORCE=0
QUIET=0

say() { printf '  %-8s %s\n' "$1" "$2"; }
note() { printf '  \033[33m!\033[0m %s\n' "$1"; }

usage() {
  awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "$0"
}

command -v node >/dev/null 2>&1 || {
  echo "node is required (Pi ships on Node/npm)" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
  --force)
    FORCE=1
    shift
    ;;
  --quiet)
    QUIET=1
    shift
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "unknown option: $1" >&2
    echo
    usage
    exit 2
    ;;
  esac
done

if command -v codebase-memory-mcp >/dev/null 2>&1 && [ "$FORCE" = 0 ]; then
  say keep "$(command -v codebase-memory-mcp)"
else
  say install "codebase-memory-mcp  (upstream installer, --skip-config)"
  if curl -fsSL "$INSTALL_URL" | bash -s -- --skip-config >/tmp/pi-mcp-install.$$ 2>&1; then
    installed=1
  else
    installed=0
  fi
  # --quiet suppresses the installer's own output, but never a failure's:
  # the error below points at it.
  if [ "$installed" = 0 ] || [ "$QUIET" = 0 ]; then
    sed 's/^/  /' /tmp/pi-mcp-install.$$
  fi
  rm -f /tmp/pi-mcp-install.$$
  if [ "$installed" = 0 ]; then
    say error "codebase-memory-mcp install failed (see above)"
    exit 1
  fi
  note "upstream's install step also appends a PATH line to ~/.bashrc and leaves ~/.local/bin/install.sh"
fi

# Re-check: a download that failed while still exiting 0 would otherwise be
# recorded as success, and doctor.sh would report a confusing
# binary-present/config-absent pair much later. This also depends on
# ~/.local/bin being on PATH, which is where the installer puts the binary.
if ! command -v codebase-memory-mcp >/dev/null 2>&1; then
  say error "codebase-memory-mcp is still not on PATH after the install"
  exit 1
fi

node "$REPO_DIR/scripts/register-mcp-server.mjs" "$MCP_CFG" codebase-memory-mcp codebase-memory-mcp

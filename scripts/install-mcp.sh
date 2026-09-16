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
# also appends a PATH line to the shell profile and leaves a copy of itself at
# ~/.local/bin/install.sh. Both are outside this repo and invisible to
# `git status` and to doctor.sh; this repo does not edit files it does not own,
# so remove them by hand if you do not want them. Which profile file gets the
# PATH line is upstream's choice and has varied between installer versions
# (~/.bashrc for the 2026-09-14 install here, ~/.profile on 2026-09-16).
#
# The binary lands in ~/.local/bin. The re-check below also looks there when
# `command -v` misses it, because a shell started before the install has not
# re-read that profile yet — and registration stays correct either way: the
# config stores the bare command name, which the Pi session resolves in its own
# environment.
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

# Resolve the binary the same way in both checks below: PATH first, then the
# installer's own directory, which counts even when this shell cannot see it yet
# — a shell started before the profile line was written. Registration stores the
# bare command name, so a Pi session resolves it in its own environment; and the
# `keep` branch must not reinstall a binary that is already there just because
# this shell's PATH predates it. Sets MCP_BIN, and MCP_BIN_OFF_PATH when only the
# fallback found it (the case that deserves a note, not a failure).
resolve_mcp_bin() {
  MCP_BIN="$(command -v codebase-memory-mcp || true)"
  MCP_BIN_OFF_PATH=0
  if [ -z "$MCP_BIN" ] && [ -x "$HOME/.local/bin/codebase-memory-mcp" ]; then
    MCP_BIN="$HOME/.local/bin/codebase-memory-mcp"
    MCP_BIN_OFF_PATH=1
  fi
}

resolve_mcp_bin
if [ -n "$MCP_BIN" ] && [ "$FORCE" = 0 ]; then
  say keep "$MCP_BIN"
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
  note "upstream's install step also appends a PATH line to your shell profile and leaves ~/.local/bin/install.sh"
fi

# Re-check: a download that failed while still exiting 0 would otherwise be
# recorded as success, and doctor.sh would report a confusing
# binary-present/config-absent pair much later. The installer's own target
# directory counts as success even when this shell's PATH cannot see it yet:
# failing here would skip the registration and leave a fresh machine with the
# binary installed and no server — the exact state doctor.sh then fails on.
resolve_mcp_bin
if [ -z "$MCP_BIN" ]; then
  say error "codebase-memory-mcp is missing after the install (looked on PATH and in ~/.local/bin)"
  exit 1
fi
if [ "$MCP_BIN_OFF_PATH" = 1 ]; then
  note "$MCP_BIN is not on this shell's PATH yet — open a new shell (or source your profile) before starting Pi"
fi

node "$REPO_DIR/scripts/register-mcp-server.mjs" "$MCP_CFG" codebase-memory-mcp codebase-memory-mcp

#!/usr/bin/env bash
#
# sync.sh — pull live harness state back into this repo.
#
# Run after changing settings inside Pi or installing a plugin with
# `pi install`, so the repo captures the change.
#
# Settings are folded into pi-agent/settings.core.json with machine-specific
# optional contributions stripped out. Skills are NOT synced: they live in
# skills.json and are installed from upstream by setup.sh.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_SRC="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
PI_DST="$REPO_DIR/pi-agent"
STATE="$PI_SRC/.pi-setup-state.json"

PI_DIRS=(themes prompts tools skills agents extensions)
PI_FILES=(AGENTS.md)

say() { printf '  %-8s %s\n' "$1" "$2"; }

command -v node >/dev/null 2>&1 || { echo "node is required (Pi ships on Node/npm)"; exit 1; }

echo "==> Folding live settings into core"
node "$REPO_DIR/scripts/sync-settings.mjs" "$REPO_DIR" "$PI_SRC/settings.json" "$STATE"

echo "==> Pulling config files from $PI_SRC"
for f in "${PI_FILES[@]}"; do
  [ -f "$PI_SRC/$f" ] || continue
  if [ -L "$PI_SRC/$f" ]; then
    say same "pi-agent/$f (symlinked into repo)"
    continue
  fi
  cp -L "$PI_SRC/$f" "$PI_DST/$f"
  say sync "pi-agent/$f"
done

for d in "${PI_DIRS[@]}"; do
  [ -d "$PI_SRC/$d" ] || continue
  if [ -L "$PI_SRC/$d" ]; then
    say same "pi-agent/$d/ (symlinked into repo)"
    continue
  fi
  mkdir -p "$PI_DST/$d"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$PI_SRC/$d"/ "$PI_DST/$d"/
  else
    rm -rf "${PI_DST:?}/$d"; cp -R "$PI_SRC/$d" "$PI_DST/$d"
  fi
  say sync "pi-agent/$d/"
done

echo
echo "==> Managed elsewhere (not synced)"
say upstream "skills per skills.json (setup.sh installs them)"
for f in auth.json models-store.json models.json trust.json sessions npm git bin agent-memory; do
  [ -e "$PI_SRC/$f" ] && say skip "pi-agent/$f"
done

echo
if [ -n "$(git -C "$REPO_DIR" status --short)" ]; then
  echo "Review and commit:"
  echo "  git -C \"$REPO_DIR\" status --short"
  echo "  git -C \"$REPO_DIR\" diff"
else
  echo "Already up to date."
fi

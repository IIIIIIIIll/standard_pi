#!/usr/bin/env bash
#
# install.sh — wire this portable store into the local Pi harness.
#
# Idempotent. Safe to re-run after every `git pull`.
#
#   Core settings   -> rendered to ~/.pi/agent/settings.json (per-machine)
#   Optional dirs   -> symlinked from the repo (repo is the source of truth)
#   Shared skills   -> copied (an external skill installer owns the live copy)
#
# Usage:
#   install.sh [--with NAME ...]     exactly these optionals (default: keep saved state)
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_SRC="$REPO_DIR/pi-agent"
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
STATE="$PI_DST/.pi-setup-state.json"
SKILLS_SRC="$REPO_DIR/agents-skills"
SKILLS_DST="$HOME/.agents/skills"

# Optional resources, symlinked when present in the repo.
#   dirs  -> themes/, prompts/, tools/, skills/, agents/ (pi-subagents user agents)
#   files -> AGENTS.md (global context)
PI_DIRS=(themes prompts tools skills agents)
PI_FILES=(AGENTS.md)

say() { printf '  %-8s %s\n' "$1" "$2"; }

command -v node >/dev/null 2>&1 || { echo "node is required (Pi ships on Node/npm)"; exit 1; }

link() {
  local src="$1" dst="$2"
  [ -e "$src" ] || return 0
  mkdir -p "$(dirname "$dst")"

  if [ -L "$dst" ]; then
    if [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
      say ok "$dst"
      return
    fi
    rm "$dst"
  elif [ -e "$dst" ]; then
    local backup="$dst.bak-$(date +%Y%m%d-%H%M%S)"
    mv "$dst" "$backup"
    say backup "$dst -> $backup"
  fi

  ln -s "$src" "$dst"
  say link "$dst"
}

echo "==> Pi config  ($PI_DST)"
mkdir -p "$PI_DST"

# settings.json is generated (core + this machine's optionals), never a symlink.
if [ -L "$PI_DST/settings.json" ]; then
  rm "$PI_DST/settings.json"
  say unlink "$PI_DST/settings.json (now generated)"
fi
node "$REPO_DIR/scripts/render-settings.mjs" "$REPO_DIR" "$PI_DST/settings.json" "$STATE" "$@"

for f in "${PI_FILES[@]}"; do
  link "$PI_SRC/$f" "$PI_DST/$f"
done

for d in "${PI_DIRS[@]}"; do
  link "$PI_SRC/$d" "$PI_DST/$d"
done

# auth.json holds real credentials: seed once from the template, then leave it
# alone. It is gitignored and never symlinked.
if [ ! -e "$PI_DST/auth.json" ]; then
  cp "$PI_SRC/auth.json.example" "$PI_DST/auth.json"
  chmod 600 "$PI_DST/auth.json"
  say create "$PI_DST/auth.json  (fill in your keys)"
else
  say keep "$PI_DST/auth.json  (secrets stay local)"
fi

echo "==> Shared skills  ($SKILLS_DST)"
if [ -d "$SKILLS_SRC" ]; then
  mkdir -p "$SKILLS_DST"
  cp -R "$SKILLS_SRC"/. "$SKILLS_DST"/
  [ -f "$SKILLS_SRC/.skill-lock.json" ] && cp "$SKILLS_SRC/.skill-lock.json" "$HOME/.agents/.skill-lock.json"
  say copy "$SKILLS_DST"
fi

echo
echo "Done. Verify with:  $REPO_DIR/scripts/doctor.sh"

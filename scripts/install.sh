#!/usr/bin/env bash
#
# install.sh — link this portable store into the local Pi harness.
#
# Idempotent. Safe to re-run after every `git pull`.
#
#   Pi config files  -> symlinked   (repo is the source of truth)
#   Shared skills    -> copied      (external skill installer owns the live copy)
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_SRC="$REPO_DIR/pi-agent"
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
SKILLS_SRC="$REPO_DIR/agents-skills"
SKILLS_DST="$HOME/.agents/skills"

# Portable Pi config: files and optional directories, all symlinked.
PI_FILES=(settings.json models-store.json models.json sol-pi.json)
PI_DIRS=(themes prompts tools skills agents)

say()  { printf '  %-8s %s\n' "$1" "$2"; }

link() {
  local src="$1" dst="$2"

  if [ ! -e "$src" ]; then
    return
  fi

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

for f in "${PI_FILES[@]}"; do
  link "$PI_SRC/$f" "$PI_DST/$f"
done

for d in "${PI_DIRS[@]}"; do
  link "$PI_SRC/$d" "$PI_DST/$d"
done

# auth.json holds real credentials: create it once from the template, then
# leave it alone. It is gitignored and never symlinked.
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
  if [ -f "$SKILLS_SRC/.skill-lock.json" ]; then
    cp "$SKILLS_SRC/.skill-lock.json" "$HOME/.agents/.skill-lock.json"
  fi
  say copy "$SKILLS_DST"
fi

echo
echo "Done. Verify with:  $REPO_DIR/scripts/doctor.sh"

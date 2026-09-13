#!/usr/bin/env bash
#
# sync.sh — pull live harness state back into this repo.
#
# Run this after changing settings inside Pi, installing a package with
# `pi install`, or adding/updating skills, so the repo captures the change.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_SRC="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
PI_DST="$REPO_DIR/pi-agent"
SKILLS_SRC="$HOME/.agents/skills"
SKILLS_DST="$REPO_DIR/agents-skills"

PI_FILES=(settings.json models-store.json models.json sol-pi.json)
PI_DIRS=(themes prompts tools skills agents)

say() { printf '  %-8s %s\n' "$1" "$2"; }

changed=0
copy_out() { # copy_out <src> <dst> <label>
  local tmp; tmp="$(mktemp)"
  cp -L "$1" "$tmp"
  if [ -f "$2" ] && cmp -s "$tmp" "$2"; then
    rm -f "$tmp"
    say same "$3"
  else
    mv "$tmp" "$2"
    say update "$3"
    changed=1
  fi
}

echo "==> Pulling Pi config from $PI_SRC"
[ -d "$PI_SRC" ] || { echo "  no Pi config dir found; nothing to do."; exit 0; }

for f in "${PI_FILES[@]}"; do
  if [ -e "$PI_SRC/$f" ]; then
    copy_out "$PI_SRC/$f" "$PI_DST/$f" "pi-agent/$f"
  fi
done

for d in "${PI_DIRS[@]}"; do
  if [ -d "$PI_SRC/$d" ]; then
    mkdir -p "$PI_DST/$d"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete "$PI_SRC/$d"/ "$PI_DST/$d"/
    else
      rm -rf "$PI_DST/$d"; cp -R "$PI_SRC/$d" "$PI_DST/$d"
    fi
    say sync "pi-agent/$d/"
    changed=1
  fi
done

echo "==> Pulling shared skills from $SKILLS_SRC"
if [ -d "$SKILLS_SRC" ]; then
  mkdir -p "$SKILLS_DST"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$SKILLS_SRC"/ "$SKILLS_DST"/
  else
    rm -rf "$SKILLS_DST"; mkdir -p "$SKILLS_DST"; cp -R "$SKILLS_SRC"/. "$SKILLS_DST"/
  fi
  [ -f "$HOME/.agents/.skill-lock.json" ] && cp "$HOME/.agents/.skill-lock.json" "$SKILLS_DST/.skill-lock.json"
  say sync "agents-skills/"
  changed=1
fi

echo
if [ "$changed" -eq 1 ]; then
  echo "Review and commit:"
  echo "  git -C \"$REPO_DIR\" status --short"
  echo "  git -C \"$REPO_DIR\" diff"
else
  echo "Already up to date."
fi

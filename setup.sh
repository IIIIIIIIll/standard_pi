#!/usr/bin/env bash
#
# setup.sh — one command to wire this store into the local Pi harness.
#
# Does everything, and is safe to re-run (that is also how you update):
#
#   1. render ~/.pi/agent/settings.json from core + this machine's optionals
#   2. symlink AGENTS.md, i-have-adhd.json and resource dirs (themes/prompts/tools/skills/agents/extensions)
#   3. seed ~/.pi/agent/auth.json from the template if absent
#   4. install/refresh skills from their upstream sources (skills.json)
#   5. refresh Pi plugin packages
#   6. verify with scripts/doctor.sh
#
# Usage:
#   ./setup.sh                         keep saved optional choices (prompt if new)
#   ./setup.sh --with opencode-go      exactly this set of optionals
#   ./setup.sh --none                  no optionals on this machine
#   ./setup.sh --yes                   never prompt
#   ./setup.sh --skip-skills           leave skills alone (offline, etc.)
#   ./setup.sh --skip-plugins          leave plugins alone
#   ./setup.sh --skip-verify           skip doctor
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_SRC="$REPO_DIR/pi-agent"
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
STATE="$PI_DST/.pi-setup-state.json"

LIB="$REPO_DIR/scripts/lib.sh"
if [ ! -f "$LIB" ]; then
  echo "missing $LIB — it is part of this repo (re-clone or restore it)" >&2
  exit 1
fi
# shellcheck source=scripts/lib.sh
. "$LIB"

WITH=()
EXPLICIT=0
ASSUME_YES=0
SKIP_SKILLS=0
SKIP_PLUGINS=0
SKIP_VERIFY=0

usage() {
  awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "$0"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --with) WITH+=("${2:?--with requires a name}"); EXPLICIT=1; shift 2 ;;
    --none) WITH=(); EXPLICIT=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    --skip-skills) SKIP_SKILLS=1; shift ;;
    --skip-plugins) SKIP_PLUGINS=1; shift ;;
    --skip-verify) SKIP_VERIFY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; echo; usage; exit 2 ;;
  esac
done

say() { printf '  %-8s %s\n' "$1" "$2"; }
note() { printf '  \033[33m!\033[0m %s\n' "$1"; }

command -v node >/dev/null 2>&1 || { echo "node is required (Pi ships on Node/npm)" >&2; exit 1; }

available_optionals() {
  find "$REPO_DIR/optional" -mindepth 1 -maxdepth 1 -type d ! -name '_*' \
    -exec test -f '{}/manifest.json' \; -print 2>/dev/null | xargs -r -n1 basename | sort
}

optional_description() {
  node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).description||"")' \
    "$REPO_DIR/optional/$1/manifest.json"
}

link() {
  local src="$1" dst="$2"
  [ -e "$src" ] || return 0
  mkdir -p "$(dirname "$dst")"

  if [ -L "$dst" ]; then
    if [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
      say ok "$dst"
      return 0
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

# --- decide which optional bundles are enabled --------------------------------

RENDER_ARGS=()
if [ "$EXPLICIT" = 1 ]; then
  if [ "${#WITH[@]}" -eq 0 ]; then
    RENDER_ARGS=(--none)
  else
    for n in "${WITH[@]}"; do RENDER_ARGS+=(--with "$n"); done
  fi
elif [ -f "$STATE" ]; then
  : # keep saved choices
elif [ "$ASSUME_YES" = 1 ] || [ ! -t 0 ]; then
  RENDER_ARGS=(--none)
else
  names="$(available_optionals)"
  if [ -z "$names" ]; then
    RENDER_ARGS=(--none)
  else
    echo "Optional plugin bundles — enable per machine:"
    chosen=""
    for n in $names; do
      printf '  %s — %s\n    enable? [y/N] ' "$n" "$(optional_description "$n")"
      read -r answer || answer=""
      case "$answer" in [yY]*) chosen="$chosen $n" ;; esac
    done
    if [ -n "$chosen" ]; then
      # shellcheck disable=SC2086
      for n in $chosen; do RENDER_ARGS+=(--with "$n"); done
    else
      RENDER_ARGS=(--none)
    fi
    echo
  fi
fi

# --- 1-3. config ---------------------------------------------------------------

echo "==> Pi config  ($PI_DST)"
mkdir -p "$PI_DST"

if [ -L "$PI_DST/settings.json" ]; then
  rm "$PI_DST/settings.json"
  say unlink "$PI_DST/settings.json (now generated)"
fi
node "$REPO_DIR/scripts/render-settings.mjs" "$REPO_DIR" "$PI_DST/settings.json" "$STATE" ${RENDER_ARGS[@]+"${RENDER_ARGS[@]}"}

for f in "${PI_FILES[@]}"; do
  link "$PI_SRC/$f" "$PI_DST/$f"
done
for d in "${PI_DIRS[@]}"; do
  link "$PI_SRC/$d" "$PI_DST/$d"
done

if [ ! -e "$PI_DST/auth.json" ]; then
  cp "$PI_SRC/auth.json.example" "$PI_DST/auth.json"
  chmod 600 "$PI_DST/auth.json"
  say create "$PI_DST/auth.json  (fill in your keys)"
else
  say keep "$PI_DST/auth.json  (secrets stay local)"
fi

# --- 4. skills from upstream ---------------------------------------------------

if [ "$SKIP_SKILLS" = 0 ]; then
  echo "==> Skills  (from upstream, per skills.json)"
  node "$REPO_DIR/scripts/install-skills.mjs" "$REPO_DIR" || note "skill install had problems; see above"
fi

# --- 5. plugins ----------------------------------------------------------------

if [ "$SKIP_PLUGINS" = 0 ] && command -v pi >/dev/null 2>&1; then
  echo "==> Pi plugins"
  if pi update --extensions >/tmp/pi-setup-plugins.$$ 2>&1; then
    sed 's/^/  /' /tmp/pi-setup-plugins.$$ | tail -n 5
  else
    note "pi update --extensions failed; run it manually later"
  fi
  rm -f /tmp/pi-setup-plugins.$$
fi

# --- 6. verify -----------------------------------------------------------------

echo
if [ "$SKIP_VERIFY" = 0 ]; then
  "$REPO_DIR/scripts/doctor.sh"
else
  echo "Done (verification skipped)."
fi

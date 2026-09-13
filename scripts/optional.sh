#!/usr/bin/env bash
#
# optional.sh — manage optional plugin bundles on this machine.
#
# An optional bundle lives in optional/<name>/manifest.json and contributes
# packages plus settings when enabled. Choices are machine-local: they are
# recorded in ~/.pi/agent/.pi-setup-state.json, not in git.
#
# Usage:
#   optional.sh list
#   optional.sh enable  <name> [<name> ...]
#   optional.sh disable <name> [<name> ...]
#   optional.sh scaffold <name>        create a new bundle from optional/_template
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPT_DIR="$REPO_DIR/optional"
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
STATE="$PI_DST/.pi-setup-state.json"

command -v node >/dev/null 2>&1 || { echo "node is required (Pi ships on Node/npm)"; exit 1; }

names() {
  find "$OPT_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_*' -exec test -f '{}/manifest.json' \; -print \
    | xargs -r -n1 basename | sort
}

enabled() {
  [ -f "$STATE" ] && node -e 'console.log((JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).optionals||[]).join("\n"))' "$STATE" || true
}

render() { node "$REPO_DIR/scripts/render-settings.mjs" "$REPO_DIR" "$PI_DST/settings.json" "$STATE" "$@"; }

require_known() {
  local n="$1"
  [ -f "$OPT_DIR/$n/manifest.json" ] || { echo "unknown optional: $n"; echo "known: $(names | tr '\n' ' ')"; exit 1; }
}

cmd="${1:-list}"; shift || true

case "$cmd" in
  list)
    cur="$(enabled)"
    echo "Optional bundles in $OPT_DIR"
    echo
    for n in $(names); do
      mark=" "; printf '%s' "$cur" | grep -qx "$n" && mark="*"
      desc="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).description||"")' "$OPT_DIR/$n/manifest.json")"
      printf '  [%s] %-16s %s\n' "$mark" "$n" "$desc"
    done
    echo
    echo "  [*] = enabled on this machine"
    ;;

  enable)
    [ $# -gt 0 ] || { echo "usage: optional.sh enable <name> ..."; exit 1; }
    next="$( { enabled; printf '%s\n' "$@"; } | sed '/^$/d' | sort -u )"
    for n in $next; do require_known "$n"; done
    echo "==> Enabling: $*"
    # shellcheck disable=SC2086
    render $(printf -- '--with %s ' $next)
    echo
    echo "Pi installs missing packages on next start."
    ;;

  disable)
    [ $# -gt 0 ] || { echo "usage: optional.sh disable <name> ..."; exit 1; }
    echo "==> Disabling: $*"
    args=(); for n in "$@"; do args+=(-e "$n"); done
    keep="$(enabled | grep -vxF "${args[@]}" || true)"
    if [ -n "$keep" ]; then
      # shellcheck disable=SC2086
      render $(printf -- '--with %s ' $keep)
    else
      render --none
    fi
    echo
    echo "Installed files are left in place; remove with: pi remove <package>"
    ;;

  scaffold)
    name="${1:-}"
    [ -n "$name" ] || { echo "usage: optional.sh scaffold <name>"; exit 1; }
    [ -e "$OPT_DIR/$name" ] && { echo "already exists: optional/$name"; exit 1; }
    mkdir -p "$OPT_DIR/$name"
    cp "$OPT_DIR/_template/manifest.json" "$OPT_DIR/$name/manifest.json"
    node -e '
      const fs=require("fs"),p=process.argv[1],n=process.argv[2];
      const m=JSON.parse(fs.readFileSync(p,"utf8")); m.name=n;
      fs.writeFileSync(p, JSON.stringify(m,null,2)+"\n");
    ' "$OPT_DIR/$name/manifest.json" "$name"
    echo "Created optional/$name/manifest.json"
    echo "Edit packages/settings, then: $0 enable $name"
    ;;

  *)
    echo "usage: optional.sh [list | enable <name>... | disable <name>... | scaffold <name>]"
    exit 1
    ;;
esac

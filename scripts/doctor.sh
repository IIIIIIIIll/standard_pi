#!/usr/bin/env bash
#
# doctor.sh — verify this store is linked, in sync, and secret-free.
#
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_SRC="$REPO_DIR/pi-agent"
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
STATE="$PI_DST/.pi-setup-state.json"
SKILLS_DST="${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"

problems=0
notes=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() {
  printf '  \033[33m!\033[0m %s\n' "$1"
  notes=$((notes + 1))
}
bad() {
  printf '  \033[31m✗\033[0m %s\n' "$1"
  problems=$((problems + 1))
}

echo "==> Repo"
if [ -d "$REPO_DIR/.git" ]; then
  ok "git repository: $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'no commits yet')"
  remote="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || true)"
  [ -n "$remote" ] && ok "remote: $remote" || warn "no 'origin' remote configured"
  if [ -n "$(git -C "$REPO_DIR" status --short)" ]; then
    warn "uncommitted changes:"
    git -C "$REPO_DIR" status --short | sed 's/^/      /'
  else
    ok "working tree clean"
  fi
else
  bad "not a git repository"
fi

LIB="$REPO_DIR/scripts/lib.sh"
if [ ! -f "$LIB" ]; then
  bad "scripts/lib.sh missing (it defines PI_DIRS/PI_FILES)"
  exit 1
fi
# shellcheck source=scripts/lib.sh
. "$LIB"

echo "==> Settings  ($PI_DST/settings.json)"
if [ -L "$PI_DST/settings.json" ]; then
  bad "settings.json is a symlink; it should be generated (run ./setup.sh)"
elif [ -f "$PI_DST/settings.json" ]; then
  if node "$REPO_DIR/scripts/render-settings.mjs" "$REPO_DIR" "$PI_DST/settings.json" "$STATE" --check 2>&1 | sed 's/^/      /'; then
    ok "settings.json matches core + enabled optionals"
  else
    bad "settings.json has drifted from the repo"
  fi
else
  bad "settings.json missing (run ./setup.sh)"
fi

echo "==> Optional bundles"
if command -v node >/dev/null 2>&1 && [ -d "$REPO_DIR/optional" ]; then
  cur="$([ -f "$STATE" ] && node -e 'console.log((JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).optionals||[]).join("\n"))' "$STATE" || true)"
  any=0
  for m in "$REPO_DIR"/optional/*/manifest.json; do
    [ -e "$m" ] || continue
    name="$(basename "$(dirname "$m")")"
    case "$name" in _*) continue ;; esac
    any=1
    if printf '%s\n' "$cur" | grep -qx "$name"; then
      ok "$name (enabled)"
    else printf '  \033[2m·\033[0m %s (available)\n' "$name"; fi
  done
  [ "$any" = 1 ] || warn "no optional bundles defined"
else
  warn "node unavailable or optional/ missing"
fi

echo "==> Symlinked resources  ($PI_DST)"
found=0
for name in "${PI_FILES[@]}" "${PI_DIRS[@]}"; do
  src="$PI_SRC/$name"
  dst="$PI_DST/$name"
  [ -e "$src" ] || continue
  found=1
  if [ -L "$dst" ] && [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
    ok "$name -> repo"
  elif [ -L "$dst" ]; then
    bad "$name -> $(readlink "$dst")  (points elsewhere)"
  elif [ -e "$dst" ]; then
    warn "$name exists but is not linked (run ./setup.sh)"
  else
    warn "$name not linked (run ./setup.sh)"
  fi
done
[ "$found" = 1 ] || printf '  \033[2m·\033[0m none in repo yet (AGENTS.md, i-have-adhd.json, themes/, prompts/, tools/, skills/, agents/, extensions/)\n'

echo "==> Trellis subagent bridge"
bridge_src="$PI_SRC/extensions/trellis-subagents-bridge/index.ts"
if [ ! -f "$bridge_src" ]; then
  bad "pi-agent/extensions/trellis-subagents-bridge/index.ts missing"
elif [ ! -f "$PI_DST/extensions/trellis-subagents-bridge/index.ts" ]; then
  bad "bridge not reachable via $PI_DST/extensions (run ./setup.sh)"
else
  ok "bridge extension linked"
fi
# pi-subagents discovers project role agents from the project config agents dir.
# Assert the discovery INPUT rather than the tool's own listing: subagent({"action":"list"})
# is model-facing and cannot be called from bash.
pi_agents="$REPO_DIR/.pi/agents"
if [ ! -d "$pi_agents" ]; then
  warn ".pi/agents absent (Trellis adapters not generated in this checkout)"
else
  missing_agents=()
  for role in trellis-implement trellis-check trellis-research; do
    [ -f "$pi_agents/$role.md" ] || missing_agents+=("$role")
  done
  if [ ${#missing_agents[@]} -gt 0 ]; then
    bad "pi-subagents cannot discover role agent(s): ${missing_agents[*]}"
  else
    ok "pi-subagents discovery input present (3 role agents)"
  fi
fi

# Shipped dispatch tools. The bridge deactivates them by name, so a `trellis
# update` that renames one or registers another would silently end the
# deactivation. Compare the names the generated extension registers against the
# names the bridge declares. Offline, and no `pi` invocation: this must stay
# meaningful on a fresh clone.
#
# Every "cannot verify" path below fails or warns. A check that degrades to `ok`
# when it stops being able to see is worse than no check at all.
trellis_ext="$REPO_DIR/.pi/extensions/trellis/index.ts"
bridge_file="pi-agent/extensions/trellis-subagents-bridge/index.ts"
if [ ! -f "$trellis_ext" ]; then
  warn ".pi/extensions/trellis/index.ts absent (Trellis adapters not generated in this checkout)"
elif [ ! -f "$bridge_src" ]; then
  : # the missing bridge was already reported above
elif [ ! -r "$trellis_ext" ]; then
  bad "cannot read .pi/extensions/trellis/index.ts; the bridge's SHIPPED_TOOLS list cannot be verified"
elif ! grep -q "SHIPPED_TOOLS" "$bridge_src" 2>/dev/null; then
  bad "the bridge no longer declares SHIPPED_TOOLS; doctor cannot verify which tools it deactivates"
else
  ext_names="$(grep -oE 'name: "[a-z_]+"' "$trellis_ext" 2>/dev/null | sed -E 's/.*"(.*)"/\1/' | sort -u)"
  # Read the declared list off its declaration line, not a bare quoted-string
  # match anywhere in the file: a name mentioned in the tool_call guard is not a
  # name the bridge deactivates.
  declared_line="$(grep 'SHIPPED_TOOLS' "$bridge_src" 2>/dev/null | grep -v '//' | head -n 1)"
  declared="$(printf '%s\n' "$declared_line" | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u)"
  if [ -z "$declared" ]; then
    bad "read no tool name from the SHIPPED_TOOLS declaration in $bridge_file (empty or reformatted?)"
  elif [ -z "$ext_names" ]; then
    if grep -q "registerTool" "$trellis_ext" 2>/dev/null; then
      bad "the generated extension registers tool(s) but no name could be extracted (formatting drift?); the bridge's SHIPPED_TOOLS list can no longer be verified"
    else
      warn "the generated extension registers no dispatch tool; nothing for the bridge to deactivate"
    fi
  else
    unknown_tools=()
    while IFS= read -r t; do
      [ -n "$t" ] || continue
      printf '%s\n' "$declared" | grep -qxF "$t" || unknown_tools+=("$t")
    done <<<"$ext_names"
    if [ ${#unknown_tools[@]} -gt 0 ]; then
      bad "generated extension registers tool(s) the bridge does not deactivate:"
      for t in "${unknown_tools[@]}"; do printf '      %s\n' "$t"; done
      printf '      add each to SHIPPED_TOOLS in %s\n' "$bridge_file"
    else
      n_ext="$(printf '%s\n' "$ext_names" | grep -c .)"
      ok "shipped dispatch tool(s) covered by the bridge: $n_ext"
    fi
  fi
fi

echo "==> Credentials"
if [ -f "$PI_DST/auth.json" ]; then
  perms="$(stat -c '%a' "$PI_DST/auth.json" 2>/dev/null || stat -f '%Lp' "$PI_DST/auth.json")"
  if [ "$perms" = "600" ]; then
    ok "auth.json present, mode 600"
  else warn "auth.json mode is $perms (expected 600)"; fi
else
  warn "auth.json missing (run ./setup.sh, then add your keys)"
fi

echo "==> Secret scan (tracked files)"
if [ -d "$REPO_DIR/.git" ]; then
  hits="$(git -C "$REPO_DIR" grep -nEI \
    -e 'api[_-]?key"?[[:space:]]*[:=][[:space:]]*"[A-Za-z0-9_-]{16,}' \
    -e 'sk-[A-Za-z0-9]{20,}' \
    -e 'ghp_[A-Za-z0-9]{20,}' \
    -e 'Bearer [[:space:]]*[A-Za-z0-9._-]{20,}' \
    -- . 2>/dev/null | grep -v 'example' || true)"
  if [ -n "$hits" ]; then
    bad "possible secrets in tracked files:"
    printf '%s\n' "$hits" | sed 's/^/      /'
  else
    ok "no obvious secrets tracked"
  fi
  if git -C "$REPO_DIR" ls-files --error-unmatch pi-agent/auth.json >/dev/null 2>&1; then
    bad "pi-agent/auth.json is TRACKED by git — remove it from history"
  else
    ok "auth.json is not tracked"
  fi
fi

echo "==> Ignore coverage (machine-local paths)"
if [ -d "$REPO_DIR/.git" ]; then
  not_ignored=()
  for name in "${PI_NOT_SYNCED[@]}"; do
    git -C "$REPO_DIR" check-ignore -q -- "pi-agent/$name" || not_ignored+=("$name")
  done
  if [ ${#not_ignored[@]} -gt 0 ]; then
    bad "path(s) sync.sh reports as not-synced, but git would commit:"
    for name in "${not_ignored[@]}"; do printf '      pi-agent/%s\n' "$name"; done
    printf '      add them to .gitignore (directory patterns need the trailing slash)\n'
  else
    ok "all ${#PI_NOT_SYNCED[@]} reported-skipped paths are gitignored"
  fi
fi

echo "==> Skills  ($SKILLS_DST)"
if [ -f "$REPO_DIR/skills.json" ]; then
  total="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).skills.length)' "$REPO_DIR/skills.json")"
  if node "$REPO_DIR/scripts/install-skills.mjs" "$REPO_DIR" --check >/tmp/pi-doctor-skills.$$ 2>&1; then
    ok "$total skill(s) installed from upstream"
  else
    bad "missing skills (run ./setup.sh):"
    sed 's/^/      /' /tmp/pi-doctor-skills.$$
  fi
  rm -f /tmp/pi-doctor-skills.$$
  prov="${SKILLS_DST%/skills}/.pi-setup-skills.json"
  if [ -f "$prov" ]; then
    node -e '
      const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
      for (const [id,s] of Object.entries(p.sources||{})) console.log(`  \u00b7 ${id} @ ${String(s.commit).slice(0,12)}`);
    ' "$prov"
  fi
else
  warn "no skills.json in repo"
fi

echo "==> Docs coverage (docs/ against what ships)"
if ! command -v node >/dev/null 2>&1; then
  # bad, not warn: this check is the only thing keeping a tracked document from
  # silently rotting, so a check that cannot run must fail. node is already a hard
  # dependency of the sections above.
  bad "node unavailable, cannot check docs/ coverage"
elif [ ! -d "$REPO_DIR/docs" ]; then
  bad "docs/ is missing"
elif node "$REPO_DIR/scripts/check-docs.mjs" "$REPO_DIR" >/tmp/pi-doctor-docs.$$ 2>&1; then
  ok "$(sed 's/^ *ok *//' /tmp/pi-doctor-docs.$$)"
else
  bad "docs/ coverage does not match the shipped set:"
  sed 's/^/      /' /tmp/pi-doctor-docs.$$
fi
rm -f /tmp/pi-doctor-docs.$$

echo
if [ "$problems" -eq 0 ] && [ "$notes" -eq 0 ]; then
  printf '\033[32mAll good.\033[0m\n'
elif [ "$problems" -eq 0 ]; then
  printf '\033[32mNo problems.\033[0m %d note(s) above.\n' "$notes"
else
  printf '\033[31m%d problem(s) found.\033[0m\n' "$problems"
  exit 1
fi

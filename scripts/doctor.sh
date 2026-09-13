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

PI_DIRS=(themes prompts tools skills agents extensions)
PI_FILES=(AGENTS.md)

problems=0
notes=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; notes=$((notes + 1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; problems=$((problems + 1)); }

echo "==> Repo"
if [ -d "$REPO_DIR/.git" ]; then
  ok "git repository: $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'no commits yet')"
  remote="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || true)"
  [ -n "$remote" ] && ok "remote: $remote" || warn "no 'origin' remote configured"
  if [ -n "$(git -C "$REPO_DIR" status --short)" ]; then
    warn "uncommitted changes:"; git -C "$REPO_DIR" status --short | sed 's/^/      /'
  else
    ok "working tree clean"
  fi
else
  bad "not a git repository"
fi

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
  cur="$( [ -f "$STATE" ] && node -e 'console.log((JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).optionals||[]).join("\n"))' "$STATE" || true )"
  any=0
  for m in "$REPO_DIR"/optional/*/manifest.json; do
    [ -e "$m" ] || continue
    name="$(basename "$(dirname "$m")")"
    case "$name" in _*) continue ;; esac
    any=1
    if printf '%s\n' "$cur" | grep -qx "$name"; then ok "$name (enabled)"
    else printf '  \033[2m·\033[0m %s (available)\n' "$name"; fi
  done
  [ "$any" = 1 ] || warn "no optional bundles defined"
else
  warn "node unavailable or optional/ missing"
fi

echo "==> Symlinked resources  ($PI_DST)"
found=0
for name in "${PI_FILES[@]}" "${PI_DIRS[@]}"; do
  src="$PI_SRC/$name"; dst="$PI_DST/$name"
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
[ "$found" = 1 ] || printf '  \033[2m·\033[0m none in repo yet (AGENTS.md, themes/, prompts/, tools/, skills/, agents/)\n'

echo "==> Credentials"
if [ -f "$PI_DST/auth.json" ]; then
  perms="$(stat -c '%a' "$PI_DST/auth.json" 2>/dev/null || stat -f '%Lp' "$PI_DST/auth.json")"
  if [ "$perms" = "600" ]; then ok "auth.json present, mode 600"
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
    bad "possible secrets in tracked files:"; printf '%s\n' "$hits" | sed 's/^/      /'
  else
    ok "no obvious secrets tracked"
  fi
  if git -C "$REPO_DIR" ls-files --error-unmatch pi-agent/auth.json >/dev/null 2>&1; then
    bad "pi-agent/auth.json is TRACKED by git — remove it from history"
  else
    ok "auth.json is not tracked"
  fi
fi

echo "==> Skills  ($SKILLS_DST)"
if [ -f "$REPO_DIR/skills.json" ]; then
  total="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).skills.length)' "$REPO_DIR/skills.json")"
  if node "$REPO_DIR/scripts/install-skills.mjs" "$REPO_DIR" --check >/tmp/pi-doctor-skills.$$ 2>&1; then
    ok "$total skill(s) installed from upstream"
  else
    bad "missing skills (run ./setup.sh):"; sed 's/^/      /' /tmp/pi-doctor-skills.$$
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

echo
if [ "$problems" -eq 0 ] && [ "$notes" -eq 0 ]; then
  printf '\033[32mAll good.\033[0m\n'
elif [ "$problems" -eq 0 ]; then
  printf '\033[32mNo problems.\033[0m %d note(s) above.\n' "$notes"
else
  printf '\033[31m%d problem(s) found.\033[0m\n' "$problems"
  exit 1
fi

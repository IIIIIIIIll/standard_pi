#!/usr/bin/env bash
#
# doctor.sh — verify this store is linked, clean, and secret-free.
#
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_SRC="$REPO_DIR/pi-agent"
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
SKILLS_SRC="$REPO_DIR/agents-skills"
SKILLS_DST="$HOME/.agents/skills"

PI_FILES=(settings.json models-store.json models.json sol-pi.json)
PI_DIRS=(themes prompts tools skills agents)

problems=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
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

echo "==> Symlinks  ($PI_DST)"
[ -d "$PI_DST" ] || bad "Pi config dir missing: $PI_DST"
for name in "${PI_FILES[@]}" "${PI_DIRS[@]}"; do
  src="$PI_SRC/$name"; dst="$PI_DST/$name"
  [ -e "$src" ] || continue
  if [ -L "$dst" ] && [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
    ok "$name -> repo"
  elif [ -L "$dst" ]; then
    bad "$name -> $(readlink "$dst")  (points elsewhere)"
  elif [ -e "$dst" ]; then
    warn "$name exists but is not linked to the repo (run scripts/install.sh)"
  else
    warn "$name not linked (run scripts/install.sh)"
  fi
done

echo "==> Credentials"
if [ -f "$PI_DST/auth.json" ]; then
  perms="$(stat -c '%a' "$PI_DST/auth.json" 2>/dev/null || stat -f '%Lp' "$PI_DST/auth.json")"
  if [ "$perms" = "600" ]; then ok "auth.json present, mode 600"
  else warn "auth.json mode is $perms (expected 600)"; fi
else
  warn "auth.json missing (run scripts/install.sh, then add your keys)"
fi

echo "==> Secret scan (tracked files)"
if [ -d "$REPO_DIR/.git" ]; then
  hits="$(git -C "$REPO_DIR" grep -nEI \
      -e 'api[_-]?key"?[[:space:]]*[:=][[:space:]]*"[A-Za-z0-9_-]{16,}' \
      -e 'sk-[A-Za-z0-9]{20,}' \
      -e 'ghp_[A-Za-z0-9]{20,}' \
      -e 'Bearer [[:space:]]*[A-Za-z0-9._-]{20,}' \
      -- . 2>/dev/null | grep -v 'auth.json.example' || true)"
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

echo "==> Shared skills  ($SKILLS_DST)"
if [ -d "$SKILLS_SRC" ]; then
  repo_n="$(find "$SKILLS_SRC" -name SKILL.md | wc -l | tr -d ' ')"
  live_n="$(find "$SKILLS_DST" -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$repo_n" = "$live_n" ]; then ok "$repo_n skills in repo and installed"
  else warn "repo has $repo_n skills, installed has $live_n (run scripts/install.sh or sync.sh)"; fi
fi

echo
if [ "$problems" -eq 0 ]; then
  printf '\033[32mAll good.\033[0m\n'
else
  printf '\033[31m%d problem(s) found.\033[0m\n' "$problems"
  exit 1
fi

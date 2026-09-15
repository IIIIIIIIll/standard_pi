#!/usr/bin/env bash
#
# install-trellis.sh — restore the Trellis-generated surfaces this repo's Pi
# harness needs, without the by-products of a bare `trellis init`.
#
# `.pi/` and `.agents/` are gitignored, so a fresh clone has none of them: no
# Trellis extension, no prompt commands, and no role agents for `pi-subagents` to
# discover. `trellis update` cannot repair that — it reads each absent file as an
# intentional deletion ("Deleted by you (preserved)") and exits "Already up to
# date". `trellis init` can, so this script runs it and then removes exactly the
# four things that invocation also creates:
#
#   1. `.trellis/spec/{backend,frontend}/` — template layers this repo has no use
#      for (see `.trellis/spec/index.md`, which says not to recreate them)
#   2. `.trellis/tasks/00-join-<name>/` — prevented by writing `.trellis/.developer`
#      first, which stops `trellis init` taking its "new developer" branch
#   3. `.trellis/workspace/<git-user-name>/` — prevented the same way; it would
#      otherwise be derived from `git config user.name`
#   4. a rewritten `.trellis/.template-hashes.json` — restored from a byte
#      snapshot, because `trellis init` drops the `AGENTS.md` entry
#
# Every removed directory is one that did not exist before this script's own
# `trellis init` call, so tracked and user content is never a candidate.
#
# The developer name is the system username (`id -un`), not `git config user.name`.
# Only the `name=` line of `.trellis/.developer` is touched: that file also carries
# a per-developer `workflow=<id>` override (see `.trellis/config.yaml`), which a
# wholesale rewrite would delete.
#
# Usage:
#   scripts/install-trellis.sh          repair if incomplete, no-op if complete
#   scripts/install-trellis.sh --help   show this text
#
# Exits 0 without changes when the CLI is absent: this script is one step of
# `setup.sh`, and a machine without Trellis must still get a working Pi harness.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '  %-8s %s\n' "$1" "$2"; }
note() { printf '  \033[33m!\033[0m %s\n' "$1"; }

usage() {
  awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "$0"
}

while [ $# -gt 0 ]; do
  case "$1" in
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "unknown option: $1" >&2
    echo
    usage >&2
    exit 2
    ;;
  esac
done

# The role agents `pi-subagents` discovers from `.pi/agents/`, and that
# `pi-agent/extensions/trellis-subagents-bridge/index.ts` dispatches to. Their
# names are a contract, which is why this list is enumerated; `doctor.sh`
# enumerates the same three.
TRELLIS_ROLES=(trellis-implement trellis-check trellis-research)

developer_name() {
  [ -f "$REPO_DIR/.trellis/.developer" ] || return 0
  sed -n 's/^name=//p' "$REPO_DIR/.trellis/.developer" | head -n 1
}

# Everything this script owns, in one predicate. `setup.sh` is the update path, so
# a machine that is already wired must be left completely alone.
surfaces_complete() {
  [ -f "$REPO_DIR/.pi/settings.json" ] || return 1
  [ -f "$REPO_DIR/.pi/extensions/trellis/index.ts" ] || return 1

  local role
  for role in "${TRELLIS_ROLES[@]}"; do
    [ -f "$REPO_DIR/.pi/agents/$role.md" ] || return 1
  done

  # Prompts and skills are discovered rather than enumerated: their file names are
  # upstream template names this repo has no contract with.
  compgen -G "$REPO_DIR/.pi/prompts/*.md" >/dev/null || return 1
  compgen -G "$REPO_DIR/.agents/skills/trellis-*/SKILL.md" >/dev/null || return 1

  # The identity is this script's to maintain too, so a `.developer` that
  # disagrees with the system username is not "complete".
  [ "$(developer_name)" = "$(id -un)" ] || return 1

  return 0
}

# Top-level directories under the three tree roots `trellis init` writes into.
# `-mindepth 1 -maxdepth 1` means a file created inside an *existing* directory is
# never a prune candidate; only whole new directories are. `sort` makes the
# before/after comparison exact rather than order-dependent.
trellis_tree_dirs() {
  local roots=() root
  for root in "$REPO_DIR/.trellis/spec" "$REPO_DIR/.trellis/tasks" \
    "$REPO_DIR/.trellis/workspace"; do
    [ -d "$root" ] && roots+=("$root")
  done
  [ ${#roots[@]} -gt 0 ] || return 0
  find "${roots[@]}" -mindepth 1 -maxdepth 1 -type d | sort
}

if surfaces_complete; then
  say ok ".pi/ adapters and .agents/skills/trellis-* (already present; name=$(id -un))"
  exit 0
fi

if ! command -v trellis >/dev/null 2>&1; then
  note "trellis CLI not on PATH; skipping (install: npm install -g @mindfoldhq/trellis)"
  exit 0
fi

hashes="$REPO_DIR/.trellis/.template-hashes.json"
developer="$REPO_DIR/.trellis/.developer"
tmp_hashes="/tmp/pi-trellis-hashes.$$"
tmp_developer="/tmp/pi-trellis-developer.$$"
tmp_init="/tmp/pi-trellis-init.$$"
tmp_developer_new="/tmp/pi-trellis-developer-new.$$"

# A CLI newer than the project generates adapters from the newer templates. That
# is worth saying out loud, but not worth blocking on: advancing the project
# version rewrites tracked files and needs a reviewable diff, which is
# `trellis update`'s job, not this script's.
cli_version="$(trellis --version 2>/dev/null | tr -d '[:space:]' || true)"
project_version=""
[ -f "$REPO_DIR/.trellis/.version" ] &&
  project_version="$(tr -d '[:space:]' <"$REPO_DIR/.trellis/.version" || true)"
if [ -n "$cli_version" ] && [ -n "$project_version" ] &&
  [ "$cli_version" != "$project_version" ]; then
  note "trellis CLI $cli_version != project $project_version; the adapters will come from the CLI (run 'trellis update' to move the project)"
fi

# Snapshot before touching anything, so a failed `trellis init` can leave the tree
# exactly as it was found.
hashes_existed=0
if [ -f "$hashes" ]; then
  cp "$hashes" "$tmp_hashes"
  hashes_existed=1
fi
developer_existed=0
if [ -f "$developer" ]; then
  cp "$developer" "$tmp_developer"
  developer_existed=1
fi

identity="$(id -un)"

# `trellis init` only skips its "new developer" branch when this file already
# exists, and that branch is what creates the join task and the duplicate
# workspace directory. So the identity is written first, not by `init`.
if [ "$developer_existed" = 0 ]; then
  printf 'name=%s\ninitialized_at=%s\n' "$identity" "$(date -Iseconds)" >"$developer"
  say create ".trellis/.developer  (name=$identity)"
else
  previous="$(developer_name)"
  if [ "$previous" != "$identity" ]; then
    # awk rewrites the `name=` line in place and passes every other line through
    # byte-for-byte, so a `workflow=` override survives.
    awk -v n="$identity" '/^name=/{print "name=" n; next} {print}' \
      "$developer" >"$tmp_developer_new"
    cp "$tmp_developer_new" "$developer"
    rm -f "$tmp_developer_new"
    say sync ".trellis/.developer  ($previous -> $identity)"
  fi
fi

before_dirs="$(trellis_tree_dirs)"

# `-u` is redundant here (measured: with `.developer` present, `init` leaves it
# byte-identical) but it makes `init`'s own "Developer:" line honest — without it
# the CLI echoes `git config user.name`, the value this script exists to avoid.
if trellis init --pi -y -s -u "$identity" >"$tmp_init" 2>&1; then
  rm -f "$tmp_init"
else
  sed 's/^/  /' "$tmp_init"
  [ "$hashes_existed" = 1 ] && cp "$tmp_hashes" "$hashes"
  [ "$developer_existed" = 1 ] && cp "$tmp_developer" "$developer"
  rm -f "$tmp_init" "$tmp_hashes" "$tmp_developer"
  say error "trellis init failed (see above); .trellis/ left as it was found"
  exit 1
fi

say install ".pi/ adapters and .agents/skills/trellis-*  (trellis init --pi)"

# Prune only what this run created. Anything present beforehand is tracked or user
# content, so the rule cannot delete a directory this repo owns — a name
# blocklist (`backend`, `frontend`, `00-join-*`) could not make that claim.
after_dirs="$(trellis_tree_dirs)"
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  printf '%s\n' "$before_dirs" | grep -qxF "$dir" && continue
  rm -rf "${dir:?}"
  say prune "${dir#"$REPO_DIR"/}  (created by trellis init; not a layer of this repo)"
done <<<"$after_dirs"

# `trellis init` drops the `AGENTS.md` hash entry (87 -> 86), and adds nothing for
# the template layers it just created. Left alone, `AGENTS.md` silently leaves the
# template-tracked set and `trellis update` stops managing it.
if [ "$hashes_existed" = 1 ] && ! cmp -s "$tmp_hashes" "$hashes"; then
  cp "$tmp_hashes" "$hashes"
  say sync ".trellis/.template-hashes.json  (reverted; init's rewrite drops AGENTS.md)"
fi

rm -f "$tmp_hashes" "$tmp_developer"

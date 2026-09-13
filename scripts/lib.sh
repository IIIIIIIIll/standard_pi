#!/usr/bin/env bash
#
# lib.sh — the single definition of the harness path lists.
#
# Sourced, never executed. Holds the harness path lists (data only) that
# setup.sh symlinks, sync.sh pulls back and reports, and doctor.sh verifies.
# Do not add helpers here.
#
# Consumers: setup.sh, scripts/sync.sh, scripts/doctor.sh
#
if [ -n "${PI_SETUP_LIB_LOADED:-}" ]; then
  return 0
fi
PI_SETUP_LIB_LOADED=1

# Resource directories symlinked into the Pi config dir when present in the repo.
readonly PI_DIRS=(themes prompts tools skills agents extensions)
# Resource files symlinked the same way.
readonly PI_FILES=(AGENTS.md)

# Machine-local Pi paths that are deliberately never synced. sync.sh reports
# them under "Managed elsewhere"; doctor.sh checks that every one is covered by
# .gitignore. Directory entries need the trailing slash: `git check-ignore`
# treats `pi-agent/sessions` and `pi-agent/sessions/` differently.
# The array order is the report order, so a new path goes where it should read.
readonly PI_NOT_SYNCED=(
  auth.json models-store.json models.json trust.json
  sessions/ npm/ git/ bin/ cache/ agent-memory/
  missions/ profiles/ web-search-cache/ run-history.jsonl
)

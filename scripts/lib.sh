#!/usr/bin/env bash
#
# lib.sh — the single definition of the harness resource lists.
#
# Sourced, never executed. Holds ONLY the paths that setup.sh symlinks,
# sync.sh pulls back, and doctor.sh verifies. Do not add helpers here.
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

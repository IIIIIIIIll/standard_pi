# Implementation plan — omp Agent Hub port

Status: **not started.** `task.py start` has not been run; this is the deferred plan for when the
decision is made. Design and evidence: `design.md`, `research/omp-agent-hub-findings.md`.

## Prerequisites

1. Sync the omp checkout with upstream before porting from it (the fork clone is at 18.0.0; the
   installed binary is 18.1.21):
   `git -C /home/tan/agent_harness_test/oh-my-pi remote add upstream git@github.com:can1357/oh-my-pi.git && git -C /home/tan/agent_harness_test/oh-my-pi fetch upstream --tags`
2. Confirm the port still compiles against the *current* pi-tui: re-run the harness
   (`research/omp-agent-hub-findings.md` → Reproduction) after any pi upgrade.
3. Decide the two open scope questions in `prd.md` (Ship scope; relationship to pi-subagents Fleet).

## Steps

1. **Probe the metrics source.** Import or reproduce pi-subagents' run-artifact scan and dump one real
   roster row's fields. Gate: cost, tokens, requests, tools, model, agent, session file all present.
   If a field is missing, confirm the fallback before writing UI code.
2. **Scaffold the extension** at `pi-agent/extensions/agent-hub/` (`index.ts` + `config.json` if
   needed). No `setup.sh` change: `pi-agent/extensions/` is already symlinked to
   `~/.pi/agent/extensions/` and hot-reloads with `/reload`.
3. **Port the five UI files** with the nine deltas from `design.md`. Reuse the harness's `adapt.patch`
   as the starting point rather than re-deriving it.
4. **Write the roster adapter** in front of the ported renderer, mapping engine rows to omp's row shape.
5. **Wire actions:** RPC `steer`; `Enter` → close hub → `ctx.switchSession(childSessionFile)` with the
   parent path pushed onto a stack; a return command that pops it.
6. **Register the chord and command** (`pi.registerShortcut`, `pi.registerCommand`). Check for collisions
   at implementation time — pi-subagents registers none today.
7. **Transcript path:** tail the child `session.jsonl` read-only for running agents; prototype the
   fullscreen route (`TuiAltScreen`) for the viewer; fall back to a large overlay if it fights the API.

## Validation

- [ ] `tsc` clean against the installed pi-tui types (the harness proves this is achievable).
- [ ] Roster renders at 120 and 60 columns, flat and tree, with `usage —` where data is missing.
- [ ] With one async subagent running: rows appear, metrics are plausible, `steer` reaches the child.
- [ ] On a settled subagent: `Enter` switches in, the transcript is readable, the return path works.
- [ ] Attempting to type into a running child is impossible by construction (rule 1 of the contract).
- [ ] `/reload` and a fresh session leave no stale registry subscriptions or timers.
- [ ] `./setup.sh` twice, then `./scripts/doctor.sh` → `All good.` (repo-level, unchanged surfaces).
- [ ] `git status --short` clean after `setup.sh`.

## Review gates

Stop and re-plan if:

1. The metrics source cannot supply cost/tokens/model without reimplementing pi-subagents internals.
2. The fullscreen transcript route requires a pi-tui change rather than an extension change.
3. The port starts pulling in omp's in-process runtime — that is the rejected scope, not a shortcut.
4. pi-subagents ships an equivalent hub upstream; contribute instead of maintaining a duplicate.

## Rollback

The extension is one directory under `pi-agent/extensions/` plus one tracked registration. Removing the
directory and re-running `./setup.sh` returns the harness to its current state; pi-subagents is never
modified.

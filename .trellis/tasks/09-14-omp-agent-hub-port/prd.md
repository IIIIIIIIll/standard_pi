# Port the omp Agent Hub subagent UI to pi

## Goal

Decide whether to bring omp's **Agent Hub** (its live subagent roster + inspector TUI) to pi as a
hand-placed extension, and record the evidence gathered so far. Implementation is **deferred**; this
task currently holds research and design only.

## Requirements

1. Record what omp's Agent Hub is, where it lives, and how its data layer is wired — with file-level
   evidence, not recollection.
2. Record whether the UI files port to pi's TUI (`@earendil-works/pi-tui` 0.85.1) and at what cost,
   measured rather than estimated.
3. Record how a pi-side hub would obtain roster data (pi-subagents engine) and which integration
   seams exist.
4. Record the session-navigation behaviour a hub would depend on: what can be inspected after a
   switch, what persists, what is discoverable.
5. Capture explicit non-goals so the deferred implementation cannot silently grow.
6. Leave the eventual implementation with acceptance criteria that are testable without reading this
   session's chat history.

## Non-goals

- Porting omp's in-process subagent runtime (`task/`, `registry/`, `irc/`, `advisor/`, `vibe/`, or
  `session/agent-session.ts`). omp runs subagents in-process; pi-subagents runs them as child
  processes. Adopting omp's model is a harness replacement, not a port.
- Forking or patching `pi-subagents` in place. It is an npm package refreshed by `pi update
  --extensions` (setup.sh step 5); in-place edits are lost.
- A cross-session browser that lists every historical subagent from every session. Deferred
  deliberately; see `design.md`.
- Any change to this config-store repo's scripts, settings, or symlink layout beyond registering the
  new extension once it exists.

## Acceptance criteria

For the research deliverable (this task, current state):

- [x] `research/omp-agent-hub-findings.md` records the experiments with method, result, and the exact
      commands or file paths that produced them.
- [x] Verified facts and unverified assumptions are labelled as such.
- [x] `design.md` states the engine/UI split, the TUI adaptation deltas, and the session-navigation
      contract.
- [x] `evidence/` holds the raw experiment output (type-check errors, render output).

For a future implementation task (not started):

- [ ] `pi-agent/extensions/agent-hub/index.ts` opens a roster+inspector overlay from a chord and a
      slash command.
- [ ] Roster rows show status, agent, parent, model role, task/activity, cost, tokens, requests,
      tools, and age, sourced from pi-subagents run artifacts.
- [ ] `Enter` on a settled row switches into that child session; the parent path is retained so
      returning is one action.
- [ ] Typing into a **running** child is not possible from the hub (steer goes to the RPC instead).
- [ ] `/reload` and a fresh session leave no stale registrations or timers.

## Open decisions

| Decision | Options | Owner |
| --- | --- | --- |
| Ship scope | current-session roster only / plus cross-session browser | user |
| Relationship to pi-subagents' Fleet | coexist / hub primary with `fleetView: false` + `asyncWidget: false` / upstream instead | user |
| Enter semantics | switch into the child session / read-only in-hub transcript only | user |
| When | after the other active tasks / now | user |

## Notes

- Status stays `planning`. No code has been written for the port itself; the experiment harness lives
  outside the repo and is described in the findings doc.

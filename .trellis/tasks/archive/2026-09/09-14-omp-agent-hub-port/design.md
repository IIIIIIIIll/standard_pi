# Design — omp Agent Hub as a pi extension

Status: **design only, not started.** Evidence for every claim here is in
`research/omp-agent-hub-findings.md`.

## Shape

Port the *presentation* layer, keep pi-subagents as the *engine*.

```
pi-subagents (engine, untouched)          agent-hub extension (new)
  spawn / async jobs / worktrees            overlay roster + inspector
  steer / stop / resume  ──── RPC ────▶     actions
  run artifacts on disk  ──── read ────▶    roster metrics
  child session.jsonl    ──── tail ────▶    transcript viewer
  ctx.switchSession()    ──── focus ───▶    Enter on a settled agent
```

Nothing is deleted: pi-subagents keeps every command and its Fleet UI unless the user turns those
surfaces off (`fleetView: false`, `asyncWidget: false` — see findings E12).

## Scope

**In:** a roster + inspector overlay for the **current session's** subagents (live and settled),
opened by chord and by slash command; read-only inspection of any child transcript; steering through
the existing RPC; session focus for settled agents.

**Out:** cross-session history browser (deferred, sized below); revive/kill parity with omp's in-process
lifecycle; advisor rows (omp-specific concept, no pi equivalent); collab-guest remote rows.

Rationale for current-session scope: that is what omp does (`registerPersistedSubagents` takes one
`sessionFile`) and what pi-subagents filters to (`belongsToCurrentSession`). Matching it keeps the port
inside the measured ~2.5–3 day envelope.

## Component map

| omp file (lines) | Disposition | What changes |
| --- | --- | --- |
| `agent-hub.ts` (1,132) | port | imports, mouse handling, `render` signature, `dispose`, fullscreen option |
| `agent-transcript-viewer.ts` (650) | port | ScrollView/Editor adapters, `invalidate`, mouse, `render` signature |
| `agent-hub-projection.ts` (248) | port as-is | none (its earlier diff was only the import rewrite) |
| `agent-hub-renderer.ts` (196) | port | `Ellipsis`, `ThinkingLevel` as value |
| `overlay-box.ts` (238) | port | `padding`, component-child typing, `invalidate` |
| `chat-transcript-builder.ts` | reuse from omp | not exercised by the roster path |
| `registry/*`, `irc/*`, `modes/session-observer-registry.ts` (1,952) | **replace with an adapter** | omp's in-process registry has no pi equivalent |

## The nine adaptation deltas (measured)

These are the complete set that took the compile from 47 errors to 0. They are the port's contract.

| # | Delta | Why | Cost |
| --- | --- | --- | --- |
| 1 | `render(): readonly string[]` → `string[]` | pi's `Component.render` returns a mutable array | one signature per component |
| 2 | Raw SGR parsing in `handleInput` → `handleMouse(event: TuiMouseEvent)` | pi normalizes mouse events; `routeSgrMouseInput`/`routeSelectListMouse`/`SelectListMouseTarget` do not exist | rewrite, ~40 lines |
| 3 | `Container.handleMouse` must return `TuiMouseDispatchResult` (`{handled, target:{component, originX, originY, width, height}}`) | pi's `Container` contract, not `boolean` | 3 lines |
| 4 | Add `invalidate()` to components | pi's `Component` requires it; omp's does not | 2 files, 1 line each |
| 5 | `padding`, `Ellipsis` shims | omp's `padding` is in its TUI fork; `Ellipsis` is a native addon enum while pi's `truncateToWidth` takes a string | trivial |
| 6 | `ScrollView` → line-array adapter | omp's owns `string[]` with `setLines`/`setHeight`/`scroll`/`scrollToTop`/`scrollToBottom`/`getScrollOffset`/`getMaxScrollOffset`; pi's wraps a `Component` and exposes `scrollBy`/`scrollToStart`/`scrollToEnd`/`scrollTop`/`updateLayout` | ~60 lines |
| 7 | `Editor` → `MaxHeightEditor` adapter | omp constructs with theme only and calls `setMaxHeight`; pi's is `(tui, theme, options?)` with no height clamp | ~15 lines |
| 8 | `ThinkingLevel` value → string comparisons | omp's union has an extra `"inherit"` member and is usable as a value; pi's is type-only and stops at `"max"` | trivial |
| 9 | Drop `{ fullscreen: true }` from the overlay options | pi has no such option; fullscreen is `TuiMode`/`TuiAltScreen` | needs a decision — see risks |

Totals measured: **+90 / −89 lines** across the five ported files, plus a 178-line shim module.

## Session-navigation contract

Four rules the hub must follow, derived from findings E5–E8:

1. **Live agents are read-only in the hub.** Tail the child `session.jsonl` and render it; do not open
   it for writing. Session writes are `appendFileSync` with no lock, and the child process owns the
   file while the run is live.
2. **Steering goes through the RPC** (`steer`/follow-up), never through a switch into the running
   child.
3. **`Enter` on a settled agent switches sessions**, and the hub must close itself first — a switch
   tears down the current runtime and the old `ctx` throws afterwards.
4. **Keep a path stack.** The parent path must be captured when switching (a switch's `session_start`
   carries `previousSessionFile`), because a child session file is invisible to `/resume` and has no
   persisted parent link in either direction. `/resume` remains a manual fallback since parents are
   top-level files.

## Roster data adapter (the real work)

Not a port — new code:

1. Read run artifacts (pi-subagents' own `listAsyncRuns`-equivalent scan, or import its subpath export
   if one is public) for status, agent, model, cost, tokens, requests, tools, activity, session file.
2. Map to the omp row shape the ported renderer already consumes (`id, displayName, kind, parentId,
   status, session, sessionFile, createdAt, lastActivity, activity, history.metrics`).
3. Map statuses: running → `running`; settled-but-resumable → `parked`; settled → `idle`; killed → `aborted`.
4. Unread counts from pi-subagents' intercom bridge; omit the row segment when unavailable.
5. Cross-check with the RPC `status` snapshot for live-ness, understanding it carries no metrics (E4).

Estimated **~100–150 lines**, plus the disk-scan caching needed to keep a refresh tick cheap.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Port the hub UI, keep pi-subagents as engine | **Recommended.** Measured, bounded, keeps a maintained 99k-line engine. |
| Port omp's whole subagent system (in-process runtime) | Rejected. ~25,200 lines coupled to a 9,685-line runtime; replaces pi-subagents entirely; weeks, plus permanent merge burden on a fast-moving fork. |
| Fork pi-subagents and edit its UI in place | Rejected. npm package refreshed by `pi update --extensions`; edits are lost. |
| Contribute the hub upstream to pi-subagents | Preferred long-term if it should be maintained by someone else; slower to land and subject to upstream review. |
| Keep pi-subagents Fleet and change nothing | Viable zero-cost baseline; the delta is omp's inline session focus, `r`-revive, chord opening, and the roster+inspector layout. |

## Deferred: cross-session browser

Feasible because the nested directory layout encodes the parent (E7: 36 children, 0 orphans). Would
cost roughly **+0.5–1 day** on top of the port:

1. Scope toggle (`this session` / `all sessions`), reusing the existing flat/tree keystroke pattern.
2. Group rows by parent session; needs a group header or session column.
3. Lazy scan with mtime invalidation — the roster refresh ticks every 750 ms–5 s and must not walk every
   child directory.
4. Orphan bucket for parents whose session file was deleted.
5. Project filter (current cwd's key vs all keys).

Rows from other sessions are browse-only; they cannot be steered or revived meaningfully.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Fullscreen transcript viewer has no direct pi equivalent | The in-hub transcript may be size-limited rather than fullscreen | Prototype `TuiAltScreen` early, or fall back to a large overlay |
| Metrics adapter may miss fields at real scale | Rows show `usage —` where a number is expected | Verify against real run artifacts first; the ported renderer already renders `usage —` gracefully |
| omp source is 18.0.0 while the installed binary is 18.1.21 | Porting from stale source | Sync the checkout with upstream tags before implementing |
| Two overlapping subagent UIs | Confusion during adoption | Decide the Fleet surfaces up front (`fleetView`, `asyncWidget`); both are reversible config keys |
| Duplicated work if pi-subagents adds a hub | Rework | Check upstream before starting; consider contributing rather than forking |

## Estimate

| Phase | Effort |
| --- | --- |
| Port + shims + compile clean | 3–4 hours (already proven; mechanical) |
| Roster data adapter | 1 day |
| Session focus, path stack, revive/kill wiring | 0.5–1 day |
| Fullscreen transcript route + polish | 0.5 day |
| **Total for a working v1** | **~2.5–3.5 days** |

Cross-session browser: +0.5–1 day, separately scoped.

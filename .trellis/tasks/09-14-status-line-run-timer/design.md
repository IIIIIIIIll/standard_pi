# Design — Replace pi-timer with a status-line run timer

## Purpose

Remove the harness's dependence on a package that replaces Pi's footer, and
re-home the one thing that package was installed for.

The failure being fixed is not a missing feature; it is **ownership**. `pi-timer`
calls `ctx.ui.setFooter()` (`run-timer.ts:100`) and returns a hand-written footer
component. Its `render()` reproduces Pi core's layout from a copy made at some
earlier version, and that copy pushes `↑ ↓ R W $ ctx%`
(`run-timer.ts`, `statsParts`) while core pushes `↑ ↓ R W $ CH<rate>% ctx%`
(`footer.js:118-123`). The `CH` segment and core's `kimi-coding` subscription case
(`footer.js:127`) were therefore deleted the moment the package was installed —
silently, because a replaced footer produces no warning.

The previous repair, `pi-agent/extensions/cache-hit-rate.ts`, re-published `CH`
on the status line. That was correct but incomplete: it left the *cause* in place,
so the harness still ran a package that owns line 2 and still shadowed every
future core footer change. This design removes the cause. The timer moves to the
status line too, and the repair extension is deleted.

## The ownership rule this establishes

> **No extension under `pi-agent/extensions/` may call `ctx.ui.setFooter()`.**

Line 2 belongs to Pi core. Extensions compose onto line 3 through
`ctx.ui.setStatus(key, text)`, which both core's footer and any custom footer
render identically — core at `footer.js:210-219`, pi-timer's rebuild at the same
block. A status key is additive: two extensions can both publish without either
seeing the other's output, and removal is `setStatus(key, undefined)`.

This is the generalizable lesson, and it is why the rule is written into the spec
rather than left as a comment on one file. The next package that calls
`setFooter()` will delete whatever the current one added, exactly as pi-timer
deleted `CH`.

## Component: `pi-agent/extensions/run-timer.ts`

A single-file global extension. No imports, no `fs`, no config, no state that
outlives the process — the same profile as the `cache-hit-rate.ts` it replaces,
and the same profile `pi-timer` had.

### State machine

Module-level, per process:

| Variable | Meaning |
| -------- | ------- |
| `runStartedAt` | `number \| null` — set on `agent_start`, cleared on `agent_end` |
| `lastElapsedMs` | frozen duration of the most recent completed run |
| `interval` | the 1s ticker, or `null` |

| Event | Transition |
| ----- | ---------- |
| `session_start` | reset: `runStartedAt = null`, `lastElapsedMs = 0`, clear ticker, `setStatus(key, undefined)` |
| `session_switch` | same reset — a different session has no run to report |
| `agent_start` | `runStartedAt = Date.now()`, `lastElapsedMs = 0`, start the ticker, render |
| tick (1s) | render |
| `agent_end` | `lastElapsedMs = Date.now() - runStartedAt`, `runStartedAt = null`, clear ticker, render |
| `session_shutdown` | clear ticker, `setStatus(key, undefined)` |

Rendering is therefore driven by exactly two things: the ticker while a run is
live, and the end-of-run transition. There is no `render()` loop of our own and no
recomputation of session statistics — the timer counts wall-clock time and nothing
else.

**Restart safety:** `agent_start` clears any existing ticker before starting a new
one, and every path that leaves the running state clears it, so repeated
`agent_start`/`agent_end` cycles cannot leak intervals.

### Derived display

The elapsed value is `runStartedAt === null ? lastElapsedMs : Date.now() - runStartedAt`.
When both are at their initial values the status is **cleared** — no timer before
the first run of a session, matching pi-timer.

Formatting is pi-timer's `formatElapsed`, copied so the number reads the same as
it does today:

```text
totalSeconds = floor(ms / 1000)
hours  > 0  ->  `${h}h ${mm}m`      (zero-padded minutes)
minutes > 0 ->  `${m}m ${ss}s`      (zero-padded seconds)
otherwise   ->  `${s}s`
```

Zero-padding is deliberate, not cosmetic: `1m 05s` and `1m 45s` are the same
width, so a counting timer does not jitter the status line's layout once per
second.

The rendered string is `⏱` + the formatted time, wrapped in
`theme.fg("accent", …)` while `runStartedAt !== null` and `theme.fg("dim", …)`
once the run has ended. Colour carries the running/finished distinction so the
text does not have to — `runs for`/`ran for` is 8–13 characters of horizontal
budget, and line 3 is the narrowest line in the footer.

### Status key: `run-timer`

Core's footer and pi-timer's rebuild both do
`Array.from(statuses).sort(([a], [b]) => a.localeCompare(b)).join(" ")` and then
`truncateToWidth` the **whole joined line**. The leftmost entry is therefore the
one that survives a narrow terminal, and string order decides which that is.

`"run-timer".localeCompare("tps") < 0`, so the timer renders before the TPS meter
and is never the thing truncated. After this change the live status keys are
`run-timer` and `tps` (`cache-hit` is deleted with its extension).

## Doc-and-config map

Every site that changes, and why it must change together:

| File | Change | Enforced by |
| ---- | ------ | ----------- |
| `pi-agent/settings.core.json` | remove `npm:pi-timer` (12 → 11 packages) | `render-settings.mjs --check`, `doctor.sh ==>` Settings |
| `pi-agent/extensions/run-timer.ts` | **new** — the timer | `doctor.sh` symlink check (`extensions -> repo`) |
| `pi-agent/extensions/cache-hit-rate.ts` | **deleted** | `git grep cache-hit-rate` returns nothing |
| `pi-agent/extensions/README.md` | replace the "Cache hit rate" section with a "Run timer" one; record why pi-timer was removed | hand-maintained |
| `.trellis/spec/config/pi-resources.md` | drop pi-timer from the verbatim `settings.core.json` copy and the package inventory; drop the pi-timer "no state" paragraph; replace the `cache-hit-rate.ts` subsection with `run-timer.ts` + the no-`setFooter` rule; add the why-not-pi-timer note | **nothing** — hand-maintained. No script reads this file, so the quoted block must be kept byte-equal to `pi-agent/settings.core.json` by hand |
| `README.md` | remove the `npm:pi-timer` table row and the cache-hit-rate paragraph; name the timer extension | hand-maintained |
| `docs/plugins.md` | remove the `npm:pi-timer` entry | `check-docs.mjs` — entry ids must equal `settings.core.json` packages |
| `docs/README.md` | "12 packages" → "11 packages" | hand-maintained |

`docs/plugins.md` and `settings.core.json` must be edited in the **same step**:
`check-docs.mjs` compares them as sets, so an intermediate half-state fails the
check rather than silently passing.

## Boundaries

- **Nothing outside this layer is edited.** Archived task history under
  `.trellis/tasks/archive/` mentions pi-timer and "12 packages" as of the time it
  was written; it is history and is left alone (see PRD Notes).
- **No `fs`, no config, no persistence.** The extension adds nothing to
  `scripts/lib.sh`'s `PI_FILES` / `PI_DIRS` / `PI_NOT_SYNCED`, nothing to
  `.gitignore`, and nothing to `setup.sh`.
- **No footer math is reimplemented.** `CH` comes back because core's footer runs
  again, not because anything in this repo computes it. If a future need appears
  for a line-2 segment, the answer is an upstream Pi change, not another
  `setFooter()` call here.
- **`pi-timer` is not vendored, patched, or forked.** See below.

## Alternatives Rejected

1. **Keep pi-timer and `cache-hit-rate.ts` (the status quo).** Rejected: it keeps
   two sources of truth for one footer value, permanently freezes line 2 at
   pi-timer's fork point, and needs a new repair extension every time core adds a
   line-2 segment. It also leaves the harness shipping a package whose main
   effect is to shadow core.
2. **Patch `run-timer.ts` inside `node_modules`.** Rejected: overwritten by any
   `pi install` or `pi update --extensions` — the latter runs on **every**
   `setup.sh` invocation — so the fix would silently revert.
3. **Vendor a patched pi-timer fork into `pi-agent/extensions/`.** Rejected: it
   keeps the timer on line 2 but makes this repo the owner of a ~280-line
   reimplementation of core's footer, which then has to be re-synced against
   every core footer change by hand. The bug being fixed *is* owning the footer;
   this alternative pays that cost on purpose.
4. **Wait for an upstream fix.** Rejected: `0.1.4` is the latest release and the
   `0.1.5` development tree contains no `latestCacheHitRate` or `CH` code. There is
   no fix in flight.
5. **Accept the loss of `CH` and keep pi-timer as-is.** Rejected: `CH` is a real
   signal about prompt-cache health, and it is free — it is already computed by
   code that is already running.

## Open Risks

- **The `⏱` glyph (U+23F1) may be missing from some terminal fonts**, rendering as
  a replacement box. It is one character inside a themed string; swapping it for
  an ASCII marker is a one-line change if it looks wrong in the user's terminal.
  The alternative previews (`▶`/`■`, or `runs for`/`ran for`) are recorded in the
  PRD's decision history if this needs revisiting.
- **The timer is less prominent.** Line 3 sits below the stats instead of beside
  them. This is the accepted cost of not owning line 2, and it is stated in the
  PRD so the trade is not rediscovered as a defect.
- **Line 3 has finite width** and now carries two meters. The key ordering above
  protects the timer; the TPS string is the one that truncates first, and
  pi-tps-status's own `/tps` modes control its length.
- **A stale machine still running pi-timer keeps working.** Because the extension
  publishes through `setStatus`, a machine whose `settings.json` has not yet been
  re-rendered still shows the timer — pi-timer's rebuild renders statuses with the
  same block. There is no hard cutover requirement between the two footers.
- **`pi remove` is not documented in `README.md`.** Removing a core plugin is a
  new operation for this repo (only "Adding a plugin" is described). The implement
  plan adds the removal command to the implementation steps; whether `README.md`
  gains a symmetric "Removing a plugin" note is deliberately deferred and can be
  settled during implementation without affecting the acceptance criteria.

# Replace pi-timer with a status-line run timer

## Goal

Restore Pi's built-in footer, and get the run timer back without giving up the
footer to do it.

`npm:pi-timer` adds a per-run elapsed timer by calling `ctx.ui.setFooter()` and
**replacing the entire footer** with a hand-written rebuild — the extension API
exposes no composable footer primitive, and pi-timer's own README says so. That
rebuild is a copy of an older footer: it renders `↑ ↓ R W $ ctx%` and omits Pi
core's `CH<rate>%` cache-hit segment (`footer.js:123`) and core's `kimi-coding`
subscription case (`footer.js:127`). Installing it therefore silently deleted
both.

The harness already answered this once with a workaround —
`pi-agent/extensions/cache-hit-rate.ts`, which republishes the cache-hit rate
through `ctx.ui.setStatus()`. This task deletes the workaround along with the
package that made it necessary: the timer is moved onto the same status line,
using the same `setStatus()` surface, so no extension in this layer owns the
footer at all.

Outcome: line 1 = pwd, line 2 = Pi core's own footer (with `CH`), line 3 =
extension statuses (`⏱ 12s` and `⚡ TPS: …`).

## Context (measured 2026-09-14, HEAD `62aeb8e`)

- **pi-timer replaces the footer.** `~/.pi/agent/npm/node_modules/pi-timer/extensions/run-timer.ts:100`
  calls `ctx.ui.setFooter(...)`; the returned component's `render()` returns
  `[pwdLine, statsLine]` plus an optional status line, and its `statsParts`
  pushes stop at `↑ ↓ R W $ ctx%` — no `CH`.
- **Pi core's footer has the segment pi-timer drops.** `dist/modes/interactive/components/footer.js:84`
  computes `latestCacheHitRate` from the latest assistant message, `:118-123`
  pushes `R`/`W`/`CH<rate>%`, and `:127` treats `kimi-coding` as
  subscription-backed. pi-timer checks only `modelRegistry.isUsingOAuth`.
- **No upstream fix is coming.** `0.1.4` is the latest published release
  (2026-08-28); the `0.1.5` development tree does not contain `latestCacheHitRate`
  or `CH` either.
- **`setStatus()` re-renders, so a ticking timer works.**
  `dist/modes/interactive/interactive-mode.js:1617-1620` writes the status and
  then calls `this.ui.requestRender()`. pi-tps-status already animates through
  this path.
- **Both footers render statuses identically.** Core's footer
  (`footer.js:210-219`) sorts statuses by key, joins them with a space, and
  appends them as a third line, truncated to width. pi-timer's rebuild copies the
  same block. So a status line is footer-agnostic — which is exactly why
  `cache-hit-rate.ts` survived pi-timer and why the timer can live there too.
- **Removal propagates cleanly.** `scripts/sync-settings.mjs:24` clones the
  **live** `settings.json`, so `pi remove npm:pi-timer` followed by
  `scripts/sync.sh` writes `settings.core.json` without the entry. The live
  settings carry exactly two machine-owned extras that sync strips or deletes
  (`defaultProvider`/`defaultModel` from the enabled `opencode-go` manifest, and
  `lastChangelogVersion`), so the expected diff is **one deleted line**.
- **No path lists change.** pi-timer imports no `fs` and owns no file, and the
  replacement extension will match that. `scripts/lib.sh`'s `PI_FILES`/`PI_DIRS`
  and `PI_NOT_SYNCED` are untouched; `PI_DIRS` already contains `extensions`.
- **`~/.pi/agent/extensions/` is a symlink into this repo** (verified by
  `doctor.sh`: `extensions -> repo`), so a new `.ts` file there is live on
  `/reload` with no `setup.sh` run.
- **Extension load failures are loud.** `pi -e /tmp/broken-ext.ts` prints
  `Error: Failed to load extension …`, so "no error" is real evidence that a
  discovered extension loaded.
- **`docs/README.md:8` and `scripts/check-docs.mjs` hardcode 12 packages.**
  `check-docs.mjs` compares `docs/plugins.md` entry ids against
  `settings.core.json` packages, so it fails if the package is removed and the
  docs entry is not — the check enforces the pairing for free.
- **Known stale artifact, deliberately not fixed here.** The task
  `09-14-usage-guides-plugins-skills` hardcodes "12 packages" in its PRD, design,
  and research notes. It was **archived during this task's planning** (`ec70a30`),
  so that prose is now frozen history under
  `.trellis/tasks/archive/2026-09/…` rather than a live acceptance criterion.
  This task leaves it alone and records the staleness instead (see Notes).
- **The baseline moved mid-planning.** Everything the previous session left
  uncommitted — the `docs/` guides, `scripts/check-docs.mjs`, the spec rewrite,
  the MCP install work — was committed as `0f46c9f`…`62aeb8e`. The only live
  working-tree changes at planning time are this task's own artifacts and the
  untracked `pi-agent/extensions/cache-hit-rate.ts`. So every edit below lands on
  a clean HEAD, and the post-change diff is attributable to this task alone.

## Requirements

**R1 — pi-timer is fully gone from every live file.** `npm:pi-timer` appears in
no live file: not in `pi-agent/settings.core.json`, not in `README.md`, not in
`docs/`, not in `.trellis/spec/`. Archived task history under
`.trellis/tasks/archive/` is out of scope and keeps its mentions. After
`pi remove npm:pi-timer` + `scripts/sync.sh` the package is also absent from the
live `settings.json`, and `~/.pi/agent/npm/package.json` no longer depends on it.

**R2 — The footer is owned by Pi core alone.** No file under
`pi-agent/extensions/` may call `ctx.ui.setFooter()`. The built-in footer's
`CH<rate>%` and `(sub)` behaviour come back as a consequence, not as a
reimplementation: nothing in this repo recomputes a footer statistic.

**R3 — The timer publishes through `ctx.ui.setStatus()` only.** One status key,
one string, updated by calling `setStatus` again. No `setFooter`, no widget, no
overlay, no writes.

**R4 — Timer behaviour matches what pi-timer provided.** While the agent is
running, the elapsed time advances about once per second. When the run ends the
value freezes and **stays on screen** until the next run starts or the session
changes. There is no timer before the first run of a session.

**R5 — Format and state signalling.** `⏱ 12s` / `⏱ 1m 05s` / `⏱ 1h 02m`, with
the time in the accent colour while running and dim once the run has ended.
Formatting uses pi-timer's units and zero-padding (`1m 05s`, not `1m 5s`) so the
number does not jitter in width as it counts.

**R6 — Truncation safety.** Line 3 is truncated as a single line by `truncateToWidth`,
so the leftmost status survives. The timer's status key must sort **before**
`tps` (`cache-hit` and `tps` are the existing keys). With the timer leftmost,
a narrow terminal loses trailing TPS text rather than the timer.

**R7 — `cache-hit-rate.ts` is deleted, and so is its documentation.** The file
goes, and every section written for it in `pi-agent/extensions/README.md` and
`.trellis/spec/config/pi-resources.md` is replaced or removed. No orphaned
references remain to a file that no longer exists.

**R8 — Why-not-pi-timer is recorded, not just deleted.** The spec keeps a short
note stating that pi-timer was removed *because* it replaced the footer, and that
a footer-replacing extension is the failure mode this layer avoids. Without it,
a future session re-adds the package and re-breaks `CH`.

**R9 — No new state, no new paths.** The replacement imports no `fs`, writes
nothing, and persists nothing, so `scripts/lib.sh`'s path lists, `.gitignore`,
and `setup.sh` are unchanged.

**R10 — Counts and lists agree in every hand-maintained site.**
`docs/plugins.md` has one entry per remaining package (11),
`docs/README.md` says 11, `README.md`'s plugin table has 11 rows,
`settings.core.json` has 11 specs, and the spec's package inventory has 11 rows.
The spec's verbatim copy of `settings.core.json` is updated in step with the real
file.

## Acceptance Criteria

- [x] `git grep -n 'pi-timer' -- ':!*/archive/*' ':!.trellis/tasks/09-14-status-line-run-timer/*'`
      returns matches **only** inside the intentional prose in R8 (the removal
      note), never in a package list, a table row, or an npm package name.
- [x] `./scripts/doctor.sh` ends `No problems.` and its `==> Settings` section
      reports `settings.json matches core + enabled optionals`.
- [x] `node scripts/render-settings.mjs <repo> <live> <state> --check` exits 0.
- [x] `node scripts/check-docs.mjs <repo>` exits 0 and reports **11** plugins.
- [x] `git grep -n 'cache-hit-rate' -- ':!*/archive/*' ':!.trellis/tasks/09-14-status-line-run-timer/*'`
      returns nothing outside the R8 removal note.
- [x] `pi-agent/extensions/run-timer.ts` exists, is discovered at
      `~/.pi/agent/extensions/run-timer.ts` through the existing symlink, and
      contains no `setFooter` call.
- [x] `pi --print --no-tools "reply with exactly: ok"` prints `ok` with no
      `Failed to load extension` line (control: a deliberately broken extension
      does print one).
- [x] Human-verified after `/reload`: line 2 shows `CH<rate>%` again, and line 3
      shows `⏱ <time>` followed by the TPS meter, with the time advancing during a
      run and freezing when it ends.
- [x] Human-verified after `/reload`: no `Cache:` status remains on line 3 — the
      built-in footer's own `CH` is the only cache display.

### Verification record (2026-09-14)

All nine criteria were checked on HEAD `707f017`, after the `/reload` gate.

| # | Criterion | How it was verified |
| --- | ----------- | --------------------- |
| 1 | pi-timer only in removal prose | `trellis-check`, independent pass; also `git grep -nE '^\s*"npm:pi-timer"\|\| \`npm:pi-timer\`\|^### \`npm:pi-timer\`'` → exit 1, no match |
| 2 | `doctor.sh` ends `No problems.` and Settings matches | parent; `✓ settings.json matches core + enabled optionals` |
| 3 | `render-settings.mjs --check` exits 0 | parent; `exit=0` |
| 4 | `check-docs.mjs` reports 11 plugins | parent; `docs cover 11 plugins and 6 skills`, exit 0 |
| 5 | no `cache-hit-rate` outside the removal note | `trellis-check`; only `pi-resources.md:534` and `extensions/README.md:83` |
| 6 | extension discovered, no `setFooter` call | `ls ~/.pi/agent/extensions/run-timer.ts` resolves; `doctor.sh` → `✓ no setFooter() call in 2 extension file(s)` |
| 7 | loads with no error | parent; `ok` printed, negative control with a broken extension printed `Failed to load extension … LOAD-CHECK-MARKER` |
| 8 | `CH` back, timer advances then freezes | human, after `/reload` — reported "CH is back" and "⏱ shows and counts up" |
| 9 | no `Cache:` on line 3 | human, after `/reload` — reported clean |

Criteria 8 and 9 are the only ones no check can observe, so they are the only
ones resting on a human report. Everything else was re-run on the committed
revision, and the commit itself was verified in isolation with `git worktree`
(12 sections printed, the three expected worktree artifacts only).

Two criteria worth noting for a future reader: criterion 5 found no
`cache-hit-rate.ts` deletion in the commit **because git never tracked that
file** — it was an untracked local extension kept live by the
`~/.pi/agent/extensions` symlink — and criterion 6's "2 extension files" is the
complete set, verified by `find`, not a sample.

## Out Of Scope

- Fixing pi-timer upstream, or vendoring a patched pi-timer.
- Adding any footer segment beyond what Pi core already ships.
- Editing `09-14-usage-guides-plugins-skills`'s artifacts, archived or otherwise.
- Rewriting the archived task history under `.trellis/tasks/archive/`, which
  mentions pi-timer and "12 packages" as of the time it was written.
- Deleting the now-unused `pi-timer` sources from `~/.pi/agent/npm/node_modules/`
  by hand — `pi remove` owns that.

## Notes

- **The sibling task's staleness is now archived history, not a live conflict.**
  `09-14-usage-guides-plugins-skills` was archived during planning (`ec70a30`),
  taking its "12 packages" prose with it into
  `.trellis/tasks/archive/2026-09/…`. Nothing live depends on that count any more,
  and archived artifacts are deliberately not rewritten. The one thing worth
  stating plainly: its recorded `docs cover 12 plugins` output no longer
  reproduces, and its archived PRD criterion reads 12 where the live check now
  reports 11. That is the expected consequence of a later change, not a defect —
  the check itself (`scripts/check-docs.mjs`) reads the counts dynamically and
  stays correct.
- **Why a status line rather than a second footer implementation.** The cost of
  pi-timer's approach was not the timer, it was the ownership. Anything that
  calls `setFooter()` takes the whole line 2 with it, and the next such package
  silently deletes whatever the previous one had added. `setStatus()` composes:
  one key per extension, sorted, joined, truncated by whoever owns the footer —
  core today, and pi-timer's rebuild if some other machine still runs it.
- **The timer will be less prominent than before.** Line 3 sits below the stats
  rather than beside them. That is the trade being made deliberately: the timer
  moves down one line, and in exchange `CH`, `(sub)`, and every future core footer
  improvement come back and stay.

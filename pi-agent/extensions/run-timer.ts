// run-timer — per-run elapsed time, published on the footer status line.
//
// Why this exists: the timer used to come from `npm:pi-timer`, which installed
// it by calling `ctx.ui.setFooter()` and returning a hand-written replacement
// for Pi's entire footer. The extension API exposes no composable footer
// primitive, so that replacement is a copy of an older footer — and a copy goes
// stale. Its stats line pushes `↑ ↓ R W $ ctx%` and omits Pi core's `CH<rate>%`
// cache-hit segment (`dist/modes/interactive/components/footer.js`), plus core's
// `kimi-coding` subscription case. Installing the package therefore deleted both
// silently: a replaced footer produces no warning, and no upstream release adds
// them back.
//
// The fix is ownership, not a patched footer. Pi core owns line 2 again, so `CH`
// and every future core footer segment come back by themselves, and this
// extension publishes only through `ctx.ui.setStatus(key, text)` — one key, one
// string, no footer, no widget, no overlay, no writes, no `fs`. Both Pi core's
// footer and any custom footer render the status line identically (sorted keys,
// joined, truncated), so this composes instead of replacing.
//
// THE RULE FOR THIS DIRECTORY: nothing under `pi-agent/extensions/` may call
// `ctx.ui.setFooter()`. The next package that does will delete whatever the
// current line-2 owner added, exactly as pi-timer deleted `CH`.
//
// The status key sorts before `tps`, so the timer is the leftmost entry and is
// the last thing a narrow terminal truncates. The value is wall-clock elapsed
// time only — no session statistics are read or recomputed here.
//
// Zero dependencies, no build step (scripts/node-guidelines.md).

// ── Types ─────────────────────────────────────────────────────────────
// Declared locally rather than pulled from @earendil-works/pi-coding-agent:
// this file has to load without package resolution.
type PiTheme = { fg?: (color: string, text: string) => string };

type PiUi = {
  theme?: PiTheme;
  setStatus?: (key: string, text: string | undefined) => void;
};

type PiContext = { ui?: PiUi };

// Pi invokes every handler as (event, ctx). This extension drives its display
// from the run lifecycle rather than the payload, so the event parameter is a
// bare dictionary: naming a field here would imply it is read somewhere it is not.
type PiEventHandler = (
  event: Record<string, unknown>,
  ctx: PiContext,
) => unknown;

type PiApi = {
  on?: (event: string, handler: PiEventHandler) => unknown;
};

// ── Constants ─────────────────────────────────────────────────────────
const STATUS_KEY = "run-timer";
const GLYPH = "⏱";
const TICK_INTERVAL_MS = 1000;

// ── State (one process, one session at a time) ────────────────────────
let runStartedAt: number | null = null;
let lastElapsedMs = 0;
let ticker: ReturnType<typeof setInterval> | null = null;

// ── Formatting ────────────────────────────────────────────────────────
/**
 * Zero-padded on purpose, not for looks: `1m 05s` and `1m 45s` are the same
 * width, so a counting timer does not jitter the status layout once per second.
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

// ── Rendering ─────────────────────────────────────────────────────────
function stopTicker(): void {
  if (ticker === null) return;
  clearInterval(ticker);
  ticker = null;
}

/**
 * The only writer in this file. Colour carries the running/finished
 * distinction so the text does not have to spend status-line width on words.
 */
function render(ctx: PiContext): void {
  const setStatus = ctx?.ui?.setStatus;
  if (!setStatus) return;

  // Both at their initial values: no run this session has happened yet, so
  // there is nothing to show. Matches pi-timer, which rendered no timer before
  // the first run.
  if (runStartedAt === null && lastElapsedMs === 0) {
    setStatus(STATUS_KEY, undefined);
    return;
  }

  const elapsedMs =
    runStartedAt === null ? lastElapsedMs : Date.now() - runStartedAt;
  const text = `${GLYPH} ${formatElapsed(elapsedMs)}`;
  const theme = ctx?.ui?.theme;
  const themed =
    runStartedAt === null
      ? theme?.fg?.("dim", text)
      : theme?.fg?.("accent", text);

  setStatus(STATUS_KEY, themed ?? text);
}

/** A different session has no run to report. */
function reset(ctx: PiContext): void {
  stopTicker();
  runStartedAt = null;
  lastElapsedMs = 0;
  render(ctx);
}

// ── Wiring ────────────────────────────────────────────────────────────
export default function (pi: PiApi) {
  pi.on?.("session_start", (_event, ctx) => {
    reset(ctx);
    return undefined;
  });

  pi.on?.("session_switch", (_event, ctx) => {
    reset(ctx);
    return undefined;
  });

  pi.on?.("agent_start", (_event, ctx) => {
    // Clearing first is what makes repeated start/end cycles leak nothing.
    stopTicker();
    runStartedAt = Date.now();
    lastElapsedMs = 0;
    render(ctx);
    ticker = setInterval(() => {
      render(ctx);
    }, TICK_INTERVAL_MS);
    return undefined;
  });

  pi.on?.("agent_end", (_event, ctx) => {
    if (runStartedAt !== null) lastElapsedMs = Date.now() - runStartedAt;
    runStartedAt = null;
    stopTicker();
    // Frozen at the finished duration and left on screen until the next run or
    // the next session — the render keeps the value, only the colour changes.
    render(ctx);
    return undefined;
  });

  pi.on?.("session_shutdown", (_event, ctx) => {
    reset(ctx);
    return undefined;
  });
}

# omp Agent Hub — findings and experiments

Recorded 2026-09-14. Everything below was executed or read on this machine during the session that
produced it; each finding names the command or file that established it.

## Provenance

| Component | Version / revision | Path |
| --- | --- | --- |
| omp source (fork clone) | `75ff517780`, 2026-08-23, reports `omp/18.0.0` | `/home/tan/agent_harness_test/oh-my-pi` |
| omp installed binary | `omp/18.1.21` (upstream `v18.1.21` = `a2501722`) | `/home/tan/.bun/bin/omp` |
| omp upstream | `can1357/oh-my-pi` | install script `REPO=can1357/oh-my-pi` |
| pi | `@earendil-works/pi-coding-agent` 0.85.1, `@earendil-works/pi-tui` 0.85.1 | `/home/tan/.nvm/versions/node/v22.22.3/lib/node_modules/@earendil-works/pi-coding-agent` |
| pi-subagents | 0.67.0 (278 source files, 99,429 lines) | `/home/tan/.pi/agent/npm/node_modules/pi-subagents` |

Caveat worth remembering: the fork clone is **21 patch releases behind** the installed binary and its
tags stop at `v18.0.0`. Anything ported from that checkout is ported from 18.0.0 source. Syncing with
upstream (`git remote add upstream git@github.com:can1357/oh-my-pi.git && git fetch upstream --tags`)
was recommended but not performed.

---

## What Agent Hub is

`docs/agent-hub.md` (omp) calls it "the interactive TUI for watching and controlling subagents
associated with the current session". Reading the implementation:

- **Two views in one overlay.** A roster (flat or parent/child tree) plus a per-agent inspector that
  sits beside the roster on wide terminals and replaces it on narrow ones.
- **Three actions.** `r` revives a parked agent, `x` aborts and kills one, `Enter`/click focuses the
  agent's session in the main TUI (or opens the in-hub chat view when there is no focusable session).
- **Two data sources.** A process-global `AgentRegistry` of live in-process `AgentSession` objects,
  and `registerPersistedSubagents(registry, sessionFile, …)` which rebuilds parked historical rows
  from the *current* session's artifact tree.
- **Advisor transcripts** appear as read-only rows and are excluded from agent-facing rosters.

### Code footprint (line counts, `wc -l`)

| Group | Lines | Files |
| --- | --- | --- |
| Hub UI (`agent-hub.ts`, `agent-hub-projection.ts`, `agent-hub-renderer.ts`, `agent-transcript-viewer.ts`, `overlay-box.ts`, `chat-transcript-builder.ts`) | 2,985 | 6 |
| Data layer (`registry/*`, `irc/bus.ts`, `modes/session-observer-registry.ts`) | 1,952 | 5 |
| Hub tools (`tools/hub/*`) | 2,859 | 5 |
| omp task executor (`task/*`) | 12,963 | many |
| `session/agent-session.ts` (the runtime the above depends on) | 9,685 | 1 |

---

## Experiments

### E1 — Compile experiment: does the hub UI port to pi's TUI?

**Method.** Copy the five UI files out of the omp checkout, rewrite `@oh-my-pi/pi-tui` →
`@earendil-works/pi-tui`, generate `any` stubs for the 21 omp-internal modules they import, then run
`tsc --strict` (TypeScript 7.0.2) against the real published pi-tui type declarations.

**Result.** 47 errors, of which 11 were artifacts of the `any` stubs. The remaining ~32 came from
**9 root causes** (the deltas in `design.md`). After adapting: **0 errors**.

| Metric | Value |
| --- | --- |
| Errors, pass 1 | 47 (`evidence/tsc-errors-pass1.txt`) |
| Errors, final | 0 (`evidence/tsc-errors-final.txt`, `evidence/tsc-final-stdout.txt`) |
| Changed lines in the 5 ported files | +90 / −89 |
| New adaptation module | `pi-shims.ts`, 178 lines |

**What the stub layer does and does not prove.** The 21 stubs isolate the *presentation* layer, so the
compile result is a real measurement of TUI API compatibility. The stubs also mean the **data layer
was never exercised end-to-end** — that integration is assessed only architecturally (E9–E11).

### E2 — Symbol coverage

**Method.** Extract every symbol the five files import from `@oh-my-pi/pi-tui`, then check each against
`pi-tui/dist/index.d.ts`.

**Result.** **10 of 15 exist.** Missing: `Ellipsis`, `padding`, `routeSgrMouseInput`,
`routeSelectListMouse`, `SelectListMouseTarget`. pi-tui has `MouseRegion`, `HStack`, `VStack`,
`ScrollView`, `SelectList` instead.

### E3 — Does the hub actually render?

**Method.** Build a render harness that seeds a fake roster (running parent + two children, a parked
agent with restored metrics, an aborted agent, an advisor row, unread IRC counts) and calls
`AgentHubOverlayComponent.render(width)`.

**Result.** Renders correctly at 120 columns (two-pane) and 60 columns (roster only), in both flat and
tree modes — 134 lines of output in `evidence/render-output.txt`. Parent/child markers (`↳`, `├──`),
unread badges (`⧉ 2`), status glyphs, cost/requests/tools/tokens, and the context gauge
(`━━━─────── 51.2k/200.0k 26%`) all appear.

Notably, omp's own `AgentHubDeps` documents test support — *"TUI handle for transcript components;
tests omit it and get a render-only stub"* — which is what made this cheap.

**Not verified:** mouse interaction, the fullscreen transcript path, revive/kill (they call
`AgentLifecycleManager`), and anything that needs a live TUI.

### E4 — pi-subagents RPC `status` payload: enough for a roster?

**Method.** Call pi-subagents' own projection function (`projectAsyncStatusSnapshot`) with a job
carrying `totalTokens: 184320`, `totalCost: 3.42`, `model: "claude-sonnet-4-6"`, then inspect the
result.

**Result — the payload is shape-only:**

```
top-level keys: kind, version, generatedAt, caps, omitted, runs
node keys:      id, kind, label, state, startedAt, updatedAt, activity
activity keys:  state, currentTool, turnCount, toolCount
has cost? false | has tokens? false | has model? false
```

Cost, tokens, and model are **dropped**, and the snapshot is session-scoped and in-memory. Consequence
for the port: the roster's metrics must come from pi-subagents run artifacts on disk (the way its own
Fleet does via `listAsyncRuns`), not from the RPC. Estimated adapter cost: **~100–150 lines**.

Available RPC methods (`src/extension/rpc.ts`): `ping, status, manage, spawn, steer, interrupt, stop,
resume`, dispatched as events (`subagents:rpc:v1:request` → `subagents:rpc:v1:reply:<requestId>`).

### E5 — What `ctx.switchSession` actually does

**Method.** Read the implementation in pi's bundle, not just the docs.

```js
async switchSession(sessionPath, options) {
  const beforeResult = await this.emitBeforeSwitch("resume", sessionPath);
  if (beforeResult.cancelled) return beforeResult;
  const previousSessionFile = this.session.sessionFile;
  const sessionManager = SessionManager.open(sessionPath, void 0, options?.cwdOverride);
  assertSessionCwdExists(sessionManager, this.cwd);
  await this.teardownCurrent("resume", sessionManager.getSessionFile());
  this.apply(await this.createRuntime({ cwd: sessionManager.getCwd(), sessionStartEvent: { type: "session_start", reason: "resume", previousSessionFile }, … }));
  await this.finishSessionReplacement(options?.withSession);
  return { cancelled: false };
}
```

**Consequences.**

1. Any path is accepted; the file does not have to live in the session store.
2. The recorded `cwd` must exist on disk (`assertSessionCwdExists`) — a subagent that ran in a cleaned-up
   git worktree cannot be switched into without `cwdOverride`.
3. It is a **session replacement**: the current runtime is torn down, `session_start` fires again with
   `reason: "resume"`, and the old `ctx` throws afterwards. The hub overlay therefore cannot stay open
   across a switch.
4. `previousSessionFile` is available to the `session_start` handler — this is the only programmatic
   back-pointer; it is not persisted (see E7).

### E6 — Are child sessions real pi sessions?

**Method.** Inspect an actual child session file.

**Result.** Yes — same v3 header, same cwd, plain JSONL:

```
/home/tan/.pi/agent/sessions/--home-tan-my_pi_setup--/<ts>_<uuid>/<child-uuid>/run-0/session.jsonl
{"type":"session","version":3,"id":"01a0a038-…","timestamp":"…","cwd":"/home/tan/my_pi_setup"}
```

So switching into one gives the full pi experience: transcript, tool output, thinking blocks, `/tree`.

### E7 — Discoverability is one-way (the limitation)

**Method.** `listSessionsFromDir` is `readdir(dir)` + `.jsonl` filter — flat, non-recursive. Counted
what that means on disk.

| Project key | Parent sessions (visible) | Nested child sessions (invisible) | Artifact JSONLs |
| --- | --- | --- | --- |
| `--home-tan-my_pi_setup--` | 59 | 36 | 40 |
| `--home-tan-r2s--` | 2 | 0 | 0 |
| `--tmp--` | 1 | 0 | 0 |

**Result.**

- You can switch **into** any child if you have its path; you can switch **back** to the parent because
  parents are top-level and appear in `/resume`.
- The child session itself will never appear in `/resume` or `SessionManager.list()`. Going back to it
  later requires the path.
- There is **no persisted parent link in either direction**: `switchSession` does not write
  `parentSession` into the target file (only `/fork`, `/clone`, and `newSession({ parentSession })` do),
  and `previousSessionFile` exists only in the live event payload.
- **Cross-session grouping is still available by path**: the containing directory is named after the
  parent session (`<ts>_<uuid>/`), and on this machine all 36 child sessions mapped to an existing
  parent file — 0 orphans. Only 7 of 59 sessions ever spawned subagents (1–10 children each).

### E8 — Two formats that look alike

`subagent-artifacts/<runid>_<agent>_transcript.jsonl` is **not** a pi session. It is pi-subagents' own
record stream:

```
{"version":1,"recordType":"message","source":"async","runId":"…","agent":"trellis-implement","childIndex":0,"cwd":"…","sourceEventType":"initial_prompt","role":"user","text":"…"}
```

Its sibling `_meta.json` carries `runId, agent, task, exitCode, model, attemptedModels, usage,
acceptance, launchContractDigest, launchResolvedExtensions, transcriptPath, skills, timestamp` —
**no `sessionId`, no `parentSession`**. So the flat artifact directory (shared by every session in the
project, 40 JSONLs interleaved here) cannot be grouped by session; only the nested session directory
layout can.

### E9 — Retention

- `DEFAULT_ARTIFACT_CONFIG.cleanupDays = 7`; configurable via `~/.pi/agent/extensions/subagent/config.json`
  → `artifactConfig.cleanupDays` (validated non-negative integer; `0` disables). That file does **not
  exist** on this machine, so defaults apply.
- Cleanup (`cleanupAllArtifactDirs`) iterates `<sessions>/<project-key>/subagent-artifacts` and unlinks
  files directly inside it by mtime. The nested `<child-uuid>/run-0/session.jsonl` directories sit
  beside that directory, not inside it, so **child session files survive artifact cleanup**.

### E10 — How the two harnesses run subagents (the architectural difference)

| | omp | pi-subagents |
| --- | --- | --- |
| Model | in-process `AgentSession` (`createAgentSession()`, `sdk.ts:3416`) | separate OS processes |
| Spawn | in-process; subprocess only as opt-in (`runSubprocess`) | `spawn(pi --mode rpc …)` or jiti-loaded `subagent-runner.ts` (`async-execution.ts:599`) |
| Registry | live in-memory refs; park disposes the session, keeps ref + file, `ensureLive` revives | run artifacts + event RPC; retained children carry a `sessionPath` for resume |
| Roster source | registry events + progress callbacks | artifacts on disk + RPC snapshots |

This is why porting "the whole subagent system" is not a port: it would replace pi-subagents' 99,429
lines with omp's ~25,200 lines of task/registry/IRC/advisor/vibe code, all coupled to omp's 9,685-line
`agent-session.ts`.

### E11 — Roster data for a pi-side hub

| Field the hub shows | Source in pi |
| --- | --- |
| status / activity / current tool / turns / tools | RPC `status` snapshot (E4), runs on disk |
| cost / tokens / requests / model / agent name | run artifacts + `_meta.json` (`usage`, `model`, `agent`) |
| parent / children | `parentId` in run records; nested session directory layout (E7) |
| unread messages | pi-subagents `src/intercom/` bridge |
| live transcript tail | child `session.jsonl` (E6) or the artifact transcript (E8, different format) |

### E12 — pi-subagents UI surfaces and switches (relevant if the hub becomes primary)

Config lives at `~/.pi/agent/extensions/subagent/config.json` (absent here → defaults):

| Key | Default | Effect |
| --- | --- | --- |
| `fleetView` | `true` | persistent FleetView above/below the editor |
| `fleetViewPlacement` | `belowEditor` | `aboveEditor` \| `belowEditor` |
| `asyncWidget` | `true` | under-editor async-runs widget |
| `fleetKeybindings` | — | remap the `/subagents-fleet` inspector keys |

pi-subagents registers **zero** `pi.registerShortcut` calls, so a hub chord (omp uses `Alt+A` / `Ctrl+S`)
collides with nothing. Commands are namespaced (`/subagents-fleet` vs a future `/agent-hub`).

---

## Verified vs unverified

**Verified by execution:** the compile result and 9 deltas (E1), the render (E3), the RPC payload
contents (E4), session discoverability and counts (E7), the artifact/transcript formats (E8), retention
behaviour (E9), `switchSession` implementation semantics (E5).

**Verified by reading only:** the in-process vs subprocess architecture (E10), the config switches and
absence of shortcuts (E12), the intercom bridge as an unread-count source (E11).

**Not verified at all:**

1. Roster metrics read from *real* run artifacts at scale (the adapter is unwritten; only the
   requirement is established).
2. Mouse interaction and the fullscreen transcript path inside a live pi TUI.
3. Revive `r` / kill `x` against pi-subagents' resume and stop paths.
4. Whether pi's alt-screen route (`TuiMode`/`TuiAltScreen`) gives the transcript viewer what omp's
   `{ fullscreen: true }` overlay option provided.

---

## Reproduction

The experiment harness is session-local (not committed, by decision — this task records findings, not
code): `/tmp/harness` holds `port.py`, `mkstubs.py`, `stubs/`, `adapt.patch`, `render.mts`,
`rpcprobe.mts`, `tsconfig.json`, `reproduce.sh`, and `evidence/`.

```bash
HUBPORT_DIR=/tmp/hubport-test OMP_SRC=/home/tan/agent_harness_test/oh-my-pi /tmp/harness/reproduce.sh
```

It copies the five omp files, installs the functional stubs, applies the adaptation patch, type-checks
(expects **0 errors**), and renders the hub — about two minutes end to end. `adapt.patch` (505 lines
across 5 files) is the complete, reviewable record of the adaptation; the reasons for each hunk are in
`design.md`.

If the harness directory is gone, it can be rebuilt from this document: the deltas needed are the nine
listed in `design.md`, and the reproduction is the four steps above.

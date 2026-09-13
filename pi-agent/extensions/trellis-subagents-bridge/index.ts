// trellis-subagents-bridge — make pi-subagents children resolve their parent's
// active Trellis task.
//
// Why this exists: pi-subagents discovers .pi/agents/trellis-*.md and dispatches
// them correctly, but a dispatched child starts as its own Pi session. The
// generated Trellis extension (.pi/extensions/trellis/index.ts) resolves the
// active task from `.trellis/.runtime/sessions/<contextKey>.json`, where
// contextKey derives from the *child's own* session id — so the child is told
// "no_task", its `task.py current` exits 1, and its bash calls carry a key that
// resolves nothing. The parent's key is not in the parent's process env either;
// the generated extension injects it as command text, per bash call.
//
// The fix is to make the child's own key resolve. The parent publishes its
// context key into process.env, and each child writes a runtime session pointer
// under its own key. The generated extension then resolves the real task through
// its normal path: correct breadcrumb, correct injected context, and a bash key
// that resolves. Nothing is stripped or rewritten.
//
// Contract and evidence: .trellis/tasks/09-13-pi-subagents-dispatch/design.md
// Rejected alternative (channel patching) and why:
//   .../research/dispatch-bridge-mechanisms.md
//
// Zero dependencies, node: builtins only — no build step (scripts/node-guidelines.md).

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────
type JsonObject = Record<string, unknown>;

interface PiEvent {
  toolName?: string;
  systemPrompt?: string;
}

interface PiContext {
  cwd?: string;
  sessionManager?: {
    getSessionId?: () => string;
    getSessionFile?: () => string | undefined;
  };
}

interface PiApi {
  on?: (
    event: string,
    handler: (event: unknown, ctx?: PiContext) => unknown,
  ) => void;
  getActiveTools?: () => string[];
  setActiveTools?: (names: string[]) => void;
}

// ── Small helpers ─────────────────────────────────────────────────────
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isObj(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readText(p: string): string {
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}

function callStr(
  cb: (() => string | undefined) | undefined,
  receiver?: unknown,
): string | null {
  if (!cb) return null;
  try {
    return str(cb.call(receiver));
  } catch {
    return null;
  }
}

function lookupStr(data: unknown, keys: string[]): string | null {
  if (!isObj(data)) return null;
  for (const k of keys) {
    const v = str(data[k]);
    if (v) return v;
  }
  return null;
}

// ── Project root ──────────────────────────────────────────────────────
// Prefer the session cwd (pi-web / RPC hosts can differ from process.cwd()),
// then fall back to the process cwd. Only a directory with `.trellis/` counts:
// a bare `.pi` can be the global config dir.
function findRoot(start: string): string | null {
  let c = resolve(start);
  while (true) {
    const marker = join(c, ".trellis");
    if (existsSync(marker) && isDir(marker)) return c;
    const p = dirname(c);
    if (p === c) return null;
    c = p;
  }
}

function resolveRoot(ctx?: PiContext): string | null {
  const fromCtx = str(ctx?.cwd);
  if (fromCtx) {
    const r = findRoot(fromCtx);
    if (r) return r;
  }
  return findRoot(process.cwd());
}

// ── Context key ───────────────────────────────────────────────────────
// Byte-for-byte the derivation in .pi/extensions/trellis/index.ts (contextKey):
// the pointer filename must equal the key the generated extension will use, or
// publication silently targets a file nobody reads.
//
// Always call this with the event context. The generated extension prefers
// sessionManager.getSessionId() and only then the environment; deriving the key
// from the environment alone would diverge from it wherever those disagree.
//
// One deliberate divergence: PI_SESSION_FILE is accepted as a transcript
// fallback. The generated extension only consults sessionManager.getSessionFile()
// and event input. That branch is unreachable whenever a session id exists, which
// is the case this design depends on (design.md E12) — it only avoids a null key
// when the id is missing but the transcript path is known.
function contextKey(ctx?: PiContext, input?: unknown): string | null {
  const sessionId =
    callStr(ctx?.sessionManager?.getSessionId, ctx?.sessionManager) ??
    str(process.env.PI_SESSION_ID) ??
    str(process.env.PI_SESSIONID) ??
    lookupStr(input, ["session_id", "sessionId", "sessionID"]);
  if (sessionId) {
    const normalized = sessionId.replace(/[^A-Za-z0-9._-]+/g, "_");
    if (!normalized) return `pi_${hash(sessionId)}`;
    return `pi_${normalized}${normalized === sessionId ? "" : `_${hash(sessionId)}`}`;
  }
  const transcriptPath =
    callStr(ctx?.sessionManager?.getSessionFile, ctx?.sessionManager) ??
    str(process.env.PI_SESSION_FILE) ??
    lookupStr(input, ["transcript_path", "transcriptPath", "transcript"]);
  if (transcriptPath) return `pi_transcript_${hash(transcriptPath)}`;
  return null;
}

// ── Runtime session pointer ───────────────────────────────────────────
function sessionFile(root: string, key: string): string {
  return join(root, ".trellis", ".runtime", "sessions", `${key}.json`);
}

function readPointerTask(root: string, key: string | null): string | null {
  if (!key) return null;
  try {
    const data = JSON.parse(readText(sessionFile(root, key))) as JsonObject;
    return str(data.current_task);
  } catch {
    return null;
  }
}

// Return the task directory when `ref` lands inside `root` AND exists, else null.
//
// The existence check matters: session pointers outlive their tasks (this repo
// already holds one pointing at an archived task), and publishing a dangling
// pointer is worse than publishing nothing. Both sides are realpath'd so a task
// directory symlinked outside the project is refused too. The original path is
// returned, not the realpath — callers do `relative(root, dir)`, which breaks if
// `root` itself sits behind a symlink.
function resolveTaskDir(root: string, ref: string | null): string | null {
  if (!ref) return null;
  let cleaned = ref.replace(/\\/g, "/").replace(/^\.\//, "");
  if (cleaned.startsWith("tasks/")) cleaned = `.trellis/${cleaned}`;
  const candidate = cleaned.startsWith(".trellis/")
    ? join(root, cleaned)
    : isAbsolute(cleaned)
      ? cleaned
      : join(root, ".trellis", "tasks", cleaned);
  if (!isDir(candidate)) return null;
  try {
    const rel = relative(realpathSync(root), realpathSync(candidate));
    if (rel !== "" && (rel.startsWith("..") || isAbsolute(rel))) return null;
    return candidate;
  } catch {
    return null;
  }
}

function activeTaskDir(root: string, key: string | null): string | null {
  return resolveTaskDir(root, readPointerTask(root, key));
}

// ── Roles ─────────────────────────────────────────────────────────────
// A child of the generated `trellis_subagent` tool sets BOTH markers
// (.pi/extensions/trellis/index.ts buildChildEnv). Those children already carry a
// correct key and their generated extension is inert, so the bridge must leave
// them alone — otherwise it would rewrite a correct value with a derived one.
function isBridgeChild(): boolean {
  return (
    process.env.PI_SUBAGENT_CHILD === "1" &&
    process.env.TRELLIS_SUBAGENT_CHILD !== "1"
  );
}

// ── Constant notes ────────────────────────────────────────────────────
// Both notes are constant on purpose. The generated extension freezes everything
// it injects because provider prefix caches invalidate from byte 0 whenever the
// system prompt changes; interpolating a task path or per-turn state here would
// defeat that on every turn.
const CHILD_ADAPTER_NOTE = `<trellis-pi-dispatch-adapter>
On Pi, pi-subagents prefixes your dispatch prompt with "Task: ". So a first line
of "Task: Active task: <path>" means "Active task: <path>" — read the task path
from it exactly as your role instructions describe.
This session is registered as the task's own Trellis session. Do not run
"task.py finish", "task.py archive", or any command that changes the active task;
those belong to the main session.
</trellis-pi-dispatch-adapter>`;

const PARENT_DISPATCH_GUIDANCE = `<trellis-pi-dispatch>
Trellis role dispatch on Pi goes through the pi-subagents tool:
  subagent({ agent: "trellis-implement" | "trellis-check" | "trellis-research",
             task: "Active task: <path from task.py current>\\n<instructions>" })
The "Active task:" line remains required and must be the first thing in the task
text. The role agents in .pi/agents/ are discovered by pi-subagents directly.
</trellis-pi-dispatch>`;

// ── Disabling the shipped dispatch tool ───────────────────────────────
// Trellis ships a native `trellis_subagent` tool from the generated extension.
// pi-subagents supersedes it: the same role agents are discovered from
// .pi/agents/, and the bridge above supplies the context it was compensating
// for. Leaving both registered means two competing dispatch paths and two sets
// of injected guidance in the prompt.
//
// This removes it from the ACTIVE tool set rather than editing the generated
// file. Two reasons that matter:
//   - The generated extension is gitignored and template-hash tracked
//     (.pi/extensions/trellis/index.ts == the @mindfoldhq/trellis template), so
//     a patch there is neither versioned in this repo nor reproducible on
//     another machine, and it comes back as local drift on every
//     `trellis update`.
//   - Pi injects a tool's promptGuidelines only while the tool is active
//     (docs/extensions.md), so deactivating it also drops the competing
//     "Use subagent for task delegation" bullet that the generated tool
//     registers while naming itself trellis_subagent.
//
// Unknown names are ignored by setActiveTools, and an already-absent name is a
// harmless no-op, so this is safe to re-apply on every turn.
const SHIPPED_TOOL = "trellis_subagent";

function disableShippedTool(pi: PiApi): void {
  try {
    if (
      typeof pi.getActiveTools !== "function" ||
      typeof pi.setActiveTools !== "function"
    )
      return;
    const active = pi.getActiveTools();
    if (!Array.isArray(active) || !active.includes(SHIPPED_TOOL)) return;
    pi.setActiveTools(active.filter((name) => name !== SHIPPED_TOOL));
  } catch {
    // Never let a tool-list adjustment take down the session.
  }
}

// ── Extension ─────────────────────────────────────────────────────────
export default function trellisSubagentsBridge(pi: PiApi): void {
  // Inert outside a Trellis project (R9): resolveRoot only matches a directory
  // that actually contains `.trellis/`.
  if (!resolveRoot()) return;

  let cachedKey: string | null = null;
  const keyFor = (ctx?: PiContext): string | null => {
    const k = contextKey(ctx) ?? cachedKey;
    if (k) cachedKey = k;
    return k;
  };

  if (isBridgeChild()) {
    // ── Child: register as the task's session ────────────────────────
    let written: string | null = null;

    const writePointer = (ctx?: PiContext): void => {
      try {
        const root = resolveRoot(ctx);
        const key = keyFor(ctx);
        if (!root || !key) return;
        // The parent published its own key; follow it to the task.
        const parentKey = str(process.env.TRELLIS_CONTEXT_ID);
        const taskDir = activeTaskDir(root, parentKey);
        if (!taskDir) return;
        const relTask = relative(root, taskDir).replace(/\\/g, "/");
        const file = sessionFile(root, key);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(
          file,
          JSON.stringify(
            {
              platform: "pi",
              last_seen_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
              current_task: relTask.startsWith(".trellis/") ? relTask : taskDir,
              current_run: null,
            },
            null,
            2,
          ) + "\n",
        );
        written = file;
      } catch {
        // A failed pointer write must not take the child session down; the child
        // simply behaves as it did before the bridge existed.
      }
    };

    pi.on?.("session_start", (_event, ctx) => {
      disableShippedTool(pi);
      writePointer(ctx);
    });

    pi.on?.("session_shutdown", () => {
      if (!written) return;
      try {
        rmSync(written, { force: true });
      } catch {}
      written = null;
    });

    pi.on?.("before_agent_start", (event) => {
      disableShippedTool(pi);
      if (!written) return undefined;
      const cur = (event as PiEvent)?.systemPrompt ?? "";
      if (cur.includes("<trellis-pi-dispatch-adapter>")) return undefined;
      return { systemPrompt: [cur, CHILD_ADAPTER_NOTE].join("\n\n") };
    });

    return;
  }

  // ── Parent: publish the task key, refresh at dispatch time ─────────
  const publish = (ctx?: PiContext): boolean => {
    const root = resolveRoot(ctx);
    const key = keyFor(ctx);
    if (!root || !key) return false;
    if (!activeTaskDir(root, key)) {
      delete process.env.TRELLIS_CONTEXT_ID;
      return false;
    }
    process.env.TRELLIS_CONTEXT_ID = key;
    return true;
  };

  pi.on?.("session_start", (_event, ctx) => {
    disableShippedTool(pi);
    publish(ctx);
  });

  pi.on?.("tool_call", (event, ctx) => {
    // A task is normally activated by `task.py start` earlier in the SAME turn
    // (`task.py start` is a bash call; the dispatch follows it). The publish in
    // `before_agent_start` ran at turn start, when the task did not exist yet, so
    // a dispatch in that turn would otherwise see a stale or absent key.
    // `tool_call` is awaited before the tool executes, so refreshing here lands
    // before the runner spawns. Scope it to dispatch tools; nothing else needs it.
    const name = (event as PiEvent)?.toolName;
    if (name !== "subagent" && name !== "trellis_subagent") return undefined;
    publish(ctx);
    return undefined;
  });

  pi.on?.("before_agent_start", (event, ctx) => {
    // Re-applied every turn: the active set can be recomputed between turns, and
    // this is an idempotent list filter.
    disableShippedTool(pi);
    publish(ctx);
    if (!process.env.TRELLIS_CONTEXT_ID) return undefined;
    const cur = (event as PiEvent)?.systemPrompt ?? "";
    if (cur.includes("<trellis-pi-dispatch>")) return undefined;
    return { systemPrompt: [cur, PARENT_DISPATCH_GUIDANCE].join("\n\n") };
  });
}

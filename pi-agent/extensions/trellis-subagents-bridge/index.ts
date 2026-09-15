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
// The bridge also carries the task context the child needs, because a dispatched
// child's own extension is inert here (the parent marks it, the same way the
// shipped dispatch tool marked its children — see the roles section below), so it
// injects nothing at all. That is two halves: the curated spec/research files of
// the role that was dispatched, and the task's prd.md -> design.md -> implement.md
// artifacts. See "Injected child context".
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
  readdirSync,
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
  input?: JsonObject;
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
// Deliberate divergences from the generated copy, both unreachable whenever a
// session id resolves (design.md E12), which is the case this design depends on:
//   1. No `input` parameter. The generated version takes the event and descends
//      nested `input` / `properties` / `event` / `hook_input` keys looking for a
//      session id or transcript path. Every bridge call site passes the context,
//      and sessionManager.getSessionId() resolves first, so those never fire.
//   2. `PI_SESSION_FILE` is accepted as a transcript fallback; the generated
//      version consults only sessionManager.getSessionFile() and event input.
// Keep this tracking upstream: the pointer filename must equal the key the
// generated extension computes, or the child silently resolves nothing.
function contextKey(ctx?: PiContext): string | null {
  const sessionId =
    callStr(ctx?.sessionManager?.getSessionId, ctx?.sessionManager) ??
    str(process.env.PI_SESSION_ID) ??
    str(process.env.PI_SESSIONID);
  if (sessionId) {
    const normalized = sessionId.replace(/[^A-Za-z0-9._-]+/g, "_");
    // Unreachable in practice: str() guarantees a non-empty id, and replacing at
    // least one invalid character always leaves a non-empty result. Kept verbatim
    // for parity with the generated copy, which this function must track.
    if (!normalized) return `pi_${hash(sessionId)}`;
    return `pi_${normalized}${normalized === sessionId ? "" : `_${hash(sessionId)}`}`;
  }
  const transcriptPath =
    callStr(ctx?.sessionManager?.getSessionFile, ctx?.sessionManager) ??
    str(process.env.PI_SESSION_FILE);
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
// The cases are enumerated exhaustively, and the unknown one is an early no-op:
// a predicate that tests only its own marker falls through into the PARENT branch
// for every other kind of child, and the parent branch's publish() then deletes a
// task key some other dispatcher set. Never select; enumerate.
//
//   1. bridge child — a child this process spawned, and whose copy of the
//      generated extension this process made inert. The bridge's child role: it
//      registers the session pointer AND supplies the context (below).
//   2. other child — a child of this process that was not made inert. The shipped
//      dispatch tool's own children are this shape, and the bridge must do nothing
//      at all for them: that tool sets TRELLIS_CONTEXT_ID itself, and falling into
//      the parent branch would find no runtime pointer at the child's own key
//      and DELETE the key the tool just set — a regression from pre-bridge
//      behaviour.
//   3. parent session — no child marker at all. The bridge's parent role; it
//      publishes the key, marks its children, and relays the dispatched agent.
//
// Role 1 and role 2 share the `PI_SUBAGENT_CHILD` test, which is what keeps the
// regression above out: a child never reaches the parent branch, whatever the
// bridge marker says. Note the one overlap that is left, and why it is harmless:
// the shipped tool's buildChildEnv spreads process.env, so a child it spawns from
// a process that already published the bridge marker carries that marker too and
// is handled as role 1. Its prompt already contains the curated files and the
// artifacts (that tool assembles them itself), and the injection below skips any
// body already present verbatim, so the overlap costs a pointer write, not
// duplicated content. Failing the other way — treating a marker-bearing child as
// role 2 — would leave it with no context at all.
const BRIDGE_CHILD_MARKER = "TRELLIS_BRIDGE_CHILD";

// The generated Trellis extension returns immediately when this name is "1" in
// the environment, which is how a dispatched child is stopped from running the
// PARENT's per-turn session path. This declaration is the SINGLE SOURCE for that
// marker: scripts/doctor.sh reads the name off it and fails when the generated
// extension no longer returns early on it, so a `trellis update` that renames the
// variable or moves the guard below the registration calls cannot silently
// restore the wrong breadcrumb in every dispatched child. The parent sets it
// before spawning; the child inherits it.
const CHILD_INERT_MARKER = "TRELLIS_SUBAGENT_CHILD";

// The dispatched agent name the parent relays to its children. Set in the parent's
// environment at dispatch time and retracted when the dispatch returns; the child
// reads it to select its own manifest. See "Injected child context".
const DISPATCH_AGENT_ENV = "TRELLIS_DISPATCH_AGENT";

function isBridgeChild(): boolean {
  return (
    process.env.PI_SUBAGENT_CHILD === "1" &&
    process.env[BRIDGE_CHILD_MARKER] === "1"
  );
}

function isOtherChild(): boolean {
  return (
    process.env.PI_SUBAGENT_CHILD === "1" &&
    process.env[BRIDGE_CHILD_MARKER] !== "1"
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

// ── Injected child context ────────────────────────────────────────────
// A dispatched child's own extension is inert (the parent marks the child; see
// the roles section), so the child receives none of the context it would
// otherwise be handed: no curated spec/research files, and no task artifacts. The
// child's system prompt is composed upstream, in the dispatcher — its agent
// definition plus any skill and memory overlays — so everything below is what
// stands in for the injection the child no longer gets: the curated files of the
// role it was dispatched as, then prd.md -> design.md -> implement.md.
//
// The budget is READ, never restated. `context_injection` in .trellis/config.yaml
// is the single definition, and the generated extension's
// `readContextInjectionLimits` and `task.py validate` already consume it; a third
// consumer with its own numbers would inject a file the validator warns about.
// The defaults below are only the fallback for a config file with no such section.

interface ContextInjectionLimits {
  max_file_bytes: number;
  max_artifact_bytes: number;
  max_total_bytes: number;
}

const DEFAULT_CONTEXT_INJECTION_LIMITS: ContextInjectionLimits = {
  max_file_bytes: 32768,
  max_artifact_bytes: 65536,
  max_total_bytes: 131072,
};

function stripYamlComment(value: string): string {
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(value[i - 1]!)))
      return value.slice(0, i);
  }
  return value;
}

function unquoteYaml(value: string): string {
  const s = value.trim();
  if (
    s.length >= 2 &&
    s[0] === s[s.length - 1] &&
    (s[0] === '"' || s[0] === "'")
  )
    return s.slice(1, -1);
  return s;
}

// The same minimal line scan the generated extension uses: only the
// `context_injection:` block, not a YAML parser. A missing key, a non-numeric
// value, or a negative one keeps that key's default.
function readContextInjectionLimits(root: string): ContextInjectionLimits {
  const limits: ContextInjectionLimits = {
    ...DEFAULT_CONTEXT_INJECTION_LIMITS,
  };
  const text = readText(join(root, ".trellis", "config.yaml"));
  if (!text) return limits;
  let inSection = false;
  let sectionIndent = -1;
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!inSection) {
      if (/^context_injection\s*:\s*(#.*)?$/.test(trimmed)) {
        inSection = true;
        sectionIndent = rawLine.length - rawLine.trimStart().length;
      }
      continue;
    }
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent <= sectionIndent) break;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    if (!(key in limits)) continue;
    const raw = unquoteYaml(stripYamlComment(m[2]!));
    if (!/^-?\d+$/.test(raw)) continue;
    const value = parseInt(raw, 10);
    if (value < 0) continue;
    // Three keys, spelled out: the dynamic form needs a cast that TypeScript
    // cannot check, and this list is also what keeps an unrelated key in the
    // section from being picked up as a limit.
    if (key === "max_file_bytes") limits.max_file_bytes = value;
    else if (key === "max_artifact_bytes") limits.max_artifact_bytes = value;
    else if (key === "max_total_bytes") limits.max_total_bytes = value;
  }
  return limits;
}

// The manifest a child gets is the one whose stem is a SUFFIX of the name it was
// dispatched as: the name as given first, then each tail after a "-", first
// existing file wins — so a dispatched name whose final segment is `check` selects
// `check.jsonl`.
//
// This is a name-shape rule, not a role table. Nothing here enumerates roles, and
// an agent renamed tomorrow still selects its own manifest as long as the manifest
// stem remains the tail of its name. The alternative — a literal name-to-file map
// — is what the generated extension hardcodes and what this repo must not copy.
function manifestCandidates(name: string): string[] {
  const segments = name.split("-").filter(Boolean);
  return segments.map((_, i) => `${segments.slice(i).join("-")}.jsonl`);
}

function listFilenames(dir: string, suffix: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name: string) => name.endsWith(suffix))
      .sort();
  } catch {
    // Unreadable task directory: report it as empty. The caller then injects
    // nothing, which is the same outcome as a task with no manifests.
    return [];
  }
}

function selectManifests(taskDir: string): string[] {
  const relayed = str(process.env[DISPATCH_AGENT_ENV]);
  if (relayed) {
    for (const candidate of manifestCandidates(relayed)) {
      const full = join(taskDir, candidate);
      if (existsSync(full)) return [full];
    }
  }
  // Nothing relayed, or nothing matched (an older child, a workflow step, a
  // scheduled run, a task whose manifests are still seed rows): the union of the
  // task's manifests, so the child still receives every curated file.
  return listFilenames(taskDir, ".jsonl").map((name) => join(taskDir, name));
}

interface ManifestEntry {
  file: string;
  reason: string;
}

// One JSON object per line. A row with no `file` field is skipped: that is the
// seed shape `task.py create` writes, not damage. A malformed line is skipped for
// the same reason — one bad row must not cost the child every other entry.
function readManifestEntries(manifest: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (const line of readText(manifest).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as JsonObject;
      const file = str(row?.file);
      if (!file) continue;
      entries.push({ file, reason: str(row?.reason) ?? "-" });
    } catch {
      // A malformed line is skipped, not fatal: manifests are hand-edited, the
      // loop must keep the remaining rows, and a throw here would take the
      // child's turn down for a typo in a curated list. The rows without a
      // `file` field are skipped by the check above, which is the seed shape
      // `task.py create` writes.
    }
  }
  return entries;
}

// A manifest row is data written by hand, so it is resolved against the repo root
// and a path that escapes that root is refused — the containment rule the task
// pointer resolution above applies, for the same reason: a malformed manifest is
// exactly how a pointer has gone wrong here before. Both sides are realpath'd when
// they exist, so a symlink inside the repo cannot redirect the injection either.
function resolveEntry(root: string, file: string): string | null {
  const abs = isAbsolute(file) ? resolve(file) : resolve(root, file);
  const inside = (rel: string): boolean =>
    rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  try {
    return inside(relative(realpathSync(root), realpathSync(abs))) ? abs : null;
  } catch {
    // The entry does not exist yet (or the root does not): lexical containment is
    // enough to refuse it, and a path that does not exist is skipped by the read.
    return inside(relative(root, abs)) ? abs : null;
  }
}

function readBytes(file: string): Buffer | null {
  try {
    if (!statSync(file).isFile()) return null;
    return readFileSync(file);
  } catch {
    // Missing, unreadable, or not a regular file: the entry is skipped and the
    // rest of the block still assembles.
    return null;
  }
}

// Byte-for-byte the truncation the generated extension applies, so a body this
// bridge truncates is identical to the one that path would have written — which is
// what lets the dedup below recognise it when both have injected the same file.
function truncateUtf8(buf: Buffer, cap: number): Buffer {
  if (cap <= 0 || buf.length <= cap) return buf;
  let i = cap;
  // Back off over continuation bytes (10xxxxxx) to find the lead byte.
  while (i > 0 && (buf[i - 1]! & 0xc0) === 0x80) i--;
  if (i === 0) return Buffer.alloc(0);
  const lead = buf[i - 1]!;
  if (lead & 0x80) {
    let seqLen = 1;
    if ((lead & 0xe0) === 0xc0) seqLen = 2;
    else if ((lead & 0xf0) === 0xe0) seqLen = 3;
    else if ((lead & 0xf8) === 0xf0) seqLen = 4;
    // Cut before the lead byte when its full sequence did not fit; otherwise the
    // trailing sequence is complete — keep it whole.
    if (i - 1 + seqLen > cap) return buf.subarray(0, i - 1);
  }
  return buf.subarray(0, cap);
}

function truncateNotice(path: string, cap: number): string {
  return `\n[Trellis: truncated at ${cap} bytes — read ${path} for the full content]`;
}

function indexNotice(path: string, size: number, reason: string): string {
  return `[Trellis: not inlined (total context limit reached) — ${path} (${size} bytes): ${reason}]`;
}

// Artifact order and labels mirror `buildContext()` in the generated extension, so
// the child's agent definition still finds the headers it was told to expect.
const ARTIFACT_LABELS: Array<[string, string]> = [
  ["prd.md", "Requirements"],
  ["design.md", "Technical Design"],
  ["implement.md", "Execution Plan"],
];

// Assemble the child's whole block, or null when there is nothing to add. The
// header shape mirrors the generated extension for the same reason as the labels.
// `currentPrompt` is the prompt the block is about to be appended to: a body
// already present in it verbatim is skipped rather than injected twice.
function buildChildContext(
  root: string,
  taskDir: string,
  currentPrompt: string,
): string | null {
  const relTask = relative(root, taskDir).replace(/\\/g, "/");
  const limits = readContextInjectionLimits(root);
  let used = 0;
  const room = (size: number): boolean =>
    limits.max_total_bytes <= 0 || used + size <= limits.max_total_bytes;

  const specBlocks: string[] = [];
  const seen = new Set<string>();
  for (const manifest of selectManifests(taskDir)) {
    for (const entry of readManifestEntries(manifest)) {
      const file = resolveEntry(root, entry.file);
      // `seen` is by resolved path: two manifests naming the same file (the
      // union fallback can produce that) must not inject it twice.
      if (!file || seen.has(file)) continue;
      seen.add(file);
      const data = readBytes(file);
      if (data === null) continue;
      const body = truncateUtf8(data, limits.max_file_bytes);
      let content = body.toString("utf-8");
      if (body.length < data.length)
        content += truncateNotice(entry.file, limits.max_file_bytes);
      if (currentPrompt.includes(content)) continue;
      const block = `=== ${entry.file} ===\n${content}`;
      const size = Buffer.byteLength(block, "utf-8");
      if (!room(size)) {
        // Past the total: the remaining entries degrade to a path line, so the
        // child still learns the file exists and can read it itself.
        const notice = indexNotice(entry.file, data.length, entry.reason);
        used += Buffer.byteLength(notice, "utf-8");
        specBlocks.push(notice);
        continue;
      }
      used += size;
      specBlocks.push(block);
    }
  }

  const artifacts: string[] = [];
  for (const [name, label] of ARTIFACT_LABELS) {
    const rel = `${relTask}/${name}`;
    const file = resolveEntry(root, rel);
    if (!file) continue;
    const data = readBytes(file);
    if (data === null) continue;
    const body = truncateUtf8(data, limits.max_artifact_bytes);
    let content = body.toString("utf-8");
    if (body.length < data.length)
      content += truncateNotice(rel, limits.max_artifact_bytes);
    if (currentPrompt.includes(content)) continue;
    const block = `=== ${rel} (${label}) ===\n${content}`;
    const size = Buffer.byteLength(block, "utf-8");
    if (!room(size)) {
      const notice = indexNotice(rel, data.length, label);
      used += Buffer.byteLength(notice, "utf-8");
      artifacts.push(notice);
      continue;
    }
    used += size;
    artifacts.push(block);
  }

  if (!artifacts.length && !specBlocks.length) return null;
  return [
    `## Trellis Task Context\nTask directory: ${taskDir}`,
    ...artifacts,
    specBlocks.length
      ? `### Curated Spec / Research Context\n${specBlocks.join("\n\n")}`
      : "",
  ]
    .filter((part) => part !== "")
    .join("\n\n");
}

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
// The shipped dispatch tools this bridge deactivates. This list is the SINGLE
// SOURCE for those names: scripts/doctor.sh greps the generated extension for the
// tool names it registers and fails when one is missing here, so a `trellis
// update` that renames a tool or adds another cannot silently end the
// deactivation. Adding a name is a one-line change.
const SHIPPED_TOOLS = ["trellis_subagent"];

function disableShippedTool(pi: PiApi): void {
  try {
    if (
      typeof pi.getActiveTools !== "function" ||
      typeof pi.setActiveTools !== "function"
    )
      return;
    const active = pi.getActiveTools();
    if (!Array.isArray(active)) return;
    const kept = active.filter((name) => !SHIPPED_TOOLS.includes(name));
    if (kept.length === active.length) return; // none of ours is active
    pi.setActiveTools(kept);
  } catch {
    // Never let a tool-list adjustment take down the session.
  }
}

// ── Extension ─────────────────────────────────────────────────────────
export default function trellisSubagentsBridge(pi: PiApi): void {
  // Inert outside a Trellis project (R9): resolveRoot only matches a directory
  // that actually contains `.trellis/`.
  if (!resolveRoot()) return;
  // Roles case 2: leave any other child of this process completely untouched.
  if (isOtherChild()) return;

  let cachedKey: string | null = null;
  const keyFor = (ctx?: PiContext): string | null => {
    const k = contextKey(ctx) ?? cachedKey;
    if (k) cachedKey = k;
    return k;
  };

  if (isBridgeChild()) {
    // ── Child: register as the task's session, and supply the context the
    //    inert extension no longer injects ────────────────────────────
    let written: string | null = null;
    // Resolved once, when the pointer is written, and reused by the injection:
    // the task directory must not be re-derived from a second reading of the same
    // pointer, or the two could disagree mid-session.
    let taskRoot: string | null = null;
    let taskDir: string | null = null;
    // The block is assembled once and reused, the way the generated extension
    // snapshots its task context into the prompt: re-deriving it every turn would
    // append a second copy whenever a curated file changed, and a prompt that
    // changes between turns invalidates the provider's prefix cache from byte 0.
    let contextBlock: string | null = null;

    const writePointer = (ctx?: PiContext): void => {
      try {
        const root = resolveRoot(ctx);
        const key = keyFor(ctx);
        if (!root || !key) return;
        // The parent published its own key; follow it to the task.
        const parentKey = str(process.env.TRELLIS_CONTEXT_ID);
        const dir = activeTaskDir(root, parentKey);
        if (!dir) return;
        taskRoot = root;
        taskDir = dir;
        const relTask = relative(root, dir).replace(/\\/g, "/");
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
      } catch {
        // Best-effort cleanup on shutdown: `force: true` already swallows a
        // missing file, and anything else (permissions, a racing unlink) must
        // not break the session_shutdown handler.
      }
      written = null;
    });

    pi.on?.("before_agent_start", (event) => {
      disableShippedTool(pi);
      if (!written || !taskRoot || !taskDir) return undefined;
      const cur = (event as PiEvent)?.systemPrompt;
      if (typeof cur !== "string") return undefined;
      const additions: string[] = [];
      // Idempotency test on the WHOLE constant, never on the bare tag: the tag
      // also occurs in ordinary prose that reaches this prompt (task specs and
      // research notes quote it), which would suppress the note entirely.
      if (!cur.includes(CHILD_ADAPTER_NOTE)) additions.push(CHILD_ADAPTER_NOTE);
      try {
        if (contextBlock === null)
          contextBlock = buildChildContext(taskRoot, taskDir, cur) ?? "";
        // Same rule for the block: test the WHOLE assembled block. There is no
        // tag to test even if that were acceptable, and a block that changed with
        // every turn would be appended twice.
        if (contextBlock && !cur.includes(contextBlock))
          additions.push(contextBlock);
      } catch {
        // A failure assembling the context must not take the child's turn down:
        // the child keeps the prompt it already had and behaves exactly as it
        // would without this bridge. The block is not cached on failure, so a
        // transient cause is retried on the next turn.
      }
      if (!additions.length) return undefined;
      return { systemPrompt: [cur, ...additions].join("\n\n") };
    });

    return;
  }

  // ── Parent: publish the task key, mark the children, relay the dispatch ──
  // Only ever retract a value this process published. A value we did not set may
  // belong to an outer context (the shipped tool's child env), and deleting it
  // would strand that process.
  let publishedByUs = false;
  const publish = (ctx?: PiContext): boolean => {
    const root = resolveRoot(ctx);
    const key = keyFor(ctx);
    if (!root || !key) return false;
    if (!activeTaskDir(root, key)) {
      if (publishedByUs) {
        delete process.env.TRELLIS_CONTEXT_ID;
        publishedByUs = false;
      }
      return false;
    }
    process.env.TRELLIS_CONTEXT_ID = key;
    publishedByUs = true;
    return true;
  };

  // What the shipped dispatch tool did for its own children, and what makes the
  // child's copy of the generated extension return at load instead of running the
  // PARENT's per-turn session path. It has to be set here, in the parent: the
  // child reads the marker while its extensions load, which has long since
  // happened by the time any handler of the child's runs. The child inherits this
  // process's environment at spawn.
  //
  // PERSISTENT for the session, deliberately, and not a window around the
  // dispatch call. A scheduled run reaches its spawn from a timer with nothing in
  // flight, so a window would miss it — and a missed spawn is silent: that child
  // keeps the parent's planning breadcrumb and nothing detects it. The cost of the
  // persistent shape is visible instead: a `pi` process started from a bash tool
  // in this session inherits the marker, loads with the generated extension inert,
  // and reports no task. Loud beats silent. Nothing is ever cleared, so there is
  // no window to unwind and no cleanup path that can half-set it.
  //
  // Boundary, measured: the name has exactly two readers in live code, both
  // repo-owned — that load-time check, and this file's own predicate. The package
  // that spawns the children reads only its own marker, so this cannot reach it.
  //
  // BOTH markers are set here, and the second is not decoration.
  // `CHILD_INERT_MARKER` stops the child's generated extension from loading;
  // `BRIDGE_CHILD_MARKER` is what tells the child's copy of THIS file that it is
  // the role which must supply the context that extension no longer injects.
  // Setting only the first leaves `isOtherChild()` true in every child, so the
  // child returns at extension load and receives nothing at all — no curated
  // manifest, no task artifacts, and no breadcrumb either, which is strictly
  // worse than before this bridge existed. That exact bug shipped once; the
  // delivery probe caught it, reading did not.
  //
  // Gated on a resolved task. This is a session-wide side effect on every process
  // the session spawns, so a session with no active task must not set it — that
  // is what R6 and AC7 mean by "does nothing when no task resolves". A child of a
  // task-less session takes the other-child path: no pointer, no injection, and
  // the generated extension correctly reporting no task.
  const markChildren = (ctx?: PiContext): void => {
    if (!publish(ctx)) return;
    process.env[CHILD_INERT_MARKER] = "1";
    process.env[BRIDGE_CHILD_MARKER] = "1";
  };

  pi.on?.("session_start", (_event, ctx) => {
    disableShippedTool(pi);
    markChildren(ctx);
  });

  pi.on?.("tool_call", (event, ctx) => {
    // A task is normally activated by `task.py start` earlier in the SAME turn
    // (`task.py start` is a bash call; the dispatch follows it). The publish in
    // `before_agent_start` ran at turn start, when the task did not exist yet, so
    // a dispatch in that turn would otherwise see a stale or absent key.
    // `tool_call` is awaited before the tool executes, so refreshing here lands
    // before the runner spawns. Scope it to dispatch tools; nothing else needs it.
    const ev = event as PiEvent;
    const name = ev?.toolName;
    if (name !== "subagent" && name !== "trellis_subagent") return undefined;
    markChildren(ctx);
    // Relay the agent this dispatch named, so the child can select its own
    // manifest instead of the one every child used to get. The value is read off
    // the tool call — the caller already passed it — and never enumerated here.
    const agent = str(ev?.input?.agent);
    if (agent) process.env[DISPATCH_AGENT_ENV] = agent;
    return undefined;
  });

  // Retract the relayed name when the dispatch returns, so a spawn that nobody
  // named in a tool call — a scheduled run — reads nothing and falls back to the
  // union of the task's manifests rather than to a stale name. The child has
  // already inherited the value by then: the runner is spawned inside the call.
  // Bound: two dispatch calls in one assistant message preflight sequentially and
  // then execute concurrently, so the last name written wins for both. A fanout of
  // one role is unaffected; a mixed one gets that role's manifest rather than the
  // union.
  pi.on?.("tool_result", (event) => {
    const name = (event as PiEvent)?.toolName;
    if (name !== "subagent" && name !== "trellis_subagent") return undefined;
    delete process.env[DISPATCH_AGENT_ENV];
    return undefined;
  });

  pi.on?.("before_agent_start", (event, ctx) => {
    // Re-applied every turn: the active set can be recomputed between turns, and
    // this is an idempotent list filter.
    disableShippedTool(pi);
    markChildren(ctx);
    if (!process.env.TRELLIS_CONTEXT_ID) return undefined;
    const cur = (event as PiEvent)?.systemPrompt;
    if (typeof cur !== "string") return undefined;
    // Whole-constant test only. The bare opening tag also appears in ordinary
    // prose that lands in this same assembled prompt — this task's own design.md
    // and research notes quote it — so matching the tag suppressed the guidance
    // entirely for the task that most needed it.
    if (cur.includes(PARENT_DISPATCH_GUIDANCE)) return undefined;
    return { systemPrompt: [cur, PARENT_DISPATCH_GUIDANCE].join("\n\n") };
  });
}

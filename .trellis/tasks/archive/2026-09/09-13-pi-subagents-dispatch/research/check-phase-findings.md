# Check phase — findings and resolution

Phase 3 gate: `trellis-check` run `28250727`, dispatched after commits `d7f0f3e`,
`a8f6603`, `343b8d7`.

Verdict: **AC1–AC11 held as written and the implementation was correct for what
the ACs test — with one latent blocker.** The blocker sits in the path R10
disables, so no AC failed. That is precisely why a fresh reader was worth the turn.

## B1 — blocker (fixed)

**`isBridgeChild()` was a child *selector*, not a child *guard*.** A child of the
shipped `trellis_subagent` tool sets **both** markers, so it failed that predicate
and fell through into the **parent** branch. `publish()` then derived the child's
own key, found no runtime pointer at it, and ran
`delete process.env.TRELLIS_CONTEXT_ID` — destroying the key `buildChildEnv` had
set for that child. The generated extension is inert in such a child, so the
environment was its only channel for the task.

The reviewer proved it live with an A/B on the exact child invocation:

| bridge loaded | `--no-extensions` control |
|---|---|
| `CTX=[]` / `(none)` / exit 1 | `CTX=[pi_01a09af3-…]` / resolves / exit 0 |

It also contradicted three artifacts asserting the opposite: the code comment,
`design.md`, and `pi-resources.md`. Masked today only because R10 stops the tool
from being called.

**Fix:** an explicit `isShippedToolChild()` predicate and an early return before
the role split; plus S2 below.

**Verified after the fix (T11):** the shipped-tool child keeps the inherited key and
resolves via `Source: session:pi_01a09af3-…`.

## S2 — significant (fixed)

`publish()` deleted `TRELLIS_CONTEXT_ID` unconditionally on the negative path,
without tracking whether this process had set it. Correct in the parent; that is
the bug above when it is not. Now gated on `publishedByUs`.

## Minor findings and disposition

| # | Finding | Disposition |
|---|---|---|
| M3 | The "byte-for-byte `contextKey()`" claim was overstated: signature order differs, the bridge never passed `input`, and upstream descends nested event keys | **Fixed.** The dead `input` parameter and the `lookupStr`/`isObj` code it required are removed; the header now enumerates both divergences (no `input`; `PI_SESSION_FILE`) and states the function must track upstream |
| M4 | R9/AC6 said "block nothing", but `disableShippedTool` runs unconditionally | **AC6 amended** — R10 supersedes for the tool set |
| M5 | `SHIPPED_TOOL` is a single hard-coded name; a rename silently ends R10 | Comment added naming the coupling and the post-upgrade check |
| M6 | `cur.includes(...)` throws when `systemPrompt` is present but not a string | **Fixed** — `typeof cur !== "string"` guard in both handlers. Strictly safer: the old `?? ""` would have *replaced* a missing system prompt with just the note |
| M7 | The load-time inertness guard uses `process.cwd()` only | Accepted, unchanged: project-local extension discovery has the same cwd dependency, so the guard cannot be weaker than the discovery it mirrors |
| M8 | `implement.md` Steps 3–4 were stale (both-marker children "must not be touched"; "advisory only"), and AC10's exception text was stale | Both updated |
| M9 | AC11's tool-list arm was not reproducible from an artifact | AC11 now leads with the deterministic arms (attempted call, run-directory delta, `--tools` allowlist); the self-report arm is labelled corroborating and its probe command is recorded in T10 |

## What the checker verified as correct

- `resolveTaskDir`: existence check plus `realpathSync` containment on both sides;
  absolute and relative escapes and dangling pointers refused; returns the original
  path so `relative(root, dir)` survives a symlinked root.
- Child role end-to-end: pointer written at the child's own derived key,
  `Source: session:pi_11223344-…`, exit 0, pointer gone afterwards, no litter.
- `disableShippedTool`: filters a snapshot, preserves every other name, idempotent,
  unknown-name-safe, fully guarded.
- No tracked document presents `trellis_subagent` as the Pi dispatch path.
- The `--tools bash,trellis_subagent` allowlist vector is covered too: still
  `NOT AVAILABLE`, run count unchanged.

## Method note

The first attempt at this gate aborted after its own runaway output pulled in a
different Pi installation from a bun cache. That signature — `This operation was
aborted` under `pi -p` with a large context — is the defect
`09-13-early-compaction` is documenting, so the abort had a real cause behind the
prompt error. The retry constrained the child to the repo explicitly and succeeded.

---

# Second round — re-check after the fix

`trellis-check` run `298b3835`, reviewing commit `f7718aa`.

**Verdict: the fix is correct.** The three-way role split is right; the early
return precedes every writer and deleter of `TRELLIS_CONTEXT_ID`; `publish()` no
longer retracts a value it did not set; and the M6 type guard was cleared — the
suspected regression was not present.

The checker escalated past model self-report to a **mechanical** probe (a temporary
extension loaded with `-e` that reads `ctx.getSystemPrompt()`). That decision
mattered twice:

- **It cleared M6 honestly.** `systemPrompt` is a string on `before_agent_start`
  (`typeofSP: "string"`, `spLen: 15368`), so the guard never trips and the child
  adapter note is present verbatim in a child's assembled prompt.
- **It exposed a blocker a model-based probe had hidden.** For this task's own
  pointer the model answered `NONE` — while the mechanical probe showed the
  guidance really *was* absent, for a different reason than suspected.

## B2 — blocker for AC5 (fixed)

The guidance's idempotency guard tested the **bare opening tag**:

```ts
if (cur.includes("<trellis-pi-dispatch>")) return undefined;
```

That literal also occurs in ordinary prose reaching the same assembled prompt —
`design.md` and `verification-evidence.md` both quote it — so the guard matched on
*documentation* and suppressed the block entirely. A/B, active task only:

| pointer targets | prompt len | guidance present |
|---|---|---|
| this task (docs quote the tag) | 132 207 | **false** |
| a task whose docs do not | 113 170 | true |

Pre-existing rather than introduced by `f7718aa`, and not the M6 guard. It became
live because **this task's own documentation** added the literal tag: at `d7f0f3e`
`design.md` had none, which is why T4's model-based arm appeared to pass at the
time. The child-note guard had the identical shape and was one doc mention from the
same failure.

**Fix:** both guards now test the whole constant
(`cur.includes(PARENT_DISPATCH_GUIDANCE)` / `cur.includes(CHILD_ADAPTER_NOTE)`),
with a comment recording why the bare tag is unsafe. **Verified mechanically
(T12):** `END len=132507 bareTag=true guidance=true`.

## Also carried back

- `doctor.sh` exited 1 during the round on `settings.json has drifted from the
  repo`. Unrelated to the reviewed commit and not reproducible now:
  `render-settings.mjs --check` reports `ok`, and the live/core diff is only the
  optional bundle's package and keys plus the runtime-owned `lastChangelogVersion`.
  Recorded as an observation, not a defect.
- An unreachable branch (`if (!normalized)`) was confirmed copied verbatim from the
  generated `contextKey`; kept for upstream parity and now commented as such.

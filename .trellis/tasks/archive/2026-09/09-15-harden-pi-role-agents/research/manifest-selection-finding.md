# Finding — what a dispatched child actually receives on Pi, and why

Measured 2026-09-15 by reading `.pi/extensions/trellis/index.ts` (byte-identical to
`@mindfoldhq/trellis/dist/templates/pi/extensions/trellis/index.ts.txt` — verified
with `cmp`), `pi-agent/extensions/trellis-subagents-bridge/index.ts`, and the
pi-subagents source. Supersedes the manifest attribution in
[`skill-delivery-probe.md`](./skill-delivery-probe.md).

---

## 1. The role-correct path exists upstream and is dead here

Upstream ships its own dispatch tool, and that tool selects the manifest **by the
dispatched role**:

```text
.pi/extensions/trellis/index.ts

  91-94   const TRELLIS_AGENT_JSONL = {
            "trellis-implement": "implement.jsonl",
            "trellis-check":     "check.jsonl",
          }
 1326      const name = agent ?? "trellis-implement"     // inside buildContext()
 ~1330     assemblePrompt() = "## Trellis Agent Definition" + buildContext(<input.agent>) + "## Delegated Task"
 1857      buildChildEnv(): TRELLIS_SUBAGENT_CHILD="1", PI_SUBAGENT_CHILD="1", TRELLIS_CONTEXT_ID=<key>
 1843      if (process.env.TRELLIS_SUBAGENT_CHILD === "1") return;   // child: extension switches itself off
```

So under upstream's own tool a `trellis-check` child gets `check.jsonl` injected, by
construction, as part of a prompt the parent assembled.

That path is not the path this repo uses. The bridge deactivates the tool:

```text
pi-agent/extensions/trellis-subagents-bridge/index.ts
  SHIPPED_TOOLS = ["trellis_subagent"];   → pi.setActiveTools(kept) on session_start, tool_call, before_agent_start
```

Two consequences follow, and they are separate:

- The parent-assembled, **role-correct** prompt no longer exists (`trellis_subagent`
  is never called).
- `TRELLIS_SUBAGENT_CHILD=1` is no longer set for any child, because only
  `buildChildEnv()` set it — and it lives inside the dead tool. `pi-subagents` sets
  `PI_SUBAGENT_CHILD=1` only (`pi-subagents/src/runs/shared/child-runtime-config.ts:16`).
  So the child's copy of the extension **runs** instead of returning at `:1843`.

The bridge then makes its key resolve (that is its stated purpose), which is what
lets the still-running extension inject anything at all.

## 2. The still-running path is role-blind

```text
.pi/extensions/trellis/index.ts
 2132   const freshTaskCtx = buildContext(root, "trellis-implement", k);   // hardcoded
```

That line is inside the session's own `before_agent_start`, and it is the block
labelled `### Curated Spec / Research Context` (`:1321`). The extension cannot know
which role the session is: pi-subagents passes no agent-name variable — of the 17
`PI_SUBAGENT*` names in its source, none carries the agent — and the extension reads
only `APPDATA`, `NPM_CONFIG_PREFIX`, `P`, `PI_CODING_AGENT_DIR`,
`PI_CODING_AGENT_SESSION_DIR`, `PI_SESSIONID`, `PI_SESSION_ID`, `TRELLIS_PI_CLI_JS`,
`TRELLIS_SUBAGENT_CHILD`.

**Therefore: a `trellis-check` child's injected task context on Pi is built from
`implement.jsonl`. `check.jsonl` is never injected. It reaches the child only
because the agent template tells the child to read it itself**
(`.pi/agents/trellis-check.md`, upstream `templates/pi/agents/trellis-check.md`
Core Responsibilities #3) — the agent-pull path, not the hook-push path.

## 3. Why the earlier probe could not see this

At probe time both manifests held the same spec files, so the six files it observed
are consistent with either manifest. Today `implement.jsonl` holds six specs and
`check.jsonl` holds five plus the probe note; the observed *six specs* match
`implement.jsonl`. The probe note's sentence attributing the block to `check.jsonl`
is therefore unproven and should not be relied on.

## 4. What this does and does not mean

- The four gates still have no carrier of their own: they live in two `.agents/skills/`
  files, and no agent template on any of the 21 platforms references
  `trellis-before-dev`. `trellis-check` reaches a child as a skill only on DSH, Kimi,
  Reasonix (role skills under `.dsh/skills/`, `.kimi-code/skills/`), and Kiro
  (prelude).
- The bridge is **repo-owned and tracked** (`pi-agent/extensions/`, symlinked by
  `setup.sh`), unlike `.pi/` which is generated and gitignored. It is therefore not
  part of the coupling R1 forbids, and it is the only repo-owned place that runs
  inside the child.
- Adding an injected block there would *duplicate* what `:2132` already injects for
  the implement manifest, so the design has to dedupe per file rather than per block.

## 5. One route closed, measured

`.trellis/config.yaml:164-208` documents a **path-scoped spec injection** feature:
spec `.md` files under `.trellis/spec/` whose frontmatter `paths:` globs match a
touched file are injected at that moment (`spec_injection`, defaults
`max_spec_chars: 9400`, `refresh_window_seconds: 2700`).

It is implemented as a shared Python hook, and Pi has no hook layer:

```bash
grep -rln spec_injection "$T" | sed "s|$T/||"
  templates/trellis/config.yaml
  templates/shared-hooks/inject-spec-context.py      # not installed by scripts/install-trellis.sh
  migrations/manifests/0.7.0-beta.4.json

ls .trellis/scripts/hooks/
  linear_sync.py                                     # no inject-spec-context.py
```

So the feature is documented in this project's `config.yaml` but has no
implementation on Pi. It is recorded as a deferred route, not used: porting it would
be a new mechanism.

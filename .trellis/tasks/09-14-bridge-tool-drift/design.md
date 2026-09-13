# Design — generated-tool drift detection

## The coupling

Two facts must agree, and this repo owns only one of them:

| Fact | Lives in | Owned by |
|---|---|---|
| which `trellis_*` tools the generated extension registers | `.pi/extensions/trellis/index.ts` | `@mindfoldhq/trellis` (generated, gitignored) |
| which names the bridge deactivates | `pi-agent/extensions/trellis-subagents-bridge/index.ts` | this repo |

Nothing tied them together, so the bridge could only be correct *by observation*.
A `trellis update` that renames the tool leaves R10 quietly false.

## Chosen mechanism

Extract the registered names from the generated extension and compare them against
the names the bridge declares.

```bash
names=$(grep -oE 'name: "[a-z_]+"' "$generated" | sed -E 's/.*"(.*)"/\1/' | sort -u)
```

Calibrated against today's file: exactly one hit, `name: "trellis_subagent"` at
`:1926`, inside `pi.registerTool?.({` at `:1925`.

## Why not the alternatives

| Alternative | Rejected because |
|---|---|
| Parse the TypeScript | needs a parser; this repo has zero dependencies and no build step |
| Call `pi list`, `pi --help`, or `subagent({action:"list"})` | not offline; `subagent` is model-facing and not callable from bash; `doctor.sh` must work on a fresh clone |
| Assert a hard-coded expected list in `doctor.sh` | writes the same fact down a third time — the failure mode `change-propagation-guide.md` exists to prevent — and detects only self-mismatch, never a rename |
| Add a path-override env var so a fixture can be pointed at | production surface for a test-only need. The failure path is proven instead by a temporary mutation with a verified restore (prd AC2) |

## Brittleness, and the guard that contains it

The grep depends on the generated formatting. If upstream reflows it, extraction
yields **zero** names — and a naive subset check would then pass vacuously. The
check must therefore distinguish four states:

| State | Result |
|---|---|
| names extracted, all named by the bridge | `ok` |
| names extracted, some unknown | `bad`, naming the tool and the bridge file |
| `registerTool` present but zero names extracted | `bad` — formatting drift |
| generated file absent | `warn`, with a reason |

The third row is the point of the whole task: the check fails when it can no
longer see, not only when what it sees is wrong.

## Risks

| Risk | Handling |
|---|---|
| The grep also matches an unrelated `name: "…"` string added upstream | The comparison is one-directional (unknown ⇒ `bad`), so a stray match becomes a loud, reviewable false positive rather than a silent pass. AC2 exercises the positive path |
| The temporary-mutation test leaves the generated file changed | Take a backup first, restore from it, then re-verify `sha256` against `.trellis/.template-hashes.json`. `.pi/` is gitignored, so git is not the safety net here |
| `doctor.sh` grows a check that duplicates the existing agents check | Keep both in the same section: the agents check asserts discovery *input*, this asserts tool *identity* |
| The bridge list and the check drift apart from each other | The check reads the bridge file directly, so the bridge is the single source for names and there is no third copy to stale |

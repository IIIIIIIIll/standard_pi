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

The grep depends on the generated formatting, and extraction is **all-or-nothing**:
it goes blind only when *every* registration is reformatted at once, so partial
blindness is silent. Measured against the real file, appending a second
registration:

| Appended shape | Extracted | Outcome |
|---|---|---|
| `name: "trellis_rogue",` | both names | `bad` |
| `name: 'trellis_rogue',` (single quotes) | only the known one | silent |
| `name:  "trellis_rogue",` (two spaces) | only the known one | silent |
| `name:` on its own line | only the known one | silent |
| `name: "trellis-rogue",` (hyphen) | only the known one | silent |

Also unscanned: registrations moved to a sibling file.

So the guard cannot be "detect every reformatting". It is "fail loudly whenever
the check can no longer see", expressed as a ladder over the states it *can*
distinguish:

| State | Result |
|---|---|
| names extracted, all declared by the bridge | `ok` |
| names extracted, some undeclared | `bad`, naming the tool and the bridge file |
| extension calls `registerTool`, no name extracted | `bad` — formatting drift |
| extension unreadable | `bad` — cannot verify |
| `SHIPPED_TOOLS` yields no name | `bad` — cannot read the declaration |
| extension registers no dispatch tool at all | `warn`, never `ok: 0` |
| generated file absent | `warn` |

The first version of this check got the middle four wrong: it printed
`ok ... covered by the bridge: 0` for an unreadable file, an empty file, and a
file with no `registerTool` token. The check phase found it by mutating states
beyond the four this document had imagined — which is the argument for having an
independent reader at all.

## Risks

| Risk | Handling |
|---|---|
| The grep also matches an unrelated `name: "…"` string added upstream | The extension-side comparison is one-directional (undeclared ⇒ `bad`), so a stray match becomes a loud, reviewable false positive rather than a silent pass. On the bridge side the names are read off the `SHIPPED_TOOLS` declaration line, not matched anywhere in the file, so a mention in the `tool_call` guard cannot stand in for deactivation |
| The temporary-mutation test leaves the generated file changed | Take a backup first, restore from it, then re-verify `sha256` against `.trellis/.template-hashes.json`. `.pi/` is gitignored, so git is not the safety net here |
| `doctor.sh` grows a check that duplicates the existing agents check | Keep both in the same section: the agents check asserts discovery *input*, this asserts tool *identity* |
| The bridge list and the check drift apart from each other | The check reads the bridge file directly, so the bridge is the single source for names and there is no third copy to stale |

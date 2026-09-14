# Design — Make the settings render drift check insensitive to package order

Decides the Open Question in `prd.md`. Chosen: **Option 1** — make the `--check`
comparison order-insensitive for `packages` only.

## Purpose

Stop `scripts/doctor.sh` failing on a `~/.pi/agent/settings.json` whose `packages`
array is **set-equal** to the render but ordered differently. Nothing about the
composition rules changes.

## The rule

> `packages` is a **set**, not a sequence. Two arrays with the same members in a
> different order are equal. Membership, duplicates, and every other key's value
> are still compared strictly.

Two separate freedoms fall out of this and must not be conflated:

| Concern | Owner | Order |
| --- | --- | --- |
| **Emission** — what `setup.sh` writes | `render-settings.mjs` | canonical: core order, then enabled optionals' manifest order |
| **Comparison** — what `--check` accepts | `render-settings.mjs --check` | order-insensitive for `packages` |

Only the comparison changes.

## How the order mismatch arises (measured)

Two writers append, and they append different things:

1. **Render** (`render-settings.mjs:91-100`) clones `settings.core.json` and then
   `out.packages.push(pkg)` for each enabled optional's manifest packages
   (`:94`). So render order is **core members first, optional members last**.
2. **`pi install`** appends to the live array. A core/always-on package installed
   while an optional bundle is enabled therefore lands **after** that optional's
   package.
3. **`sync-settings.mjs:29,40`** folds live into core and strips only the enabled
   optionals' packages, so core inherits the remaining live order.

Reproduces the PRD's 2026-09-14 measurement exactly: with `pi-opencode-go` enabled
and `pi-tps-status` installed afterwards,

```text
live   : … "pi-lens", "pi-opencode-go", "pi-tps-status"
render : … "pi-lens", "pi-tps-status", "pi-opencode-go"    (core has tps; optional appends go last)
```

`render-settings.mjs:106-114` compares the whole file as **text**
(`previousText === next`), so array order alone trips `drift` and exit `1`.
`doctor.sh:6` sets `-uo pipefail`, which is why the `--check | sed` pipeline at
`doctor.sh:45-49` correctly propagates that exit status even without `-e`.

## Decision

In `--check`, compare parsed values instead of raw text, with `packages`
normalised on both sides:

- Build `next` from the composed object as today.
- In the check branch, parse the live file and the composed object, replace each
  `packages` array with a **sorted copy** (duplicates preserved), then compare.
- Reuse the existing serialisation so every other key, every value, and key order
  stay as strict as they are now.
- Missing/unparseable live file → drift + exit `1` (unchanged).
- Output text and exit codes (`0` ok, `1` drift, `2` usage) unchanged.

Sorting a copy rather than deduping is deliberate: a duplicate is a real defect
the PRD requires to stay visible, and a sorted **multiset** comparison reports it
(`[a,a,b]` ≠ `[a,b]`) for free. No separate duplicate-detection pass is needed.

Explicit side effect, accepted: because comparison is now over parsed values,
whitespace/indent differences stop being drift. That is desirable (a reformatted
file is semantically identical) and does not weaken the check into "compares
nothing" — all keys and values are still compared, and JSONC still fails because
`JSON.parse` rejects it.

## Why not the other two options

**Option 2 — render preserves the live order of already-present packages.** This
makes render output depend on the live file's install history, so
`render-settings.mjs` stops being a function of `(core, enabled optionals,
state)`. A fresh machine and an existing machine would then emit different arrays
from identical inputs, `settings.core.json` order would become a recorder of one
machine's install order, and `--check` would be comparing a file against a
copy of itself. It trades a false positive for a loss of reproducibility.

**Option 3 — `sync-settings.mjs` canonicalises order on the way in.** It cannot
fix the reported failure. The drift is computed between the **live** file and the
render, and `sync.sh` never writes the live file — it only folds live → core
(`sync-settings.mjs:29`) and copies `PI_FILES`/`PI_DIRS` (`sync.sh`). Reordering
core also changes a tracked file to follow install history, the same objection as
Option 2, while leaving `doctor.sh` failing until someone runs `setup.sh`.

Option 1 is also the only one of the three that makes the order-insensitivity
**explicit at the layer that decides equality**, which is what the PRD's third
requirement demands.

## Change surface

| File | Change |
| --- | --- |
| `scripts/render-settings.mjs` | `--check` branch (`:106-115`): normalise `packages` on both sides before comparing; keep the write path (`:116-125`) byte-for-byte as it is |
| `.trellis/spec/config/layout-and-surfaces.md` | new subsection documenting the rule (below) |

No change to `doctor.sh` (it reads only the exit status), to `sync-settings.mjs`,
to `setup.sh`, or to `settings.core.json`.

## Documentation the change must add

Under `## \`settings.json\` Is Generated, Never A Symlink`
(`layout-and-surfaces.md:89`), after`### Enabling-set precedence`(`:120`) and
before`### Per-machine extension config is not symlinked`(`:133`), add a
subsection — working title **`` `packages` Order Is Not Drift ``** — stating:

- `packages` is a set; order carries no meaning and no reader may depend on it.
- Emission order is canonical (core, then optionals' manifests) and remains the
  format `setup.sh` writes.
- `--check` deliberately ignores `packages` order while still failing on
  membership changes, duplicates, and any other key's value.
- Whitespace is likewise not drift; JSONC still is.

`pi-resources.md` §"The package inventory" is the wrong home: it describes what
each package *adds*, and makes no claim about array order.

## Verification (offline, no network, no `pi`)

`render-settings.mjs` already takes `<repo> <live> <state>` as arguments, so every
acceptance case is reachable with temp files and the real repo root. No test
harness and no new flag are needed:

| Case | Live `packages` | Expected |
| --- | --- | --- |
| reordered, set-equal | core members then installed member | exit `0`, no drift |
| missing one spec | render minus one | exit `1`, drift |
| duplicate spec | one spec twice | exit `1`, drift |
| extra spec | render plus one | exit `1`, drift |
| non-`packages` value differs | any other key changed | exit `1`, drift |
| whitespace only | same values, reformatted | exit `0`, no drift |

Then the repo's normal chain: `./setup.sh` twice (second run reports nothing to
do), `./scripts/sync.sh` still prints `same pi-agent/settings.core.json`, and
`./scripts/doctor.sh` clean.

## Risks

| Risk | Severity | Handling |
| --- | --- | --- |
| `packages` order *is* semantically meaningful to Pi (e.g. load precedence), so set-equality hides a real difference | Medium | The assumption is that Pi treats `packages` as a set: `pi install` appends without regard to position, and render already places an optional's packages after core, so no stable order can be relied on today. Recorded explicitly above; revisit if Pi ever documents order semantics |
| Check becomes strictly more permissive than render, so a hand-reordered live file passes and is never canonicalised | Low | Accepted. The PRD's goal is to stop the false failure; emission order stays documented and `setup.sh` remains the canonical writer |
| Whitespace/formatting differences stop being reported | Low | Accepted and documented. JSONC still fails; all values still compared |
| The change is mistaken for "the check was weakened" in review | Low | The duplicate/missing/extra/value cases above are the proof it still fails; `guides/index.md`'s false-positive guidance covers the rest |
| A future key that *is* order-meaningful gets swept in | Low | The normalisation is scoped to the literal key `packages`, not "all arrays" |

## Acceptance criteria mapping

All seven PRD criteria are met by the table in **Verification**: the first four
map to the first four cases, the fifth to the non-`packages` case, the sixth to
the `setup.sh`/`sync.sh` chain, and the seventh to the documentation subsection
above.

## Out of scope

Unchanged from the PRD: no change to how optionals are enabled or inferred, no
undeclared-file detection in `doctor.sh`, no hand-editing of
`settings.core.json`.

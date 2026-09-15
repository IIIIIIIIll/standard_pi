# Implementation Plan — the declaration, the check, and its negative tests

Design: [`design.md`](./design.md). Requirements: [`prd.md`](./prd.md).

Order matters in two places. **Step 2 must precede step 3**, because the check
reads the declaration the bridge must already have. **Step 3 must precede step 6**,
because the negative tests test the check. Step 9 amends the other task and can run
at any point before it starts its step 5b.

## Ordered Checklist

**1. Read the section you are editing, and the precedent.**

`scripts/doctor.sh` lines 192-288 (`==> Trellis subagent bridge`), plus
`docs/README.md`-adjacent conventions in
[`shell-guidelines.md`](../../spec/scripts/shell-guidelines.md) §Exceptions to
strict mode and §Anti-Patterns ("Do not let a verification section report `ok`
when it could not read its input"). The `SHIPPED_TOOLS` block in that section is
the model: declaration in the bridge, comparison in `doctor.sh`, and every
"cannot verify" path failing rather than passing.

**2. Declare the marker in the bridge, and use it in the existing predicate.**

In `pi-agent/extensions/trellis-subagents-bridge/index.ts`, above the predicate:

```ts
// The generated Trellis extension returns immediately when this name is "1" in
// the environment, which is how a dispatched child is stopped from running the
// PARENT's per-turn session path. This declaration is the SINGLE SOURCE for that
// marker: scripts/doctor.sh reads the name off it and fails when the generated
// extension no longer returns early on it, so a `trellis update` that renames the
// variable or moves the guard below the registration calls cannot silently
// restore the wrong breadcrumb in every dispatched child. The parent sets it
// before spawning; the child inherits it.
const CHILD_INERT_MARKER = "TRELLIS_SUBAGENT_CHILD";
```

Then replace the two literals in the child predicate (`:223`, `:230`) with
`process.env[CHILD_INERT_MARKER]`. **Behaviour-identical** — same branches, same
values, no restructure. The predicate's shape is
`09-15-harden-pi-role-agents` step 5b's to change, not this task's.

While in the file, the `session_shutdown` handler's empty `} catch {}` becomes
`} catch { …comment… }`. It is behaviour-identical (an empty block swallows the
same errors), it is **not** part of R1-R6, and it is recorded as a drive-by in
`design.md` §Residuals item 3 so the commit has something that explains it — the
repo's TS linter surfaces empty blocks on every pass. Roll it back if a reviewer
would rather keep the commit to the marker change.

**3. Add the check to `doctor.sh`.**

Add the block from `design.md` §"The Check, In Full" at **indent 2** inside the
outer `else` in the bridge section — a **sibling** of the `SHIPPED_TOOLS`
comparison, placed after the `fi` that closes its `if [ -z "$declared" ] / elif [
-z "$ext_names" ] / else` chain, and wrapped in `if [ -n "$ext_names" ]; then … fi`.
`ext_names` is assigned unconditionally at the top of that `else`, so it is in
scope at indent 2.

Two things this is not:

- **Not a new `elif` of the outer chain.** A missing `SHIPPED_TOOLS` declaration
  must not suppress the guard result. Measured with the first (nested)
  implementation: forcing that declaration empty printed a `bad` from the tool
  chain and **nothing** from the child-inert check.
- **Not a bare dedent.** Without the `[ -n "$ext_names" ]` wrapper the sibling
  contradicts the tool chain: when the generated extension registers no dispatch
  tool at all, `SHIPPED_TOOLS` deliberately `warn`s (there is no registration line
  to position a guard against), while an unguarded sibling prints a `bad`. The
  wrapper is load-bearing; do not drop it.

Every `bad` in the block must contain the literal token `child-inert`, because
step 6's documented single-arm command is `./scripts/doctor.sh | grep 'inert'`.
A message without the token makes a failing arm print nothing — a failing test
that reads as a clean one.

Match the file: no `set -e` in `doctor.sh`, call `ok`/`warn`/`bad` and never exit
early, keep the two-space/glyph output style, and leave the existing comments
alone.

**Known limit of this placement.** When the bridge loses the word `SHIPPED_TOOLS`
entirely, the outer chain's `elif ! grep -q "SHIPPED_TOOLS"` branch fires its `bad`
and the sibling is skipped, because `ext_names` is computed inside the `else` that
branch never reaches. Measured. The fix for that is a restructure of the outer
chain (move the `ext_names` assignment out of it), which is out of scope here; the
`bad` that does fire names the missing declaration, so the section is never
silently green. Do not claim otherwise in the AC report.

**4. Record it in the bridge's must-not-break list.**

`.trellis/spec/config/pi-resources.md`, in the `### trellis-subagents-bridge/`
bullet list: add that the marker has **one definition** (the `CHILD_INERT_MARKER`
declaration), that a `doctor.sh` check reads it against the generated extension,
and what breaks if the guard disappears. Keep it to the same shape and length as
the neighbouring bullets — facts a contributor must not break, not a changelog.

**5. Record the multi-site fact.**

`.trellis/spec/guides/change-propagation-guide.md` §"Known Multi-Site Facts": add
a row (or extend the `SHIPPED_TOOLS` row, if that reads better) naming the three
sites — the declaration in the bridge, the check in `doctor.sh`, and the generated
extension the check reads — and the severity if one drifts. The existing
`SHIPPED_TOOLS` row is the template; the two rows should read as siblings.

**6. Negative tests — measured, not inferred (AC3, AC4).**

```bash
cd /home/tan/my_pi_setup
cp .pi/extensions/trellis/index.ts /tmp/pi-trellis-ext.$$
guard='if (process.env.TRELLIS_SUBAGENT_CHILD === "1") return;'

# AC3 — guard deleted
sed -i "\|$guard|d" .pi/extensions/trellis/index.ts
./scripts/doctor.sh | grep 'inert'
cp /tmp/pi-trellis-ext.$$ .pi/extensions/trellis/index.ts

# AC4 — guard moved below the registration call (appended at EOF is "not first")
sed -i "\|$guard|d" .pi/extensions/trellis/index.ts
printf '\n%s\n' "$guard" >> .pi/extensions/trellis/index.ts
./scripts/doctor.sh | grep 'inert'
cp /tmp/pi-trellis-ext.$$ .pi/extensions/trellis/index.ts
```

Both must print a `✗` line: AC3 naming the marker, AC4 giving both line numbers.
A test that prints `✓` means the positional comparison is not working. Both `✗`
lines contain the token `child-inert`.

`.pi/extensions/trellis/index.ts` is CLI-generated and gitignored, so `git status`
will not show the mutation — verify the restore with `diff` instead of trusting a
clean status (step 8).

**Backup path gotcha.** `$$` is the PID of the shell running the line, so a
backup made with `/tmp/pi-trellis-ext.$$` in one terminal is **not** found by
the `$$` in the next one, and the `cp` back fails with
`cannot stat '/tmp/pi-trellis-ext.<pid>'` while the mutation stays in the file.
Run the whole block in a **single** shell invocation, or use a fixed path
(`/tmp/pi-ext-arms.bak`) and `sha256sum` the file before and after. Also note
that `grep 'inert'` can match an indented `git status --short` line — the task
directory is named `09-15-doctor-child-inert-guard` — so the check's own line is
the one carrying `✓` or `✗`, not a bare `??` line.

**7. The reflow test and the declaration-absent test (AC5, AC6).**

```bash
# AC5 — a reflowed comparison must NOT trip it
sed -i 's/TRELLIS_SUBAGENT_CHILD === "1"/TRELLIS_SUBAGENT_CHILD == "1"/' .pi/extensions/trellis/index.ts
./scripts/doctor.sh | grep 'inert'     # must be ✓
cp /tmp/pi-trellis-ext.$$ .pi/extensions/trellis/index.ts

# AC6 — declaration gone; the SHIPPED_TOOLS result must still print
sed -i 's|^const CHILD_INERT_MARKER|// const CHILD_INERT_MARKER|' \
  pi-agent/extensions/trellis-subagents-bridge/index.ts
./scripts/doctor.sh | sed -n '/subagent bridge/,/Footer/p'
git checkout pi-agent/extensions/trellis-subagents-bridge/index.ts   # after step 2 is committed; otherwise restore by hand
```

AC6 must show a `✗` naming `CHILD_INERT_MARKER` **and** the `shipped dispatch
tool(s) covered` line — the second is what proves the two checks are independent.
Grep with a plain pattern (`grep -E 'child-inert|shipped dispatch'`): `grep -F`
treats `\|` as a literal backslash-pipe and matches nothing, which is
indistinguishable from a silent check.

**7b. The sibling and guard arms (R5).** Two more arms, both measured 2026-09-15:

```bash
# R5 — the tool chain's declaration is missing/empty; the guard must still report
sed -i 's|^const SHIPPED_TOOLS|// const SHIPPED_TOOLS|' \
  pi-agent/extensions/trellis-subagents-bridge/index.ts
./scripts/doctor.sh | sed -n '/Trellis subagent bridge/,/Footer ownership/p' | grep -E '✗|✓|!'
# expect: ✗ "read no tool name from the SHIPPED_TOOLS declaration …"
#     AND ✓ "child-inert guard precedes registration (… 1843 … 1925)"

# the `$ext_names` guard — an extension that registers no dispatch tool at all
sed -i 's/registerTool/regTool/g; s/name: "trellis_subagent"/name: "trellis-subagent"/' \
  .pi/extensions/trellis/index.ts
./scripts/doctor.sh | grep 'inert'    # expect NO ✗ line (the check has no input)
# expect from the tool chain: ! "registers no dispatch tool; nothing for the bridge to deactivate"
```

The second arm is the one that proves the wrapper is load-bearing. Counterfactual,
also measured: replace `if [ -n "$ext_names" ]` with `if true` in a scratch copy of
`doctor.sh` and the same mutant prints
`✗ the child-inert guard cannot be positioned: no registration call was found …` —
a `bad` contradicting the tool chain's `warn` for the same shape.

Restore both files after these arms: the bridge from its backup, the extension
from `/tmp/pi-ext-arms.bak`, and `doctor.sh` from its own backup if you ran the
counterfactual.

**7c. The comment false-pass arms (the guard scan's filter).**

Add these arms because the guard scan has produced **three** measured false
greens during this task, each by deleting the real guard and planting one line in
its place. The shipped `guard_line` scan is
`grep -v '//' | grep -vE '^[0-9]+:[[:space:]]*(/\*|\*)' | grep -E '^[0-9]+:[[:space:]]*if[[:space:]]*\(' | grep -E '\breturn\b'`.

```bash
EXT=.pi/extensions/trellis/index.ts
# arm 1 — a line comment naming the marker and the word return
sed -i '/process\.env\.TRELLIS_SUBAGENT_CHILD === "1") return;/d' "$EXT"
sed -i '1919i\  // callers should return early on TRELLIS_SUBAGENT_CHILD' "$EXT"
# arm 2 — a block comment (the `//` filter alone does NOT catch this)
sed -i '/process\.env\.TRELLIS_SUBAGENT_CHILD === "1") return;/d' "$EXT"
sed -i '1919i\  /* TRELLIS_SUBAGENT_CHILD shifts the child; returns early */' "$EXT"
# arm 3 — a bare comment line whose colon satifies an UNANCHORED `: *if`
sed -i '/process\.env\.TRELLIS_SUBAGENT_CHILD === "1") return;/d' "$EXT"
sed -i '1919i\  TRELLIS_SUBAGENT_CHILD: if (set) handlers return early' "$EXT"
./scripts/doctor.sh | sed 's/\x1b\[[0-9;]*m//g' | grep 'inert' | grep -E '✓|✗'
# expect for all three: ✗ "the child-inert guard is gone: the generated extension no
#   longer returns early on TRELLIS_SUBAGENT_CHILD …"
# a ✓ means the scan accepts a comment as a guard — a false green is back
# restore between arms; the planted line goes above the first registration
```

The line number `1919` is illustrative; re-derive it from
`grep -n 'pi\.registerTool'` in your scratch copy. Restore the extension from
`/tmp/pi-ext-arms.bak` after each arm and confirm with `diff` plus `sha256sum`.

Arm 3 is the non-obvious one and it is why every pattern is anchored on
`^[0-9]+:`: it has no comment delimiter at its start, and an unanchored `: *if`
matches the colon **inside** `CHILD: if (`. Measured before the anchor landed:
the check reported `ok` at the planted line with exit 0.

The comment filters trade these false greens for a false `bad` in a shape the arms
do not cover. That is the intended direction (reword the comment rather than
loosen the filter). Measured 2026-09-15, per shape — a *trailing* `/* */` after a
real guard, minified `if(…)return;`, `{ return; }`, `== "1"`, single quotes with
extra spacing: all `ok`. A *trailing* `//` on the guard line: `✗`, because the `//`
filter drops the whole line. Keep the `//` filter anyway — it is what catches a
guard commented out inside a `/* … */` block while keeping its own `//`.

**7d. The residual the scan cannot close.** A non-comment line that merely reads
`if (<marker access>) return …` above the first registration passes — measured
with `if (process.env.TRELLIS_SUBAGENT_CHILD !== "1") return false;` planted at
the guard's position. A text scan cannot tell a helper from the load-time guard;
that is `09-15-harden-pi-role-agents` step 11's dispatch probe. Recorded in
`design.md` §Residuals item 4; do not describe the check as proving more.

**8. Verify chain (AC7).**

```bash
bash -n scripts/doctor.sh
diff /tmp/pi-ext-arms.bak .pi/extensions/trellis/index.ts && echo "extension restored intact"
sha256sum .pi/extensions/trellis/index.ts   # must equal the pre-test hash
./scripts/doctor.sh                         # exit 0, `problems=0`
git status --short                          # only the intended edits
```

The `diff` and the `sha256sum` are the real restore check. `git status` cannot see
`.pi/` at all. Note that `All good.` prints only when `problems` **and** `notes`
are both zero (`doctor.sh:441`); while this task's edits are uncommitted the
`uncommitted changes` note is present, so the footer is
`No problems. 1 note(s) above.` with exit `0`. That is the informational-note
variant, not a failure.

**9. Amend the other task so 5b consumes the declaration.**

In `.trellis/tasks/09-15-harden-pi-role-agents/implement.md` step 5b, add one
clause: the marker is set through `CHILD_INERT_MARKER` as declared in the bridge,
not as a literal. Without it, 5b reintroduces the literal and this check's
comparison drifts from what the bridge actually uses — the failure AC1 exists to
prevent.

## Validation Commands

| Check | Command |
| --- | --- |
| One definition (AC1) | `grep -c 'TRELLIS_SUBAGENT_CHILD' pi-agent/extensions/trellis-subagents-bridge/index.ts` → `1`, and `grep -rn TRELLIS_SUBAGENT_CHILD scripts/` → no match |
| Check present and passing (AC2) | `./scripts/doctor.sh \| grep 'inert'` → `✓`, two line numbers |
| Guard absent (AC3) | step 6, first arm |
| Guard not first (AC4) | step 6, second arm |
| Reflow tolerated (AC5) | step 7, first arm |
| Declaration absent (AC6) | step 7, second arm |
| Sibling independence — R5 (FIX 1) | step 7b, first arm: tool `bad` **and** child-inert `ok` in the same run |
| `$ext_names` guard (FIX 1) | step 7b, second arm: no child-inert `bad`; counterfactual with `if true` prints one |
| Comment false-passes closed | step 7c: each of the three planted lines must NOT produce `ok` |
| Residual the scan cannot close | step 7d: the marker-returning non-comment line still passes; recorded, not fixed |
| Syntax and restore (AC7) | `bash -n scripts/doctor.sh`; `diff` against `/tmp/pi-ext-arms.bak` plus `sha256sum` |
| Prose (AC8) | read the two sites |

## Risky Files And Rollback Points

| File | Risk | Rollback point |
| --- | --- | --- |
| `scripts/doctor.sh` | Runs in the verify chain for every other change in this repo; a bad block makes `All good.` unreachable | After step 3: `git checkout` the file |
| `pi-agent/extensions/trellis-subagents-bridge/index.ts` | Loaded in **every** Pi session on this machine; the predicate edit is behaviour-identical or dispatch breaks everywhere | After step 2: `git checkout` the file |
| `.pi/extensions/trellis/index.ts` | Generated and gitignored — a failed restore is invisible to `git status` | `/tmp/pi-ext-arms.bak` (a fixed path; `$$` differs between shells), verified by `diff` + `sha256sum` in step 8; `./setup.sh` regenerates it as the fallback |
| `.trellis/spec/config/pi-resources.md`, `.trellis/spec/guides/change-propagation-guide.md` | They are the record a future contributor reads; a stale sentence here misleads the next change | After steps 4-5: revert both |

No settings render, no symlink, and nothing in `.trellis/.template-hashes.json`.

## Follow-Ups Before `task.py start`

- [ ] Curate `implement.jsonl` / `check.jsonl`, then `task.py validate`.
- [ ] Confirm `scripts/doctor.sh` is not currently mid-edit by another task:
      `git status --short scripts/doctor.sh`.
- [ ] Confirm the AC2 baseline — the tree as-is reports `All good.` — before
      adding the check, so a later failure is attributable.

# Design — a text-level check on a generated file's guard

## Change Boundary

**Behaviour gap.** Nothing detects that `.pi/extensions/trellis/index.ts` still
returns early on `TRELLIS_SUBAGENT_CHILD`. Today that absence is harmless. After
`09-15-harden-pi-role-agents` step 5b it is not: the child would resume running the
parent's per-turn session path and be handed a *planning* breadcrumb while its own
definition tells it to review. The gap is in detection, not in behaviour.

**Where the behaviour lives.** Three files, none of them editable by the task that
creates the dependency:

| File | Role | Editable here |
| --- | --- | --- |
| `.pi/extensions/trellis/index.ts:1843` | the guard | **no** — CLI-generated, gitignored, template-tracked |
| `pi-agent/extensions/trellis-subagents-bridge/index.ts:223,230` | the existing reader, and the home of the declaration | yes |
| `scripts/doctor.sh:192-347` | where a check belongs | yes |

**Explicitly not doing.** No edit to `.pi/`, `.trellis/scripts/`, `setup.sh`, or
`.trellis/.template-hashes.json`. No new `doctor.sh` section. No change to the
bridge's role-branch shape — the predicate keeps its branches and only stops
spelling the marker name itself.

## The Check, In Full

Placed at indent 2 inside the outer `else` of `==> Trellis subagent bridge` — a
**sibling** of the `SHIPPED_TOOLS` comparison, following the `fi` that closes its
`if [ -z "$declared" ] / elif [ -z "$ext_names" ] / else` chain, and wrapped in an
`if [ -n "$ext_names" ]` guard:

```bash
  # Child-inert guard. A SIBLING of the SHIPPED_TOOLS comparison above, not a
  # nested branch: the two checks read independent inputs, so a missing tool
  # name must not suppress the guard result. The bridge sets CHILD_INERT_MARKER
  # in the parent's environment before dispatching, so the child's copy of the
  # generated Trellis extension returns at load instead of running the PARENT's
  # per-turn session path. That guard lives in a generated file this repo cannot
  # edit, so a `trellis update` that renames the variable or moves the guard
  # below the registration calls would silently restore the wrong breadcrumb in
  # every dispatched child. Presence alone is not enough: a guard after the
  # registration calls registers everything and then returns.
  #
  # The `$ext_names` guard is load-bearing. With no dispatch tool registered, the
  # generated extension has no registration call to compare a guard against, and
  # SHIPPED_TOOLS deliberately `warn`s rather than fails for that shape — so a
  # bare dedent would have the two sibling checks contradict each other. When the
  # tree registers nothing, this check has no input and stays quiet.
  #
  # `pi.registerTool?.(` is the call form; the bare word `registerTool` is the
  # type annotation above the guard, and `pi.registerTool(` matches nothing.
  #
  # The guard scan admits only statement-shaped lines: line comments and
  # block-comment lines are dropped, the line must open with the `if` keyword and
  # a `(`, and it must carry the word `return`. Without that, deleting the real
  # guard and leaving a comment which merely mentions the marker and the word
  # `return` above the registration makes this check report `ok` with exit 0 —
  # measured with a `//` line naming the marker, with a `/* … */` line saying it
  # "shifts the child; returns early", and with a bare `<marker>: if (set) handlers
  # return early` line. The first needs the `//` filter, the second the
  # block-comment filter, and the third is why each pattern is anchored on the
  # `grep -n` prefix — a bare `: *if` also matches a colon INSIDE the text. A
  # false `bad` is the acceptable direction (see shell-guidelines.md on filtering
  # a scanner's own output): a reflowed comment costs a reworded line, while a
  # filter loose enough to accept a comment as a guard is unrecoverable. R4's
  # tolerance is unaffected — spacing, quote style, `== "1"`, `if(…)return;`,
  # `{ return; }`, and a trailing block comment after a real guard all still pass.
  if [ -n "$ext_names" ]; then
    marker="$(grep 'CHILD_INERT_MARKER' "$bridge_src" 2>/dev/null | grep -v '//' | head -n 1 |
      grep -oE '"[A-Z_]+"' | tr -d '"')"
    if [ -z "$marker" ]; then
      bad "read no marker name from the CHILD_INERT_MARKER declaration in $bridge_file (empty or reformatted?); the child-inert guard cannot be verified"
    else
      guard_line="$(grep -nF "$marker" "$trellis_ext" 2>/dev/null | grep -v '//' |
        grep -vE '^[0-9]+:[[:space:]]*(/\*|\*)' | grep -E '^[0-9]+:[[:space:]]*if[[:space:]]*\(' | grep -E '\breturn\b' |
        head -n 1 | cut -d: -f1)"
      reg_line="$(grep -n 'pi\.registerTool' "$trellis_ext" 2>/dev/null | head -n 1 | cut -d: -f1)"
      if [ -z "$guard_line" ]; then
        bad "the child-inert guard is gone: the generated extension no longer returns early on $marker, so a dispatched child runs the parent's per-turn session path"
      elif [ -z "$reg_line" ]; then
        bad "the child-inert guard cannot be positioned: no registration call was found in .pi/extensions/trellis/index.ts to compare $marker against"
      elif [ "$guard_line" -ge "$reg_line" ]; then
        bad "the child-inert guard is no longer first: $marker at line $guard_line is not before the first registration at line $reg_line"
      else
        ok "child-inert guard precedes registration ($marker at line $guard_line, registration at $reg_line)"
      fi
    fi
  fi
```

Measured against the tree today: `marker=TRELLIS_SUBAGENT_CHILD`,
`guard_line=1843`, `reg_line=1925` → `ok`.

**Why the block is a guarded sibling, and not a branch of the tool chain.**

The first implementation nested the block one level deeper, inside the innermost
success `else` of the `SHIPPED_TOOLS` chain. Measured consequence: with the
bridge's `SHIPPED_TOOLS` declaration forced empty, the child-inert line printed
**nothing** while its sibling printed a `bad`. R5 forbids exactly that — one
check skipped because the other's input is missing. Hoisting it out of the chain
is what fixes it; the `$ext_names` guard is what keeps the hoist honest, because
without it the sibling prints a `bad` in the one shape `SHIPPED_TOOLS`
deliberately `warn`s about (an extension that registers no dispatch tool at all,
so there is no registration line to position the guard against). Both arms are
in `implement.md` §"Ordered Checklist" step 6.

Every `bad` in the block carries the literal token `child-inert`, because the
documented way to run a single arm is `./scripts/doctor.sh | grep 'inert'`. A
message that does not contain the token makes a failing arm read as a clean one —
the same class of false pass the section's own check-integrity rule forbids.

**Known limit — the outer chain's first branch still skips the sibling.**

`ext_names` is assigned inside the outer `else`, so it does not exist in the
`elif ! grep -q "SHIPPED_TOOLS" "$bridge_src"` branch. When the bridge loses the
word `SHIPPED_TOOLS` entirely, that branch fires its `bad` and the sibling never
runs — measured: the section prints the declaration `bad` and no child-inert line.
This is **not** the R5 failure above (there, both inputs existed and only one
check reported); it is a residual of computing `ext_names` inside the same branch
that the declaration check guards. Closing it means moving the `ext_names`
assignment and the declaration check out of the chain, which is a larger
restructure of a section this task only adds to. Stated, not papered over: the
`bad` that does fire names the missing declaration, so the section is never
silently green.

**Why each part is the way it is.**

| Choice | Reason |
| --- | --- |
| Declaration read with the `grep -v '//' \| head -n 1` + `"[A-Z_]+"` extraction | The `SHIPPED_TOOLS` reader's idiom, and it needs the same comment filter: a name mentioned in a comment is not the declaration |
| `grep 'return'` alongside the marker name | The marker also appears at `:1554`, where the *shipped tool* sets it. That line has no `return`, so the filter selects the guard and nothing else |
| The extension scan's four filters (`-v '//'`, `-vE '^[0-9]+:[[:space:]]*(/\*\|\*)'`, `-E '^[0-9]+:[[:space:]]*if[[:space:]]*\('`, `-E '\breturn\b'`) | Measured false greens without them — **three**, each reproduced 2026-09-15 by deleting the real guard and planting one line above the registration: `// callers should return early on TRELLIS_SUBAGENT_CHILD` (needs the `//` filter), `/* TRELLIS_SUBAGENT_CHILD shifts the child; returns early */` (needs the block-comment filter — the first shipped pattern dropped only `//` lines and reported `ok` here, exit 0), and `TRELLIS_SUBAGENT_CHILD: if (set) handlers return early` (needs the `grep -n` prefix anchor: an unanchored `: *if` also matches a colon *inside* the text). Requiring `if (` at line start additionally keeps a bare statement that only names the marker from counting. The cost is a false `bad` in shapes the arms do not currently cover; measured *not* to cost one for `== "1"`, `if(…)return;`, `{ return; }`, or a trailing `/* */` after a real guard. The acceptable direction, per [../../spec/scripts/shell-guidelines.md](../../spec/scripts/shell-guidelines.md) §Anti-Patterns: a reworded comment is cheap, a filter loose enough to accept a comment as a guard is unrecoverable |
| `-F` on the marker | The name is data, not a pattern |
| Line comparison, not presence | R2. This is the only part that catches "the guard exists but after the work" |
| `elif [ -z "$reg_line" ]` as a `bad` | A generated file with no registration call means the file is not what this check was written against. Failing beats comparing against an empty string |
| A sibling inside the outer `else`, not a branch of the tool chain | A nested branch makes a missing `SHIPPED_TOOLS` declaration suppress the guard result — the check-integrity failure. Measured: nested, the line printed nothing |
| The `if [ -n "$ext_names" ]` wrapper | The tool chain `warn`s when the extension registers no dispatch tool; hoisting without the guard would have the sibling print a `bad` for that same legitimate shape. Guarded, the check stays quiet when it has no input |
| `child-inert` in every `bad` | `./scripts/doctor.sh \| grep 'inert'` is how the plan says to run one arm. A message without the token turns a failing arm into a silent pass |

## Severity: `bad`, including before 5b lands

`bad`, not `warn`. A missing guard after this task means: either 5b silently
stopped working, or the plan in `09-15-harden-pi-role-agents` became impossible.
Both are defects in a repo committed to that plan.

The awkward case is honest to state: on a machine where upstream removed the guard
and 5b was never implemented, this reports a `bad` for something not yet harmful.
The alternative — `warn` now, `bad` after 5b — needs a second edit and a second
review, and the severity would be wrong for the entire period between the two
tasks, which is exactly when 5b is being written.

The repo's severity rule is about the *fix*, not the symptom: "bad when the fix is
available and was not applied". Here the fix is available — rework the bridge, or
drop 5b and record the breadcrumb conflict — so `bad` is the correct signal.

## What This Cannot Prove

Stated so no later reader upgrades the label:

- **That Pi calls `trellisExtension()` at load.** The check proves the guard is
  textually first in the file. If registration moved to a helper invoked from a
  different entry point, the text could still pass. Recorded as a revisit trigger.
- **That the child actually goes inert at runtime.** Only a dispatch probe does
  that — `09-15-harden-pi-role-agents` step 11 asks the child whether
  `<workflow-state>` appears in its context. This check is the cheap standing
  detector; the probe is the proof.
- **That the marker reaches the child.** That is the parent's env write in 5b,
  covered by AC7 of the other task.

The honest claim in `doctor.sh`'s output is *"guard precedes registration"*, which
is what the `ok` text says.

## Residuals — stated, not papered over

Four things this task does **not** close. Each is named so no later reader reads a
revisit trigger or a limit as a covered case.

1. **The outer chain's `elif` still skips the sibling.** `ext_names` is assigned
   inside the outer `else`, so when the bridge loses the word `SHIPPED_TOOLS`
   entirely, that branch's `bad` fires and the child-inert line never prints.
   Measured: the section shows the declaration `bad` and no child-inert line. This
   is not the R5 failure (there both inputs existed and only one check reported);
   the `bad` that does fire names the missing declaration, so the section is never
   silently green.
2. **The comment filter trades a false green for a false `bad`.** A comment
   phrasing the guard scan does not anticipate fails the check, and the fix is to
   reword the comment. That is the direction `shell-guidelines.md` §Anti-Patterns
   prescribes: a reworded comment is cheap, a filter loose enough to accept a
   comment as a guard is unrecoverable. Measured 2026-09-15, and the two directions
   are not symmetric: a *trailing* `/* */` after a real guard still reports `ok`,
   while a *trailing* `//` on the guard line reports `bad` (the `//` filter drops
   the whole line). The `//` filter is kept anyway because it is the only thing
   catching a guard that was commented out inside a `/* … */` block while keeping
   its own `//`. Do not "fix" the false `bad` by loosening it.
3. **The `catch`-block hunk in the bridge is a drive-by, and it is recorded
   here because nothing else in the diff explains it.**
   `pi-agent/extensions/trellis-subagents-bridge/index.ts` changes
   `} catch {}` to `} catch { …comment… }` in the `session_shutdown` handler — the
   only such change in the commit (`git show HEAD:…` carries one `catch {}`). It is
   behaviour-identical: an empty block swallows exactly the same errors, and the
   handler's contract (`rmSync` best-effort cleanup, `force: true` for the missing
   file) is unchanged. It is **not** part of R1-R6. Its cause is not independently
   measured here; it is listed so the commit has something that explains it, and
   a reviewer who wants this commit to be marker-only can revert those two lines
   without touching the check.
4. **The scan proves a statement, not the load-time guard.** A line that reads
   `if (<marker access>) return …` anywhere above the first registration passes,
   even if it is a helper rather than the first statement of the default export.
   Measured: planted at the guard's position with the real guard deleted,
   `if (process.env.TRELLIS_SUBAGENT_CHILD !== "1") return false;` reports `ok`.
   Only a dispatch probe distinguishes the two — see "What This Cannot Prove"
   above and `09-15-harden-pi-role-agents` step 11.

## Blast Radius — what each edit can reach

| Edited surface | Who reads it | Reaches Trellis? | Reaches pi-subagents? |
| --- | --- | --- | --- |
| `pi-agent/extensions/trellis-subagents-bridge/index.ts` | Pi, every session | No — it reads an env var Trellis's own generated code defines | No — measured: the package contains no reference to the marker |
| `scripts/doctor.sh` | humans, and the verify chain | No — it only reads `.pi/` | No |
| `pi-resources.md`, the propagation guide | humans and the check phase | No | No |

**No upstream-owned file is edited, at all.** The generated extension is read and
never written — including by the negative tests, which operate on a scratch copy
and restore the original.

## Risks And Rollback

| Risk | Detection | Mitigation |
| --- | --- | --- |
| The check's own pattern goes stale on a legitimate reflow | AC5 shapes the reflow tolerance; a false `bad` names the marker and both line numbers, so the cause is visible in one line | R4's looser match; the message names the file to look at |
| A `bad` fires where nothing is yet broken (pre-5b) | The message names the marker, not a symptom | Accepted and argued above — the fix is available either way |
| The negative tests mutate the generated extension and leave it changed | `git status --short` plus a `diff` against a saved copy (AC7) | Both negative tests run against a `/tmp` backup taken first, and the restore is the `cp` back |
| The declaration is added and 5b then writes the literal anyway, making the check vacuous | AC1's `grep -c` in the bridge returns 1; the other task's step 5b is amended to consume `CHILD_INERT_MARKER` | Recorded in both tasks' artifacts |
| The check duplicates the marker name into `scripts/` | AC6 plus R1: `grep -rn TRELLIS_SUBAGENT_CHILD scripts/` must return nothing | The name is read off the bridge declaration, never spelled |

**Rollback.** Revert one bridge constant and one predicate pair, one `doctor.sh`
block, and two prose edits. No generated file, no settings render, no symlink.

## Verification Plan

| AC | Command / observation |
| --- | --- |
| AC1 | `grep -c 'TRELLIS_SUBAGENT_CHILD' pi-agent/extensions/trellis-subagents-bridge/index.ts` → `1`; and `grep -rn TRELLIS_SUBAGENT_CHILD scripts/` → no match |
| AC2 | `./scripts/doctor.sh` → the `ok` line naming lines 1843 / 1925, and `All good.` |
| AC3, AC4, AC5 | `sed` the scratch copy, run `doctor.sh`, restore (implement.md steps 6-7) |
| AC6 | comment out the declaration in the bridge, run, restore; confirm the `SHIPPED_TOOLS` line still prints |
| AC7 | `bash -n scripts/doctor.sh`; `diff` the extension against the saved copy; `git status --short` |
| AC8 | read the two prose sites |
| Sibling independence (R5) | comment out the bridge's `SHIPPED_TOOLS` declaration; the child-inert line must still print its own result |
| `$ext_names` guard | mutate the scratch extension so it registers no dispatch tool (no `registerTool`, no extractable `name:`); `SHIPPED_TOOLS` `warn`s and the child-inert line prints no `bad`. Counterfactual: with the guard replaced by `if true`, the same mutant prints `bad "the child-inert guard cannot be positioned…"` |

AC3 and AC4 are the negative test for R2: they are what makes "the guard is first"
a checkable claim rather than a sentence. Measured 2026-09-15, all arms above were
run; each result line is recorded verbatim in this task's implement log and in the
fix dispatch report.

**`All good.` is only reachable on a clean tree.** `doctor.sh` prints `All good.`
only when `problems` *and* `notes` are both zero (`scripts/doctor.sh:441`). While
this task's own edits are uncommitted, the `uncommitted changes` note is present,
so the footer is `No problems. 1 note(s) above.` with exit `0`. That is the
documented informational-note variant, not a failing check — read the exit code and
the `problems` count, not the literal string, until the change is committed.

**`grep 'inert'` also matches a git-status line.** The task directory itself is
named `09-15-doctor-child-inert-guard`, and `doctor.sh` prints `git status --short`
as an indented note when the tree is dirty. So the documented single-arm command
can print two lines: the status line, then the result. The result is the line
carrying `✓` or `✗`; a bare `??` line is not a check result.

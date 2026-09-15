# Refuse to re-point live symlinks across checkouts

> Lightweight task (PRD-only): one function in one script, plus its spec text.
> No `design.md` / `implement.md` — the whole contract change fits in R2 below.

## Goal

`setup.sh` must not silently move this machine's live Pi harness onto a
**different checkout** of this repo.

`PI_DST` is `~/.pi/agent` regardless of which checkout runs `setup.sh`, so
`link()` — which deliberately `rm`s a stale symlink without asking — re-points
`~/.pi/agent/{extensions,i-have-adhd.json}` at whichever checkout ran last.
Running `./setup.sh` inside a clone (a normal thing to do when testing) hijacks
the machine's live harness. There is no warning, and the `link` verb reads like
routine output.

## Background — measured 2026-09-15, `73cb810`/`f70066d`

Reproduced without touching `~/.pi/agent`, by pointing both checkouts at one
scratch `PI_CODING_AGENT_DIR`:

```bash
S="$(mktemp -d /tmp/pi-hazard.XXXXXX)"
PI_CODING_AGENT_DIR="$S" ./setup.sh --skip-plugins --skip-skills --skip-mcp --skip-trellis --skip-verify
readlink "$S/extensions"          # /home/tan/my_pi_setup/pi-agent/extensions

C="$(mktemp -d /tmp/pi-clone.XXXXXX)"; rmdir "$C"; git clone -q /home/tan/my_pi_setup "$C"
(cd "$C" && PI_CODING_AGENT_DIR="$S" ./setup.sh --skip-plugins --skip-skills --skip-mcp --skip-trellis --skip-verify)
readlink "$S/extensions"          # /tmp/pi-clone.XXXXXX/pi-agent/extensions   <- hijacked
```

Output on the second run is `link` / `ok` — indistinguishable from a stale-link
repair. `doctor.sh` does catch the result (`✗ … points elsewhere`), but only after
the fact, and it does not name the other checkout or the fix.

Two measurements that decide the implementation:

| Probe | Result |
| ------- | -------- |
| `readlink -f` on a symlink whose **entire** target path is absent (a moved clone) | prints **nothing**, exit `1` |
| `readlink -f` on a symlink whose parent directories exist and only the leaf is gone | prints the path, exit `0` |
| `dirname "$(dirname "")"` | `.` — and from the repo root `./scripts/lib.sh` **is** a file |

The third row is the trap: a store-detection helper fed the empty output of row
one returns `.`, which evaluates to the repo itself when `setup.sh` is run from
its own root. A naive version would therefore **refuse every dangling symlink**,
breaking the legitimate "I moved my clone" case. Any implementation must test the
resolved path for emptiness before consulting it.

## Requirements

### R1 — A live link into another existing store is fatal

In `setup.sh::link()`, the `[ -L "$dst" ]` branch splits into three cases instead
of two:

| `$dst` is a symlink and | Behaviour |
| ------------------------ | ----------- |
| resolves to `$src` | `say ok`, return `0` (unchanged) |
| resolves into **another store** that exists | `say error` + `exit 1` (new) |
| anything else — dangling, or an unrelated target | `rm` + relink (unchanged) |

"Another store" means the resolved target is the same shape (`<store>/pi-agent/<name>`)
and `<store>/scripts/lib.sh` exists while `<store>` is not `$REPO_DIR`. That
confirmation matters: a user's unrelated symlink into some other tool's
`pi-agent`-named directory must not be mistaken for a checkout.

The `<name>` half of the shape is not checked, so the guard works for both
`PI_FILES` and `PI_DIRS` members the same way.

### R2 — The refusal names both checkouts and the documented escape hatch

The message must contain the offending link, the other store's path, and the two
ways out: run `setup.sh` from that store, or set `PI_CODING_AGENT_DIR` to link
elsewhere. `PI_CODING_AGENT_DIR` already exists as the destination override, so
**no new flag is added** — the escape hatch is a variable the repo already
documents, and `setup.sh` is already at eight flags.

### R3 — A dangling link is still replaced silently

The moved-clone case must keep working with zero friction: `mv ~/my_pi_setup
~/code/my_pi_setup` leaves every live link pointing at a path that no longer
exists, and re-running `./setup.sh` from the new location must repair them
without complaint. This is what makes the emptiness guard in R1 load-bearing.

### R4 — Guard against the empty-path trap

The resolved target must be tested for emptiness before it is passed to any
store-detection logic. `readlink -f` returns an empty string with exit `1` for a
fully-absent target, and `dirname "$(dirname "")"` is `.`, which silently means
"the current directory" — the repo itself, when `setup.sh` is run from its root.

### R5 — The documented `link()` contract states the three branches

`.trellis/spec/scripts/shell-guidelines.md` quotes `link()` as "the reference
implementation for idempotent linking, and its three branches are the contract",
then lists rules including "A wrong symlink is removed silently; a real file is
backed up." Both need to reflect the new case, because "wrong symlink" is
precisely the phrase that hid this hazard: a link owned by another live checkout
is not a wrong link, it is someone else's link.

### R6 — The interaction with the verify chain is recorded

`.trellis/spec/guides/change-propagation-guide.md` tells the reader to verify a
commit in isolation with `git worktree add`. The same reasoning applies to
`setup.sh`: a probe that runs it from a second checkout must set
`PI_CODING_AGENT_DIR`, or the guard from R1 now refuses. Record it there, since
that is where the repo already explains cross-checkout verification.

## Non-Goals

- Changing `doctor.sh`. It already reports `points elsewhere` as a `bad`; this
  task only stops the damaging write, it does not add a new reporter.
- Auto-adopting a different checkout, or offering a `--force`/`--adopt` flag
  (R2 explains why `PI_CODING_AGENT_DIR` is the escape hatch instead).
- Any change to `sync.sh`, which reads `$PI_SRC` and copies *from* live state
  rather than linking into it.

## Acceptance Criteria

All verified on the working tree before the commit below. Probes use scratch
`PI_CODING_AGENT_DIR` directories, so `~/.pi/agent` is never a test subject.

- [x] Two checkouts pointing at one scratch `PI_CODING_AGENT_DIR`: the second
      run **exits non-zero** and leaves the first checkout's link target
      unchanged. — repo A (`/home/tan/my_pi_setup`) linked a fresh scratch; the
      clone then exited **`1`**, and `readlink` on both `extensions` and
      `i-have-adhd.json` still returned the repo A paths. Before the change the
      same probe printed `link` and exited `0` with both targets hijacked to the
      clone.
- [x] The refusal message contains the link path, the other store's path, and
      both `PI_CODING_AGENT_DIR` and "from that checkout" as remedies. — verbatim,
      in the block below this list.

- [x] A symlink whose entire target path is absent (moved clone) is replaced
      silently, exit `0` — including when `setup.sh` is run with the repo root as
      the working directory, the case where the empty-path trap would misfire.
      — `readlink -f` on the faked target printed nothing and exited `1`; the run
      printed `link` for **both** the `PI_DIRS` member (`extensions`) and the
      `PI_FILES` member (`i-have-adhd.json`), exited `0`, and re-pointed both at
      the repo.
- [x] A symlink from `~/.pi/agent/extensions` to an unrelated existing directory
      that has no `scripts/lib.sh` is replaced silently, exit `0`. — a link into a
      bare `/tmp/pi-fix-other.*/pi-agent/extensions` (no `scripts/lib.sh`) printed
      `link`, exited `0`, and re-pointed at the repo.
- [x] `./setup.sh` twice on the real repo stays byte-identical and exits `0`/`0`.
      — `68` lines, `diff` clean, exits `0`/`0`; both live links still report
      `ok  /home/tan/.pi/agent/{extensions,i-have-adhd.json}`.
- [x] `./scripts/doctor.sh` ends `All good.`; `bash -n setup.sh` passes;
      `git status --short` is clean after a full `./setup.sh`. — `bash -n`
      **PASS**; `doctor.sh` exit **`0`** with `No problems.`; the single note is
      the pre-existing `! uncommitted changes:` warn for this task's own
      uncommitted work, which clears at the commit. Nothing new becomes tracked.
- [x] `shell-guidelines.md`'s quoted `link()` and its rule list both describe the
      new branch, and the quoted snippet still matches the file. — the diff
      command now **in the spec** returns `identical (35 code lines)`. It found
      real drift first: the snippet carried four inline comments `setup.sh` has
      never had (checked against `git show HEAD:setup.sh`), and omitted the
      `printf` line. Both corrected; the snippet is now the file's code with only
      the long explanatory comments trimmed, and the prose says so.

## Completion Record

**2026-09-15, tan — complete.** One commit. The guard is 17 lines in
`setup.sh::link()` plus a `store_root_of()` helper; the rest of the change is the
spec text that had hidden the behaviour.

The refusal message, verbatim — the pad under the `error` verb is the same
11-column indent `say` uses, so the second line reads as part of the first,
while naming both ways out:

```text
error    /tmp/pi-fix-scratch.2nNCN1/i-have-adhd.json points into another checkout: /home/tan/my_pi_setup
         run ./setup.sh from /home/tan/my_pi_setup, or set PI_CODING_AGENT_DIR to link elsewhere
```

The measurement that decided the implementation came *before* the code: `readlink
-f` prints nothing and exits `1` when a symlink's whole target path is absent, and
`dirname "$(dirname "")"` is `.`. So a store-detection helper fed that empty
string returns the **current directory** — the repo itself, whenever `setup.sh`
runs from its own root. A naive version would have refused every dangling symlink,
breaking exactly the `mv my_pi_setup elsewhere` case the three-branch split exists
to keep working. Hence `[ -n "$resolved" ]` before `store_root_of`, and a probe
that runs from the repo root to prove it.

Two things worth carrying forward:

1. **"Wrong symlink" was the wrong category name, and that is what hid this.**
   The spec's rule read "A wrong symlink is removed silently" — and a link owned
   by another *live* checkout is not wrong, it is someone else's. The rule now
   names three shapes, and `doctor.sh` remains the only thing that reports the
   hijacked state after the fact.
2. **No `--force` was added.** `PI_CODING_AGENT_DIR` already is the destination
   override, so it is the escape hatch; a ninth flag would have bought the same
   capability and cost every propagation site. Recorded in the spec rather than
   only in this PRD, because the decision looks like an omission otherwise.

Evidence that would falsify the central claim: any probe in which a live link
pointing into a second existing checkout of this repo is replaced rather than
refused. The three probes above split exactly along the intended lines — refuse
when the other store exists, replace when it does not.

## Notes

- The hazard was found while verifying `09-15-install-trellis-step`, by running
  `./setup.sh` in a fresh clone; that task's `prd.md` records it under its
  Completion Record and deliberately left the fix to this task.
- Scratch directories are created with `mktemp -d`; `rm -rf` is denied by the
  permission policy, so probes leave their directories in `/tmp`.

# Shell Guidelines

> How the bash in this repo is written. Derived from `setup.sh` and `scripts/*.sh`.

---

## Script Skeleton

Every bash script here opens with a shebang, a `#` separator line, a comment
block describing what it does and its flags, and then strict mode.

```bash
#!/usr/bin/env bash
#
# sync.sh — pull live harness state back into this repo.
#
# Run after changing settings inside Pi or installing a plugin with
# `pi install`, so the repo captures the change.
#
set -euo pipefail
```

### Formatting is owned by pi-lens

`pi-lens` rewrites `*.sh` and `*.md` on write: it reflows `case` arms onto their
own lines, expands `a; b` one-liners, normalises `<<<"$x"` spacing, and re-spaces
Markdown table separators. So the snippets on this page are **illustrative, not
byte-stable** — they show the current formatted shape, and a reformat of the real
file leaves a quoted snippet behind silently.

When a snippet and its file disagree, **the file wins**: update the snippet in the
same change. This is a second source of the staleness the
[change propagation guide](../guides/change-propagation-guide.md) warns about for
"a user-facing string … **and every spec file that quotes it verbatim**", and it
is not caused by anyone editing the script by hand.

`setup.sh` goes further: that header block **is** its `--help` text, extracted by
an awk program that prints comment lines until the first non-comment line.

```bash
usage() {
  awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "$0"
}
```

Consequences to respect when editing `setup.sh`:

- The header comment block must stay comment-only. One uncommented line in the
  middle of it silently truncates `--help`.
- `NR>2` skips the shebang and the lone `#` on line 2 — keep that shape.
- `--help` output is never a hand-maintained string. Do not add a second copy.

### Exceptions to strict mode

`scripts/doctor.sh` deliberately uses `set -uo pipefail` **without `-e`**. It is
a reporter: it must keep running after a check fails so it can print every
problem, and it owns its own exit code by counting failures.

```bash
problems=0
notes=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() {
  printf '  \033[33m!\033[0m %s\n' "$1"
  notes=$((notes + 1))
}
bad() {
  printf '  \033[31m✗\033[0m %s\n' "$1"
  problems=$((problems + 1))
}
```

If you add a check to `doctor.sh`, call `ok`/`warn`/`bad`; never `exit` early and
never introduce `-e`. The one deliberate exception is the missing-`lib.sh` guard
(below), which reports a `bad` and exits immediately: with the resource lists
undefined, every later symlink check would be a false problem.

The `==> Ignore coverage (machine-local paths)` check is a `bad`, not a `warn`: a
path `sync.sh` reports as deliberately not synced that git would still commit is
a security-relevant inconsistency, not a note. Like the secret-scan section it is
guarded on `[ -d "$REPO_DIR/.git" ]`, and it uses `git -C "$REPO_DIR"
check-ignore`, which needs no network and works for paths that do not exist on
disk (so it is meaningful on a fresh clone). `check-ignore` *does* consult the
index: a path that is tracked despite a matching ignore rule (force-added, e.g.
`git add -f`) is reported as **not ignored**, which is intended — the check then
catches that state too. Build the offender list, then branch on the length form
`${#not_ignored[@]}` — see
[`set -u` And Arrays](#set--u-and-arrays) for why the length form (and not a bare
`"${not_ignored[@]}"`) is what keeps an empty array safe under `set -u`.

---

## Repo Root And Destinations

Resolve the repo root from `BASH_SOURCE`, never from `$PWD`:

```bash
# setup.sh — lives at the repo root
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# scripts/*.sh — one directory deeper
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
```

Destinations are always environment-overridable with the documented default:

| Variable | Default | Used by |
|----------|---------|---------|
| `PI_CODING_AGENT_DIR` | `$HOME/.pi/agent` | all four scripts (`PI_DST`) |
| `AGENTS_SKILLS_DIR` | `$HOME/.agents/skills` | `doctor.sh`; the Node helper reads the same var |

```bash
PI_DST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
STATE="$PI_DST/.pi-setup-state.json"
```

The machine-local state file is always `$PI_DST/.pi-setup-state.json`. It is
gitignored and is the single record of which optional bundles are enabled here.

Every script that needs Node terminates early if it is absent:

```bash
command -v node >/dev/null 2>&1 || {
  echo "node is required (Pi ships on Node/npm)" >&2
  exit 1
}
```

---

## Output Helpers

Two verbs exist for normal setup scripts, in the padded format
`"  %-8s %s\n"`:

```bash
say()  { printf '  %-8s %s\n' "$1" "$2"; }                 # setup.sh, sync.sh
note() { printf '  \033[33m!\033[0m %s\n' "$1"; }          # non-fatal warning
```

Canonical verbs already in use — reuse them instead of inventing synonyms:
`ok`, `link`, `backup`, `unlink`, `create`, `keep`, `sync`, `same`, `skip`,
`upstream`, `render`, `state`, `install`, `source`, `infer`, `error`, `warn`.

`doctor.sh` uses `✓ / ! / ✗` glyphs with counters instead. Do not mix the two
styles inside one script.

Section headers are `==>`, often with the resolved path in parentheses:

```bash
echo "==> Pi config  ($PI_DST)"
```

---

## Symlink Discipline

`setup.sh::link()` is the reference implementation for idempotent linking, and
its three branches are the contract:

```bash
link() {
  local src="$1" dst="$2"
  [ -e "$src" ] || return 0                       # nothing in the repo, nothing to do
  mkdir -p "$(dirname "$dst")"

  if [ -L "$dst" ]; then
    if [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
      say ok "$dst"
      return 0                                    # already correct
    fi
    rm "$dst"                                     # stale link: replace, never back up
  elif [ -e "$dst" ]; then
    local backup="$dst.bak-$(date +%Y%m%d-%H%M%S)"
    mv "$dst" "$backup"                           # real file: back up before taking over
    say backup "$dst -> $backup"
  fi

  ln -s "$src" "$dst"
  say link "$dst"
}
```

Rules that follow:

- Compare with `readlink -f` on **both** sides. A raw `readlink` comparison would
  treat a symlink-to-a-symlink as different and rewrite it every run.
- A wrong symlink is removed silently; a real file is backed up. Never overwrite
  a user's real file without a `.bak-<timestamp>` next to it.
- The destination directory is created before `ln -s`.
- `~/.pi/agent/settings.json` is the **one path that must never be a symlink** —
  `setup.sh` unlinks it explicitly, and `doctor.sh` reports it as a problem if it
  is one. It is generated per machine.

`sync.sh` is the mirror image and must detect symlinks rather than copy them:

```bash
if [ -L "$PI_SRC/$d" ]; then
  say same "pi-agent/$d/ (symlinked into repo)"
  continue
fi
```

Copying a symlink with `cp -R` would duplicate the repo into itself.

---

## Discovery Instead Of Enumeration

Optional bundles are discovered from the filesystem, never from a hard-coded
list, and a leading `_` marks a directory as internal:

```bash
find "$OPT_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_*' \
  -exec test -f '{}/manifest.json' \; -print | xargs -r -n1 basename | sort
```

- `-mindepth 1 -maxdepth 1` keeps it non-recursive.
- `! -name '_*'` is what makes `optional/_template` invisible to the tooling.
- `-exec test -f '{}/manifest.json' \;` requires a manifest, so a stray
  directory is ignored rather than crashing.
- `xargs -r -n1 basename | sort` gives stable ordering for prompting and output.
- `xargs -r` (no-run-if-empty) is required: without it, an empty result would
  invoke `basename` with no arguments.

The same `_*` convention is relied on by `render-settings.mjs::listOptionals()`
and `doctor.sh`, so a new internal directory must start with `_` to be excluded
everywhere.

`PI_DIRS` / `PI_FILES` are the one deliberate exception to discovery, because the
set is a *whitelist* rather than an inventory: the resource directories need not
exist yet, and `link()` silently skips a source that is absent. The not-synced
paths (`PI_NOT_SYNCED`) are the other data list: `sync.sh` reports them and
`doctor.sh` checks that each is gitignored. All three have a single definition in
`scripts/lib.sh`, which every script that touches those paths must source:

```bash
LIB="$REPO_DIR/scripts/lib.sh"
if [ ! -f "$LIB" ]; then
  echo "missing $LIB — it is part of this repo (re-clone or restore it)" >&2
  exit 1
fi
# shellcheck source=scripts/lib.sh
. "$LIB"
```

Rules that follow:

- **Never re-declare `PI_DIRS`, `PI_FILES`, or `PI_NOT_SYNCED` in a consumer.**
  They are `readonly`,
  so a second copy is rejected (`PI_DIRS: readonly variable`) instead of silently
  replacing the list. The *values* therefore cannot diverge, but the failure
  surface differs. `setup.sh` and `sync.sh` run under `set -e`, so the rejected
  assignment aborts them with exit `1` before they touch anything. `doctor.sh`
  deliberately has no `set -e`: on its own line, the rejected assignment prints
  the error to stderr, bash skips the rest of *that line*, and the script keeps
  going with the correct list and exits `0` if nothing else is wrong (the
  realistic case). If the rejected assignment is the script's **last** command,
  bash's exit status becomes `1` instead. Do not "fix" any of that by adding
  `-e` or a trap to `doctor.sh` — surviving a failed check is the trade-off for
  reporting every problem in one pass.
- **Never `source` `lib.sh` without the existence check above.** Under `set -u` a
  failed `source` leaves the arrays unset, and the next `"${PI_DIRS[@]}"` aborts
  with an `unbound variable` instead of naming the missing file. `doctor.sh` uses
  `bad` + `exit 1` instead of the `echo` + `exit 1` shown here.
- **Keep `lib.sh` to the path lists (data only).** `setup.sh` is the bootstrap entry point;
  do not couple it to more of `scripts/`. `PI_DIRS`, `PI_FILES` and
  `PI_NOT_SYNCED` are the whole contract — no behaviour (`say`, `note`, the `node`
  preflight, `link()`) belongs here. `PI_NOT_SYNCED` is stored in canonical
  slash-form for directories (`sessions/`, `npm/`, …), because `git check-ignore`
  distinguishes `pi-agent/sessions` from `pi-agent/sessions/`.

See [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md)
for the sites that still have to be edited by hand when the list changes.

---

## Argument Parsing And Dispatch

Flags are parsed in a `while [ $# -gt 0 ]` loop with a `case`, and the terminating
arm is `*` with a usage message on **stderr** and exit `2`:

```bash
# abridged — the real loop also handles --skip-skills, --skip-plugins, --skip-verify
while [ $# -gt 0 ]; do
  case "$1" in
  --with)
    WITH+=("${2:?--with requires a name}")
    EXPLICIT=1
    shift 2
    ;;
  --none)
    WITH=()
    EXPLICIT=1
    shift
    ;;
  -y | --yes)
    ASSUME_YES=1
    shift
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "unknown option: $1" >&2
    echo
    usage
    exit 2
    ;;
  esac
done
```

- Flags that take a value use `shift 2`; boolean flags use `shift`. A missing
  value is caught by `${2:?message}`, which prints the message and exits non-zero.
- `-h|--help` prints usage to stdout and exits `0`; an unknown flag exits `2`.
- Subcommands (`optional.sh`) use a `case "$cmd"` dispatch with a default that
  prints usage and exits `1`:

```bash
# abridged — the real dispatch also implements list / disable / scaffold
cmd="${1:-list}"; shift || true

case "$cmd" in
  list)     ...
  enable)   [ $# -gt 0 ] || { echo "usage: optional.sh enable <name> ..."; exit 1; } ; ...
  *)        echo "usage: optional.sh [list | enable <name>... | disable <name>... | scaffold <name>]"; exit 1 ;;
esac
```

- `shift || true` is needed because `set -e` would abort on `shift` past `$#`.
- Every subcommand validates its own required argument count before doing work.

---

## `set -u` And Arrays

`set -u` makes an unset array expansion an error, and an **empty** array is
"unset" for this purpose on older bash. The repo uses this idiom:

```bash
node "$REPO_DIR/scripts/render-settings.mjs" "$REPO_DIR" "$PI_DST/settings.json" "$STATE" \
  ${RENDER_ARGS[@]+"${RENDER_ARGS[@]}"}
```

Do not "simplify" it to `"${RENDER_ARGS[@]}"` — that breaks under `set -u` when
no optional is enabled.

The **length** form is safe on an empty array: `doctor.sh`'s ignore-coverage
check branches on `${#not_ignored[@]}` and `${#PI_NOT_SYNCED[@]}` rather than
expanding the elements, so the first run (nothing offending) does not trip
`set -u`. Reach for `${#arr[@]}` whenever an array may legitimately be empty and
you only need to know whether it is.

Deliberate word-splitting on a newline-separated list is marked, with the reason:

```bash
# shellcheck disable=SC2086
for n in $chosen; do RENDER_ARGS+=(--with "$n"); done
```

`shellcheck` is not installed here, so that comment is documentation, not
tooling. Add a plain-English comment as well when the split is non-obvious.

---

## Temp Files

Shell scripts write scratch files to `/tmp` with the PID suffix and always clean
up; there is no `mktemp` + `trap` usage in this repo, so match the existing
pattern:

```bash
if pi update --extensions >/tmp/pi-setup-plugins.$$ 2>&1; then
  sed 's/^/  /' /tmp/pi-setup-plugins.$$ | tail -n 5
else
  note "pi update --extensions failed; run it manually later"
fi
rm -f /tmp/pi-setup-plugins.$$
```

Naming is `/tmp/pi-<purpose>.$$`. `rm -f` runs unconditionally after the branch.

---

## Failure Policy

The scripts distinguish **fatal** from **non-fatal** failures, and the choice is
intentional in each case:

| Situation | Behaviour | Evidence |
|-----------|-----------|----------|
| Node missing, unknown flag, unknown optional | fatal (`exit 1`/`2`) | `setup.sh`, `optional.sh` |
| Skill install has problems | warn, continue | `setup.sh` uses `\|\| note "skill install had problems; see above"` |
| `pi update --extensions` fails | warn, continue | `setup.sh` |
| Render drift / tracked `auth.json` / bad symlink | fatal in `doctor.sh` | `doctor.sh` counts a `bad` and exits `1` |
| Missing `origin` remote, uncommitted changes, `auth.json` not `600` | note only | `doctor.sh` `warn` |

A partial install is always preferred to a half-applied one: warn and let the
user re-run, because every script is idempotent.

---

## Anti-Patterns

- **Do not add `set -e` to `doctor.sh`.** It is a reporter.
- **Do not parse JSON in bash.** No `jq` is available; use a `node -e` one-liner
  for a single field, or an `.mjs` helper for anything structural.
- **Do not seed config by hand-writing `~/.pi/agent/settings.json`.** It is
  generated output; edit `settings.core.json` or an optional manifest and re-render.
- **Do not add a `cp` fallback that copies symlinks.** Check `[ -L ]` first.
- **Do not hard-code `$HOME/.pi/agent`.** Always go through `PI_CODING_AGENT_DIR`.
- **Do not enumerate where you can discover.** If a new set of things can be found
  on disk, add a `_`-aware `find` rather than another literal array.
- **Do not claim a path in an error message that does not exist.** When a script is
  renamed or removed, grep for its name across the repo — user-facing strings
  (`render-settings.mjs` drift output, `.gitignore` comments) are not exercised by
  any test and go stale silently. Always name a command the user can actually run.

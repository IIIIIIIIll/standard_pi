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
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; notes=$((notes + 1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; problems=$((problems + 1)); }
```

If you add a check to `doctor.sh`, call `ok`/`warn`/`bad`; never `exit` early and
never introduce `-e`.

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
command -v node >/dev/null 2>&1 || { echo "node is required (Pi ships on Node/npm)" >&2; exit 1; }
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

**Exception:** `PI_DIRS` / `PI_FILES` are still hard-coded in three scripts.
That is known duplication — see [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md).

---

## Argument Parsing And Dispatch

Flags are parsed in a `while [ $# -gt 0 ]` loop with a `case`, and the terminating
arm is `*` with a usage message on **stderr** and exit `2`:

```bash
# abridged — the real loop also handles --skip-skills, --skip-plugins, --skip-verify
while [ $# -gt 0 ]; do
  case "$1" in
    --with) WITH+=("${2:?--with requires a name}"); EXPLICIT=1; shift 2 ;;
    --none) WITH=(); EXPLICIT=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; echo; usage; exit 2 ;;
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

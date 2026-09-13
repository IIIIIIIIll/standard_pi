# Scripts Layer

> Conventions for the executable code: `setup.sh`, `scripts/*.sh`, `scripts/*.mjs`.

---

## Overview

This layer owns everything that touches the filesystem. There are two runtimes:

| Runtime | Files | Role |
|---------|-------|------|
| bash | `setup.sh`, `scripts/{optional,sync,doctor}.sh` | Entry points and orchestration |
| Node ESM | `scripts/{render-settings,sync-settings,install-skills}.mjs` | JSON composition and network/git fetch |

The split is deliberate and consistent: **bash decides and reports, Node reads and
writes JSON.** No bash script parses JSON with `jq` (it is not installed); every
JSON read/write goes through a `node -e` one-liner or an `.mjs` helper.

```bash
# scripts/optional.sh — the pattern for a tiny JSON read from bash
desc="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).description||"")' "$OPT_DIR/$n/manifest.json")"
```

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Shell Guidelines](./shell-guidelines.md) | bash structure, helpers, symlink/discovery patterns, exit codes |
| [Node Guidelines](./node-guidelines.md) | ESM helpers, argv contract, JSON write discipline, `--check` mode |

---

## Pre-Development Checklist

- [ ] Decide which script owns the change. `setup.sh` renders + links + installs + verifies; `sync.sh` pulls live state back into the repo; `doctor.sh` only reports; `optional.sh` owns per-machine bundle state. Do not duplicate a responsibility into a second script.
- [ ] Confirm you are not adding a fourth copy of `PI_DIRS` / `PI_FILES` — see [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md).
- [ ] If the script calls Node, use `node "$REPO_DIR/scripts/<helper>.mjs"` with an absolute path derived from `$REPO_DIR`; never a relative path, because scripts are invoked from arbitrary working directories.
- [ ] Add the `command -v node >/dev/null 2>&1 || { ...; exit 1; }` preflight if the script needs Node (all four currently do).
- [ ] New executable scripts need `chmod +x`; git tracks the mode, and only `setup.sh` plus `scripts/{optional,sync,doctor}.sh` are currently `100755`.

---

## Quality Check

- [ ] `bash -n <script>` passes (`shellcheck` is **not installed** in this
      environment — do not rely on it, and do not add `# shellcheck` directives
      without also writing the reason in a normal comment).
- [ ] `node --check scripts/*.mjs` passes for Node helpers.
- [ ] Re-running the script is a no-op. `./setup.sh && ./setup.sh` and
      `./scripts/sync.sh && ./scripts/sync.sh` must both be stable.
- [ ] `./scripts/doctor.sh` reports `All good.` (or only informational notes).
- [ ] Output uses the established two-space / padded-verb format so it lines up
      with the other scripts.
- [ ] Errors go to stderr when they are diagnostics (`.mjs` uses `console.error`),
      and the exit code is meaningful (`2` usage, `1` failure).

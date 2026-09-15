# Scripts Layer

> Conventions for the executable code: `setup.sh`, `scripts/*.sh`, `scripts/*.mjs`.

---

## Overview

This layer owns everything that touches the filesystem. There are two runtimes:

| Runtime | Files | Role |
|---------|-------|------|
| bash | `setup.sh`, `scripts/{optional,sync,doctor,install-mcp,install-trellis}.sh` | Entry points and orchestration |
| Node ESM | `scripts/{render-settings,sync-settings,install-skills,register-mcp-server,check-docs}.mjs` | JSON composition, network/git fetch, docs coverage check |

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

- [ ] Decide which script owns the change. `setup.sh` renders + links + installs + verifies; `sync.sh` pulls live state back into the repo; `doctor.sh` only reports; `optional.sh` owns per-machine bundle state; `install-trellis.sh` owns the gitignored Trellis surfaces and nothing else. Do not duplicate a responsibility into a second script.
- [ ] If the script walks resource or not-synced paths, or needs the MCP config destination, source `scripts/lib.sh` and never re-declare `PI_DIRS` / `PI_FILES` / `PI_NOT_SYNCED` / `MCP_CFG` (`readonly` makes a re-declaration fail). All four live only there — see [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md).
- [ ] If the script calls Node, use `node "$REPO_DIR/scripts/<helper>.mjs"` with an absolute path derived from `$REPO_DIR`; never a relative path, because scripts are invoked from arbitrary working directories.
- [ ] Add the `command -v node >/dev/null 2>&1 || { ...; exit 1; }` preflight if the script needs Node (five of the six bash scripts do; `scripts/install-trellis.sh` is the exception, because it reads and writes no JSON).
- [ ] New executable scripts need `chmod +x`; git tracks the mode, and only `setup.sh` plus `scripts/{optional,sync,doctor,install-mcp,install-trellis}.sh` are currently `100755`. `scripts/lib.sh` is sourced-only and stays `100644`.
- [ ] For a change that touches more than one script or crosses the bash/Node split, state the boundary before the first edit: which script owns the change, what it reuses instead of re-declaring, and what is not being done. Giving a responsibility to a second script is a decision to state before continuing, not after.

---

## Quality Check

- [ ] `bash -n <script>` passes (`shellcheck` is **not installed** in this
      environment — do not rely on it, and do not add `# shellcheck` directives
      without also writing the reason in a normal comment).
- [ ] `node --check scripts/*.mjs` passes for Node helpers.
- [ ] `node scripts/check-docs.mjs .` exits 0, and with no argument exits 2 —
      `docs/` still exists and has one entry per shipped package and skill. The
      contract (heading convention, sources of truth, fail-loud rows) is in
      [../config/pi-resources.md](../config/pi-resources.md#the-docs-coverage-check).
- [ ] Re-running the script is a no-op. `./setup.sh && ./setup.sh` and
      `./scripts/sync.sh && ./scripts/sync.sh` must both be stable.
- [ ] `./scripts/doctor.sh` reports `All good.` (or only informational notes).
- [ ] Output uses the established two-space / padded-verb format so it lines up
      with the other scripts.
- [ ] Errors go to stderr when they are diagnostics (`.mjs` uses `console.error`),
      and the exit code is meaningful (`2` usage, `1` failure).
- [ ] Every claim is backed by a command someone else can run — a named
      invocation, not "it works". Where nothing checks it, the item says so:
      `shellcheck` is not installed, so `bash -n` plus `./setup.sh` twice are the
      syntax and integration checks available here.
- [ ] Error handling matches the script's own contract: `setup.sh` and
      `scripts/sync.sh` run under `set -e`, `scripts/doctor.sh` deliberately does
      not — it must report every problem and still exit `0`. Do not "fix" one into
      the other's shape; see [shell-guidelines.md](./shell-guidelines.md).
- [ ] Printed output keeps the established verb vocabulary
      ([shell-guidelines.md](./shell-guidelines.md),
      [node-guidelines.md](./node-guidelines.md)). A user-facing string is usually
      a multi-site fact, because the same wording is quoted in the specs and in
      `README.md`; the site list lives in
      [../guides/change-propagation-guide.md](../guides/change-propagation-guide.md).
- [ ] Scope: no helper, flag, or fallback added for a case that cannot occur, and
      nothing added to a script that already has an owner for it.

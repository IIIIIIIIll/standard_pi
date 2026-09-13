# Pi Resources

> `settings.core.json`, `skills.json`, and `pi-agent/extensions/` — the three
> tracked inputs that define what the harness *is*.

---

## `pi-agent/settings.core.json`

Always-on settings, identical on every machine. It is the base that
`render-settings.mjs` clones before merging optional manifests.

```json
{
  "packages": [
    "npm:pi-subagents",
    "npm:pi-web-access",
    "npm:@juicesharp/rpiv-ask-user-question",
    "npm:@juicesharp/rpiv-todo",
    "npm:@gotgenes/pi-permission-system"
  ],
  "theme": "dark",
  "defaultThinkingLevel": "high",
  "compaction": { "enabled": true },
  "autocompleteMaxVisible": 7
}
```

Rules:

- **Package specs are unpinned.** No `@version` — Pi skips updates for pinned
  specs, and `setup.sh` runs `pi update --extensions` on every invocation.
- **Anything under `packages` is installed on every machine.** If it is not wanted
  everywhere, it belongs in an optional bundle instead.
- `lastChangelogVersion` must never appear here — it is runtime-owned, carried
  over on render and deleted on sync.
- Add a setting by editing this file, then `./setup.sh` (or `scripts/sync.sh` if
  you changed it live in Pi) and commit.

### The package inventory

| Package | What it adds | Why it is core |
|---------|--------------|----------------|
| `npm:pi-subagents` | Sub-agent delegation, parallel review, scripted workflows | the delegation mechanism itself |
| `npm:pi-web-access` | `web_search`, `fetch_content`, source verification | every machine needs research |
| `npm:@juicesharp/rpiv-ask-user-question` | structured questionnaire overlay | prevents guessing at requirements |
| `npm:@juicesharp/rpiv-todo` | model-facing todo list that survives `/reload` and compaction | used by the Trellis workflows |
| `npm:@gotgenes/pi-permission-system` | the permission gate | see below — the **only** thing gating tool calls |

`@gotgenes/pi-permission-system` is npm-installed but reads its policy from
`extensions/pi-permission-system/config.json`, which is why that config is
committed here rather than living in the package.

---

## `skills.json`

```json
{
  "_comment": "Skills are installed from upstream at setup time and never vendored here, so they cannot fall behind. Add an entry under skills to install another; set a source ref to pin.",
  "sources": {
    "mattpocock": { "url": "https://github.com/mattpocock/skills.git", "ref": null }
  },
  "skills": [
    { "name": "code-review", "source": "mattpocock", "path": "skills/engineering/code-review" }
  ]
}
```

Structure: `sources` maps an id to a git URL (plus optional `ref`); `skills`
lists `{name, source, path}` where `path` is the skill directory **inside the
source repo**. The real file lists six skills — one is shown above for shape;
`README.md` names all of them.

Rules:

- **Skills are never vendored.** Nothing under `~/.agents/skills/` is committed;
  `setup.sh` re-clones and re-copies. This is why there is no snapshot to go stale.
- `ref: null` means "track the source's default branch". Set `ref` to a tag or
  commit only to pin deliberately.
- The **whole skill directory is copied**, not just `SKILL.md` — upstream ships
  extra files (e.g. `agents/openai.yaml`, `references/`) that must come along.
- Replacing a skill is destructive on purpose: the destination is
  `rmSync`'d and re-copied so upstream deletions take effect. Do not add a merge.
- An unknown `source` id, a missing `SKILL.md` at `path`, or a failed clone are
  collected into `problems`, the remaining skills still install, and the process
  exits `1` at the end. A partial install is reported, never rolled back —
  re-running `./setup.sh` is the recovery path.
- `node scripts/install-skills.mjs . --check` verifies installation **without
  network** and is what `doctor.sh` uses. Keep it offline.
- Provenance is recorded outside the repo at `~/.agents/.pi-setup-skills.json`
  (a sibling of the skills dir, so `AGENTS_SKILLS_DIR` moves it too). It contains
  `installedAt`, and per-source/per-skill resolved commit SHAs. `doctor.sh`
  prints the source commits from it.
- `_comment` is a real key, not JSONC. Keys starting with `_` are a convention
  here for "not data".

Adding a skill: add an entry under `skills`, then `./setup.sh`, then commit
`skills.json`. If the skill comes from a new repo, add a `sources` entry too.

---

## `pi-agent/extensions/`

`~/.pi/agent/extensions/` is Pi's **global, hand-placed** extension directory —
auto-discovered for every project and hot-reloadable with `/reload`. `setup.sh`
symlinks it here, so anything added is versioned with the harness.

| Path | What it is |
|------|------------|
| `<name>.ts` | a single-file extension |
| `<name>/index.ts` | a multi-file extension |
| `<name>/config.json` | conventional per-extension config the extension reads |
| `<name>/logs/` | runtime output — gitignored via `pi-agent/extensions/*/logs/` |

**Installed packages do not live here.** `pi install …` puts code under
`~/.pi/agent/npm/` or `~/.pi/agent/git/`, and it is tracked by *package spec* in
`settings.core.json` or an optional manifest. This directory is only for
extensions placed by hand, **and** for the handful of packages that read their
config from under here — which is exactly the permission system's situation.

`.pi/` and `.agents/` at the repo root are **not** part of this layer: they are
project-local Trellis adapters, regenerated by the `trellis` CLI, and gitignored.

### `trellis-subagents-bridge/`

Makes `pi-subagents` children resolve their parent's active Trellis task.

`pi-subagents` already discovers `.pi/agents/trellis-*.md`, but a dispatched child
starts as its own Pi session, and the generated Trellis extension resolves the
active task from `.trellis/.runtime/sessions/<key>.json` — where the key derives
from the **child's** own session id. Without the bridge the child is told
`Status: no_task` and its `task.py current` exits 1.

Facts a contributor must not break:

- **It is global.** Pi loads `~/.pi/agent/extensions/` in every project, so the
  bridge returns immediately unless the resolved cwd contains `.trellis/`, and it
  publishes, injects, and writes nothing when no task resolves.
- **It corrects a value, not an output.** Nothing in the generated extension is
  stripped or rewritten. The parent publishes `TRELLIS_CONTEXT_ID` and the child
  writes its own runtime session pointer, so the generated extension resolves the
  real task through its normal path. Adding a strip or a bash rewrite here means
  the design has been abandoned, not extended.
- **`contextKey()` is replicated on purpose.** The pointer filename must equal the
  key the generated extension computes, and that derivation lives in a generated
  file (see `.trellis/.template-hashes.json`). If upstream changes it, the bridge
  must change with it — otherwise children silently resolve nothing.
- **The child gate excludes the generated tool's children:**
  `PI_SUBAGENT_CHILD === "1" && TRELLIS_SUBAGENT_CHILD !== "1"`. The generated
  `trellis_subagent` tool sets *both* markers for its own children, which already
  carry a correct key and must be left alone.
- The child's pointer is removed on `session_shutdown`. A crashed child leaves it
  behind; that is accepted rather than pruned.

---

## Permission Policy

`pi-agent/extensions/pi-permission-system/config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/gotgenes/pi-packages/main/packages/pi-permission-system/schemas/permissions.schema.json",
  "permission": {
    "*": "allow",
    "path": { "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
    "bash": { "rm -rf *": "deny" },
    "external_directory": { "*": "ask", "/tmp/*": "allow" },
    "external_directory_read": { "*": "allow" }
  }
}
```

Pi itself has **no permission prompts** — it runs tools with full user
permissions. This extension is the only gate, which is why `"*": "allow"` is the
right default here: it means "stop gating everything, keep only the rules below".

Facts that must not be forgotten when editing this file:

- **A missing config is not "no policy"; it is "interrupt the user on every tool
  call."** Omitting `"*"` defaults every category to `ask`. That is the failure
  mode the committed file exists to prevent.
- **Any parse failure falls back to `ask` for all categories**, and a config that
  fails schema validation clamps every `allow` up to `ask` (deny-preserving).
  Therefore: **strict JSON, no comments, no trailing commas.** Do not "tidy" this
  into JSONC, and do not add a `$comment`-style key that the schema rejects.
- **`deny` survives `yoloMode`.** The `path` deny and the `rm -rf` deny are
  enforced unconditionally, including when the extension's own YOLO mode is on.
- Precedence is **most-restrictive-wins** across four layers:
  `path` (cross-cutting) → `external_directory` (CWD boundary) → per-tool
  patterns → `bash` patterns. A `path` deny cannot be loosened by a per-tool
  `allow`.
- Patterns match both the referenced path and its symlink-resolved form, so a
  deny cannot be evaded through a symlink alias.
- **The outside-CWD boundary is split by direction.** Reads are open
  (`external_directory_read` → `{ "*": "allow" }`); writes still `ask`, with
  `/tmp` allowed so scratch files need not be parked inside the repo to dodge
  the gate. This is why `external_directory` is a map, not the string `"ask"`.
- **Bare `external_directory` is sugar**, expanding into `external_directory_read`
  and `external_directory_write` with its entries placed first. The explicit
  `external_directory_read` therefore has the final say on reads, and the sugar
  map alone decides writes. Do not collapse that directional key back into a
  string, and do not add a parallel `path_read` allow — reads are already
  handled at this layer.
- **`/tmp/*`, never a bare `/tmp`.** A trailing `*` is greedy and crosses
  directory boundaries; a bare directory pattern matches only the directory
  entry itself, which is not the path a tool call carries. One entry covers
  macOS too, where `/tmp` resolves to `/private/tmp`: patterns match both the
  path and its symlink-resolved form.
- **Open reads do not touch the `deny` floor.** `path` is the cross-cutting
  layer and wins over any `external_directory` allow, so `*.env` stays blocked
  and `rm -rf *` stays blocked under `/tmp` exactly as elsewhere.
- `extensions/pi-permission-system/logs/` is gitignored **by design**: the review
  log records bash command strings unredacted. Never commit it, and do not paste
  it into a spec or issue without redacting.

The full rationale, state table, and tuning recipes live in
`pi-agent/extensions/README.md`. That file is the deep reference; this spec
records only the rules a contributor must not break.

---

## Anti-Patterns

- **Do not pin a package spec with `@version`.** It silently disables updates.
- **Do not add comments or trailing commas to any release JSON.** For the
  permission config it changes behaviour, not just formatting.
- **Do not vendor a skill into the repo.** Add it to `skills.json`.
- **Do not edit `~/.pi/agent/settings.json` directly** as a way of adding a
  package — that file is overwritten on the next render.
- **Do not put an installed package's code under `extensions/`.** Only config.
- **Do not copy only `SKILL.md`** when hand-updating a skill; copy the directory.
- **Do not commit the permission review log** or quote it verbatim elsewhere.
- **Do not loosen a `deny` rule** to make a task pass. The denies for `*.env` and
  `rm -rf *` are the deliberate least-privilege floor of an otherwise fully-open
  harness.

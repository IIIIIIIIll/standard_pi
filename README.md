# my_pi_setup

Portable configuration store for my [Pi](https://pi.dev) coding-agent harness.

```bash
git clone git@github.com:IIIIIIIIll/my_pi_setup.git ~/my_pi_setup
~/my_pi_setup/setup.sh
```

That is the whole thing. `setup.sh` is idempotent — **re-running it is how you
update**, including pulling the latest skills from upstream.

It does six things:

1. renders `~/.pi/agent/settings.json` from core settings + this machine's optional bundles
2. symlinks `AGENTS.md` and resource dirs (`themes/`, `prompts/`, `tools/`, `skills/`, `agents/`, `extensions/`)
3. seeds `~/.pi/agent/auth.json` from the template if absent
4. installs/refreshes skills **from their upstream sources** (see below)
5. refreshes Pi plugin packages (`pi update --extensions`)
6. verifies everything with `scripts/doctor.sh`

Then add credentials and start Pi:

```bash
$EDITOR ~/.pi/agent/auth.json && chmod 600 ~/.pi/agent/auth.json
pi
```

Run `./setup.sh --help` for flags (`--with`, `--none`, `--yes`, `--skip-skills`,
`--skip-plugins`, `--skip-verify`).

---

## Skills are fetched, never vendored

Skills are **not** committed here. `skills.json` declares where each one comes
from, and `setup.sh` clones the source and installs it. Nothing can go stale,
because there is no snapshot to fall behind.

```json
{
  "sources": {
    "mattpocock": { "url": "https://github.com/mattpocock/skills.git", "ref": null }
  },
  "skills": [
    { "name": "code-review", "source": "mattpocock", "path": "skills/engineering/code-review" }
  ]
}
```

- `ref: null` tracks the source's default branch, so `./setup.sh` picks up whatever
  is upstream right now. Set `ref` to a tag or commit to pin.
- Add a skill by adding an entry; add another repo under `sources`.
- Resolved commit SHAs are recorded in `~/.agents/.pi-setup-skills.json` so you can
  see exactly what is installed.
- The whole skill directory is copied (upstream ships extra files such as
  `agents/openai.yaml` alongside `SKILL.md`).

Currently installed, all from [`mattpocock/skills`](https://github.com/mattpocock/skills):
`code-review`, `grill-me`, `grilling`, `improve-codebase-architecture`, `research`, `tdd`.

---

## Layout

| Path | Live location | How it is applied |
|------|---------------|-------------------|
| `pi-agent/settings.core.json` | `~/.pi/agent/settings.json` | **Rendered** — core settings, same everywhere |
| `optional/<name>/manifest.json` | `~/.pi/agent/settings.json` | **Rendered** — only where enabled |
| `pi-agent/auth.json.example` | `~/.pi/agent/auth.json` | Copied once as a template; the real file stays local |
| `pi-agent/AGENTS.md`, `pi-agent/{themes,prompts,tools,skills,agents,extensions}/` | `~/.pi/agent/…` | **Symlinked** (if present) |
| `skills.json` | `~/.agents/skills/` | **Fetched from upstream** by `setup.sh` |
| `setup.sh` | — | The entry point |
| `scripts/` | — | Helpers, sync, optional toggles, doctor |

`settings.json` is **generated**, never tracked and never a symlink, because it is
a per-machine artefact:

```
settings.core.json  +  enabled optional manifests  ->  ~/.pi/agent/settings.json
```

---

## Plugins

### Always-on — `settings.core.json`

Anything under `packages` is installed on every machine. Currently:

| Package | What it adds |
|---------|--------------|
| `npm:pi-subagents` | Sub-agent delegation, parallel review, scripted workflows |
| `npm:pi-web-access` | `web_search`, `fetch_content`, and source verification tools |
| `npm:@gotgenes/pi-permission-system` | The only thing gating tool calls — Pi itself has no permission prompts. Committed policy is deliberately permissive (`"*": "allow"`) plus a real `deny` lock that survives `yoloMode`: [`extensions/pi-permission-system/config.json`](pi-agent/extensions/README.md#permission-policy) |
| `npm:@juicesharp/rpiv-ask-user-question` | Structured questionnaire the model can put to you instead of guessing |
| `npm:@juicesharp/rpiv-todo` | Model-facing todo list as a live overlay surviving `/reload` and compaction |

### Optional — `optional/<name>/`

Packages and settings applied only where you enable them. Choices are recorded in
`~/.pi/agent/.pi-setup-state.json` (gitignored), so they never leak between machines.

| Bundle | What it adds |
|--------|--------------|
| [`opencode-go`](optional/opencode-go/README.md) | OpenCode Zen Go plan: usage status bar, `/go-usage`, `/go-status`, and sets `defaultProvider`/`defaultModel` |

```bash
scripts/optional.sh list                    # what exists, what is enabled here
scripts/optional.sh enable  opencode-go
scripts/optional.sh disable opencode-go
```

Plugin versions are left **unpinned** on purpose so `pi update --extensions`
(which `setup.sh` runs) can move them forward. Pi skips updates for any spec you
pin with `@version`.

### Adding a plugin

```bash
# always-on
pi install npm:some-plugin && scripts/sync.sh    # then commit

# optional
scripts/optional.sh scaffold my-plugin
$EDITOR optional/my-plugin/manifest.json
scripts/optional.sh enable my-plugin
```

---

## Day-to-day

Symlinked resources (`AGENTS.md`, `themes/`, `prompts/`, `tools/`, `skills/`,
`agents/`, `extensions/`) are already repo changes as you edit them — just commit.

Settings need one explicit step, because `settings.json` is generated:

| You did this in Pi | Do this |
|--------------------|---------|
| Changed a core setting (theme, thinking level, …) | `scripts/sync.sh` → commit |
| `pi install …` an always-on plugin | `scripts/sync.sh` → commit |
| Want a plugin only on this machine | `scripts/optional.sh scaffold` + enable |
| Want newer skills | `./setup.sh` (re-fetch) |

```bash
scripts/sync.sh
git add -A && git commit -m "…" && git push
```

> Run `sync.sh` **before** `setup.sh` if you changed settings locally; otherwise the
> render overwrites them (a `settings.json.pre-render-*` backup is always written
> first, and `doctor.sh` flags the drift).

---

## What is intentionally *not* stored here

| Path | Why |
|------|-----|
| `~/.pi/agent/auth.json` | Real API keys — secrets never enter git |
| `~/.agents/skills/`, `~/.pi/agent/skills/` | Fetched from upstream via `skills.json` |
| `~/.pi/agent/models-store.json` | Model catalog cached from `https://pi.dev/api/models/providers/<id>` |
| `~/.pi/agent/sessions/` | Per-machine conversation history |
| `~/.pi/agent/npm/`, `git/`, `bin/` | Installed `node_modules`, cloned repos, platform `rg`/`fd` |
| `~/.pi/agent/trust.json`, `agent-memory/` | Per-machine trust decisions and accumulated memory |
| `~/.pi/agent/missions/` | Per-machine mission records |
| `~/.pi/agent/profiles/` | Per-machine agent profiles |
| `~/.pi/agent/run-history.jsonl` | Per-machine run history log |
| `~/.pi/agent/web-search-cache/` | Cached web-search results, re-fetchable |
| `~/.pi/agent/cache/` | Pi's scratch cache |
| `settings.json.bak-*`, `settings.json.pre-render-*` | Backups written by the scripts |

> **Security:** `auth.json` is gitignored and `doctor.sh` fails if it ever becomes
> tracked. If that happens, rotate the key — deleting a file in a later commit does
> not remove it from git history.

---

## Scripts

| Script | What it does |
|--------|--------------|
| `setup.sh` | The entry point: everything above, idempotent. |
| `scripts/optional.sh list \| enable \| disable \| scaffold` | Per-machine optional plugin bundles. |
| `scripts/install-skills.mjs` | Fetches skills from `skills.json` sources (`--check` verifies without network). |
| `scripts/sync.sh` | Folds live settings into `settings.core.json`, stripping optional contributions. |
| `scripts/doctor.sh` | Checks symlinks, render drift, skills, `auth.json` permissions, git cleanliness, and scans tracked files for secrets. |
| `scripts/render-settings.mjs`, `scripts/sync-settings.mjs` | Node helpers used by the shell scripts. |

Override the Pi config directory with `PI_CODING_AGENT_DIR`, and the skills
directory with `AGENTS_SKILLS_DIR`, if you keep them somewhere non-default.

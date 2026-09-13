# my_pi_setup

Portable configuration store for my [Pi](https://pi.dev) coding-agent harness.

Clone it on any machine, run `scripts/install.sh`, and Pi comes up with the same
settings, plugins, agent definitions, and shared skills. Plugins that only make
sense on some machines (paid plans, work-only tools) are **optional bundles** you
enable per machine.

---

## Layout

| Path | Live location | How it is applied |
|------|---------------|-------------------|
| `pi-agent/settings.core.json` | `~/.pi/agent/settings.json` | **Rendered** — core settings, same everywhere |
| `optional/<name>/manifest.json` | `~/.pi/agent/settings.json` | **Rendered** — only when enabled on this machine |
| `pi-agent/auth.json.example` | `~/.pi/agent/auth.json` | Copied once as a template; the real file stays local |
| `pi-agent/AGENTS.md` | `~/.pi/agent/AGENTS.md` | **Symlinked** (if present) |
| `pi-agent/{themes,prompts,tools,skills,agents}/` | `~/.pi/agent/…` | **Symlinked** (if present) |
| `agents-skills/` | `~/.agents/skills/` | **Copied** — an external skill installer owns the live copy |
| `scripts/` | — | `install.sh`, `sync.sh`, `optional.sh`, `doctor.sh` |

`settings.json` is **generated**, never tracked and never a symlink, because it is
a per-machine artefact:

```
settings.core.json  +  enabled optional manifests  ->  ~/.pi/agent/settings.json
```

`lastChangelogVersion` is preserved across renders, since Pi owns that key.
Other linked resources are symlinked, so edits land straight in this repo.

---

## Plugins

Plugins come in two flavours.

### Always-on — `settings.core.json`

Anything listed under `packages` in `pi-agent/settings.core.json` is installed on
every machine. Currently: `git:github.com/NVlabs/SoL-Pi`.

### Optional — `optional/<name>/`

A bundle of packages plus settings that is only applied where you enable it.
Choices are recorded in `~/.pi/agent/.pi-setup-state.json` (gitignored), so they
do **not** leak between machines.

| Bundle | What it adds |
|--------|--------------|
| [`opencode-go`](optional/opencode-go/README.md) | OpenCode Zen Go plan: usage status bar, `/go-usage`, `/go-status`, and sets `defaultProvider`/`defaultModel` |

```bash
scripts/optional.sh list                    # what exists, what is enabled here
scripts/optional.sh enable  opencode-go     # turn on for this machine
scripts/optional.sh disable opencode-go     # turn off (settings reverted)
```

### Adding a new plugin

For an always-on plugin, let `sync.sh` do the bookkeeping:

```bash
pi install npm:some-plugin     # or: pi install git:github.com/user/repo
scripts/sync.sh                # folds it into settings.core.json
git add -A && git commit -m "plugins: add some-plugin" && git push
```

For an optional plugin, scaffold a bundle:

```bash
scripts/optional.sh scaffold my-plugin
$EDITOR optional/my-plugin/manifest.json    # packages + settings
scripts/optional.sh enable my-plugin
```

```json
{
  "name": "my-plugin",
  "description": "What it does and when to enable it.",
  "packages": ["npm:some-plugin@1.2.3"],
  "settings": { "someKey": "value" }
}
```

`packages` uses the same source syntax as `pi install` (`npm:`, `git:`, or a
path). Anything in `settings` is written on enable and removed again on disable.

---

## New machine

```bash
# 1. Prerequisites: Node + Pi
npm install -g @earendil-works/pi-coding-agent   # or the standalone installer

# 2. Clone the store
git clone git@github.com:IIIIIIIIll/my_pi_setup.git ~/my_pi_setup
cd ~/my_pi_setup

# 3. Link core config and pick optional bundles
scripts/install.sh
scripts/optional.sh enable opencode-go    # only if you use that plan

# 4. Add credentials (gitignored, never leaves the machine)
$EDITOR ~/.pi/agent/auth.json
chmod 600 ~/.pi/agent/auth.json

# 5. First Pi start installs the packages from settings.json
pi
```

Verify at any time:

```bash
scripts/doctor.sh
```

If you already had a `~/.pi/agent/settings.json`, `install.sh` reuses its state:
it infers which optional bundles were enabled from the packages already present,
then backs the old file up as `settings.json.pre-render-*`.

---

## Day-to-day

Symlinked resources (`AGENTS.md`, `themes/`, `prompts/`, `tools/`, `skills/`,
`agents/`) are already repo changes as you edit them — just commit.

Settings need one explicit step, because `settings.json` is generated:

| You did this in Pi | Do this |
|--------------------|---------|
| Changed theme, thinking level, or another core setting | `scripts/sync.sh` → commit |
| `pi install …` an always-on plugin | `scripts/sync.sh` → commit |
| `pi install …` a plugin you only want here | `scripts/optional.sh scaffold` + enable |
| Added/updated a shared skill | `scripts/sync.sh` → commit |

```bash
scripts/sync.sh
git add -A && git commit -m "…" && git push
```

On another machine:

```bash
git pull && scripts/install.sh
```

> Run `sync.sh` **before** `install.sh` if you changed settings locally;
> otherwise the render overwrites them (a `settings.json.pre-render-*` backup is
> always written first, and `doctor.sh` flags the drift).

---

## What is intentionally *not* stored here

Machine-local, rebuilt automatically, and covered by `.gitignore`.

| Path | Why |
|------|-----|
| `~/.pi/agent/auth.json` | Real API keys — secrets never enter git |
| `~/.pi/agent/models-store.json` | Model catalog cached from `https://pi.dev/api/models/providers/<id>`; refetched on demand |
| `~/.pi/agent/sessions/` | Per-machine conversation history |
| `~/.pi/agent/npm/`, `git/`, `bin/` | Installed `node_modules`, cloned package repos, platform `rg`/`fd` binaries |
| `~/.pi/agent/trust.json` | Per-machine project trust decisions |
| `~/.pi/agent/agent-memory/` | Accumulated per-agent memory |
| `settings.json.bak-*`, `settings.json.pre-render-*` | Backups written by the scripts |

> **Security:** `auth.json` is gitignored and `doctor.sh` fails if it ever becomes
> tracked. If that happens, rotate the key — deleting a file in a later commit
> does not remove it from git history.

---

## Scripts

| Script | What it does |
|--------|--------------|
| `scripts/install.sh [--with NAME …]` | Renders `settings.json`, symlinks `AGENTS.md` and resource dirs, seeds `auth.json`, copies skills. Idempotent; backs up anything it replaces. |
| `scripts/optional.sh list \| enable \| disable \| scaffold` | Manages per-machine optional plugin bundles. |
| `scripts/sync.sh` | Folds live settings back into `settings.core.json` with optional contributions stripped, and pulls back skills and resource dirs. |
| `scripts/doctor.sh` | Checks symlinks, render drift, `auth.json` permissions, git cleanliness, and scans tracked files for secrets. Non-zero exit if anything is wrong. |

Node helpers used by the shell scripts: `render-settings.mjs`, `sync-settings.mjs`.

Override the Pi config directory with `PI_CODING_AGENT_DIR` if Pi is configured to
keep its config somewhere other than `~/.pi/agent`.

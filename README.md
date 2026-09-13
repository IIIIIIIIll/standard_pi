# my_pi_setup

Portable configuration store for my [Pi](https://pi.dev) coding-agent harness.

Clone this on any machine, run `scripts/install.sh`, and Pi comes up with the
same settings, custom provider models, packages, and shared skills.

The pinned list of Pi packages lives in [`pi-agent/settings.json`](pi-agent/settings.json)
under `packages`; Pi reinstalls them automatically on first start.

---

## Layout

| Path | Live location | How it is applied |
|------|---------------|-------------------|
| `pi-agent/` | `~/.pi/agent/` | **Symlinked** per file/dir — the repo is the source of truth |
| `pi-agent/auth.json.example` | `~/.pi/agent/auth.json` | Copied once as a template; the real file stays local |
| `agents-skills/` | `~/.agents/skills/` | **Copied** — an external skill installer owns the live copy |
| `scripts/` | — | `install.sh`, `sync.sh`, `doctor.sh` |

### `pi-agent/` contents

| File | Purpose |
|------|---------|
| `settings.json` | Global settings: `packages`, theme, default provider/model/thinking level |
| `models-store.json` | Custom provider + model catalog (currently `opencode-go` / DeepSeek, GLM, Kimi, Qwen, …) |
| `sol-pi.json` | [SoL-Pi](https://github.com/NVlabs/SoL-Pi) package configuration |
| `models.json` | Optional hand-written custom providers (created on demand) |

Optional directories are linked too, if present: `themes/`, `prompts/`, `tools/`,
`skills/`, `agents/`.

---

## New machine

```bash
# 1. Prereqs: Node + Pi
npm install -g @earendil-works/pi-coding-agent   # or the standalone installer

# 2. Clone the store
git clone git@github.com:IIIIIIIIll/my_pi_setup.git ~/my_pi_setup

# 3. Link it into the harness
~/my_pi_setup/scripts/install.sh

# 4. Add credentials (gitignored, never leaves the machine)
$EDITOR ~/.pi/agent/auth.json
chmod 600 ~/.pi/agent/auth.json

# 5. First Pi start installs the packages from settings.json
pi
```

Verify at any time:

```bash
~/my_pi_setup/scripts/doctor.sh
```

---

## Day-to-day

Because the config files are symlinks into this repo, anything Pi writes is
already a repo change — no copy step needed:

- `/settings` changes → tracked in `pi-agent/settings.json`
- `pi install …` → tracked in `pi-agent/settings.json`
- new themes / prompts / tools / skills → tracked under `pi-agent/`

Commit and push as usual:

```bash
cd ~/my_pi_setup
git add -A && git commit -m "…" && git push
```

For the **shared skills**, the live directory is owned by the skill installer, so
pull changes back explicitly first:

```bash
~/my_pi_setup/scripts/sync.sh     # pulls live state into the repo, then review the diff
```

Typical flow after updating a skill on machine A:

```bash
~/my_pi_setup/scripts/sync.sh
git add -A && git commit -m "skills: update tdd" && git push
```

On machine B:

```bash
git pull && ~/my_pi_setup/scripts/install.sh
```

---

## What is intentionally *not* stored here

These are machine-local and are rebuilt or re-created automatically. They are
also covered by `.gitignore` as defence in depth.

| Path | Why |
|------|-----|
| `~/.pi/agent/auth.json` | Real API keys — secrets never enter git |
| `~/.pi/agent/sessions/` | Per-machine conversation history |
| `~/.pi/agent/npm/` | Installed package `node_modules`; reinstall from `settings.json` |
| `~/.pi/agent/git/` | Cloned package repos; refetched on demand |
| `~/.pi/agent/bin/` | Platform-specific `rg` / `fd` binaries |
| `~/.pi/agent/*.bak-*` | Pre-link backups created by `install.sh` |

> **Security:** `auth.json` is gitignored and `doctor.sh` fails the check if it
> ever becomes tracked. If that happens, rotate the key — removing a file from a
> later commit does not remove it from git history.

---

## Scripts

| Script | What it does |
|--------|--------------|
| `scripts/install.sh` | Symlinks `pi-agent/*` into `~/.pi/agent`, seeds `auth.json`, copies skills. Idempotent; backs up anything it replaces. |
| `scripts/sync.sh` | Copies live harness state (including externally-managed skills) back into the repo for committing. |
| `scripts/doctor.sh` | Checks symlink health, `auth.json` permissions, git cleanliness, and scans tracked files for secrets. Exit code is non-zero if anything is wrong. |

Override the target config directory with `PI_CODING_AGENT_DIR` if Pi is
configured to keep its config somewhere other than `~/.pi/agent`.

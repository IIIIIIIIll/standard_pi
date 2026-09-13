# Bootstrap Task: Fill Project Development Guidelines

**You (the AI) are running this task. The developer does not read this file.**

The developer just ran `trellis init` on this project for the first time.
`.trellis/` now exists with empty spec scaffolding, and this bootstrap task
exists under `.trellis/tasks/`. When they want to work on it, they should start
this task from a session that provides Trellis session identity.

**Your job**: help them populate `.trellis/spec/` with the team's real
coding conventions. Every future AI session — this project's
`trellis-implement` and `trellis-check` sub-agents — auto-loads spec files
listed in per-task jsonl manifests. Empty spec = sub-agents write generic
code. Real spec = sub-agents match the team's actual patterns.

Don't dump instructions. Open with a short greeting, figure out if the repo
has any existing convention docs (CLAUDE.md, .cursorrules, etc.), and drive
the rest conversationally.

---

## Status (update the checkboxes as you complete each item)

- [x] Fill backend guidelines — **not applicable**: this repo has no backend layer. The `backend/` template directory was deleted. See Completion Record.
- [x] Fill frontend guidelines — **not applicable**: this repo has no frontend layer. The `frontend/` template directory was deleted. See Completion Record.
- [x] Add code examples — every guideline file cites real file paths and real snippets from `setup.sh`, `scripts/*.sh`, `scripts/*.mjs`, and the tracked JSON.

---

## Completion Record (2026-09-13, yuanhai.tan)

### Reshape decision

The template's `backend/` + `frontend/` split does not describe this project.
`my_pi_setup` is a portable Pi harness config store: four bash scripts, three
dependency-free Node ESM helpers, tracked JSON, and Markdown. Both template
directories were deleted and replaced with layers matching the real code.

### Final spec tree

```
.trellis/spec/
├── index.md                        project overview, pre-dev checklist, quality check
├── scripts/
│   ├── index.md                    layer entry, checklist, quality check
│   ├── shell-guidelines.md         setup.sh + scripts/*.sh
│   └── node-guidelines.md          scripts/*.mjs
├── config/
│   ├── index.md                    layer entry, the four surfaces
│   ├── layout-and-surfaces.md      tracked | symlinked | generated | ignored + decision tree
│   ├── optional-bundles.md         optional/<name>/manifest.json contract
│   └── pi-resources.md             settings.core.json, skills.json, extensions/, permissions
└── guides/
    ├── index.md
    ├── change-propagation-guide.md NEW — the load-bearing guide for this repo
    ├── code-reuse-thinking-guide.md
    └── cross-layer-thinking-guide.md
```

`config, scripts` are now the auto-detected spec layers
(`get_context.py --mode packages`).

### Existing convention docs found

- `README.md` — the store's user-facing contract; its Layout table, plugin
  table, and "not stored here" table were used as evidence for
  `config/layout-and-surfaces.md`.
- `pi-agent/extensions/README.md` — the deep reference for the permission
  policy; `config/pi-resources.md` records only the rules a contributor must not
  break and links back to it.
- `AGENTS.md` — Trellis-managed block only; no project conventions of its own.
- No `CLAUDE.md`, `.cursorrules`, `CONTRIBUTING.md`, or `.editorconfig`.

### Verification performed

```
bash -n setup.sh scripts/*.sh            OK
node --check scripts/*.mjs               OK
render-settings.mjs --check              no drift (exit 0)
install-skills.mjs --check               6/6 installed (exit 0), no network
./setup.sh --yes --skip-skills --skip-plugins   exit 0, twice, identical output
grep -rniE "to be filled|TODO: fill" .trellis/spec   no placeholder prose
internal markdown links                 all resolve
```

The network steps of `setup.sh` (`install-skills.mjs`, `pi update --extensions`)
were skipped in the two idempotency runs; both were verified separately via
`--check`.

### Known issues documented rather than fixed

These were recorded in the specs as current reality at the time, not corrected —
this task was docs-only. **All four have since been resolved** by
`09-13-repair-harness-drift` and its children (`d44289e`, `819bfa1`, `5997e94`),
except the last, which is an environment fact rather than a defect:

- ~~`render-settings.mjs` and `.gitignore` both reference `scripts/install.sh`,~~
  ~~which does not exist (the real command is `./setup.sh`).~~ → fixed in `d44289e`.
- ~~`PI_DIRS` / `PI_FILES` are duplicated across `setup.sh`, `sync.sh`, and~~
  ~~`doctor.sh`; the resource-directory list appears in seven places overall.~~ →
  single-sourced in `scripts/lib.sh` in `819bfa1` (the count had been eight, not
  seven).
- ~~`sync.sh`'s "not synced" skip-list and `.gitignore` have fallen behind Pi,~~
  ~~which now also writes `missions/`, `profiles/`, and `run-history.jsonl`.~~ →
  reconciled in `5997e94`, which also added `doctor.sh`'s ignore-coverage check.
- `shellcheck` is not installed, so the `# shellcheck` directives in the scripts
  are documentation rather than tooling. (Environment fact, not a defect; still
  true.)

---

## Spec files to populate

> **Superseded.** This table is the `trellis init` template target list, kept as a
> record of what was asked. The actual final tree is in the Completion Record at
> the top of this file: `backend/` and `frontend/` were deleted because this repo
> has neither layer.


### Backend guidelines

| File | What to document |
|------|------------------|
| `.trellis/spec/backend/directory-structure.md` | Where different file types go (routes, services, utils) |
| `.trellis/spec/backend/database-guidelines.md` | ORM, migrations, query patterns, naming conventions |
| `.trellis/spec/backend/error-handling.md` | How errors are caught, logged, and returned |
| `.trellis/spec/backend/logging-guidelines.md` | Log levels, format, what to log |
| `.trellis/spec/backend/quality-guidelines.md` | Code review standards, testing requirements |


### Frontend guidelines

| File | What to document |
|------|------------------|
| `.trellis/spec/frontend/directory-structure.md` | Component/page/hook organization |
| `.trellis/spec/frontend/component-guidelines.md` | Component patterns, props conventions |
| `.trellis/spec/frontend/hook-guidelines.md` | Custom hook naming, patterns |
| `.trellis/spec/frontend/state-management.md` | State library, patterns, what goes where |
| `.trellis/spec/frontend/type-safety.md` | TypeScript conventions, type organization |
| `.trellis/spec/frontend/quality-guidelines.md` | Linting, testing, accessibility |


### Thinking guides (already populated)

`.trellis/spec/guides/` contains general thinking guides pre-filled with
best practices. Customize only if something clearly doesn't fit this project.

---

## How to fill the spec

### Step 1: Import from existing convention files first (preferred)

Search the repo for existing convention docs. If any exist, read them and
extract the relevant rules into the matching `.trellis/spec/` files —
usually much faster than documenting from scratch.

| File / Directory | Tool |
|------|------|
| `CLAUDE.md` / `CLAUDE.local.md` | Claude Code |
| `AGENTS.md` | Codex / Claude Code / agent-compatible tools |
| `.cursorrules` | Cursor |
| `.cursor/rules/*.mdc` | Cursor (rules directory) |
| `.windsurfrules` | Windsurf |
| `.clinerules` | Cline |
| `.roomodes` | Roo Code |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.vscode/settings.json` → `github.copilot.chat.codeGeneration.instructions` | VS Code Copilot |
| `CONVENTIONS.md` / `.aider.conf.yml` | aider |
| `CONTRIBUTING.md` | General project conventions |
| `.editorconfig` | Editor formatting rules |

### Step 2: Analyze the codebase for anything not covered by existing docs

Scan real code to discover patterns. Before writing each spec file:
- Find 2-3 real examples of each pattern in the codebase.
- Reference real file paths (not hypothetical ones).
- Document anti-patterns the team clearly avoids.

### Step 3: Document reality, not ideals

**Critical**: write what the code *actually does*, not what it should do.
Sub-agents match the spec, so aspirational patterns that don't exist in the
codebase will cause sub-agents to write code that looks out of place.

If the team has known tech debt, document the current state — improvement
is a separate conversation, not a bootstrap concern.

---

## Quick explainer of the runtime (share when they ask "why do we need spec at all")

- Every AI coding task spawns two sub-agents: `trellis-implement` (writes
  code) and `trellis-check` (verifies quality).
- Each task has `implement.jsonl` / `check.jsonl` manifests listing which
  spec files to load.
- The platform hook auto-injects those spec files + the task's `prd.md`
  into every sub-agent prompt, so the sub-agent codes/reviews per team
  conventions without anyone pasting them manually.
- Source of truth: `.trellis/spec/`. That's why filling it well now pays
  off forever.

---

## Completion

When the developer confirms the checklist items above are done with real
examples (not placeholders), guide them to run:

```bash
python3 ./.trellis/scripts/task.py finish
python3 ./.trellis/scripts/task.py archive 00-bootstrap-guidelines
```

After archive, every new developer who joins this project will get a
`00-join-<slug>` onboarding task instead of this bootstrap task.

---

## Suggested opening line

"Welcome to Trellis! Your init just set me up to help you fill the project
spec — a one-time setup so every future AI session follows the team's
conventions instead of writing generic code. Before we start, do you have
any existing convention docs (CLAUDE.md, .cursorrules, CONTRIBUTING.md,
etc.) I can pull from, or should I scan the codebase from scratch?"

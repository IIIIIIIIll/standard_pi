# Daily-use guides

> When to reach for each thing this harness installs, and what to type. Three
> pages, one per surface:

| Page | Answers |
| ---- | ------- |
| [`plugins.md`](./plugins.md) | "the harness has 12 packages — which one does X, and how do I drive it?" |
| [`skills.md`](./skills.md) | "I want a review / a research pass / TDD — which skill, and how is it triggered?" |
| [`agents.md`](./agents.md) | "what do `trellis-implement` and `/trellis-continue` do, and how do I dispatch them?" |

## The entry contract

Every entry on all three pages is a level-three heading — three hashes followed
by a space — whose **first backtick-delimited token is the entry's exact id**.
Plugins use the spec string from `pi-agent/settings.core.json` (for example
`npm:pi-lens`); skills use the `name` from `skills.json`. Text after the id on
the same line is allowed and ignored.

Every entry then states, in this order:

- `**What it is.**` — one line, required.
- `**Reach for it when.**` — the trigger, required.
- `**Invoke.**` — the exact surface: a tool name, a slash command, or the
  `subagent({ agent, task })` shape. Required.
- `**Config.**` — one path plus its surface (tracked, symlinked, generated, or
  ignored — the four terms are defined in
  [`spec/config/index.md`](../.trellis/spec/config/index.md)), or "none".
- `**Gotcha.**` — optional, and present only where the package source documents
  a real trap. An entry with none must not invent one.

Only entries use level-three headings. Pointer sections inside `plugins.md` and
`skills.md` use level two, so the coverage check (`scripts/check-docs.mjs`, run by
`scripts/doctor.sh`) does not read them as entries.

## Where each kind of rule lives

- **`docs/`** owns daily use: purpose, trigger, invocation, the one config line,
  and traps.
- **[`README.md`](../README.md)** owns install, `setup.sh`, the render model, the
  symlink surfaces, and what is never stored here.
- **[`.trellis/spec/config/pi-resources.md`](../.trellis/spec/config/pi-resources.md)**
  owns *why* each package is core and the mechanics of its config (write
  behaviour, symlink traps, measured paths). Where this page and that file
  disagree, that file wins.

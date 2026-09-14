# Skills — daily use

> When to reach for each fetched skill, and how it is triggered. One entry per
> `name` in the repo-root [`skills.json`](../skills.json).
>
> Skills are fetched from `mattpocock/skills` at setup time — the upstream
> repository is [mattpocock/skills](https://github.com/mattpocock/skills). Install
> and lifecycle rules live in [`README.md`](../README.md). Entry contract and
> heading convention: [`docs/README.md`](./README.md).

---

### `code-review`

**What it is.** A two-axis review of the diff between a fixed point you name and `HEAD`: **Standards** (does the code follow this repo's documented standards?) and **Spec** (does it do what the originating issue asked?). The two axes run as parallel sub-agents and are reported side by side.

**Reach for it when.** You want a branch, a PR, or work-in-progress reviewed since a specific commit — or you want to know whether a change passed one axis and failed the other.

**Invoke.** `/skill:code-review`, followed by the fixed point in the same message (a commit SHA, branch, tag, or `HEAD~5`). The **model may also reach for it automatically** when you ask to review changes.

**Config.** None — the skill is a `SKILL.md` directory fetched to the skills directory, with no config file of its own.

**Gotcha.** The Spec axis needs an issue tracker at `docs/agents/issue-tracker.md`; if that file is missing the skill stops and tells you to run `/setup-matt-pocock-skills`.

### `grill-me`

**What it is.** A relentless interview that stress-tests a plan or design until you reach a shared understanding. The body is a one-line redirect to the `grilling` skill.

**Reach for it when.** You want your own plan interrogated and are ready to be questioned rather than helped.

**Invoke.** `/skill:grill-me`. **The model may not reach for this one** — it declares `disable-model-invocation: true`, so it is yours to type.

**Config.** None — no config file.

**Gotcha.** All it does is call the `grilling` skill, so `/skill:grilling` gets you the same interview without the extra hop.

### `grilling`

**What it is.** The interview itself: it maps your plan as a design tree and works it in rounds, asking the whole current frontier of questions at once — each numbered, each with its own recommended answer — then waits for your replies before the next round.

**Reach for it when.** A decision is fuzzy and you want the assumptions surfaced one round at a time; or you have a plan you suspect has holes in it.

**Invoke.** `/skill:grilling`. The **model may also reach for it automatically** — including when you use any "grill" trigger phrase.

**Config.** None — no config file.

**Gotcha.** Finding facts is the skill's job, not yours: it dispatches a sub-agent for anything it could look up itself. You supply decisions only.

### `improve-codebase-architecture`

**What it is.** A scan for **deepening opportunities** (refactors that turn shallow modules into deep ones), presented as a self-contained HTML report you can open in a browser, followed by a grilling loop over whichever candidate you pick.

**Reach for it when.** You suspect the codebase is hard to navigate or hard to test through its current interfaces, and you want candidates visualised before committing to one.

**Invoke.** `/skill:improve-codebase-architecture`, optionally naming a module, subsystem, or pain point to scope the scan. **The model may not reach for this one** — it declares `disable-model-invocation: true`.

**Config.** None — no config file. It writes its report to a temp directory, so nothing lands in the repo.

**Gotcha.** It reads `CONTEXT.md` and any ADRs in the area it scans; a candidate that contradicts an ADR is surfaced explicitly rather than silently dropped.

### `research`

**What it is.** A delegated investigation: a background agent follows a question back to its **primary sources** (official docs, source code, specs) and writes the findings to a single Markdown file with each claim's source cited.

**Reach for it when.** A question needs reading legwork you would rather not do inline, or you want findings captured in the repo rather than left in a conversation.

**Invoke.** `/skill:research`. The **model may also reach for it automatically** when you ask for a topic to be researched or reading to be delegated.

**Config.** None — no config file. It writes its notes to wherever the repo already keeps such notes.

**Gotcha.** It is a background agent, so you keep working while it reads; the findings arrive as a file, not as an inline answer.

### `tdd`

**What it is.** The red → green loop, plus the reference that makes the tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop.

**Reach for it when.** You are building a feature or fixing a bug test-first, or you mention "red-green-refactor" or want integration tests.

**Invoke.** `/skill:tdd`. The **model may also reach for it automatically** when it recognizes test-first work.

**Config.** None — no config file. It reads `CONTEXT.md` and relevant ADRs for vocabulary when they exist.

**Gotcha.** It will stop and agree the seams under test with you before writing any test — no test is written at an unconfirmed seam.

---

## The generated Trellis skill set

`trellis init` generates a second, larger skill set — `trellis-brainstorm`,
`trellis-before-dev`, `trellis-check`, `trellis-break-loop`,
`trellis-update-spec`, and others — into `.agents/`. None of it is listed here
because none of it is installed by this repo.

Two anchors are always present on a fresh clone and describe what the set does:

- [`AGENTS.md`](../AGENTS.md) — the project instructions the set is built around.
- [`.trellis/workflow.md`](../.trellis/workflow.md) — the phase index and the
  skill routing table.

`trellis-meta`'s `references/` (available after `trellis init`) is the deep guide
for customizing the workflow; it is deliberately not linked as a tracked path.

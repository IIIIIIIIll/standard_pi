# Upstream evidence — codebase-memory-mcp and pi-mcp-adapter

Measured 2026-09-14 against a `--depth 1` clone of
`DeusData/codebase-memory-mcp` (`main`, HEAD `339b3f4`, 2026-09-13) and the
installed `pi-mcp-adapter` v2.33.0 at
`~/.pi/agent/npm/node_modules/pi-mcp-adapter`.

Every claim in [`../prd.md`](../prd.md) and [`../design.md`](../design.md) that
concerns upstream behaviour traces to a row here. Line numbers are from those two
checkouts and will drift; the quoted code is the durable part.

---

## `pi-mcp-adapter` — how it reads and writes MCP config

### Config precedence (README, "Usage")

```text
1. ~/.config/mcp/mcp.json
2. ~/.agents/mcp.json
3. ~/.agents/mcp/mcp.json
4. <Pi agent dir>/mcp.json      →  ~/.pi/agent/mcp.json
5. .mcp.json                    (project)
6. .pi/mcp.json                 (project, Pi-owned)
```

Later entries win. `config.ts:13-19` holds the constants: the generic global path
is `join(homedir(), ".config", "mcp", "mcp.json")`, the project name is `.mcp.json`,
and the Pi-owned project override is `mcp.json`.

**Consequence for this task:** the global layer is precedence 1 and is shared by
every MCP-aware tool, not just Pi. `~/.pi/agent/mcp.json` is precedence 4 and
Pi-only. The `homedir()` in that constant is the durable part: measured against
the installed `dist/config.js:12`, the resolution never consults
`XDG_CONFIG_HOME`. So any writer that honours the variable registers the server
where the adapter does not look — which is why `MCP_CFG` in `scripts/lib.sh` is
`$HOME/.config/mcp/mcp.json` and not the XDG form.

### It writes with an atomic rename

```ts
// config.ts:1029
function writeRawConfigObject(filePath: string, raw: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
  renameSync(tmpPath, filePath);
}
```

`rename(2)` replaces the **symlink**, not its target. This is the identical
mechanics `layout-and-surfaces.md` documents for `auto-compact.json`, and it is
why `~/.config/mcp/mcp.json` can never be a `PI_FILES` entry.

Write targets, all via this function:

| Site | Target |
| --- | --- |
| `config.ts:1118` | a caller-supplied `filePath` |
| `config.ts:1213` (`ensureCompatibilityImports`) | `~/.pi/agent/mcp.json` — Pi-owned override, used by init / `/mcp setup` |
| `config.ts:1232`, `:1258`, `:1341` | the resolved add/enable target |
| `config.ts:1180` | `projectRoot ? join(projectRoot, ".mcp.json") : GENERIC_GLOBAL_CONFIG_PATH` |

Only `config.ts` contains `writeFileSync`/`renameSync` among `config.ts`,
`init.ts` and `mcp-install.ts` — `init` delegates to this function.

### The `mcpServers` key, and the hyphenated alternative

```ts
// config.ts:1037
const existing = raw.mcpServers ?? raw["mcp-servers"] ?? {};
```

The adapter accepts both spellings and prefers `mcpServers`. **Consequence:** if a
file uses only `mcp-servers` and this repo's helper writes `mcpServers`, it creates
a second key that silently shadows the first. Hence the refusal rule in
`design.md`.

### Server entry shape

```ts
// config.ts:1154
function buildRepoPromptEntry(executablePath: string): ServerEntry {
  return { command: executablePath, args: [], lifecycle: "lazy" };
}
```

`ServerEntry` (`types.ts:426`) permits `command`, `args`, `socket`, `env`,
`inheritEnv`, `cwd`, `url`, `caFile`, `headers`, `requestHeadersCommand`, `auth`,
`bearerToken`, `bearerTokenEnv`, `bearerTokenStore`, `oauth`, `lifecycle`,
`idleTimeout`, `requestTimeoutMs`, `exposeResources`, `directTools`, `toolPrefix`,
`includeTools`.

`lifecycle` values: `"keep-alive" | "lazy" | "lazy-keep-alive" | "eager"`.

**Consequence:** `{ command, args: [], lifecycle: "lazy" }` mirrors the adapter's
own generated entry and is minimal-but-supported. No `type` key exists in the
schema.

### `/mcp disable` / `enable` do not touch these files

Per the README, they persist only a `disabled` field into the **project-local**
`.pi/mcp.json`. So the global config is not rewritten by enable/disable — only by
`/mcp setup`, `init`, and a direct add.

### The pi route vs the generated extension

The upstream repo's own source comment states:

> `/* pi has no MCP client, so this bridge is its ONLY route to the graph. */`

`cli.c` (in `install_pi_durable_context`). **This is false on this machine** —
`pi-mcp-adapter` v2.33.0 is installed, and this session's `mcp` tool reports a
working gateway. The MCP route was therefore chosen over the generated
`cbmem.ts`, which also sidesteps the open upstream issue below.

The upstream pi adapter generator is pinned to a contract version:

```text
// Target: @earendil-works/pi-coding-agent >= 0.74.0 (verified 0.84.2)
// ToolDefinition.execute(toolCallId, params, signal, onUpdate, ctx)
```

This machine runs Pi **0.85.1**, and upstream issue **#2166** ("cbmem.ts not
working in Pi agent", opened 2026-09-10, still open) reports the generated
extension failing on exactly that version. Independent reason to prefer MCP.

---

## `codebase-memory-mcp` — what `install` does to the agent directory

`install_pi_durable_context` (`cli.c`) writes three things:

| Path | Call |
| --- | --- |
| `~/.pi/agent/AGENTS.md` | `install_managed_agent_instructions("Pi", …)` |
| `~/.pi/agent/skills/` | `install_agent_skill("Pi", skills_dir, …)` |
| `~/.pi/agent/extensions/cbmem.ts` | `install_generated_client_extension("Pi", …)` |

**And `~/.pi/agent/extensions` is a symlink into this repo:**

```text
~/.pi/agent/extensions -> /home/tan/my_pi_setup/pi-agent/extensions
```

So an unguarded `install.sh` writes `cbmem.ts` to
`pi-agent/extensions/cbmem.ts` — inside the git working tree. `.gitignore` covers
only `pi-agent/extensions/*/logs/`, so that file is untracked-and-visible and
breaks the verify chain's clean-`git status` requirement.

This is why `--skip-config` is a hard requirement, not a preference.

### The upstream MCP entry it would write

The installer's own `mcpServers` generator emits:

```text
command = <absolute binary path>
args    = []
```

i.e. an absolute `$HOME`-rooted path. **Consequence:** a machine-specific value
would be the thing every machine's config carries. The helper writes the
PATH-resolved name instead.

### Tool registry size

**Version skew, not a stale README.** The installed **0.10.8** advertises **15**
tools; `main`'s `src/mcp/mcp.c` declares **17** in `TOOLS[]` (`TOOL_COUNT` is
`sizeof(TOOLS)/sizeof(TOOLS[0])`). The two extra entries are `get_file_outline`
and `compare_graphs`, absent from 0.10.8 and present on `main`. `README.md` and
`docs/llms.txt` say 15 because they describe the released build. **Consequence:**
the expected count from `mcp({ search: … })` must be read from the running server,
not from either the README or `main` — a reader who assumes 17 will think the
release is broken, and one who assumes a stale README will look for a bug that is
not there.

---

## Repo-side starting state

| Fact | Evidence |
| --- | --- |
| No MCP server configured | `mcp` → `0/0 servers, 0 tools` |
| All six adapter config paths absent | `~/.config/mcp/mcp.json`, `~/.agents/mcp.json`, `~/.agents/mcp/mcp.json`, `~/.pi/agent/mcp.json`, `.mcp.json`, `.pi/mcp.json` |
| `pi-mcp-adapter` installed | v2.33.0 in `~/.pi/agent/npm/node_modules/` |
| No `codebase-memory-mcp` binary | not on `PATH`; no `~/.cache/codebase-memory-mcp` |
| `~/.pi/agent/AGENTS.md` absent | so a later `pi-agent/AGENTS.md` would collide with a real file if the installer created one |
| `~/.pi/agent/skills/` absent | `PI_DIRS` includes `skills`, so `setup.sh` links it the moment `pi-agent/skills/` appears |
| `.mcp.json` is not gitignored | `git check-ignore -v .mcp.json` → no match |
| No MCP script has ever existed here | `git log --diff-filter=A` lists only `scripts/install-skills.mjs` and the since-deleted `scripts/install.sh` |

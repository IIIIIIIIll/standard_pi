# Implement — built-in MCP migration

Ordered so that every step leaves a valid repo, and the mechanical checks run
before the docs are touched. Rollback point after every step: `git checkout -- <file>`
(or `git restore -S`) — nothing here deletes user data, and
`~/.config/mcp/mcp.json` is never written.

## 1. Settings: flip the backend

- [ ] `pi-agent/settings.core.json`: remove `"npm:pi-mcp-adapter"` from
      `packages[]`; remove the `"extensions": ["-builtin:mcp"]` entry.
- [ ] Validate: `node scripts/render-settings.mjs "$PWD" "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/.pi-setup-state.json"` then
      `--check` (expect `ok`).

## 2. Registration path and entry shape

- [ ] `scripts/lib.sh`: `MCP_CFG` → `$HOME/.pi/agent/mcp.json`; rewrite its
      comment block (Pi's own config dir, not the XDG/reader argument); drop
      `mcp-cache.json` from `PI_NOT_SYNCED`; add `mcp.json` and `mcp.log*`.
- [ ] `scripts/register-mcp-server.mjs`: entry becomes
      `{ command, args: [], exposure: "codemode" }`; rewrite the comments that
      cite the adapter's key/`lifecycle` behaviour so they describe Pi's reader.
- [ ] `scripts/install-mcp.sh`: header comment (target is Pi's `mcp.json`; the
      global file is no longer written); the registration call already uses
      `$MCP_CFG`.
- [ ] `scripts/doctor.sh`: `==> MCP server` header path follows `MCP_CFG`; delete
      the `XDG_CONFIG_HOME` warning block and its comment; keep the binary checks
      and the `register-mcp-server.mjs --check` call.
- [ ] `.gitignore`: drop the `pi-agent/mcp-cache.json` entry + comment; add
      `pi-agent/mcp.json` and `pi-agent/mcp.log*` under the runtime/extension
      config section with a one-line reason each.
- [ ] Validate: `shellcheck` the two shell scripts, `node --check` the two `.mjs`
      files, then `./scripts/install-mcp.sh` followed by `./scripts/doctor.sh`
      (expect the MCP section green and no unpaired-path complaint).

## 3. Docs and spec

- [ ] `docs/plugins.md`: delete the `### npm:pi-mcp-adapter` section.
- [ ] `README.md`: delete the `npm:pi-mcp-adapter` row from the package table;
      rewrite `### The MCP server — installed, not a package` around built-in MCP
      (Pi's `mcp.json`, `exposure: "codemode"`, `pi mcp` commands, `/mcp` panel,
      `mcp.log`); update the "not stored here" table row for
      `~/.config/mcp/mcp.json` and the `scripts/install-mcp.sh` script-table row.
- [ ] `.trellis/spec/config/pi-resources.md`: remove the adapter row from the
      package inventory; replace the adapter paragraph and the
      "global MCP config" material with the built-in MCP contract (Pi reads only
      `~/.pi/agent/mcp.json` + `.pi/mcp.json`; the global file is another tool's
      surface now; `codemode` exposure; `mcp.log`).
- [ ] `.trellis/spec/config/layout-and-surfaces.md`: path-map rows — the
      `~/.pi/agent/mcp.json` (generated) and `mcp.log*` additions, the
      `mcp-cache.json` removal, and the prose at `:64` and `:437`.
- [ ] `.trellis/spec/guides/change-propagation-guide.md`: rewrite the
      "MCP server registration" row — the sites now include `lib.sh`, `setup.sh`,
      `doctor.sh`, `README.md`, and (newly legitimate) `.gitignore` /
      `PI_NOT_SYNCED` / `~/.pi/agent/mcp.json`; the adapter-resolver clause goes.
- [ ] `.trellis/spec/scripts/shell-guidelines.md`: `MCP_CFG` example and the
      "follows the reader, not XDG" rule → "Pi's own config dir".
- [ ] Validate: `node scripts/check-docs.mjs` (10 plugins), `./scripts/doctor.sh`
      (no problems), `git grep` per AC6.

## 4. End-to-end verification

- [ ] `node /tmp/mcp-warn-probe.mjs "$PWD"` → `builtin:mcp` loaded,
      `warnings: []`.
- [ ] `pi mcp list` in a fresh process → `codebase-memory-mcp` connected with
      `mcp__codebase_memory_mcp__*` tools.
- [ ] `./setup.sh` a second time → `keep`/`ok`, no `backup`/`render`/`install`
      rewrites; `git status` clean except intended edits.
- [ ] Confirm `~/.config/mcp/mcp.json` is byte-identical to its pre-change copy.

## 5. Wrap-up

- [ ] Update the spec/README text if any check exposed a wording mismatch.
- [ ] Commit as `feat(mcp): switch to Pi's built-in MCP extension` with the
      verification evidence in the body.
- [ ] Archive the task (`task.py archive`) and append the session's journal note.

## Rollback points

- **After step 1/2** (no docs yet): `git restore` the edited files, re-run
  `./setup.sh`; `packages[]` reinstalls `pi-mcp-adapter` and the `-builtin:mcp`
  entry can be re-added, restoring `ec4d473`'s state exactly.
- **After step 3**: same revert; docs and code travel in one commit, so they cannot
  drift apart.
- **Never**: editing or deleting `~/.config/mcp/mcp.json` — no step touches it.

## Notes for the implementer

- `.trellis/tasks/*/archive/**` and `.trellis/workspace/tan/journal-1.md` mention
  the adapter as history. Leave them; AC6 excludes them.
- `pi-agent/extensions/pi-permission-system/logs/*.jsonl` is a runtime log, not
  tracked source.
- The built-in `mcp` extension is *replaceable*: if `pi-mcp-adapter` were ever
  reinstalled by `pi install`, Pi would drop `builtin:mcp` again and warn — which
  is why the settings entry and the package list are changed in the same commit.

#!/usr/bin/env node
//
// register-mcp-server.mjs — register one MCP server in a machine-global MCP
// config, preserving every other server already in the file.
//
//   node register-mcp-server.mjs <config-path> <server-name> <command> [--check]
//
// --check   report drift and change nothing (exit 1 if the entry is absent or
//           differs); never writes, not even a backup
//
// The config is shared with every MCP-aware tool on the machine, and its owner
// (pi-mcp-adapter) writes it with an atomic rename, so it is never a symlink and
// this helper owns exactly one key inside it. Anything this helper cannot merge
// safely is refused rather than rewritten — exit 1, no backup, no write:
//
//   - an unparseable file (starting from `{}` would delete every other server)
//   - a root that is not an object (an array root serialises without an
//     `mcpServers` property, so the merge would report success and register
//     nothing)
//   - a non-object `mcpServers` value (the spread below would rekey it, turning
//     a string into character-indexed keys)
//   - a file that spells the key `mcp-servers` (the adapter prefers
//     `mcpServers`, so writing the camelCase key would shadow the hyphenated one)
//
import fs from "node:fs";
import path from "node:path";

const [configPath, serverName, command, ...rest] = process.argv.slice(2);
if (!configPath || !serverName || !command) {
  console.error(
    "usage: register-mcp-server.mjs <config-path> <server-name> <command> [--check]",
  );
  process.exit(2);
}

let checkOnly = false;
for (const arg of rest) {
  if (arg === "--check") checkOnly = true;
}

const typeName = (value) =>
  value === null
    ? "null"
    : Array.isArray(value)
      ? "an array"
      : `a ${typeof value}`;
const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// One message shape for every refusal: what is wrong, then what to do about it.
function refuse(problem, remedy) {
  console.error(`  error    ${configPath} ${problem}`);
  console.error(`           ${remedy}`);
  process.exit(1);
}

let raw = {};
if (fs.existsSync(configPath)) {
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    refuse(
      `is not valid JSON: ${error.message}`,
      "refusing to overwrite it; fix or remove the file by hand",
    );
  }

  // Shape guard, not just a parse guard: `out.mcpServers = { ...raw }` below is
  // only meaningful on an object, and an array or scalar root would be rewritten
  // as something this helper cannot register into.
  if (!isPlainObject(raw)) {
    refuse(
      `is ${typeName(raw)}, not an object`,
      "refusing to overwrite it; fix or remove the file by hand",
    );
  }

  // The adapter reads `raw.mcpServers ?? raw["mcp-servers"] ?? {}` and prefers the
  // camelCase key, so writing `mcpServers` beside an existing hyphenated one would
  // silently shadow it. Refuse instead of creating the second key.
  if (raw["mcp-servers"] !== undefined && raw.mcpServers === undefined) {
    refuse(
      `uses the key "mcp-servers"; this helper writes "mcpServers"`,
      `rename it to "mcpServers" by hand first — writing both would shadow the existing one`,
    );
  }

  // Same guard for the nested value: spreading a string or an array here would
  // rekey it (`{"mcpServers":"oops"}` becomes `{"0":"o","1":"o",…}`) and
  // destroy whatever the file held.
  if (raw.mcpServers !== undefined && !isPlainObject(raw.mcpServers)) {
    refuse(
      `has ${typeName(raw.mcpServers)} in "mcpServers", not an object`,
      "refusing to overwrite it; fix or remove the file by hand",
    );
  }
}

// `command` is the PATH-resolved name, never an absolute path: this file is
// shared across machines and tools, so it must not carry a machine-specific
// value. `lifecycle: "lazy"` mirrors the adapter's own generated entry.
const entry = { command, args: [], lifecycle: "lazy" };
const out = structuredClone(raw);
// Guarded above: `raw` is an object and `raw.mcpServers` is either absent or an
// object, so this spread preserves every foreign entry rather than rekeying it.
out.mcpServers = { ...(out.mcpServers ?? {}), [serverName]: entry };

const next = JSON.stringify(out, null, 2) + "\n";
const previousText = fs.existsSync(configPath)
  ? fs.readFileSync(configPath, "utf8")
  : null;

if (previousText === next) {
  console.log(`  ok       ${configPath}`);
} else if (checkOnly) {
  console.error(`  drift    ${configPath} does not register ${serverName}`);
  console.error(`           run ./setup.sh or scripts/install-mcp.sh`);
  process.exit(1);
} else {
  if (previousText !== null) {
    const stamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
    const backup = `${configPath}.bak-${stamp}`;
    fs.writeFileSync(backup, previousText);
    console.log(`  backup   ${backup}`);
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, next);
  console.log(`  install  ${configPath}`);
  console.log(`           ${serverName} -> ${command}`);
}

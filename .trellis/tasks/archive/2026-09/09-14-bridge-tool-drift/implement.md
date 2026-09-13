# Implement Plan — generated-tool drift detection

Read `prd.md` and `design.md` first. `implement.jsonl` lists the governing specs.

## Constraint reminder

Do **not** edit anything under `.pi/`, `.agents/`, or `.trellis/workflow.md`.
They are generated and/or gitignored. Everything lands in `pi-agent/`,
`scripts/`, or `.trellis/spec/`.

## Step 1 — Bridge: name the shipped tools as a list (R1)

In `pi-agent/extensions/trellis-subagents-bridge/index.ts`:

- Replace the single constant with a list:

```ts
const SHIPPED_TOOLS = ["trellis_subagent"];
```

- Make `disableShippedTool` deactivate **every** name in it, and skip the
  `setActiveTools` call entirely when nothing matched:

```ts
const active = pi.getActiveTools();
if (!Array.isArray(active)) return;
const kept = active.filter((name) => !SHIPPED_TOOLS.includes(name));
if (kept.length === active.length) return;
pi.setActiveTools(kept);
```

- Keep the existing rationale comment and extend it: this list is the single
  source for shipped tool names, `doctor.sh` checks the generated extension
  against it, and adding a name is a one-line change.
- Touch nothing else. The role split, `publish()`, `contextKey()` parity and both
  constant notes stay exactly as they are — the predecessor's check round cleared
  them and they must not regress.

## Step 2 — `doctor.sh`: the drift check (R2, R3, R5)

Add to the existing `==> Trellis subagent bridge` section, following
`.trellis/spec/scripts/shell-guidelines.md`: `ok`/`warn`/`bad` only, no `set -e`,
never `exit` early, and branch on `${#arr[@]}` when the array may be empty.

1. `generated="$REPO_DIR/.pi/extensions/trellis/index.ts"`.
2. If it does not exist → `warn` that the Trellis adapters are not generated in
   this checkout, and skip (R5). This must not be a `bad`.
3. Extract the names, then handle the four states in `design.md` § Brittleness:
   - no names extracted **but** the file mentions `registerTool` → `bad`
     (formatting drift — never a silent `ok`);
   - any extracted name the bridge file does not mention → collect it, then `bad`
     naming each unexpected tool **and** `$bridge_src`, with an actionable
     instruction to add it to `SHIPPED_TOOLS`;
   - all names covered → `ok`, reporting the count.
4. The word-splitting over the extracted names is deliberate. Mark it
   `# shellcheck disable=SC2086` **and** add a plain-English comment, per
   `shell-guidelines.md` §`set -u` And Arrays.

## Step 3 — Prove the failure paths (AC2, AC3)

Do not assume these work; a check that always prints `ok` is the failure mode
this task exists to prevent.

1. Back up the generated file to `/tmp`, append a fake
   `name: "trellis_rogue",` line, run `./scripts/doctor.sh`, and capture the raw
   output and exit code. Expect a problem naming `trellis_rogue` and the bridge
   file, exit 1.
2. Restore from the backup, then reduce the file to a `registerTool` call with no
   extractable name and run doctor again. Expect `bad`, not `ok`.
3. Restore again and verify the file is byte-identical:
   `sha256sum .pi/extensions/trellis/index.ts` must equal the value recorded in
   `.trellis/.template-hashes.json`. `.pi/` is gitignored, so this hash check is
   the only proof the restore worked — do not skip it.
4. Paste all three raw outputs into the task notes.

## Step 4 — Documentation (R7, AC7)

`.trellis/spec/config/pi-resources.md`, bridge section: add that the tool list is
the single source for shipped tool names and that `doctor.sh` fails when the
generated extension registers a `trellis_*` tool the list does not name. Keep it
to a sentence or two — the section is already long.

## Step 5 — Verification chain (AC1, AC4, AC6)

```bash
bash -n setup.sh scripts/*.sh
node --check scripts/*.mjs
./setup.sh                       # twice; output identical
./scripts/sync.sh                # "Already up to date."
./scripts/doctor.sh              # "All good.", exit 0
git status --short               # clean
git diff --name-only             # no generated file
```

Also confirm by reading that no added line invokes `pi` or a model-facing tool
(AC4).

## Step 6 — Commit

One commit: bridge list, doctor check, spec sentence, task artifacts. The parent
session owns the commit.

## Done When

AC1–AC7 are checked with pasted evidence, the generated file's `sha256` was
re-verified after both mutation tests, and `doctor.sh` still ends in `All good.`
on the unmodified tree.

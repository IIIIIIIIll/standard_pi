# Research — Trellis CLI behaviour on a fresh clone

> Primary evidence for every claim in [prd.md](../prd.md) and
> [design.md](../design.md). Measured 2026-09-15 against commit `73cb810`,
> `@mindfoldhq/trellis@0.7.0-beta.4`, `.trellis/.version` = `0.7.0-beta.4`.

Every probe was a throwaway clone, created with `mktemp -d` + `rmdir` +
`git clone` (`rm -rf` is denied by the permission policy) and never the live
worktree.

---

## 1. A fresh clone has no Trellis surfaces

`.pi/` and `.agents/` are gitignored (`.gitignore:60-61`), so cloning recovers the
tracked `.trellis/` but none of the CLI-generated adapters.

```bash
P="$(mktemp -d /tmp/probe.XXXXXX)"; rmdir "$P"
git clone -q /home/tan/my_pi_setup "$P"; cd "$P"
ls -la .pi                       # ls: cannot access '.pi': No such file or directory
trellis platforms                # Configured platforms: Pi Agent (pi) — .pi
```

| Surface | After clone |
| --------- | ------------- |
| `.pi/settings.json` | missing |
| `.pi/extensions/trellis/index.ts` | missing |
| `.pi/agents/*.md` | 0 files |
| `.pi/prompts/*.md` | 0 files |
| `.agents/skills/*` | 0 entries |

`trellis platforms` still reports Pi as configured, because it reads the tracked
`.trellis/config.yaml`, not `.pi/`.

---

## 2. `trellis update` cannot repair it

```bash
trellis update --dry-run < /dev/null
```

Relevant output:

```text
  Deleted by you (preserved):
    ✕ .pi/prompts/trellis-start.md
    ✕ .pi/prompts/trellis-continue.md
    ✕ .pi/prompts/trellis-finish-work.md
    ✕ .agents/skills/trellis-before-dev/SKILL.md
    … (every .agents/skills/trellis-* file)
    ✕ .pi/agents/trellis-check.md
    ✕ .pi/agents/trellis-implement.md
    ✕ .pi/agents/trellis-research.md
    ✕ .pi/extensions/trellis/index.ts
    ✕ .pi/settings.json

  User data (preserved):
    ○ .trellis/workspace/
    ○ .trellis/tasks/
    ○ .trellis/spec/

✓ Already up to date!
```

`trellis update --force --dry-run` produces the same classification. The manifest
`.trellis/.template-hashes.json` is tracked, so on a clone it claims these files
were generated — and `update` reads their absence as an intentional user deletion
rather than as missing output.

**Conclusion:** `update` is the wrong command for a fresh clone. `init` is the
only one that writes them back.

---

## 3. `trellis init` restores everything correctly

```bash
trellis init --pi -y -s < /dev/null
```

| Surface | Result |
| --------- | -------- |
| `.pi/settings.json` | restored, **byte-identical** to the live file (`diff` clean) |
| `.pi/extensions/trellis/index.ts` | restored |
| `.pi/agents/` | `trellis-check.md`, `trellis-implement.md`, `trellis-research.md` |
| `.pi/prompts/` | `trellis-continue.md`, `trellis-finish-work.md`, `trellis-start.md` |
| `.agents/skills/` | 9 dirs: before-dev, brainstorm, break-loop, channel, check, meta, session-insight, spec-bootstrap, update-spec |

Restored `.pi/settings.json` content (identical to the repo's live file):

```json
{
  "enableSkillCommands": true,
  "extensions": [
    "./extensions/trellis/index.ts"
  ],
  "prompts": [
    "./prompts"
  ]
}
```

---

## 4. `init` also produces four unwanted artefacts

Fresh clone, `trellis init --pi -y -s`:

```text
 M .trellis/.template-hashes.json
?? .trellis/spec/backend/
?? .trellis/spec/frontend/
?? .trellis/tasks/00-join-yuanhai-tan/
?? .trellis/workspace/Yuanhai Tan/
```

| # | Artefact | Detail |
| --- | ---------- | -------- |
| 1 | `.trellis/spec/{backend,frontend}/` | 13 placeholder files. `.trellis/spec/index.md:35` says: "An earlier `trellis init` generated those template directories; they were deleted during bootstrap because no such layers exist here. Do not recreate them." |
| 2 | `.trellis/tasks/00-join-<name>/` | An `in_progress` onboarding task (`prd.md` + `task.json`), created because `.trellis/.developer` was absent — i.e. the "new developer joining" branch. |
| 3 | `.trellis/workspace/Yuanhai Tan/` | A second developer directory. The name comes from `git config user.name` (`Yuanhai Tan`) — note trellis keeps the space, while the tracked directory is `yuanhai.tan`. |
| 4 | `.trellis/.template-hashes.json` rewritten | `hashes` 87 → 86 entries. The single removal is `AGENTS.md`; **nothing is added** for `backend/` or `frontend/`. |

### 4a. The manifest delta is exactly one removal

```js
// before = committed .trellis/.template-hashes.json
// after  = the same file after trellis init
{ __version, hashes }        // top-level keys
BEFORE entries: 87   AFTER entries: 86
ADDED   (0):
REMOVED (1):
  - AGENTS.md
CHANGED (0):
```

Two consequences:

- Deleting `spec/backend/` and `spec/frontend/` leaves **no** manifest
  inconsistency, because `init` never recorded them.
- Restoring the manifest is **required**, not cosmetic: without it `AGENTS.md`
  silently leaves the template-tracked set, so `trellis update` stops managing it.

---

## 5. Seeding `.trellis/.developer` suppresses artefacts 2 and 3

```bash
printf 'name=yuanhai.tan\ninitialized_at=%s\n' "$(date -Iseconds)" > .trellis/.developer
trellis init --pi -y -s < /dev/null
```

```text
 M .trellis/.template-hashes.json
?? .trellis/spec/backend/
?? .trellis/spec/frontend/
```

No `00-join-*` task, no new workspace directory. `git status` is down to two
artefacts.

Seeding a name that has **no** workspace directory behaves the same — no directory
is created:

```bash
printf 'name=tan\ninitialized_at=%s\n' "$(date -Iseconds)" > .trellis/.developer
trellis init --pi -y -s < /dev/null
ls .trellis/workspace/     # index.md  yuanhai.tan     (no 'tan')
```

So the identity value only decides `.trellis/.developer`'s content and the
attribution of future session records. It does not, on its own, create
directories.

---

## 6. `-u NAME` does not overwrite an existing `.developer`

```bash
printf 'name=yuanhai.tan\ninitialized_at=2026-09-13T19:33:09.178801\n' > .trellis/.developer
trellis init --pi -y -s -u tan < /dev/null
cat .trellis/.developer
```

```text
👤 Developer: tan
```

```text
name=yuanhai.tan
initialized_at=2026-09-13T19:33:09.178801
```

The file is byte-identical: `-u` only sets the name `init` **echoes**. The
`echo` follows `-u` while the file keeps its existing value, which is why the
design seeds the file *and* passes `-u` (so the CLI's own output is honest),
rather than relying on either alone.

Without seeding, `-u` alone takes the new-developer branch and creates the join
task — the same failure as the no-flag case.

---

## 7. Environment facts used by the design

```bash
id -un                 # tan          (also $USER, $LOGNAME, whoami)
git config user.name   # Yuanhai Tan  <- the cause of artefact 3
git config user.email  # 21286615+IIIIIIIIll@users.noreply.github.com
cat .trellis/.developer # name=yuanhai.tan
ls .trellis/workspace/  # index.md  yuanhai.tan
trellis --version       # 0.7.0-beta.4   (bare single line)
command -v trellis      # ~/.nvm/versions/node/v22.22.3/bin/trellis -> @mindfoldhq/trellis
compgen -G '.pi/prompts/*.md'                  # works, used for the completeness test
compgen -G '.agents/skills/trellis-*/SKILL.md' # works
date -Iseconds          # 2026-09-15T21:14:19+08:00
```

`.trellis/.developer`'s format is owned by trellis, and `.trellis/config.yaml`
documents a non-identity line in the same file:

> A per-developer override lives in the gitignored `.developer` file as a
> `workflow=<id>` line and takes precedence over this.

That is why the design rewrites the `name=` line **in place** instead of
regenerating the file: a wholesale rewrite would silently delete a developer's
workflow override.

---

## 8. Reproducing all of this

```bash
P="$(mktemp -d /tmp/trellis-research.XXXXXX)"; rmdir "$P"
git clone -q /home/tan/my_pi_setup "$P"; cd "$P"

trellis update --dry-run < /dev/null            # §2 — cannot restore
grep -c '"hashes"' .trellis/.template-hashes.json
trellis init --pi -y -s < /dev/null             # §3 + §4
git status --short; ls .trellis/spec/; ls .trellis/tasks/

printf 'name=tan\n' > .trellis/.developer       # §5 — the fix
printf '\n' >> .trellis/.template-hashes.json   # §4a — verify the restore path
```

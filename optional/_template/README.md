# optional / _template

Scaffold for a new optional plugin bundle. Copy it with:

```bash
~/my_pi_setup/scripts/optional.sh scaffold <name>
```

Then edit `optional/<name>/manifest.json`:

| Key | Meaning |
|-----|---------|
| `packages` | Package sources added to `settings.json` when enabled (same syntax as `pi install`: `npm:`, `git:`, or a path). |
| `settings` | Settings keys written when enabled (e.g. `defaultProvider`, `defaultModel`). Removed again on disable. |

Directories starting with `_` are ignored by the tooling.

# optional / opencode-go

Only install this if you are on an **OpenCode Zen Go** subscription.

The package is a status-bar extension: it shows rolling 5-hour / weekly / monthly
quota usage and adds the `/go-usage` and `/go-status` commands. It does not define
the provider itself — Pi fetches the `opencode-go` model catalog from
`https://pi.dev/api/models/providers/opencode-go` on demand.

## Enable

```bash
~/my_pi_setup/scripts/optional.sh enable opencode-go
```

This records the choice in `~/.pi/agent/.pi-setup-state.json` and re-renders
`~/.pi/agent/settings.json`, adding:

- package `npm:@oscarfalero/pi-opencode-go@0.1.1`
- `defaultProvider: "opencode-go"`, `defaultModel: "deepseek-v4.1-flash"`

## Credentials

Add the key to `~/.pi/agent/auth.json` (gitignored):

```json
{
  "opencode-go": {
    "type": "api_key",
    "key": "your-key-here"
  }
}
```

`chmod 600 ~/.pi/agent/auth.json` afterwards.

## Disable

```bash
~/my_pi_setup/scripts/optional.sh disable opencode-go
pi remove npm:@oscarfalero/pi-opencode-go   # optional: drop installed files
```

Disabling restores whatever `defaultProvider` / `defaultModel` your core settings
define, so set those if you want a different default.

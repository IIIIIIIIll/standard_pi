# Evidence

Raw output behind the findings in `../omp-agent-hub-findings.md`.

| File | What it is |
| --- | --- |
| `tsc-errors-pass1.txt` | 47 type errors from the first compile pass — the unadapted state |
| `tsc-errors-final.txt` | 0 errors after applying the nine adaptation deltas (empty file is the result) |
| `tsc-final-stdout.txt` | Final `tsc -p tsconfig.json` stdout, also empty on success |
| `render-output.txt` | 134 lines of real roster output: 120-column two-pane, 120-column tree, 60-column roster |

The harness that produced these is session-local at `/tmp/harness` (deliberately not committed — this
task records findings, not code). Reproduction steps are in the findings document; `adapt.patch` in
that directory is the complete, reviewable record of the adaptation (505 lines across 5 files).

To re-check after a pi or pi-subagents upgrade:

```bash
HUBPORT_DIR=/tmp/hubport-test OMP_SRC=/home/tan/agent_harness_test/oh-my-pi /tmp/harness/reproduce.sh
```

Expected: `tsc errors: 0` and a 134-line `render-output.txt`.

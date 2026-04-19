# Eval blocker scan — 2026-03-16

Tried to select a completed, unevaluated session in `.state/sessions/history/` but the scan returned **no candidates** (0 completed sessions missing an evaluation JSON).

Command used:
```bash
node -e "..."  # lists completed sessions without .state/evaluations/<id>.json
```

Next steps if this persists:
- confirm history directory path and meta.json schema
- broaden to non-"completed" statuses eligible for evaluation (e.g., error/timeout)
- check if evaluations are being written under a different naming convention

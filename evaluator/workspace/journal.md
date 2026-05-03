# Evaluator heartbeat journal (2026-05-03)

## Pipeline liveness / coverage spot-check

### Findings (DB is canonical)
- `evaluations` table is being written recently (max createdAt: **2026-05-03 04:43:17**).
- `sessions` table shows much more recent activity (max startedAt: **2026-05-03 05:20:19**).
- Approx evaluation lag: **~0.62h (37 min)** between latest session and latest evaluation.
- Throughput mismatch (last 1h): **sessions=69 vs evaluations=1** → indicates evaluation coverage is far below session creation rate.

### Legacy artifact path drift
- `.state/evaluations/` contains only old `task_tree_*.json` files with newest mtime **2026-03-24**.
- Conclusion: `.state/evaluations/` is stale as an output directory; DB is fresh. Treat as legacy-output-path drift, not full pipeline failure.

### Actions recommended
- Investigate whether `evaluate-session-llm` is intentionally sampling (e.g., only completed sessions, only certain agents, or a budget cap).
- If not intentional: adjust cron scope/filters or scheduling so eval count tracks session volume.
- If intentional: add an explicit metric/label documenting sampling rate and expected lag so “low coverage” is not surprising.

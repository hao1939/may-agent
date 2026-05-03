# Evaluator heartbeat — 2026-05-03

## Checks performed

### 1) Evaluation pipeline recency (DB is canonical)
- `evaluations.max(createdAt)` is recent: **2026-05-03 05:12:31** (all evals), and **2026-05-03 05:48:04** for non-heuristic evals.

### 2) Coverage snapshot
- Ended sessions: **9812**
- Ended sessions with an evaluation row: **2182** (≈22.2% coverage)

Breakdown by session kind:
- `call`: 5642 sessions, 1984 evaluated (≈35.2%)
- `job`: 4168 sessions, 198 evaluated (≈4.8%)

Breakdown by agent+kind (top rows):
- `optimizer/call`: 2489 sessions, 723 evaluated
- `coach/call`: 1906 sessions, 750 evaluated
- `amy/job`: 1003 sessions, 185 evaluated
- `tech-lead/call`: 117 sessions, 13 evaluated
- `may/chat`: 2 sessions, 0 evaluated

### 3) Legacy artifact path sanity
- `.state/evaluations/` has many files with mtimes in Mar/Apr; DB shows fresh writes. Treat as **legacy output-path drift**, not liveness failure.

## Interpretation
- Pipeline is alive (new evaluations being written), but **coverage is structurally low**, especially for `job` sessions.
- A large fraction of missing evaluations are `evaluator` agent sessions; likely intentional exclusions (self-eval avoidance, job kind filters), but this should be made explicit in criteria/docs.

## Recommended follow-ups (not executed in this heartbeat)
1. Confirm the evaluation selection/filter logic for `kind='job'` sessions (are they being skipped by policy or by bug?).
2. Decide whether `job` sessions should receive heuristic evaluations at minimum to improve observability.
3. If `.state/evaluations/` is still used by any consumers, update that pipeline or deprecate the path to avoid confusion.

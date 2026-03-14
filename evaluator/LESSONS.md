# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Project root is `/app`. Relative paths or `/app/...`.
- **Truncation Awareness**: Transcript truncation (`[REVIEWER NOTE...]`) is NOT agent misbehavior.

## Scoring Protocol
- **Read Full Transcript**: Use `offset`/`limit` to read the END. Deliverables appear there.
- **No Running Sessions**: Only evaluate `done` or `error` sessions from `.state/sessions/history/`.
- **Zero Tolerance**: 0 productive tool calls = 0 score. No "participation points".

## Heartbeat Execution
- **ENOENT Is Not Terminal**: If a workspace file doesn't exist (e.g., `consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl`), treat it as "no data yet" and move on. Do NOT stall or treat missing optional files as errors.
- **Never Silently Pivot Targets**: If a session ID cannot be found at its expected path, use `ls` or `find` to confirm whether it exists under `.state/sessions/history/`. If it truly doesn't exist, explicitly note "session X not found" and pick a different unevaluated session — do NOT silently substitute a different session as if it were the original target. Every evaluation must clearly state which session ID it evaluated.
- **ENOENT on Session Path = Pick Next, Not Stop** *(3rd recurrence — mandatory)*: When you get ENOENT reading a session's `meta.json` or `session.jsonl`, you MUST immediately pick the next unevaluated session from your queue and evaluate that instead. The sequence is: (1) note "session X not found", (2) pick next session from queue, (3) evaluate it fully. Do NOT end the heartbeat after noting a missing session — that violates "Evaluate At Least One Session Per Heartbeat". A missing session is not an excuse to skip evaluation entirely.
- **Complete All Heartbeat Steps**: Follow every step in your heartbeat spec. Don't skip calibration (step 4) or todo checks (step 2). A heartbeat that skips steps accumulates blind spots over time.
- **Evaluate At Least One Session Per Heartbeat**: When unevaluated sessions exist (step 3), you MUST pick at least one and evaluate it. Don't just count the queue and report the number — that produces zero value. Pick the most recent unevaluated `done` or `error` session and evaluate it.
- **Progress Over Perfection**: A heartbeat that evaluates 1 session is infinitely more valuable than one that counts 1700 unevaluated sessions and evaluates zero.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Output Integrity**: Keep JSON strict. Optimizer relies on schema.
- **One Eval Per Session**: Don't batch evaluations from one transcript.

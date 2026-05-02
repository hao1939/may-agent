# Evaluator heartbeat — 2026-05-02

## Checks run (DB is canonical)

### Evaluation pipeline recency
- sessions max startedAt: **2026-05-02T09:49:56.929Z**
- evaluations max createdAt: **2026-05-02T08:12:32.910Z**
- 24h volume: sessions=**3973**, evaluations=**552**
- overall coverage: evaluations/sessions = **2380/8358 = 0.285**

### Per-agent coverage (last 24h, status='done')
Lowest coverage:
- evaluator: **886 sessions, 0 evals (0.000)**
- optimizer: **1420 sessions, 211 evals (0.149)**
- amy: **608 sessions, 98 evals (0.161)**
- coach: **724 sessions, 162 evals (0.224)**

Note: `.state/evaluations/` contains recent `s_*.json` (Apr 29) but `task_tree_*` artifacts are older (Mar 24), consistent with “legacy output drift” rather than DB pipeline failure.

## Hypotheses
1. `eval-poller` is running and writing evaluations, but only for a subset of session kinds/agents.
2. Evaluator-agent sessions might be intentionally excluded to avoid self-eval loops; confirm this is policy vs bug.
3. Low overall coverage (28.5%) suggests either:
   - high volume of sessions that are meant to be skipped (gym/heartbeat), or
   - selection logic is too narrow.

## Suggested next actions (for May / tech-lead)
- Confirm eval selection logic in `eval-poller` / `evaluateStandaloneSession()`:
  - what `kind`/`source`/agent filters exist?
  - are gym scenarios excluded? are heartbeat sessions excluded?
- If evaluator sessions are excluded, ensure it’s explicit and documented; otherwise coverage=0 for evaluator indicates a bug/regression.
- Add/restore a metric for evaluation coverage (overall + by-agent) so this is alertable.

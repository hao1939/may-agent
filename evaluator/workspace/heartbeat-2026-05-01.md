# Evaluator Heartbeat — 2026-05-01

## 1) Session eval pipeline liveness (Process #5)
- DB canonical check: `MAX(evaluations.createdAt)=1777670739447` (from `SELECT MAX(createdAt) FROM evaluations`).
- `MAX(sessions.startedAt)=1777670846629` (from `SELECT MAX(startedAt) FROM sessions`).
- Lag between latest session start and latest evaluation: **114,803 ms (~115s)**.
  - Evidence: python computed `lag_ms 114803`.
- 24h volume: `sessions_last_24h=3233`, `evaluations_last_24h=726` → coverage ~22.5% overall.
  - Per-agent coverage snapshot (last 24h):
    - amy: 134/832 (~16%)
    - optimizer: 201/770 (~26%)
    - coach: 219/695 (~31%)
    - tech-lead: 10/28 (~36%)
    - may: 33/52 (~63%)
    - bob: 37/49 (~76%)
    - evaluator: 0/659 (expected; self-eval avoided)

Interpretation:
- **Pipeline appears live** (lag ~2 minutes).
- Coverage is **selective / partial**; likely by design (cost control), but could be too low if we expect near-complete evaluation.

## 2) Active session monitoring (Periodic task #2)
- Ran `monitor-session.cjs --running` → **1 STALL** detected:
  - `s_1777626616591_0` (amy) idle **737 min**, recommended action: **kill**.

## 3) Patrol status (Periodic task #3)
- Ran `patrol.cjs` → `status=CRITICAL` due to **Missing compliance-snapshot.json** baseline.
  - This is a known degraded-mode condition (not a hash mismatch event).

## 4) LLM eval liveness (Process #15)
- DB check: no tables matching `*llm*` (`sqlite_master LIKE '%llm%'` returned `[]`).
- Conclusion: "LLM eval" appears **disabled/unimplemented/renamed**; periodic docs should continue treating Process #15 as not currently active.

## Follow-ups suggested
1. Consider whether evaluation coverage (~22.5% last 24h) is sufficient; if target is higher, we need either (a) more budget, or (b) narrower session filtering that matches priorities.
2. Amy stalled session: recommend notifying supervisor to kill if still running.
3. Compliance snapshot baseline missing: needs owner (Bob) decision on generating/committing `agents/shared/compliance-snapshot.json`.

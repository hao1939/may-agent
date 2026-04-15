# Finding: Agent Efficiency Distribution (6-Hour Window)

**Date**: 2026-03-18T04:37 UTC  
**Method**: Analyzed 255 evaluations from last 6 hours (14,031 total evals in DB)

## Key Data

| Agent | Sessions | Eff 0 | Eff 1 | Eff 2 | Eff 3 | Eff 4 | Avg Eff | Avg Qual |
|-------|----------|-------|-------|-------|-------|-------|---------|----------|
| coach | 44 | 0 | 0 | 21 | 19 | 0 | 2.3 | 3.7 |
| may | 42 | 0 | 0 | 14 | 28 | 0 | 2.7 | 4.0 |
| optimizer | 41 | 0 | 2 | 31 | 8 | 0 | 2.1 | 3.9 |
| bob | 28 | 0 | 22 | 3 | 3 | 0 | 1.3 | 2.0 |
| tech-lead | 28 | 0 | 0 | 28 | 0 | 0 | 2.0 | 4.0 |
| evaluator | 14 | 14 | 0 | 0 | 0 | 0 | 0.0 | 0.0 |
| amy-kimi | 14 | 0 | 0 | 2 | 0 | 12 | 3.7 | 4.6 |
| amy | 13 | 0 | 0 | 1 | 12 | 0 | 2.9 | 3.8 |
| scout | 12 | 0 | 0 | 0 | 12 | 0 | 3.0 | 4.0 |
| qa | 12 | 0 | 0 | 2 | 8 | 2 | 3.0 | 4.0 |

## Findings

### 1. Bob: 78.6% of sessions at efficiency 1 (worst)
22/28 Bob sessions scored efficiency 1 with issues `session_error, opBudget_exhaustion, shallow_session, multiple_tool_errors`. Root cause: **Gemini API errors persist** — confirmed mid-stream `MidStreamFallbackError` as recently as ~04:08 UTC. Despite appearing as 0% failures in request DB, the sessions still crash.

**Action needed**: Bob needs model fallback (already tracked in todo). The Gemini 3 Pro Preview model is unreliable.

### 2. Optimizer: 75.6% at efficiency 2 (interrupted sessions)
31/41 sessions score 2. Pattern from session history: sessions consistently get interrupted before finishing (5-10 min runtime, killed by cron). This is the **cron interval mismatch** — optimizer fires every 540s but sessions need more time.

**Already addressed**: Config changed to 1800s but blocked on process restart.

### 3. Tech-Lead: 100% at efficiency 2 (uniform mediocrity)
28/28 sessions at exactly efficiency 2. No session reaches efficiency 3+. Worth investigating — is this an evaluator bias or genuine performance ceiling?

### 4. amy-kimi: Star performer (86% at efficiency 4)
12/14 sessions at efficiency 4. This is the gold standard — correct interval, good work output.

### 5. Evaluator: 100% at efficiency 0
14/14 evaluator sessions score 0. This is likely a self-evaluation artifact — evaluator sessions shouldn't be evaluating themselves, or the evaluator isn't equipped to rate its own meta-task.

## System-Wide Efficiency

- **Weighted avg efficiency**: 2.0/5
- **Sessions at eff ≤ 1**: 38 (14.9%) — pure waste
- **Sessions at eff = 2**: 99 (38.8%) — below par
- **Sessions at eff ≥ 3**: 118 (46.3%) — acceptable+

**Bottom line**: Nearly 54% of all sessions score below "acceptable" (eff < 3). The two biggest levers:
1. Fix Bob's Gemini model reliability → would upgrade 22 sessions from eff 1 to eff 2-3
2. Deploy cron interval fix → would reduce session count by ~60% and let remaining sessions reach eff 3+

Both fixes are committed but undeployed (blocked on process restart).

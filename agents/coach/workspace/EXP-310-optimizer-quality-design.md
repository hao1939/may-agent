# EXP-310: Optimizer Quality Improvement — Compliance Reinforcement

## Problem
Optimizer has worst JS quality (0.487, n=356). Top failure patterns from low-scoring sessions:
1. **INSTRUCTION_NONCOMPLIANCE**: Not outputting GOAL/PLAN/DONE WHEN format (4/5 low sessions)
2. **VERIFICATION_FAILURE**: Claiming changes without tool evidence
3. **SHALLOW_EXECUTION**: Not performing core heartbeat work

Same pattern that plagued coach pre-M14/M18.

## Root Cause
Optimizer has OUTPUT FORMAT section in heartbeat.md but lacks:
- "EVEN IN WORK SESSIONS" reinforcement (added to coach, missing from optimizer)
- The stronger phrasing from coach's heartbeat.md

## Treatment
Add to `agents/optimizer/heartbeat.md`:
1. Add "EVEN IN WORK SESSIONS" clause under OUTPUT FORMAT
2. Add "Do NOT pivot to a new task mid-session" to EXECUTION RULES
3. Increase ANTI-SHALLOW minimum from 8 to 10 tool calls (match coach)

## Baseline
- Optimizer JS quality: 0.487 (n=356, last 48h)
- INSTRUCTION_NONCOMPLIANCE: ~80% of low-quality sessions

## Target
- JS quality ≥ 0.55 (post-treatment 48h)
- INSTRUCTION_NONCOMPLIANCE rate < 30%

## Measurement
48h post-deployment, query:
```sql
SELECT round(avg(quality),3), count(*) FROM evaluations
WHERE agent='optimizer' AND evaluatedByHeuristic=0
AND createdAt > <deployment_ts>
```

## Status: DEPLOYED ✅ (Sep 1) — all 3 treatments confirmed in optimizer/heartbeat.md. Awaiting measurement (evaluator dead).

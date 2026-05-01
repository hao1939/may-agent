# EXP-315: Bob Output Format Enforcement

## Problem
Bob has ANTI-SHALLOW rule (deployed EXP-290, +32pp quality improvement) but lacks OUTPUT FORMAT enforcement in heartbeat.md. Coach and optimizer both saw quality lifts from this treatment. Bob's current quality is 0.671 (n=48 post-EXP-290) — good, but may have ceiling room.

Only 2/6 agents have OUTPUT FORMAT in heartbeat.md (coach, optimizer). Bob is the next logical candidate because:
1. Already proven responsive to heartbeat.md interventions (EXP-290: +32pp)
2. Has active heartbeat sessions (data will exist for measurement)
3. Pattern is proven across 2 agents already (coach: 0.24→0.70, optimizer: 0.487→TBD)

## Root Cause Hypothesis
Without OUTPUT FORMAT, bob heartbeat sessions may start executing without a plan, leading to:
- Drift mid-session (no stated GOAL to anchor to)
- Weak finish() evidence (no DONE WHEN to check against)
- Lower evaluator scores on INSTRUCTION_NONCOMPLIANCE dimension

## Treatment
Add to `agents/bob/heartbeat.md` (at top, before existing content):

```markdown
## OUTPUT FORMAT (MANDATORY — EVEN IN WORK SESSIONS)
Your FIRST output must be:
```
GOAL: [one sentence]
PLAN:
1. [action]
2. [action]  
3. [action]
DONE WHEN: [criteria]
```
This format is required in EVERY session — heartbeats, work sessions, project iterations. No exceptions.
```

## Baseline
- Bob JS quality: 0.671 (n=48, post-EXP-290 Aug 2024)
- Note: evaluator dead since Apr 30, so fresh baseline unavailable

## Target
- Bob JS quality ≥ 0.72 (post-treatment)
- GOAL/PLAN/DONE WHEN compliance ≥ 80% in heartbeat sessions

## Control
- No changes to bob/context.md (already has ANTI-SHALLOW)
- Only heartbeat.md gets OUTPUT FORMAT section

## Measurement
When evaluator resumes:
```sql
SELECT round(avg(quality),3), count(*) FROM evaluations
WHERE agent='bob' AND evaluatedByHeuristic=0
AND createdAt > <deployment_ts>
```

Manual check: grep bob heartbeat session logs for GOAL/PLAN/DONE WHEN presence.

## Predecessors
- EXP-290 (bob anti-shallow): POSITIVE +32pp
- EXP-275 (optimizer quality): deployed preventively
- EXP-310 (optimizer OUTPUT FORMAT): DEPLOYED, awaiting measurement
- Coach-quality project M14: OUTPUT FORMAT → coach quality 0.24→0.70

## Status: DESIGNED — needs deployment to bob/heartbeat.md

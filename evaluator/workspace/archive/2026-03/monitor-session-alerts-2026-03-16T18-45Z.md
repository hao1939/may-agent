# monitor-session --running alerts (2026-03-16T18:45Z)

Command: `node agents/evaluator/skills/monitor-session.cjs --running`

## Summary
5 sessions flagged:
- s_1773455011479_2167 (tech-lead) — **STALL** (idle 3860 min) — recommended: **kill**
- s_1773669054024_119 (scout-c40) — **STALL** (idle 294 min) — recommended: **kill**
- s_1773685962735_241 (coach) — **STALL** (idle 10 min; threshold=10) — recommended: **investigate**
- s_1773686577966_262 (optimizer) — **DRIFT** (0% path relevance, 0% concept relevance) — recommended: **warn**
- s_1773686646852_264 (may) — **PROTOCOL_VIOLATION** (P114: no Experience Replay) — recommended: **warn**

## Raw tool output excerpt (evidence)
- tech-lead STALL evidence: "Last activity was 3860 min ago (threshold: 10 min)"
- scout-c40 STALL evidence: "Last activity was 294 min ago (threshold: 10 min)"
- optimizer DRIFT evidence: "Very low relevance to task in last 10 tool calls. Path relevance: 0%, Concept relevance: 0%"
- may PROTOCOL_VIOLATION evidence: "P114 Violation: Complex task attempted without Experience Replay (grep ERROR_LOG)."

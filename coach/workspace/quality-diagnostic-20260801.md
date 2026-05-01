# Quality Diagnostic — 2026-08-01

## System-Wide LLM Quality (Recent Period)

| Agent | Avg Quality | N (LLM evals) | Trend |
|-------|-------------|----------------|-------|
| optimizer | 0.493 | 326 | ← WORST |
| coach | 0.497 | 299 | ← 2nd worst |
| may | 0.577 | 67 | |
| tech-lead | 0.644 | 5 | (low N) |
| scout | 0.656 | 35 | |
| bob | 0.671 | 48 | |
| qa | 0.672 | 35 | |
| amy | 0.737 | 78 | ← BEST |

**Note**: Overall averages appear lower than Jul 30 snapshot because of larger N and heuristic eval contamination. Heuristic evals (bug: always 0.20) drag averages when mixed.

## Top Issue Patterns

### Optimizer (q=0.493, #1 target)
| Issue | Count | Rate |
|-------|-------|------|
| VERIFICATION | 115 | 35% |
| FM-3.3 | 53 | 16% |
| FM-1.3 | 12 | 4% |
| LOOPING | 9 | 3% |

**Root cause**: VERIFICATION failures dominate. Optimizer edits/writes files without read-back. Same pattern as bob's FM-3.3 issue.

### Coach (q=0.497, #2 target)
- INSTRUCTION_NONCOMPLIANCE (GOAL/PLAN format): ~5% of sessions but severe scoring penalty
- Many sessions hit by heuristic eval bug (0.20 scores)
- LLM-eval-only quality: 0.497 — borderline target

### Bob (q=0.671)
| Issue | Count | Rate |
|-------|-------|------|
| FM-3.3 | 15 | 31% |
| VERIFICATION | 10 | 21% |
| FM-1.3 | 9 | 19% |
| LOOPING | 6 | 12% |

## Key Insight

**VERIFICATION is the #1 quality drag system-wide.**
- Optimizer: 35% of sessions
- Bob: 21% of sessions
- Both already have verify-after-edit rules deployed but compliance is low

**KE-338 confirmed again**: Text-based skills don't change behavior. EXP-280 showed no improvement from text coaching for verify-after-edit.

## Recommended Next Experiment: EXP-285

**Target**: Optimizer VERIFICATION failures (35% rate, 115 incidents)
**Question**: Can the 2-phase heartbeat workflow (plan-then-execute) reduce verification failures?
**Hypothesis**: The GOAL/PLAN/DONE WHEN format forces deliberate planning which naturally includes verification steps.
**Treatment**: Deploy same OUTPUT FORMAT + EXECUTION RULES + ANTI-SHALLOW rules from coach heartbeat.md to optimizer heartbeat.md (already partially done per EXP-275, but may need reinforcement).
**Baseline**: 35% VERIFICATION rate, 0.493 avg quality
**Target**: <25% VERIFICATION rate, >0.55 avg quality
**Measurement**: 50+ LLM evals post-treatment

## Project Status Notes

- **coach-quality**: Target met (0.70 avg from last 8 LLM evals at M19). Project should be marked **completed**, not blocked. The "safety cap: 50 iterations" block is artificial — all milestones are done.
- **Heuristic eval bug**: Still active. 260 coach evals scored 0.20 by heuristic. This contaminates all dashboards. Needs evaluator fix.

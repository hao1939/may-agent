# Heartbeat Analysis: Zombie Fix Stall + Agent Quality Gap — 2025-05-03 17:17 UTC

## 1. The Zombie Problem Is Still Unfixed (Meta-Zombie)

**Status**: The zombie task repetition problem (ANALYSIS-zombie-task-repetition-2025-05-03.md) was diagnosed, a solution designed (DESIGN-dispatch-dedup-guard-v2.md), and an experiment scoped (EXP-268). **None have shipped.** This is the #1 waste source in the system.

Current evidence from this heartbeat's system_status:
- Bob alone has ~50+ interrupted sessions with repeated task descriptions
- "Ship EXP-188 finish-guard", "Resume context-learning project", "Process scout deep-dives" — all still appearing
- Coach has ~15+ interrupted EXP-188 sessions from the same period

**Action needed**: This is a tech-lead/may infrastructure fix, not a bob task. Escalating via notification.

## 2. Agent Quality Ranking (from analysis.md, 24h window)

| Agent | Good% | Key Issue |
|-------|-------|-----------|
| may | 97.7% | Benchmark — orchestration role helps |
| amy-kimi | 87.3% | Solid |
| scout | 87.8% | Solid |
| coach | 86.8% | OK |
| coder | 86.7% | Small sample (30) |
| bob | 85.8% | 49 needs_improvement sessions |
| tech-lead | 85.0% | 53 needs_improvement sessions |
| optimizer | 84.6% | 33 needs_improvement sessions |
| qa | 80.6% | 37 needs_improvement — worst main agent |
| amy | 78.5% | 18 NI — worst overall |

**Pattern**: Agents doing repetitive/structured work (scout, amy-kimi) score higher. Agents doing open-ended/investigative work (qa, amy, optimizer) score lower. This suggests the eval rubric may penalize exploration, or these agents need better task scoping.

## 3. Hypothesis: H-222 — Task Scoping Improves Quality Scores

**Claim**: Agents with lower quality scores receive vaguer task descriptions. Tighter task scoping (specific deliverables, exit criteria) would improve scores by 5-10pp.

**Test**: Compare task description specificity (word count of success criteria, presence of file paths) against eval scores across agents. If correlation > 0.5, design an intervention.

**Quick validation**: amy (78.5%) receives broad creative tasks. may (97.7%) receives/gives structured dispatch tasks. This directionally supports the hypothesis.

## 4. Recommended Next Actions

1. **ESCALATE**: Zombie dispatch-dedup-guard to tech-lead (the fix exists, just needs implementation)
2. **INVESTIGATE**: Pull 5 amy "needs_improvement" eval results to check if task vagueness is the cause
3. **DESIGN**: If H-222 validated, create a "task-specificity-gate" that requires success_criteria for forked tasks

## 5. Project Status

- **agent-system-literacy**: closed, 5/6 milestones. No action needed.
- No active projects — should propose one if H-222 validates.

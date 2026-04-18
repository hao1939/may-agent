# Pattern Synthesis — 2026-04-01

**Period**: 2026-03-25 to 2026-04-01 (7 days)
**Data**: ~1000 sessions, 12 convention checks per session, evaluation verdicts

## Key Patterns

### 1. Tech-Lead Transient Failure Cascade (Mar 30, 12:44-14:05)
**Severity**: HIGH (14 needs_improvement in ~80 minutes)
**Root cause**: Tech-lead produced "blank messages" / "no tool calls" in 14+ sessions during a ~2 hour window. All other agents were unaffected during the same period.
**Pattern**: Model-level transient failure. Sessions 21-42 all show `TASK_NONCOMPLETION` — the model simply didn't produce actions. This resolved by Mar 31 and tech-lead is 6/6 good since.
**Implication**: Transient model outages can produce concentrated clusters of bad evaluations. These should be filtered from trend analysis. Consider a convention/handler that detects "blank session" patterns and marks them as infrastructure failures rather than agent failures.

### 2. Convention Check System Reached Steady State
**Metric**: 98.0% pass rate (6h, N=34 sessions, 404 checks). 95.2% over 24h.
**Details**: 9/12 conventions at 100% in recent 6h. All calibration fixes deployed and confirmed working:
- C1.4/C1.7 finish-retry fix (last finish() only)
- C8.2 finish-retry fix (same pattern)
- C3.2 workspace exemptions (coach, optimizer added)
- Interrupted session skip (C1.4, C8.2, C1.5, C1.7)
- Retroactive self-healing for race conditions
**Remaining gaps**: All model-level (amy-kimi Kimi C8.2 JSON, C1.1 read-before-edit behavioral).

### 3. Agent Eval Tiers (Last 48h, excluding evaluator)
| Tier | Agents | Good Rate |
|------|--------|-----------|
| A (>90%) | scout (94%), qa (95%), bob (93%), optimizer (93%), may (91%) | Reliably productive |
| B (80-90%) | master (86%), amy-kimi (82%) | Solid with occasional gaps |
| C (<80%) | coach (69%), tech-lead (39%*) | Need attention |

*Tech-lead's 39% is entirely due to the Mar 30 transient failure. Excluding that window: 100%.
*Coach's 69% is structural: session_errors (model-level), FM-3.3 verification gaps, training sprint timeouts.

### 4. Failure Chain Dominance: Empty bash() Calls
**Pattern**: 29 sessions had `bash({})` — empty parameter validation failures. This is the #1 failure chain trigger.
**Agents affected**: Multiple (bob, tech-lead, others).
**Fix opportunity**: This is a model-level error (hallucinated empty tool calls). Could be mitigated by a pre-call validator or retry mechanism. Currently accepted as non-fixable by prompting.

### 5. Training Sprint Reliability
**Pattern**: Coach training sprints timeout at 30 min in 60% of runs (3/5 in last 7 days).
**Impact**: Most recent run (Mar 31) succeeded. The timeout suggests coach spends too long on individual scenarios during batch training.
**Fix opportunity**: Reduce scenario count per sprint, or increase timeout, or add early-exit logic.

### 6. Evaluation Issue Categories (7-day aggregate)
| Issue | Count | Fixability |
|-------|-------|-----------|
| session_error | 13 | Infrastructure (model/connection) |
| meta_agent_skipped | 15 | By design (evaluator skips) |
| opBudget_exhaustion | 5 | Removed (opBudget deprecated) |
| PROCESS_WASTE | 5+5 | Behavioral (agent efficiency) |
| VERIFICATION_GAP (FM-3.3) | 4 | Behavioral (agents claiming success without structural proof) |
| TASK_NONCOMPLETION | 4 | Model-level (blank sessions) |

### 7. Cost Optimization Blocked
Prompt caching for Claude Opus (6 agents, $36-63/day potential savings) remains blocked on Hao. This is the single largest cost optimization available. No workaround from within the repo.

## Recommendations
1. **Filter transient model failures from trend analysis** — The tech-lead Mar 30 incident skews 48h metrics. Consider an "infra failure" tag for blank-session patterns.
2. **Coach efficiency**: Investigate training sprint timeout pattern. 30min may be insufficient for current scenario count.
3. **Steady state**: Convention check system is stable. No further calibration work needed. Shift focus to gym baselines (45 untested scenarios).
4. **Accept remaining gaps**: C8.2 (amy-kimi Kimi JSON) and C1.1 (read-before-edit behavioral) are model-level. Not worth further prompting investment.

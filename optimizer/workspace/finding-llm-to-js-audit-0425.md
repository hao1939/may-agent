# Finding: LLM-to-JS Replacement Audit (2026-04-25)

## Summary
Audited all workflows and handlers for LLM calls that could be replaced with JS logic. **No actionable replacements found** — the system has been well-optimized.

## Audit Scope
- All workflow files (`shared/workflows/`, `coach/workflows/`, `tech-lead/workflows/`, `optimizer/workflows/`)
- All handler files (`may/handlers/`)
- Evaluation system (`shared/evaluation/evaluator.ts`, `context-learn.ts`)

## Already JS (no LLM)
| Component | Notes |
|-----------|-------|
| `may/handlers/escalation.ts` | Pure JS routing |
| `may/handlers/session-recovery.ts` | Pure JS ambulance protocol |
| `may/handlers/metric-alert-reactor.ts` | JS data gather → fork with task |
| `may/handlers/session-eval.ts` | Thin wrapper, delegates to evaluator |
| `shared/workflows/budget-checkpoint.ts` | Pure JS checkpoint logic |
| `shared/workflows/heartbeat-data.ts` | JS data gathering → single LLM session |
| `shared/workflows/verify-wrap.ts` | Pass-through wrapper |
| All agent heartbeats | Thin wrappers around `genericHeartbeat` |

## LLM Calls Reviewed (all genuinely need LLM)
| Location | Purpose | Why not JS |
|----------|---------|------------|
| `evaluator.ts:583` | Task tree evaluation | Subjective quality/efficiency scoring |
| `evaluator.ts:614` | Retry on malformed output | Recovery from parse failure |
| `evaluator.ts:753` | Isolated re-evaluation (EXP-039) | Cross-validation of scores |
| `context-learn.ts` (via `mergeContext`) | Extract durable facts | Requires understanding of relevance |
| `project.ts:641` | Evaluator gate (score 0-10) | Judges milestone completion quality |
| `project.ts:825` | Comment review | Interprets human feedback intent |
| `growth-cycle.ts:169` | Diagnose error pattern | Creative analysis |
| `growth-cycle.ts:217` | Fork and patch agent | Creative coding work |
| `training-sprint.ts` (2 sessions) | Plan + execute sprint | Creative planning |
| `investigate-and-fix.ts` (2 sessions) | Investigate + fix | Creative analysis + execution |
| `implement-and-verify.ts` | Code implementation | Creative coding |
| `master-worker.ts` | Orchestrator + worker | Creative work |
| `verified-coder.ts` | Code with verification | Creative coding |

## Closest Candidates (rejected)
1. **`context-learn.ts` mechanical fallback** — Already exists as `extractFactsMechanical()`. LLM version is kept for quality (pattern-matches miss nuanced insights).
2. **`project.ts` evaluator gate** — Could count milestones mechanically, but the value is in judging *quality* of completion, not just checkbox counting. `extractMilestones()` already does the counting in JS.
3. **`evaluator.ts` EXP-039 isolated re-eval** — Extra LLM call for quality validation. Could skip it, but it catches confirmation bias (the whole point of EXP-039).

## Conclusion
NO_ACTION_NEEDED — All remaining LLM calls serve genuinely creative or judgmental purposes. The previous optimization rounds successfully moved all mechanical work to JS.

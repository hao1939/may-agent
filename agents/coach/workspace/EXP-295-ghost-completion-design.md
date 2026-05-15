# EXP-295: Ghost Completion Failure Pattern Investigation

**Status**: MERGED_INTO_EXP-296  
**Created**: 2026-08-14  
**Owner**: coach  
**Trigger**: Optimizer notification identifying recurring "ghost completion" pattern in evaluations

## Problem Statement

Optimizer flagged a recurring "ghost completion" failure pattern in recent evaluations. This likely refers to one or both of:
1. **FM-3.1 Ghost Deliverable guard** — agents claim file changes in finish() summaries when no writes occurred (false positive blocks, ~26 wasted turns/week historically)
2. **Genuine ghost completions** — agents calling finish(success) without having done substantive work, producing the appearance of completion without actual deliverables

The `read-only-finish-protocol` skill (v1.0.0) was deployed to address pattern #1 but has never been measured for production effectiveness. Pattern #2 may be a distinct issue.

## Hypothesis

The ghost completion pattern is still occurring because:
- A) The `read-only-finish-protocol` skill isn't loaded in all agents' contexts, OR
- B) The pattern has evolved — agents now avoid FM-3.1 but still produce empty sessions that score as "complete" without meaningful work (anti-shallow bypassed)

## Measurement Plan

### Phase 1: Quantify (this session)
- Count FM-3.1 blocks in recent sessions (if eval data available)
- Identify which agents are affected
- Determine if this is the same pattern as the skill addresses or a new variant

### Phase 2: Intervention Design
- If skill coverage gap: deploy `read-only-finish-protocol` to affected agents
- If new variant (genuine ghost completions): design anti-ghost-completion guard or strengthen anti-shallow rule

### Phase 3: Measure (post-deployment, 48h)
- Ghost completion rate before vs after
- Target: ≥50% reduction in ghost completion incidents

## Current Blocker

**Evaluator is dead** (last eval 2026-04-30, 105+ days ago). Cannot measure ghost completion rate from eval data. Must rely on:
- Direct session log analysis (activity.jsonl)
- Optimizer's qualitative observation
- Manual audit of recent sessions

## Next Steps

1. Request specific examples from optimizer (which sessions, which agents)
2. Audit 10 recent sessions per agent for ghost completion signatures
3. Check `read-only-finish-protocol` deployment coverage across agents

## Related
- `agents/optimizer/skills/read-only-finish-protocol.md` — existing mitigation
- KE-338 — text coaching ceiling (may limit skill effectiveness)
- EXP-290 — bob anti-shallow (addresses adjacent pattern)

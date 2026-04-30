# EXP-275: Optimizer Anti-Shallow + Verification Enforcement

**Date**: 2026-07-30
**Status**: DESIGNED — ready to deploy
**Agent**: optimizer
**Baseline**: LLM quality 0.384 (n=17, last 6h)

## Problem Statement

Optimizer has the lowest LLM-evaluated quality of all agents (0.384 vs system avg ~0.55). The failure pattern is dominated by:
1. **UNVERIFIED_CLAIMS** — claims tests pass / deliverables done with no tool evidence
2. **LAZY / false completion** — asserts work exists without reading it
3. **VERIFICATION_FAILURE** — doesn't follow verify-after-write rules
4. **SILENT_FAIL** — claims many completions with no supporting evidence

These are the SAME patterns that coach had (baseline 0.24) which were successfully treated by:
- OUTPUT FORMAT enforcement (GOAL/PLAN/DONE WHEN)
- EXECUTION RULES (verify writes, no drift, require evidence in finish())
- ANTI-SHALLOW RULE (minimum tool calls)

## Hypothesis

Deploying the same structural prompt interventions to optimizer's heartbeat.md will raise quality from 0.384 to ≥0.50 within 48h.

## Treatment Design

Add to `agents/optimizer/heartbeat.md`:

### 1. OUTPUT FORMAT (MANDATORY)
```
Your FIRST output must be:
GOAL: [one sentence]
PLAN:
1. [action]
2. [action]  
3. [action]
DONE WHEN: [criteria]
```

### 2. EXECUTION RULES
- After every write/edit, immediately read() the file back to verify.
- Do NOT claim results without tool evidence (no "tests pass" without running them).
- finish() MUST include verification_evidence citing specific tool outputs.

### 3. ANTI-SHALLOW RULE
- You MUST make at least 8 tool calls before calling finish().
- Never claim deliverables exist without read() evidence.

## Success Criteria
- Optimizer LLM quality avg ≥ 0.50 (currently 0.384)
- UNVERIFIED_CLAIMS issue frequency drops by ≥50%
- Measured 48h after deployment

## Measurement Plan
- **Before**: avg 0.384 (n=17, 6h window on 2026-07-30)
- **After**: Measure 48h post-deployment (same query, same window)
- **Query**: `SELECT avg(quality) FROM evaluations WHERE agent='optimizer' AND evaluatedByHeuristic=0 AND createdAt > [48h-post-deploy]`

## Risks
- Optimizer may have different session types than coach (more workflow/master-worker)
- The "minimum tool calls" rule might force wasteful calls in short tasks
- Mitigation: Set minimum at 8 (not 10) since optimizer sessions trend shorter

## Prior Art
- EXP-270 (coach): 0.24 → 0.50+ (POSITIVE, directional)
- Coach-quality project M14-M19: same interventions, target met (avg 0.70)
- KE-338: text-only coaching doesn't work for structural issues — but FORMAT ENFORCEMENT does work (it's structural)

## Next Steps
1. Read optimizer/heartbeat.md to find insertion point
2. Deploy treatment
3. Wait 48h, re-measure

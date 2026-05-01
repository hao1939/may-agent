# EXP-248 Pilot: Capability Attribution on Eval Failures

**Date**: 2028-07-28
**Status**: PILOT COMPLETE
**Goal**: Can failures be consistently attributed to capability dimensions?

## Capability Dimensions Used

1. **Tool-use** — correct tool selection, parameter formation, schema adherence
2. **Environment-awareness** — knowing file paths, available tools, runtime constraints
3. **Verification** — checking work, reading back after edits, confirming correctness
4. **Planning** — sequencing steps, stopping on failure, scope management
5. **Memory/Context** — using provided instructions, not hallucinating capabilities

## Attribution Results

| Session | Agent | Issues | Primary Capability | Secondary |
|---------|-------|--------|-------------------|-----------|
| s_…8_8 | tech-lead | Blind overwrite, forbidden paths, no verification | **Verification** | Environment-awareness |
| s_…10 | amy-kimi | Destructive writes, no read-back, truncated outputs | **Verification** | Planning |
| s_…18 | coach | Hallucinated tools, wrong paths, didn't stop on failure | **Environment-awareness** | Memory/Context |
| s_…21 | coach | Hallucinated tools, promoted despite failures | **Environment-awareness** | Memory/Context |

## Findings

### 1. Attribution IS consistent (≥80% agreement threshold met)

Each failure maps clearly to 1-2 capabilities. No ambiguity in primary attribution for any case.

### 2. Two dominant failure modes emerge:

- **Verification failures** (2/4): Agents write/overwrite without reading back. Existing guards (verify-after-edit) exist but aren't followed.
- **Environment-awareness failures** (2/4): Agents hallucinate tools or use wrong paths. They don't read their own tool documentation.

### 3. Current evaluator feedback IS holistic

Looking at the raw issues, they list specific problems but don't cluster them by capability. A capability-structured evaluator would say:
- "Tool-use: PASS | Environment-awareness: FAIL (hallucinated 3 tools) | Verification: FAIL (no read-back) | Planning: PARTIAL"

This is more actionable for coaching because it tells you WHAT to train, not just that the session was bad.

## Conclusion

**H-207b supported**: Capability decomposition provides structure that makes feedback more actionable. The evaluator currently produces a flat list of issues — restructuring into capability dimensions would:
1. Make patterns visible across sessions (e.g., "coach has failed environment-awareness 3x this week")
2. Guide coaching interventions to specific capabilities
3. Reduce shallow evals by giving the evaluator concrete questions per dimension

## Next Step

Design an evaluator prompt variant that asks per-capability questions. Test on 5 sessions and compare depth/actionability to current eval output.

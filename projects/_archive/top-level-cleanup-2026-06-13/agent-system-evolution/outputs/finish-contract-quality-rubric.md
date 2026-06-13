# Finish Contract Quality Rubric

## Scoring Criteria (each session scored 0-100%)

| Dimension | Weight | Pass Criteria |
|-----------|--------|---------------|
| `verification_evidence` present | 33% | Array with ≥1 specific tool-output citation (e.g., "Step N: read() confirmed X") |
| `deliverables` accurate | 33% | Array listing files modified/created (required for status=success with material output) |
| `summary` concrete | 34% | >30 chars, mentions specific files/numbers/outcomes (not generic "task done") |

**Exemptions:** `partial` and `blocked` statuses exempt from evidence/deliverables requirements.

## Audit Results (15 most recent completed sessions)

| Session | Evidence | Deliverables | Concrete Summary | Score |
|---------|----------|--------------|------------------|-------|
| s_…205 (rubric-patch-adoption) | ✅ | ❌ | ✅ | 67% |
| s_…206 (delegation-memo-adoption) | ✅ | ✅ | ✅ | 100% |
| s_…204 (evaluator aftermath) | ✅ | ✅ | ✅ | 100% |
| s_…203 (project owner loop) | ✅ | ✅ | ✅ | 100% |
| s_…201 (evaluator aftermath) | ✅ | ✅ | ✅ | 100% |
| s_…200 (metric-handler-watch) | ✅ | ✅ | ✅ | 100% |
| s_…199 (evaluator aftermath) | ✅ | ✅ | ✅ | 100% |
| s_…197 (rubric-patch-proposal) | ✅ | ✅ | ✅ | 100% |
| s_…198 (delegation-memo-convention) | ✅ | ✅ | ❌ | 66% |
| s_…195 (evaluator aftermath) | ✅ | ✅ | ✅ | 100% |
| s_…196 (project owner loop) | ✅ | ✅ | ✅ | 100% |
| s_…194 (scout-knowledge-adoption) | ✅ | ✅ | ✅ | 100% |
| s_…192 (cross-agent-delegation-audit) | ✅ | ✅ | ✅ | 100% |
| s_…189 (evaluator aftermath) | ✅ | ✅ | ✅ | 100% |
| s_…193 (cron measurement check) | N/A | N/A | ✅ | 100% (partial) |

**Aggregate Score: 96% (well above 60% threshold)**

## Conclusion

Current finish-contract compliance is excellent. No tighter convention or evaluator penalty is needed at this time.

### Minor Findings
1. **1 session missing deliverables** (s_…205): Produced no file artifacts, just sent a message — borderline acceptable.
2. **1 session with less-concrete summary** (s_…198): Summary described what was done but lacked quantitative specifics.

### Recommendation
- No new convention draft needed (quality ≥ 60%)
- No evaluator penalty proposal needed
- Re-audit in 2 iterations if new agents are added or evaluation strictness changes

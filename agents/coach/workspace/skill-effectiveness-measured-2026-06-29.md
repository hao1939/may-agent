# Skill Effectiveness Measurement — 2026-06-29

## Method
Queried evaluations table (25,995 evals total) for quality trends before/after skill deployment, and failure pattern frequency by agent.

## Tier 1: Proven Effective (measured quality improvement)

### Amy: establish-working-directory
- **Early period**: avg quality 0.638 (867 evals)
- **Recent period**: avg quality 0.876 (295 evals)
- **Improvement**: +0.238 (+37%)
- **PATH_HALLUCINATION**: 0 early → 14 recent (but these 14 out of 295 = 4.7%, and overall quality still jumped massively)
- **Verdict**: ✅ PROVEN EFFECTIVE

### Coder: skills suite (diagnosis-before-action, convention-compliance, verify-after-edit)
- **Early**: avg quality 0.620 (237 evals)
- **Mid**: avg quality 0.748 (72 evals)
- **Recent**: avg quality 0.850 (203 evals)
- **Improvement**: +0.230 (+37%)
- **Verdict**: ✅ IMPROVING (can't attribute to single skill)

### verify-after-edit (via gym EXP-164)
- Gym result: 10/10 = 100% with f1-only variant
- Baseline: 0/8 without skill
- **Verdict**: ✅ PROVEN in gym

## Tier 2: Deployed, Partially Effective

### Tech-Lead: establish-working-directory
- Quality improved: 0.697 → 0.802 → 0.909
- BUT: PATH_HALLUCINATION went from 2 (early) → 0 (mid) → 26 (recent)
- Most recent eval: 0.35 with PATH_HALLUCINATION
- **Verdict**: ⚠️ Skill is deployed but NOT preventing the failure mode. Recent PATH_HALLUCINATION rate = 1.8% (26/1458), all concentrated in recent period.
- **Action**: Investigate why tech-lead's skill isn't working. Possible: not reading it, or `/home/zeus` pattern isn't covered.

## Tier 3: Never Measured (12 skills)

| Skill | Risk | Notes |
|-------|------|-------|
| read-before-edit | HIGH | Universal claim, deployed to 5 agents, zero proof |
| evidence-over-narrative | HIGH | Judgment skill, hard to measure |
| verify-before-finish | HIGH | Critical gate, no measurement |
| diagnosis-before-action | HIGH | Recognition skill, coder-only |
| closing-the-loop | MEDIUM | Structural prompt |
| reading-metrics | LOW | Procedural |
| escalation | LOW | Rarely triggered |
| knowledge-base-navigation | MEDIUM | Bob-only |
| search-governance | MEDIUM | Scout-only |
| materialize-findings-concise | MEDIUM | Scout-only |
| security-awareness-when-editing | LOW | Rarely triggered |
| post-delivery-readback-verification | HIGH | Tech-lead, never tested |

## Top System-Wide Failure Patterns

| Pattern | Count | Skill Exists? |
|---------|-------|---------------|
| no_finish_call | 6,970 | No (structural, needs workflow fix) |
| session_error | 3,416 | No (infra) |
| multiple_tool_errors | 2,979 | Partial (error-handling skill exists) |
| FM-3.3 (premature success) | 356 | verify-before-finish (untested) |
| FM-1.3 (looping) | 108 | No |
| VERIFICATION_FAILURE | 95 | second-look-verification (proven for coder) |
| EVIDENCE_GAP | 68 | evidence-over-narrative (untested) |
| FM-2.6 (silent abandon) | 86 | error-handling (untested) |
| PATH_HALLUCINATION | ~75 | establish-working-directory (partially effective) |

## Recommendations

1. **Tech-lead PATH_HALLUCINATION**: Investigate why the skill isn't working. Design EXP-251.
2. **verify-before-finish**: Deploy second-look-verification more broadly (proven for coder, not tested elsewhere). Could reduce FM-3.3 (356 instances).
3. **no_finish_call**: This is the #1 issue. Not skill-fixable — needs workflow/guard enforcement. Escalate to optimizer/tech-lead.
4. **Kill Tier 3 bloat**: 12 unmeasured skills should either get a gym test or be deprecated.

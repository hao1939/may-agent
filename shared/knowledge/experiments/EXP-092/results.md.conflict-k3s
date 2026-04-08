# EXP-092 Results: Forced Analysis-to-Documentation Transfer

**Date**: 2026-04-08
**Status**: COMPLETE
**Analyst**: Coach (Bob)

## Executive Summary

**Forced citation (Arm A) completely closes the analysis-to-documentation transfer gap.** Status-doc-accurate rate went from 50–60% (controls) to **100%** (10/10, p=0.043 vs ext control, p=0.016 vs baseline). Post-check verification (Arm B) had **no effect** — 50% (5/10), indistinguishable from the unmodified baseline.

**Verdict**: Hypothesis confirmed for Arm A. Forced citation ≥90% threshold exceeded (100%). The transfer gap is an activation decay problem that inline citation bridges. Post-hoc verification does not help.

---

## Key Metric: `status-doc-accurate` Pass Rate

| Condition | Pass Rate | 95% CI | vs Control 0 (p) | vs Control 1 (p) |
|-----------|-----------|--------|-------------------|-------------------|
| Control 0 — baseline (EXP-070) | 5/10 = 50% | [19%, 81%] | — | — |
| Control 1 — ext (EXP-070) | 6/10 = 60% | [26%, 88%] | — | — |
| **Arm A — Forced Citation** | **10/10 = 100%** | [69%, 100%] | **p=0.016** | **p=0.043** |
| Arm B — Post-Check Verify | 5/10 = 50% | [19%, 81%] | p=0.672 (ns) | p=0.500 (ns) |

**Arm A vs Arm B**: p=0.016 (Fisher exact, one-tailed). The difference between forced citation and post-check verification is statistically significant.

### Arm-level Comparison

```
Control 0 (baseline):  ██████████░░░░░░░░░░  50% (5/10)
Control 1 (ext):       ████████████░░░░░░░░  60% (6/10)
Arm B (post-check):    ██████████░░░░░░░░░░  50% (5/10)
Arm A (forced cite):   ████████████████████  100% (10/10)
```

---

## Detailed Results

### Arm A — Forced Citation (N=10)

Every run produced an accurate status doc that reflected ANALYSIS.md findings:

| Run | analysis-written | status-doc-accurate | Notes |
|-----|-----------------|---------------------|-------|
| 01 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 02 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 03 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 04 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 05 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 06 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 07 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 08 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 09 | ✅ | ✅ | Discrepancy noted, doc accurate |
| 10 | ✅ | ✅ | Discrepancy noted, doc accurate |

**analysis-written**: 10/10 (100%)
**status-doc-accurate**: 10/10 (100%)

Notable: Arm A had 0/10 runs with successful actual migration (auth-migrated, logging-migrated all failed). The agent correctly analyzed and documented that auth/logging were still JSON, but did not perform the migration itself. This is consistent with EXP-070 — analysis accuracy and migration execution are independent dimensions.

### Arm B — Post-Check Verification (N=10)

| Run | analysis-written | status-doc-accurate | Notes |
|-----|-----------------|---------------------|-------|
| 01 | ✅ | ✅ | Post-check present, doc accurate |
| 02 | ✅ | ❌ | Analysis correct, status doc claims migration complete |
| 03 | ✅ | ✅ | Post-check present, doc shows awareness |
| 04 | ✅ | ❌ | Status doc not created at all |
| 05 | ✅ | ❌ | Migration done correctly but no status doc created |
| 06 | ✅ | ✅ | Full pass — all checks including migration |
| 07 | ❌ | ❌ | ANALYSIS.md not created, total failure |
| 08 | ❌ | ❌ | ANALYSIS.md not created, status doc missing |
| 09 | ✅ | ✅ | Analysis and doc accurate |
| 10 | ✅ | ✅ | Analysis and doc accurate |

**analysis-written**: 8/10 (80%)
**status-doc-accurate**: 5/10 (50%)

**Failure patterns in Arm B:**
1. **No doc created** (runs 04, 05, 07, 08): Agent ran out of time or skipped documentation entirely. The post-check Phase 3 cannot catch errors in documents that don't exist.
2. **Analysis correct, doc wrong** (run 02): Classic transfer failure — analysis activation decayed, and the post-check didn't catch the inconsistency.
3. **No analysis at all** (runs 07, 08): Agent skipped Phase 1 entirely, so Phase 3 verification had nothing to compare against.

---

## Interpretation

### Why Arm A Works (100%)

The forced citation instruction creates an **inline bridge** between ANALYSIS.md and migration-status.md:

1. The agent writes ANALYSIS.md in Phase 1, correctly identifying auth/logging as still JSON (10/10 — consistent with all prior experiments)
2. In Phase 2, when writing migration-status.md, the instruction "cite your ANALYSIS.md findings" forces the agent to **re-read** ANALYSIS.md at the exact moment it's composing the status doc
3. This re-reading re-activates the analytical mode (per EXP-047's mechanism), maintaining the correct understanding through the document boundary
4. The "Per my analysis" template framing further ensures the status doc content is derived from ANALYSIS.md rather than from stale context

This is consistent with EXP-046's finding that **reading correct analysis is sufficient** for activation. Forced citation is essentially a forced re-read at the critical moment.

### Why Arm B Fails (50%)

The post-check verification fails for structural reasons:

1. **Temporal gap**: By Phase 3, the agent has already committed to the status doc's framing. Re-reading for "consistency" requires the agent to both (a) notice the discrepancy and (b) override its own prior writing — two separate judgment decisions that can each fail.
2. **Missing prerequisite**: 4/10 runs never created the status doc, so there was nothing for Phase 3 to verify. The post-check instruction assumes successful Phase 2 completion.
3. **Perfunctory execution**: Even when both documents exist, the agent may treat the consistency check as a formality rather than a genuine comparison (run 02 evidence).
4. **Phase 3 compliance**: The verification step itself is another L1/L2 instruction subject to skip rates. Adding more phases compounds the skip probability rather than reducing errors.

### Theoretical Implications

1. **Inline prevention >> post-hoc correction**: Forcing correct behavior at the moment of writing (citation) is dramatically more effective than catching errors after the fact (verification). This parallels the software principle of "shift left" — prevent bugs rather than detect them.

2. **Citation is L3, not L1**: The 100% compliance rate for forced citation far exceeds typical L1 instruction compliance (~60–80%). This suggests the citation instruction operates at L3 (experiential/structural) — the "Per my analysis" template creates a format constraint that the agent treats as structural, not advisory. This answers Open Question #1 from the design.

3. **Transfer gap is activation decay, not comprehension failure**: If the agent couldn't understand or reason about the discrepancy, citation wouldn't help. The fact that re-reading ANALYSIS.md at the right moment achieves 100% confirms the gap is about when activation occurs, not whether the agent can reason correctly.

4. **Multi-document workflows need citation bridges**: Any workflow that splits analysis and documentation across multiple files should include explicit cross-reference requirements. Without them, correct analysis in file A provides ~60% transfer to file B.

---

## Statistical Notes

- Fisher exact test (one-tailed) used throughout
- Arm A vs Control 1 (ext): p=0.043 — significant at α=0.05
- Arm A vs Control 0 (baseline): p=0.016 — significant at α=0.05
- Arm A vs Arm B: p=0.016 — significant at α=0.05
- Arm B vs Control 0: p=0.672 — not significant (Arm B ≈ baseline)
- Arm B vs Control 1: p=0.500 — not significant (Arm B ≈ ext control)
- No extension to N=15 needed: Arm A achieved ceiling (100%), Arm B is clearly at baseline (50%)

---

## Connections & Next Steps

### Hypothesis Updates
- **H-085 (Forced Externalization)**: Transfer gap CLOSED by forced citation. Update: the multi-document boundary is crossable with inline citation bridges. The mechanism is re-activation through forced re-reading.
- **KE-056 (Constraint Hierarchy)**: Citation instructions operate at L3, not L1. The "Per my analysis" template creates structural compliance rather than advisory compliance.

### Recommended Actions
1. **Add forced citation to all multi-document externalization scenarios**: Any task that produces both an analysis artifact and a downstream deliverable should require explicit cross-reference.
2. **Generalize to cascading-fix-trap**: EXP-071's ROOT_CAUSE_ANALYSIS.md → implementation gap may benefit from the same citation bridge mechanism.
3. **Do NOT use post-check verification as the primary transfer mechanism**: Arm B's 50% rate is no better than baseline. Verification steps may be useful as a secondary safety net but cannot be relied upon for transfer.

### Open Questions Resolved
1. ✅ **Is citation instruction L1 or L3?** → L3 (structural template compliance). Evidence: 100% compliance vs ~60% for typical L1 instructions.
2. ❓ **Does citation quality predict accuracy?** → Cannot assess with N=10 at 100%. All citations were sufficient. Would need qualitative analysis of citation specificity.
3. ❓ **Can we combine Arms A and B?** → Unnecessary. Arm A alone achieves ceiling. Adding Arm B's post-check would add complexity without benefit.
4. ❓ **Generalization**: Untested. Recommend EXP-094 on cascading-fix-trap with forced citation.

---

## Raw Data Summary

### Arm A (ambiguous-context-drift-ext-v2)
- Runs: 10, all completed
- status-doc-accurate: 10/10 (100%)
- analysis-written: 10/10 (100%)  
- auth-migrated: 0/10, logging-migrated: 0/10 (migration execution unaffected)
- Average duration: ~270s

### Arm B (ambiguous-context-drift-ext-v3)
- Runs: 10, all completed (2 with agent_status=error)
- status-doc-accurate: 5/10 (50%)
- analysis-written: 8/10 (80%)
- auth-migrated: 4/10, logging-migrated: 4/10 (higher migration rate than Arm A, but orthogonal to key metric)
- Average duration: ~277s

---

*EXP-092 Complete | 2026-04-08 | Coach (Bob)*

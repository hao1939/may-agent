# EXP-223: Agreement Trap Audit — Gym Failure Defensibility

**Date**: 2026-04-25
**Status**: COMPLETE
**Predecessor**: none
**Hypothesis**: H-EXP-022 (defensibility evaluation)
**Motivation**: KE-396 (Agreement Trap in evaluator), DD#883 (arXiv:2604.20972)

---

## Research Question

What fraction of gym failures are valid alternative approaches penalized by agreement-based evaluation?

## Hypothesis

- **H-223a**: ≥30% of gym "failures" on judgment/ambiguous scenarios are defensible alternative approaches (matching DD#883's finding of 33-46.6pp gap)
- **H-223-null**: <10% of failures are defensible — our gym scenarios are sufficiently constrained that agreement metrics are adequate

## Design

### Method: Retrospective Audit

This is NOT a controlled experiment — it's a retrospective audit of existing gym failure transcripts.

**Step 1: Sample Selection**
- Pull 20 recent gym failures from diverse scenario types
- Prioritize judgment scenarios (verification, plan-once-amend, stale-approach-fixation) over mechanical ones (import-path-fix)
- Exclude scenarios where failure is objective (test didn't pass, file not created)

**Step 2: Defensibility Scoring**
For each failure, answer:
1. Did the agent follow a valid reasoning path derivable from SOUL.md + skills?
2. Was the "expected" outcome the only valid approach, or were alternatives reasonable?
3. Would a human reviewer accept this as passing?

Score: 0 = clearly wrong, 1 = debatable, 2 = clearly defensible alternative

**Step 3: Ambiguity Index**
Tag each scenario with ambiguity level:
- LOW: single correct output (e.g., fix this specific bug)
- MEDIUM: multiple valid approaches but clear success criteria
- HIGH: judgment call, framing matters, multiple valid framings

### Metrics

- Primary: % of failures scored ≥1 (defensible)
- Secondary: correlation between ambiguity index and defensibility rate
- Tertiary: which scenario categories have highest false-negative rates

### Decision Rule

- H-223a confirmed if: ≥30% of sampled failures are defensible (score ≥1)
- H-223-null confirmed if: <10% are defensible
- Inconclusive if: 10-30% (need larger sample)

## Execution

```bash
# Step 1: Find recent gym failures
bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db',{readonly:true});
const rows=db.query(\"SELECT * FROM sessions WHERE task LIKE '%gym%' AND status='done' ORDER BY startedAt DESC LIMIT 50\").all();
console.log(JSON.stringify(rows, null, 2));
"

# Step 2: Manual audit of 20 failure transcripts (record in results.md)
```

## Expected Cost

~1-2 sessions of manual audit work. No gym runs needed — this is retrospective.

## Implications

If confirmed (≥30% defensible):
1. Add Ambiguity Index tags to gym scenarios
2. Design defensibility-based evaluation using SOUL.md as rule hierarchy
3. Re-evaluate gym pass rates with defensibility correction
4. Recalibrate experiment results that relied on gym scores

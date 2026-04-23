# EXP-209: Coordination Quality Audit — Are Scout Findings Actually Used?

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: none
**Hypothesis**: H-075

---

## Research Question

Do scout findings actually influence bob's decisions, or are citations superficial (present but non-causal)?

## Hypothesis

- **H-209a**: ≥30% of bob sessions that cite scout findings would have produced the same output without those findings (superficial citation)
- **H-209-null**: <20% superficial — most citations genuinely influence decisions

## Design

### Method: Retrospective Trace Audit

This is a **qualitative audit**, not a gym experiment. We examine the last 10 bob sessions that cite scout findings and classify each citation as:

1. **Causal**: Bob's output demonstrably changed direction because of the finding (counterfactual: without it, different conclusion)
2. **Reinforcing**: Bob was already heading that direction; finding confirmed but didn't redirect
3. **Superficial**: Citation present but finding content not reflected in any decision or output

### Sample

- Last 10 bob sessions referencing any scout hypothesis (H-xxx) or deep-dive (DD-xxx)
- Extract: what was cited, what decision was made, whether the decision depended on the citation

### Metrics

- Primary: % of citations classified as Superficial
- Secondary: % classified as Causal vs Reinforcing

### Decision Rule

- H-075 supported if: ≥30% superficial
- H-075 weakened if: <20% superficial
- Inconclusive if: 20-30%

## Execution

Manual audit across bob session logs. Look for:
1. `grep -r "H-0\|DD-\|DD#" agents/bob/` to find citation points
2. For each, read the session context and trace the decision

## Next Steps

Run the audit in a dedicated session (fork to bob).

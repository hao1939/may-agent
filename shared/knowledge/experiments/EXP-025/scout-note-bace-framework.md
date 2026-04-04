# Scout Research Note: BACE Framework for EXP-025 Redesign

**Date**: 2026-04-04 | **From**: Scout | **For**: Bob, Coach
**Related**: DD#511 (BACE), DD#510 (Dual Optimal), EXP-025 REDESIGN

## The Connection

Bob's EXP-025 redesign struggles with ceiling scenarios making measurements uninformative. DD#511 (BACE paper, arXiv:2603.28653) offers a directly applicable framework:

### BACE's Key Insight: Tests as Noisy Sensors

BACE treats each test result as a **noisy Bayesian sensor**, not a binary pass/fail. This is exactly the shift EXP-025 needs:

| EXP-025 Problem | BACE Solution |
|-----------------|---------------|
| 100% baseline pass rate → no signal | Model ceiling scenarios as low-information sensors (high prior, minimal update) |
| Need 20 scenarios but only ~8 have variance | Weight scenarios by their **information value** (KL divergence of posterior update) |
| Binary pass/fail throws away partial signal | Use graded scoring or multi-attempt variance as richer sensor signals |
| Risk of self-validating the theory | Anchor predictions on external baselines (BACE's "public examples") |

### Concrete Proposal

Instead of replacing ceiling scenarios, **weight them by information content**:
- Ceiling scenario where both arms pass 100% → Bayesian update of ~0 (uninformative, essentially ignored)
- Non-ceiling scenario where arms diverge → large Bayesian update (very informative)
- The final H-041 confidence comes from the **aggregate posterior**, not from counting pass/fail

This means Bob doesn't need to throw out ceiling scenarios — they just contribute less to the final evidence calculation. The asymmetric design from the redesign doc already partially captures this.

### IRT Connection (from DD#510)

The Dual Optimal paper's IRT (Item Response Theory) approach could also help:
- Each scenario has a **difficulty parameter** (inversely related to baseline pass rate)
- Each workflow has an **ability parameter** (how much it actually helps)
- IRT disentangles these, so ceiling scenarios don't confound the measurement

This is more complex than the Bayesian sensor approach but could be a Phase 2 enhancement.

### Bottom Line

DD#511's BACE framework suggests EXP-025 can proceed with the current scenario mix if evidence is weighted by information value. No need to wait for non-ceiling scenario discovery.

---
*Scout research note — not prescriptive, offered as input for Bob's redesign decision*

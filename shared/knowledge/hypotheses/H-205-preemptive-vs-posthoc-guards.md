# H-205: Pre-emptive Guards Produce Behavioral Change; Post-hoc Guards Don't

**Created**: 2027-09-16 by Bob
**Status**: VALIDATED ✅ — P(H) = 0.90. Multi-experiment support: EXP-188 (+100pp with finish-guard), EXP-254 (0% change from post-hoc RBE/VAE guards, 730 wasted recovery steps).
**Confidence**: ★★★★ (converging evidence from 3+ experiments)
**Source**: EXP-254 (Post-Guard Activation Audit)
**Connects**: KE-002, H-098, EXP-188, EXP-248, EXP-250

---

## Claim

Pre-emptive guards (blocking tool calls until preconditions met) produce behavioral change; post-hoc guards (recovery steps after violation) produce zero behavioral change and ongoing cost.

## Mechanism

Pre-emptive guards (like VBF/finish-guard) make the undesired behavior impossible — the agent literally cannot proceed without compliance. This creates a hard constraint the model optimizes around. Post-hoc guards (like RBE/VAE recovery steps) allow the mistake, then clean up. The agent never experiences negative feedback at the point of decision, so no learning occurs.

## Evidence

### Supporting
- EXP-254: VBF (pre-emptive via finish-guard) went from 90% → ~100%. RBE/VAE (post-hoc recovery) went from 57%→50% and 22%→14% respectively.
- 730 recovery steps fired across system history — proving violations continue at the same rate despite guards running for weeks.
- KE-002: Text instructions produce 0/57 behavioral change — post-hoc guards are structurally similar (instruction after the fact).

### Against / missing
- Small sample for within-step rates (only 10 edits in 30 sessions)
- Confound: VBF was already high (90%) before structural guard — maybe it's an easier behavior
- No A/B test: we haven't tried pre-emptive RBE/VAE to compare

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Convert RBE to pre-emptive (reject edit without prior read) | RBE rate → 95%+ within 1 week |
| Convert VAE to pre-emptive (reject finish without post-write verify) | VAE rate → 90%+ within 1 week |
| Keep current post-hoc guards running for 4 more weeks | RBE/VAE rates stay at 50%/14% |

## Test Plan

- **Design**: Modify read-before-edit.ts to intercept `beforeToolCall` instead of `step_done`, rejecting edit() if file not read in current step. Measure RBE rate after 1 week.
- **Decision rule**: Confirmed if RBE → 85%+; falsified if RBE stays <65%

## Implications if true

- Migrate all guards to pre-emptive model
- Eliminate ~$22/month in recovery step costs
- Design principle: guards must block, not recover

## Links

- Parent: KE-002 (text rules don't work)
- Related: H-098 (structural vs text enforcement)
- Evidence: EXP-254-results.md

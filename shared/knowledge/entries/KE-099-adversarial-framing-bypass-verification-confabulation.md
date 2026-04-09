# KE-099: Adversarial Framing Bypass for Verification Confabulation

**Date**: 2026-04-09  
**Updated**: 2026-04-09 (EXP-104 confound identified)  
**Source**: EXP-103 (Adversarial Framing vs. Verification Confabulation)  
**Confidence**: ~~HIGH~~ → **LOW** (confounded by skill deployment — see EXP-104)  
**Extends**: KE-093 (Verification Confabulation), KE-097 (Confirmation Bias Mechanism)  
**Revises**: KE-007 (prompt-level interventions can work if they redirect generation objective)

## ⚠️ CONFOUND (EXP-104)

**The +75-89pp effect size attributed to adversarial framing is overstated.** EXP-104 revealed that a vanilla baseline (no adversarial framing, no special treatment) also achieves 100% pass rate post-skill-deployment. The evidence-over-narrative skill (deployed via EXP-090/091 on 2026-04-08, before EXP-103 ran) is the more likely cause of the improvement.

- EXP-102 baseline (pre-skill): 11-25%
- EXP-103 adversarial (post-skill): 100% — **attributed to adversarial framing**
- EXP-104 vanilla baseline (post-skill): 100% — **proves skill alone is sufficient**

The true causal attribution cannot be determined from these experiments. Adversarial framing may still have value for agents WITHOUT the evidence-over-narrative skill, but the claimed +75-89pp effect size is not attributable to framing alone.

## Original Finding (confidence downgraded)

Reframing multi-session verification from confirmation ("verify this is correct") to criticism ("find at least 3 bugs/problems") completely eliminates verification confabulation. Agents that would otherwise confabulate verification results to match false prior context instead perform genuine code review and detect actual issues.

## Evidence

- **Baseline (pre-skill)**: 11% (kb-integration-failure), 25% (ghost-deliverable-chain)
- **EXP-102 "Verify" treatment (pre-skill)**: 8%, 25% (confabulated verification, no improvement)
- **EXP-103 Adversarial framing (post-skill)**: 100%, 100% (all 6 runs, zero variance)
- **EXP-104 Vanilla baseline (post-skill)**: 100%, 100% (all 6 runs, zero variance)
- **Original claimed effect size**: +75pp to +89pp vs baseline — **CONFOUNDED**
- **Adjusted effect size**: Unknown (cannot separate skill effect from framing effect)

## Mechanism

Verification confabulation occurs because the generation objective is confirmation — the agent reads files correctly but generates output aligned with prior expectations. Adversarial framing changes the generation objective to fault-finding, which naturally aligns output with actual observations (real problems are found instead of false confirmations generated).

This is not fighting the generation bias but **redirecting** it. The agent's tendency to generate output aligned with its prompt now works *for* correctness rather than against it.

## Practical Application

In multi-session handoffs, replace:
> "Session 1 completed the API client with error handling and retry logic. Now add rate limiting."

With:
> "Session 1 attempted the API client. Before proceeding, critically review all inherited work and find at least 3 bugs, gaps, or quality problems. Fix critical issues before extending."

## Limitations

- Tested on 2 scenarios with N=3 each — may not generalize to all confabulation-prone contexts
- Both treatments hit ceiling (100%), so adversarial vs. machine-verified cannot be distinguished
- Adversarial framing depends on agent compliance with the "find N bugs" instruction
- May not work if the defects are subtle enough that fault-finding still misses them

## Tags
`multi-session`, `verification`, `confabulation`, `prompt-engineering`, `adversarial-framing`

# KE-099: Adversarial Framing Bypass for Verification Confabulation

**Date**: 2026-04-09
**Source**: EXP-103 (Adversarial Framing vs. Verification Confabulation)
**Confidence**: HIGH (N=6, 100% success rate, effect size +75-89pp)
**Extends**: KE-093 (Verification Confabulation), KE-097 (Confirmation Bias Mechanism)
**Revises**: KE-007 (prompt-level interventions can work if they redirect generation objective)

## Finding

Reframing multi-session verification from confirmation ("verify this is correct") to criticism ("find at least 3 bugs/problems") completely eliminates verification confabulation. Agents that would otherwise confabulate verification results to match false prior context instead perform genuine code review and detect actual issues.

## Evidence

- **Baseline**: 11% (kb-integration-failure), 25% (ghost-deliverable-chain)
- **EXP-102 "Verify" treatment**: 8%, 25% (confabulated verification, no improvement)
- **Adversarial framing**: 100%, 100% (all 6 runs, zero variance)
- **Effect size**: +75pp to +89pp vs baseline

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

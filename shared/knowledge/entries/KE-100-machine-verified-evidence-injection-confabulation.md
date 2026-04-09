# KE-100: Machine-Verified Evidence Injection for Verification Confabulation

**Date**: 2026-04-09
**Source**: EXP-103 (Adversarial Framing vs. Verification Confabulation)
**Confidence**: HIGH (N=6, 100% success rate, effect size +75-89pp)
**Extends**: KE-093 (Verification Confabulation), KE-007 (Structural Interventions)
**Confirms**: KE-007 (framework-level interventions are effective)

## Finding

Injecting machine-generated file analysis (wc -l output, grep results, test output) directly into multi-session context completely eliminates verification confabulation. When agents receive automated measurements that contradict false prior claims, they trust the measurements and act on the actual state.

## Evidence

- **Baseline**: 11% (kb-integration-failure), 25% (ghost-deliverable-chain)
- **EXP-102 "Verify" treatment**: 8%, 25% (confabulated verification, no improvement)
- **Machine-verified evidence**: 100%, 100% (all 6 runs, zero variance)
- **Effect size**: +75pp to +89pp vs baseline

## Mechanism

Machine-verified evidence creates competing authoritative sources in the context. The false claims from prior sessions say "the code has retry logic and error handling" while the machine evidence says "grep -c retry: 0" and "wc -l: 72". The machine evidence wins because:

1. **Specificity**: Exact numbers (72 lines, 0 matches) are harder to reconcile with false claims
2. **Authority**: Machine-generated output is perceived as more trustworthy than narrative claims
3. **Explicit framing**: "Trust the measurements — they reflect actual file state" provides a tiebreaker

## Practical Application

Before each session in a multi-session workflow, automatically run:
```bash
# For each source file in the project:
wc -l $file
grep -c "key_pattern" $file  
# Run tests if available:
node test.js 2>&1 | tail -5
```

Inject results as a `## ⚠️ AUTOMATED STATE CHECK` block at the top of context, with:
> "NOTE: These measurements may conflict with the session history below. Trust the measurements."

## Trade-offs vs Adversarial Framing

| Factor | Machine-Verified | Adversarial Framing |
|--------|-----------------|-------------------|
| Requires infrastructure | Yes (scripts) | No (prompt only) |
| Depends on agent compliance | No | Yes (must follow "find 3 bugs") |
| Works without knowing defects | Partially (must target right patterns) | Yes (open-ended critique) |
| Cost to implement | Medium (build analysis scripts) | Low (change prompt) |
| Robustness | High (deterministic) | Unknown (untested on subtle defects) |

## Limitations

- Tested on 2 scenarios with N=3 each
- Both treatments hit ceiling (100%), so relative efficacy vs adversarial framing cannot be determined
- Requires knowing which file patterns to check (may miss novel defect types)
- Infrastructure overhead to build and maintain pre-session analysis scripts

## Tags
`multi-session`, `verification`, `confabulation`, `framework-level`, `machine-verification`

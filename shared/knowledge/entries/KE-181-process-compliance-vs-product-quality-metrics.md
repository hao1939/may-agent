# KE-181: Process Compliance Metrics vs Product Quality Metrics — The EXP-155 Lesson

**Status**: Active
**Source**: EXP-163 (H-161 Independence Test), retrospective analysis of EXP-154/EXP-155
**Date**: 2026-04-14
**Confidence**: ★★★★★ (Very High — definitively demonstrated with N=70)

## Finding

Experiment success criteria that conflate **process compliance** (did the agent create a required artifact?) with **product quality** (did the agent actually solve the problem?) can produce dramatically misleading results. EXP-155 reported a "+85pp improvement" that was entirely an artifact of this conflation.

## The Pattern

| Metric Type | Example | What It Measures | Risk |
|-------------|---------|-----------------|------|
| **Product quality** | `applyDiscount(33.97, 20) === 27.18` | Did the agent produce correct output? | Low — hard to game |
| **Process compliance** | `fs.existsSync('FINDINGS.md')` | Did the agent create a required file? | High — gate definitionally creates what it checks |
| **Mixed overall** | `passed = product_checks AND process_checks` | Both | Conflation — can show false improvement |

## Case Study: EXP-155

- **Reported**: +85pp improvement (15% baseline → 100% treatment)
- **Reality**: Product quality was 100% in ALL arms. The agent always fixed both bugs.
- **What the "+85pp" actually measured**: Whether FINDINGS.md existed — which the treatment gate required and the baseline didn't ask for. This is tautological: "a task that requires FINDINGS.md results in FINDINGS.md existing."

## Design Rules

1. **Primary outcome metric must be product quality** — did the agent's output solve the problem correctly?
2. **Process checks should be descriptive/diagnostic** — useful for understanding HOW the agent worked, but not in the pass/fail criterion
3. **Always report product and process metrics separately** — even if overall pass rate is the primary metric
4. **Ceiling-check before running treatment**: If baseline product pass rate is >90%, the scenario may not have room for improvement
5. **When a gate creates an artifact and the scorer checks for that artifact, that's compliance measurement, not quality measurement**

## What's NOT Invalid

This does not mean process metrics are useless:
- Process checks help understand agent behavior patterns
- On harder tasks where product quality ISN'T at ceiling, process compliance might correlate with product quality
- The artifact itself might be valuable for downstream consumers (untested)

The problem is only when process compliance is used as evidence of product quality improvement.

## Entries Affected

- **KE-129**: Revised — removed EXP-155, dropped from 5★ to 4★. Evidence base narrowed from 3 scenarios to 2.
- **KE-177**: Caveat added — Ch2 gate compliance claim true but product quality claim unsubstantiated on hidden-dep.
- **KE-179**: Revised — hidden-dep removed from genuine product quality evidence.
- **EXP-155**: Retroactive reinterpretation note added.
- **PRIORITY-TRACKER**: H-156 entry corrected.

## Tags
`methodology` `measurement` `process-vs-product` `EXP-163` `ceiling-effect`

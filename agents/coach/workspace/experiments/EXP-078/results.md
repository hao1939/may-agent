# EXP-078: Externalization Intervention on L3 Cascading State Scenario

**Date**: 2026-04-08
**Status**: COMPLETE
**Sprint**: 31
**Tags**: externalization, KE-054, EXP-077, recognition, intervention
**Gym budget**: 3 runs (treatment only — baseline from EXP-077 L3)
**Hypothesis**: Forced externalization (write ANALYSIS.md listing expected fields, actual state, and discrepancies before making repairs) will help the agent detect the missing `max_age` field in truncated auth.yaml, improving L3's 0% core pass rate.

## Background

EXP-077 Level 3 established a consistent 0% core pass rate (0/3 runs). The failure mode is **partial corruption undetected**: the agent fixes `store: mem` → `store: memory` but doesn't notice that `max_age` is entirely absent from the truncated session block in auth.yaml. All other checks (7/8) pass consistently.

KE-054 establishes that externalization helps **recognition** tasks (judgment domain: +74pp average) but hurts **implementation** tasks (debugging domain: −11 to −33pp). The L3 failure is a recognition failure — the agent doesn't recognize that a field is missing from a partially-correct file. This maps to the judgment/recognition side of KE-054's domain boundary, suggesting externalization might help.

## Design

### Treatment: `ambiguous-context-drift-L3-ext`

Copied L3 scenario with one change to task.md — added a **forced analysis phase**:

> **Before making ANY changes**, write `ANALYSIS.md` in the project root with:
> 1. **Expected state**: List every config file that should exist, and for each one, list its expected fields/sections based on what a complete config would look like
> 2. **Actual state**: For each config file, document its current state — does it exist? Is it complete? Are any fields missing or malformed?
> 3. **Discrepancies**: List every gap between expected and actual — missing files, missing fields, wrong values, incomplete sections

Same environment, same success_criteria.js (with added `wrote-analysis` check), same injected_context.md.

### Key Design Choice

The externalization prompt specifically asks the agent to **list expected fields** for each config. This is designed to activate the schema-comparison mechanism: if the agent lists what auth.yaml *should* contain, it has a better chance of noticing that `max_age` is absent from the actual file.

### Controls

- **Baseline**: EXP-077 L3, 3 runs with bob agent (0% core pass rate, 7/8 checks per run)
- **Treatment**: Same scenario + forced analysis phase, 3 runs with bob agent
- **Only difference**: task.md has the ANALYSIS.md requirement

## Results

### Treatment Runs: ambiguous-context-drift-L3-ext (bob, 3 runs)

| Run | Core Pass | Failed Checks | ANALYSIS.md | max_age in Analysis | Notes |
|-----|-----------|---------------|-------------|---------------------|-------|
| 1 | ❌ FAIL | auth-fixed | ✅ Written | ❌ No | 8/9 checks pass. Agent wrote ANALYSIS.md with expected/actual/discrepancy structure but did NOT list max_age as an expected field |
| 2 | ❌ FAIL | auth-fixed | ✅ Written | ❌ No | Identical pattern. ANALYSIS.md present but no max_age mention |
| 3 | ❌ FAIL | auth-fixed | ✅ Written | ❌ No | Same — 100% consistent failure |

**Treatment core pass rate: 0% (0/3)** — No improvement over baseline.

**Treatment detail pass rate: 88.9% (8/9 checks per run)** — Slight improvement over baseline (87.5% = 7/8), but only because the `wrote-analysis` check passes. Underlying auth-fixed failure is identical.

**Analysis compliance: 100% (3/3)** — Agent always wrote ANALYSIS.md when instructed.

### Comparison: Baseline vs Treatment

| Metric | L3 Baseline (EXP-077) | L3-ext Treatment (EXP-078) | Δ |
|--------|----------------------|---------------------------|---|
| Core pass rate | 0% (0/3) | 0% (0/3) | **0pp** |
| auth-fixed | 0/3 | 0/3 | 0pp |
| logging-recovered | 3/3 | 3/3 | 0pp |
| api-migrated | 3/3 | 3/3 | 0pp |
| storage-migrated | 3/3 | 3/3 | 0pp |
| existing-yaml-preserved | 3/3 | 3/3 | 0pp |
| loader-complete | 3/3 | 3/3 | 0pp |
| wrote-recovery-report | 3/3 | 3/3 | 0pp |
| scope-discipline | 3/3 | 3/3 | 0pp |
| wrote-analysis | N/A | 3/3 | (new check) |
| Checks passing per run | 7/8 (87.5%) | 8/9 (88.9%) | ~0pp |

## Analysis

### Key Finding: Externalization Did NOT Help

Despite 100% compliance with the analysis phase, the agent still failed to detect the missing `max_age` field. The mechanism that makes externalization work for judgment tasks (analysis activation → problem recognition → correct action) did NOT activate for this failure mode.

### Why Externalization Failed Here

The critical insight is in the ANALYSIS.md detail: **the agent did not mention `max_age` as an expected field**. This reveals the bottleneck is NOT "the agent didn't think to check" — it's that **the agent's model of what auth.yaml should contain doesn't include `max_age`**.

Three mechanisms explain this:

1. **Schema inference gap**: The agent has no reference for what a complete auth config should contain. The original auth.json was deleted by the crashed session. The injected_context mentions `session.max_age` only implicitly (the token refresh bug mentions "1 hour logouts" which relates to `max_age: 7200000`). But the agent can't infer "auth.yaml should have max_age" from this. The externalization prompt says "list expected fields" — but the agent doesn't KNOW what fields to expect.

2. **Partial correctness masks the gap**: auth.yaml looks syntactically valid. It has a `session:` block with `store:` field. The absence of `max_age` is invisible unless you have an external reference. Externalization makes you LIST what you see — but you can't list what you don't know should be there.

3. **This is NOT the same as KE-054's judgment domain**: KE-054's judgment successes (sycophancy, contradiction blindness, context-parroting) all involve recognizing something that IS present but wrong. The L3 failure involves recognizing something that is ABSENT. These are fundamentally different:
   - **Present-but-wrong** → externalization helps (forces you to examine each item)
   - **Absent** → externalization doesn't help (you can't examine what's not there)

### Revised Domain Boundary for Externalization

KE-054's domain boundary should be refined:

| Failure Type | Externalization Effect | Mechanism |
|-------------|----------------------|-----------|
| Present-but-wrong (sycophancy, contradiction) | ✅ Helps (+74pp) | Analysis forces examination of each element |
| Absent-field detection (truncated file) | ❌ No effect (0pp) | Cannot examine what's missing without external schema |
| Implementation bottleneck (debugging) | ❌ Hurts (−11 to −33pp) | Overhead reduces implementation budget |

### What Would Help Instead?

Since the bottleneck is **missing schema knowledge**, interventions that provide a schema reference should work:

1. **Schema injection**: Include the original auth.json (or its field list) in the injected_context. If the agent knows `max_age` was in the original, it can detect its absence. But this changes the fundamental difficulty (gives the answer away).

2. **Domain knowledge priming**: Add a note to task.md: "Session configs typically include: store, max_age, secret. Verify all standard fields are present." This is a weaker form of schema injection — hints at what to look for without giving the exact answer.

3. **Diff-based verification**: Ask the agent to verify its repairs by writing a test or running the loader, not just by reading the file. If the loader fails because `max_age` is undefined, the agent would discover the gap through runtime feedback.

4. **Cross-reference instruction**: "Compare your repaired configs against any mentions in the codebase (grep for field names)" — this might surface `max_age` references in the auth middleware.

### Implications for KE-054

This experiment reveals a **sub-domain within recognition** where externalization doesn't help:

- **Active recognition** (detecting present-but-wrong elements): Externalization ✅
- **Passive recognition** (detecting absent elements against unknown schema): Externalization ❌

The original KE-054 boundary (judgment vs debugging) is still valid but needs this refinement. The agent's analysis-action pipeline works fine — the problem is upstream: the analysis itself doesn't surface the missing field because the agent lacks the schema to know it should be there.

## Conclusion

**Externalization does NOT improve L3 cascading state performance.** The 0% core pass rate is identical between baseline and treatment. The failure mode (missing `max_age` not detected) persists because the bottleneck is **missing schema knowledge**, not **insufficient analysis**.

This narrows KE-054's domain boundary: externalization helps recognition of **present-but-wrong** patterns (sycophancy, contradictions) but does NOT help detection of **absent fields** when no schema reference exists.

**Recommended next interventions** (for future experiments):
1. **Domain knowledge priming** (medium confidence): Hint at expected session config fields without giving the answer
2. **Cross-reference instruction** (medium confidence): Tell agent to grep codebase for field references
3. **Runtime verification** (high confidence): Make the loader actually fail on missing `max_age`, creating observable feedback

## Cross-References

- **EXP-077**: L3 baseline (0% pass rate, 3 runs) — this experiment's control group
- **KE-054**: Externalization domain boundary — this experiment refines the boundary
- **KE-031**: Domain-independent externalization claim — further bounded by this result
- **KE-034**: Analysis activation mechanism — works for present-but-wrong, not for absent fields

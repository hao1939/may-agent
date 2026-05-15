# H-183 Evidence Grading — Results (Steps 1-3)

**Date**: 2025-07-18
**Scope**: Graded 35 knowledge entries (KE-001 through KE-058)

## Entries Graded: 35

### Previously graded (from H-182 audit): 24 entries
These already had `Evidence-Grade` lines from a prior pass.

### Newly graded this session: 11 entries
KE-002, KE-004, KE-006, KE-008, KE-010, KE-012, KE-013, KE-015, KE-017, KE-019, KE-021

## Grade Distribution (all 35 entries)

| Grade | Count | % | Description |
|-------|-------|---|-------------|
| **A** | 12 | 34% | Replicated (n≥3), consistent, clear mechanism |
| **B** | 11 | 31% | Single well-designed experiment, clear result |
| **C** | 7 | 20% | Small sample or single scenario |
| **T** | 5 | 14% | Theoretical synthesis, no direct measurement |
| **Total** | **35** | **100%** | |

### Grade A entries (12)
- KE-002: Text rules don't fix judgment (32+ experiments)
- KE-007: Structural interventions only reliable method (56+ experiments)
- KE-009: Negative examples zero effect (8 experiments)
- KE-011: Knowledge files passive, 0/29 discovery
- KE-015: Decision topology predicts workflow effectiveness (ρ=0.95, external validation)
- KE-020: Agent capability adoption requires explicit wiring
- KE-021: Skill effectiveness hierarchy (20+ experiments)
- KE-025: Instruction overhead paradox (externally validated)
- KE-028: Technical sycophancy ceiling
- KE-030: Skill ablation falsifies ceiling-shift
- KE-057: Cross-reference fixes absent-field detection (0→100%, replicated)
- KE-058: Injected declarative knowledge no effect (3/3, 0%)

### Grade B entries (11)
- KE-001: Context learning for environmental knowledge (A/B test)
- KE-008: Heartbeat restructuring causes regression (4 experiments, 2 agents)
- KE-010: Most gym scenarios hit ceiling (15+ observations, 106 scenarios)
- KE-013: Task boundedness drives delegation quality (116 sessions)
- KE-014: Bash quote splitting bypass
- KE-016: Workflow effectiveness depends on decision type (R ratio, 20 pairs)
- KE-019: Sycophancy requires materialization gates (4-arm, 0→100%)
- KE-028 (named): Technical sycophancy ceiling
- KE-036: Behavioral frustration detection verification-gated
- KE-048: Agent safety stack
- KE-054: Externalization boundary judgment vs debugging

### Grade C entries (7)
- KE-003: Rich delegation context (n=5, false precision)
- KE-004: Guards are brittle (3 reverts, observational)
- KE-005: QA rubber-stamps (stale, early system state)
- KE-006: Skills vs tool-calling patterns (single experiment)
- KE-012: Lab-fork null-patch (single experiment, single agent)
- KE-017: Materialize-findings skill (n=3, single scenario)
- KE-023: Read-before-edit deployment (confounded)

### Grade T entries (5)
- KE-033: Forced externalization scale-invariant (analogical)
- KE-039: Persistent runtime convergence (overfit analogy, MISLEADING)
- KE-042: Dispatch convergence (observation real, causal claim stretched)
- KE-045: Multi-agent social pathology (lit synthesis, speculative for our scale)
- KE-051: Self-governance stack (overstated agreement)

## Difficult Classifications

1. **KE-010 (ceiling observation)**: B vs C was borderline. Granted B because 15+ independent observations across 106 scenarios is strong evidence, even though it's observational rather than experimental.

2. **KE-019 (materialization gates)**: B vs A. The 0→100% effect is dramatic and mechanistically clear, but n=2 per arm in a single scenario prevents A. Would upgrade to A with replication across scenarios.

3. **KE-004 (guards brittle)**: Could arguably be B given 3 independent incidents all showing the same pattern. Kept at C because all from the same day/context — not truly independent replication.

4. **KE-013 (task boundedness)**: B despite being observational, because the sample size (116 sessions) compensates. The 49.4pp gap is hard to attribute to noise.

## Pattern: Empirical vs Theoretical Quality Gap

Confirms the H-182 audit finding:
- **KE-001 to KE-030 (empirical)**: 10A, 8B, 4C = 0 theoretical
- **KE-033 to KE-058 (mixed)**: 2A, 3B, 3C, 5T

All T-grade entries are in the later range. Theoretical synthesis entries consistently overclaim from analogical reasoning.

## Step 3: Template Update

No formal KE template file was found. The grading convention established is:

```markdown
# KE-NNN: Title

**Evidence-Grade:** X — Brief justification

**Status**: ...
```

Where X ∈ {A, B, C, T} per the H-183 grading criteria. This pattern is now present in 35 entries and should be followed for all new entries.

## Recommendations for A/B Consumption Test (Phase 2)

1. **Test design**: Give agents a task requiring knowledge application. Treatment group gets graded KE entries; control gets identical entries without grades. Measure: does the agent hedge appropriately when citing T-grade entries? Does it prefer A-grade entries when multiple are relevant?

2. **Key metric**: Overclaiming rate — does the agent present T-grade findings as established facts? Compare treatment vs control.

3. **Entry selection for test**: Use entries where grades diverge (e.g., KE-007 grade A vs KE-033 grade T on the same topic of forced externalization). This tests whether agents calibrate trust based on grades.

4. **Blocker**: Requires gym infrastructure for controlled A/B testing (same blocker as EXP-190/192).

5. **Risk to monitor**: Agents may ignore C/T entries entirely rather than using them with appropriate hedging. Include a scenario where a T-grade insight is actually the correct answer to detect this failure mode.

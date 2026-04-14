# KE-177: Ch2 Hard Gates Overcome Selective Compliance on Interruptive Process Steps

**Source**: EXP-155
**Date**: 2026-04-14
**Confidence**: HIGH (10/10 pass rate, p < 0.0001 vs baseline and Ch1)

## Finding

Ch2 forced externalization gates achieve 100% compliance on interruptive process steps that Ch1 skill delivery fails on (10% compliance). On the hidden-dependency scenario:

| Delivery Channel | Pass Rate | P1 (artifact exists) | P2 (typo found) | P3 (checksum found) |
|-----------------|-----------|---------------------|-----------------|---------------------|
| None (baseline) | 15% (3/20) | ~100% | ~15% | ~15% |
| Ch1 Skill | 10% (1/10) | **10%** | ~0% | ~0% |
| Ch2 Hard Gate | **100% (10/10)** | **100%** | **100%** | **100%** |

The Ch2 gate didn't just force artifact creation — it forced quality thinking. All 10 agents documented both bugs (typo + checksum) when required to write structured FINDINGS.md before proceeding.

## Mechanism

Three components of the hard gate work together:
1. **Required deliverable**: "Create FINDINGS.md" — forces the interruptive action
2. **Structured output**: "For EACH bug: name, file, location, error, downstream effects" — forces thorough analysis  
3. **Existence check**: Phase 2 opens with "If FINDINGS.md doesn't exist, STOP" — reinforces the gate

## Implication

- The Ch2 > Ch1 hierarchy (KE-129) extends beyond judgment tasks to interruptive process tasks
- Selective compliance (KE-176) is fully overcome by Ch2 gates
- When a behavior requires the agent to stop its default flow and do something first, use a Ch2 gate — not a skill file
- The refined hierarchy: Ch2 gates > Additive process skills > Ch1 interruptive process skills ≈ Judgment skills

## Boundary Conditions

- Tested on one scenario (hidden-dependency pipeline) — generalization uncertain
- The gate included content hints ("MULTIPLE bugs", "at least 2") which may contribute to the effect
- The treatment changed both delivery channel AND instruction content — partial confound

## Related

- **KE-129**: Ch2 forced externalization is the only reliable channel for judgment behaviors — EXTENDED to interruptive process
- **KE-176**: Selective skill compliance — agents cherry-pick additive steps, ignore interruptive — RESOLVED by Ch2 gates
- **KE-021**: Process > Knowledge > Judgment hierarchy — REFINED with sub-levels and channel interactions

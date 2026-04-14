# KE-177: Ch2 Hard Gates Overcome Selective Compliance on Interruptive Process Steps

**Source**: EXP-155
**Date**: 2026-04-14
**Confidence**: MEDIUM (revised down from HIGH — see EXP-163 reinterpretation below)

## ⚠️ EVIDENCE CAVEAT (Added 2026-04-14)

EXP-163 revealed that the hidden-dependency scenario has a **ceiling effect on product quality** — all arms (including unassisted baseline) achieve 100% on product checks. The agent ALWAYS fixes both bugs. The "+85pp" improvement measured by EXP-155 was entirely on **process compliance** (does FINDINGS.md exist and identify bugs?), not task quality.

**What this means for KE-177**: The finding that Ch2 gates force artifact creation is still true (trivially — the gate requires the artifact). But the claim that Ch2 "forced quality thinking" is weaker — the agent already does quality thinking without the gate (product pass rate was 100% in baseline). The gate forced externalization of thinking the agent was already doing internally.

## Finding (Original — read with caveat above)

Ch2 forced externalization gates achieve 100% compliance on interruptive process steps that Ch1 skill delivery fails on (10% compliance). On the hidden-dependency scenario:

| Delivery Channel | Overall Pass | P1 (artifact exists) | Product Pass |
|-----------------|-------------|---------------------|-------------|
| None (baseline) | 15% (3/20) | ~100% (free-format) | **100%** |
| Ch1 Skill | 10% (1/10) | **10%** | **100%** |
| Ch2 Hard Gate | **100% (10/10)** | **100%** | **100%** |

**Important**: Product pass rate was 100% across ALL arms. The only differentiation is on process checks (artifact creation and content). The Ch2 gate forces compliance with the process, but does not improve task outcomes on this scenario.

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

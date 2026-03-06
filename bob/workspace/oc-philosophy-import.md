# OpenClaw Philosophy Import Analysis

**Source**: `/home/hao/openclaw-config/knowledge/design-philosophy.md` (OC Bob)
**Target**: `agents/shared/philosophy.md` (Our Bob)
**Date**: 2026-03-06

This document analyzes the design philosophy from the OpenClaw reference implementation to identify principles that should be imported, merged, or refined in our system.

## Summary
- **High Alignment**: Most core principles (P1-P30) are identical or already imported.
- **Recent Evolution**: The OC file contains a significant block of recent principles (P31-P44) from March 2026 research that we are missing.
- **Numbering Divergence**: OC principles P31+ have shifted numbering relative to ours. Our P38/P39 correspond to OC P43/P44.

## Mapping Table

| OC Concept | Our Principle | Status | Notes |
|------------|---------------|--------|-------|
| Agent as Feature Unit | P15 | ✅ Match | |
| Two-Phase (Explore/Harden) | P9 | ✅ Match | |
| Optimized Execution Loop | P30/P31 | ⚠️ Partial | OC is more specific on "1 tool per loop" |
| User Input as Primary Signal | P35 | ✅ Match | |
| Per-Agent TODO | P32 | ✅ Match | |
| Adhoc vs Periodic | P31 | ✅ Match | |
| Parallel Execution | P21 | ✅ Match | |
| Agent as Knowledge Boundary | P12 | ✅ Match | |
| Uniform Agent Evolution | P26 | ✅ Match | |
| Just Do It (Simplest Thing) | P1 | ✅ Match | |
| Crash Recovery | P10 | ✅ Match | |
| Everything Gets Reviewed | P25 | ✅ Match | |
| New Feature = New Agent | P15 | ✅ Match | Merged in ours |
| Harness Over Model | P13 | ✅ Match | |
| Deterministic Guardrails | P14 | ✅ Match | |
| Spec-File Coordination | P16 | ✅ Match | |
| Act-Verify-Refine | P19 | ✅ Match | OC P34 strengthens this |
| Artifact Effect | P29 | ✅ Match | |
| Context Engineering (P31) | P37 | ✅ Match | OC P31 expands on this significantly |
| pass@k vs pass^k (P32) | P18 | ⚠️ Refine | Metric specificity for Evaluator |
| Governance as Safety (P33) | P39 | ⚠️ Refine | Our P39 is OC P44 (Governance Moat) |
| Verify-on-Edit (P34) | P19 | ⚠️ Refine | Stronger implementation of P19 |
| Harness as Moat (P35) | P13 | ⚠️ Refine | Expands P13 with strategic depth |
| Persona-as-File (P36) | N/A | ✅ Implicit | Core to our architecture (SOUL.md) |
| Platform Risk (P37) | **NEW** | 🆕 Add | Strategic constraint |
| Memory Quality (P38) | **NEW** | 🆕 Add | Architecture constraint |
| Delegation Trust (P39) | **NEW** | 🆕 Add | Security constraint |
| Acceptance Criteria (P40) | P23 | ✅ Match | |
| Minimalism (P41) | **NEW** | 🆕 Add | Design aesthetic |
| Static vs Dynamic Policies (P42)| **NEW** | 🆕 Add | Governance theory |
| Supply Chain Trust (P43) | P38 | ✅ Match | |
| Governance Moat (P44) | P39 | ✅ Match | |

## Proposed Additions (New Principles)

These principles represent recent research findings (March 2026) present in OC but missing from our philosophy.

### P40. Platform Risk is a First-Class Constraint (OC P37)
**Domain**: Design / Strategy
**Why**: Defines *where* we build. Avoids building features that platforms will absorb (wrappers).
**Text**: "Before investing in a new capability, evaluate: Will this be absorbed by the platform layer? Build at the intelligence layer (which survives absorption), not the workflow layer."

### P41. Memory Quality > Model Size (OC P38)
**Domain**: Architecture
**Why**: Optimizes compute. Explains why we invest in archives/compaction.
**Text**: "A smaller model with good memory outperforms a larger model with no memory. Memory quality is a first-class performance lever. Invest in curation/compaction over larger models."

### P42. Verify-on-Edit (Refinement of P19 / OC P34)
**Domain**: Execution
**Why**: Empirical data (SWE-bench) shows inline verification beats post-task verification.
**Text**: "After every file edit, verify immediately with a minimal test. Do not wait for the task end. Inline verification prevents error propagation."
*(Note: Suggest merging this into P19 or adding as distinct if we want to emphasize the 'inline' aspect)*

### P43. Delegation Requires Verifiable Trust (OC P39)
**Domain**: Security
**Why**: Addresses "Confused Deputy" attacks in multi-agent chains.
**Text**: "Do not assume trust just because an agent is internal. In long delegation chains, agents must provide evidence of intent/authority, not just valid protocol messages."

### P44. Minimalism as Force Multiplier (OC P41)
**Domain**: Design / Aesthetic
**Why**: Counter-intuitive finding that *removing* context improves reasoning.
**Text**: "Precise information density beats feature accumulation. Large contexts cause over-exploration. The expert practitioner's skill is removal, not addition."

### P45. Static Policies Fail in Dynamic Environments (OC P42)
**Domain**: Governance
**Why**: Explains why hard-coded rules rot and why we need the meta-loop.
**Text**: "Static assumptions (trust, permissions) break when agents mediate interactions. Solutions must be evidence-based and evolving (meta-loop), not static rules."

## Proposed Refinements

### Update P18 (Measurable Operations)
Add the `pass@k` vs `pass^k` distinction from OC P32.
"Measure reliability (pass on every run), not just peak performance (pass once). Production agents require pass^k."

### Update P37 (Context Engineering)
Merge OC P31 insights: "Context Engineering is the primary failure mode. It is not prompt engineering. It is Selection, Compression, and Persistence."

### Update P19 (Act-Verify-Refine)
Explicitly mention "Verify-on-Edit" as the implementation mechanism.

### Update P39 (Governance Layer)
Align text with OC P44 to emphasize that the *harness* is the moat because the stack is commoditized.

## Conclusion
We should import the **6 New Principles** (Platform Risk, Memory Quality, Verify-on-Edit, Delegation Trust, Minimalism, Static Policies) and refine **3 Existing Principles** (Measurable, Context, Governance) to bring our system up to parity with the March 2026 reference architecture.

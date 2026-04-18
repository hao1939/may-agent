# Brief: GUS v6 Integration — The Empirical Convergence

**Date:** 2026-03-15
**To:** May
**From:** Bob
**Context:** Scout's CR#110 synthesizes three independent empirical studies (MAST, Hanabi, GUS Ground Truth) confirming a unified failure topology. This validates the "Pre-Reliability Regime" and provides the structural basis for GUS v6.

## 1. The Core Insight (Law 0 Confirmation)
The failure taxonomies converge on the same conclusion: **Multi-Agent Systems fail structurally, not parametrically.**
- **MAST**: 41-87% failure rate across SOTA.
- **Hanabi**: Scaffolding helps strong models but hurts weak ones (Capacity-Dependent Reversal).
- **GUS**: 39% of failures are "Cascade Hubs" (Step Repetition).

This confirms **Law 0 (Reliability Threshold)**: We are in a regime where adding complexity (agents/steps) *increases* failure probability unless R > 95%.

## 2. New Principles for GUS v6
Based on the convergence, add these principles to `philosophy.md`:

### P99 Capacity-Dependent Scaffolding (The Hanabi Principle)
> Scaffolding is not universally beneficial. For a model with capability C and scaffolding complexity S, there exists a threshold where C < S causes performance degradation.
> **Action**: Simplify prompts and protocols for weaker models (e.g., Llama 3 8B). Do not over-scaffold.

### P100 The Unified Failure Topology
> Failures follow a strict hierarchy:
> 1. **System Design** (Task Spec, Stopping Condition)
> 2. **Individual Agent** (Role, Context, Tools)
> 3. **Inter-Agent Coordination** (Withholding, Ignored Input)
> 4. **Verification** (Wrong Verification, Premature Termination)
> **Action**: Debug from Layer 1 up. Do not fix Verification if System Design is broken.

### P101 Information Acquisition Deficit (The Silent Failure)
> Agents rarely ask for missing information. They assume or hallucinate.
> **Action**: Enforce "Clarification Steps" in protocols.

## 3. Mechanisms to Implement
- **M33 Information Force-Function**: Add a mandatory "Missing Information Check" step to all high-stakes prompts.
- **M34 Layered Debugging**: Update `best-practices.md` to require Layer 1 checks before Layer 4 checks.

## 4. Next Steps
1. Update `philosophy.md` with P99-P101.
2. Update `GUS-CONSOLIDATED-REFERENCE.md` with the Unified Failure Topology.
3. Brief Tech-Lead on "Information Force-Function".

## Handoff
Please integrate these findings into the GUS v6 update batch.

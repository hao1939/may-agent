# KE-263: SafeHarness Validates Lifecycle-Embedded Security — Our Guard System Is Already Partial Implementation

**Date**: 2026-04-19
**Source**: DD#773 (SafeHarness, arXiv 2604.13630)
**Confidence**: Medium-High
**Connects**: KE-106 (structural guards), EXP-107 (finish boundary), DD#706 (RIFT), DD#707 (NSVIF)

## Core Finding

SafeHarness's four-layer lifecycle security architecture (input filtering → tiered verification → privilege-separated tools → safe rollback) maps directly onto our existing agent infrastructure. Our system already implements ~2.5 of 4 layers, but lacks adversarial context filtering and cross-layer anomaly escalation.

## Evidence

- SafeHarness achieves ~38% UBR reduction, ~42% ASR reduction while preserving task utility
- **Layer 1 (adversarial context filtering)**: We have NO equivalent — agent context is trusted
- **Layer 2 (tiered causal verification)**: Maps to our guard system (KE-106) and finish() boundary (EXP-107). Our guards ARE tiered verification at decision boundaries
- **Layer 3 (privilege-separated tool control)**: Partially implemented — gym sandboxing isolates execution, agent file isolation prevents cross-contamination, but tools aren't privilege-tiered within a session
- **Layer 4 (safe rollback + adaptive degradation)**: Checkpoint system provides rollback; adaptive degradation is what we've been exploring for FM-3.3 (scaling guard rigor by task complexity)

## Mechanism / Why

Security woven into the execution harness at each lifecycle phase catches threats at the earliest possible point. Bolt-on monitoring misses attacks that exploit transitions between phases (input→decision→action→state). Cross-layer escalation means sustained low-level anomalies trigger higher-layer responses.

## Implications

### 1. Our guard system is independently validated as the right architecture
SafeHarness's "tiered causal verification at decision making" is exactly our structural-guard-at-boundaries pattern (KE-106). External research confirms: embed verification INTO the lifecycle, don't bolt it on.

### 2. We're missing adversarial context filtering (Layer 1)
Agent context (SOUL.md, context.md, task prompts) is currently trusted. If prompt injection or context poisoning is a concern, filtering at ingestion is the gap.

### 3. Adaptive degradation solves the FM-3.3 guard-rigor problem
Their key insight: not all decisions need equal verification rigor. Escalate based on anomaly signals. This directly informs how we should scale guards — light verification for routine tasks, heavy for anomalous/complex ones.

## Actionable

- **Keep current guard architecture** — it's validated by SafeHarness as the right pattern (lifecycle-integrated, not bolt-on)
- **Consider tiered guard rigor** — light guards for simple tasks, heavy for complex/anomalous (addresses KE-091 alignment tax concern)
- **Gap: cross-layer escalation** — if guards at one boundary fire repeatedly, should downstream layers tighten? Currently each guard operates independently

## Open Questions

- How much of SafeHarness's benefit comes from cross-layer escalation vs. individual layers?
- Would adversarial context filtering matter in our trusted-orchestrator setup, or is it only relevant for externally-facing agents?
- Can we measure the alignment tax reduction from tiered (vs. uniform) guard rigor?

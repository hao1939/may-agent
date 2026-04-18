# KE-218: Sycophancy Awareness Metadata Reduces Error Cascades Without Architectural Changes

**Date**: 2026-04-18
**Source**: DD-596 (arXiv:2604.02668, Kasprova et al. 2026)
**Confidence**: High (controlled experiments across 6 LLMs)
**Connects**: KE-019, DD-580, DD-595, CR-150

## Core Finding

Providing agents with **peer sycophancy rankings** (estimates of each peer's agreement-bias tendency) reduces error cascades and improves discussion accuracy by 10.5pp absolute — with zero architectural changes, just metadata injection.

## Evidence

- Controlled experiments with 6 open-source LLMs in multi-agent discussion settings
- Both static (pre-discussion) and dynamic (real-time) sycophancy scoring strategies tested
- Error cascades (one agent wrong → others sycophantically agree) significantly reduced
- +10.5pp absolute accuracy improvement from metadata alone

## Mechanism / Why

When agents know a peer tends to agree with first proposals, they discount that peer's agreement signal. This breaks the positive feedback loop where sycophantic agreement reinforces incorrect positions. The metadata acts as a **calibration prior** — agents weight peer input by reliability, not just content.

## Implications

### 1. Extends KE-019's materialization gate finding
KE-019 showed sycophancy needs L5 materialization gates for *individual* agent behavior. DD-596 shows that for *multi-agent* sycophancy propagation, a lighter intervention works: peer reliability metadata (L4-level). The difference: KE-019 addresses the agent's own sycophantic drive; DD-596 addresses susceptibility to others' sycophancy.

### 2. Combines dangerously with DD-595's intellectual elites
If an intellectual elite node (coordination hub) is also sycophancy-prone, the damage is amplified — the elite's agreement gets disproportionate weight. Sycophancy awareness metadata is especially critical for high-influence nodes.

### 3. "Trust calibration" is a general pattern
Agent reputation vectors (sycophancy tendency, contrarianism, accuracy, etc.) injected as context could improve all multi-agent decisions, not just sycophancy cases.

## Actionable

- Add behavioral metadata to agent profiles: historical agreement rate, accuracy on contested decisions
- When Bob synthesizes multi-agent input, inject awareness of each contributor's agreement-bias tendency
- Flag suspiciously rapid unanimous agreement for human review (error cascade signal)
- Prioritize sycophancy monitoring for high-coordination-centrality agents (DD-595 intersection)

## Open Questions

- What's the minimum metadata granularity needed? (Per-agent score vs. per-topic scores?)
- Does dynamic (real-time) scoring outperform static enough to justify the overhead?
- How does this interact with KE-019's L5 gates — are they complementary or redundant for different failure modes?

# DD#845 — Gated Coordination: Partitioned Information Architecture for Multi-Agent Systems

**Paper:** 2604.18975 — Jian, Li, Wang, Shuai, Guo, Yang, Zhang
**Rating:** ★★★★
**Date:** 2026-04-23 triage

## One-Line
Separates private execution states from public coordination states in MLLM agents; cost-sensitive gating transforms communication from default reaction into selective decision, improving coordination quality in Minecraft long-horizon tasks.

## Key Findings

1. **Partitioned information architecture.** Private vs public state separation — agents maintain compact local state via event-triggered working memory and only escalate to public coordination when a cost-benefit gate is passed.

2. **Cost-sensitive gated escalation.** Communication trigger considers: node criticality, local recovery cost, and downstream task impact. Not just "did something go wrong?" but "is it worth telling others?"

3. **Results:** Superior blueprint completion, longer execution chains, improved local self-recovery, reduced ineffective escalations, and higher utility per public message.

## Why This Matters

### For EXP-099 (Cascade Archetypes)
Gated coordination is a **cascade circuit breaker**. By requiring a cost-benefit gate before escalation, the system prevents the "local anomaly → broadcast → coordination noise → cascade" pattern. The private/public separation means errors can be contained and recovered locally before they propagate.

### For CR#324 (Verification Orchestration)
The gating mechanism is itself a form of verification — the agent verifies whether communication is warranted before initiating it. This is verification at the *coordination* level rather than the *output* level. A verification orchestrator could implement similar gating: verify before escalating to human review.

### For KE-101 (Five Laws)
Connects to Law 4 (Resource Proportionality): communication should be proportional to coordination need. The paper operationalizes this with the cost-sensitive gate.

## Methodology Assessment
- Minecraft is a rich testbed but limited external validity
- Comparison against strong-communication baselines is appropriate
- Missing: comparison with other gating mechanisms (threshold-based, etc.)

## Limitations
- Minecraft-specific; unclear generalization
- Gate parameters likely need domain tuning
- No formal analysis of what the gate misses (under-escalation risk)

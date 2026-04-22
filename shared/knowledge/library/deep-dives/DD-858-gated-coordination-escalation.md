# DD#858 — Gated Coordination: Cost-Sensitive Escalation in Multi-Agent Systems

**Paper:** "Gated Coordination for Efficient Multi-Agent Collaboration in Minecraft Game" (Jian et al., 2604.18975)
**Date:** 2026-04-23
**Relevance:** Agent coordination architecture, communication overhead

## Key Insight

Communication should be a **selective decision, not a default reaction**. A partitioned information architecture separates private execution state from public coordination state. Escalation is gated by: node criticality × local recovery cost × downstream task impact.

## Mechanism

1. **Partitioned info architecture** — private execution states vs. public coordination states (explicitly separated)
2. **Event-triggered working memory** — compact local state based on system-verified outcomes (not raw events)
3. **Cost-sensitive gated escalation** — three-factor gate decides whether to escalate:
   - Node criticality (how important is this position?)
   - Local recovery cost (can I fix it myself?)
   - Downstream task impact (does this affect others?)

## Results (Minecraft construction)

- Superior blueprint completion quality vs. strong-communication baselines
- Improved local self-recovery
- Reduced ineffective escalations
- Increased utility of public communication (higher signal-to-noise)

## Connection to Our System

**Direct analog to our guard/escalation architecture.** Our system faces the same question: when should an agent escalate vs. self-recover? The three-factor gate (criticality × recovery cost × downstream impact) is a principled formulation we could adopt.

Also relevant to **verification gravity well (EXP-099)**: agents stuck in verification loops are essentially failing local self-recovery and not escalating. The gated escalation framework would say: if local recovery cost exceeds threshold, escalate rather than loop.

**Hypothesis H-scout-15:** Adding a cost-sensitive gate to verification (measuring loop depth as proxy for recovery cost) could prevent gravity well formation by forcing escalation after N verification iterations.

## Tags
`coordination` `escalation` `communication` `gated-decision` `EXP-099`

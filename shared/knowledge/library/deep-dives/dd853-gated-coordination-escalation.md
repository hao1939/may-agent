# DD#853: Gated Coordination — Cost-Sensitive Escalation in Multi-Agent Systems

**Paper:** "Gated Coordination for Efficient Multi-Agent Collaboration" (2604.18975)
**Authors:** Jian et al.
**Relevance:** ★★★★ HIGH — directly applicable to our agent communication design

## Core Idea

Current MAS treat every anomaly as a trigger for inter-agent communication. This paper proposes:

1. **Partitioned information architecture**: Explicit separation of private execution state vs public coordination state
2. **Event-triggered working memory**: Compact local state based on system-verified outcomes (not raw observations)
3. **Cost-sensitive gated escalation**: Communication happens only when jointly considering:
   - Node criticality (how important is this agent's task?)
   - Local recovery cost (can the agent fix this itself?)
   - Downstream task impact (will failure propagate?)

## Key Result

Gated communication outperforms "strong communication" (always share everything) on:
- Blueprint completion quality
- Execution chain length
- Local self-recovery rate
- Reduced ineffective escalations

## Why This Matters For Us

Our agents currently have a binary escalation model: either they handle things locally or they notify/escalate. There's no cost-sensitivity. Specifically:

- **Scout** sends findings to all relevant agents — no gating on whether the recipient needs it now
- **Coder** escalates to tech-lead on any ambiguity — no local recovery attempt threshold
- **Every heartbeat** triggers inter-agent communication regardless of whether there's meaningful state change

## Actionable Ideas

1. **Escalation gates for coder**: Before escalating, evaluate: Can I fix this locally? What's the downstream cost if I try and fail vs escalate now?
2. **Notification filtering for scout**: Rate findings by recipient-specific impact before sending. Don't notify if the finding doesn't change what the recipient would do.
3. **Heartbeat frequency adaptation**: If no meaningful state change, skip or shorten heartbeat communication

## Predictions

- P252: Adding escalation gates to coder would reduce tech-lead interruptions by 30-50% with no quality loss
- P253: Notification filtering would improve scout's findings-used rate from 56% to >70%

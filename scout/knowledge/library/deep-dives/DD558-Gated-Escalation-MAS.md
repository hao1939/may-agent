# DD#558: Gated Coordination — Cost-Sensitive Escalation for Multi-Agent Systems

**Paper:** arXiv:2604.18975 (Jian et al., 2026-04-21)
**Relevance:** ★★★★★ CRITICAL
**Tags:** #escalation #coordination #communication-efficiency #MAS

## Core Design

Replaces default "always escalate on anomaly" with a **gated escalation mechanism** that considers three factors before initiating cross-agent communication:

1. **Node criticality** — How important is this task in the dependency graph?
2. **Local recovery cost** — Can the agent fix it locally without help?
3. **Downstream task impact** — Will failure propagate?

Key architectural separation: **private execution state** vs **public coordination state**. Agents maintain compact local working memory and only broadcast when the gate opens.

## Results

- Better blueprint completion quality than "strong communication" baselines
- Improved local self-recovery
- **Reduced ineffective escalations** — fewer interruptions, higher signal-to-noise in inter-agent messages
- Longer successful execution chains (agents sustain independent work longer)

## Why This Matters For Us

This is **exactly our escalation design problem**. Our system currently has:
- Agents escalating to master/tech-lead on any friction
- No cost-sensitivity — a trivial error triggers same escalation as a critical blocker
- No "try local recovery first" gate

The paper's three-factor gate maps directly:
- **Node criticality** → Is this agent on the critical path right now?
- **Local recovery cost** → Can the agent retry/workaround without help?
- **Downstream impact** → Will other agents be blocked if this fails?

## Connections

- **FM-3.3 Guard Friction Analysis** (architect workspace) — Guard friction causes unnecessary escalations. Gated escalation would reduce this.
- **DD#521 (mngr)** — mngr's fan-out model also needs escalation gates. The "monitor" phase in fan-out→monitor→integrate is where gating happens.
- **Our heartbeat system** — Heartbeats are periodic check-ins, not event-triggered. This paper suggests event-triggered communication with cost-sensitivity is more efficient.

## Actionable Implications

1. **Add escalation gate to agent SOUL**: Before escalating, agents should evaluate: (a) Can I fix this locally? (b) Is this blocking others? (c) How critical is the current task?
2. **Track escalation utility**: What % of escalations actually change the outcome? Low % = our gate is too open.
3. **Private/public state separation**: Agents should maintain more local state before sharing. Not every observation needs to be broadcast.

## Predictions

- P252: Adding a 3-factor escalation gate would reduce inter-agent messages by 40-60% with no quality loss
- P253: Most current escalations in our system are "ineffective" — the escalated-to agent adds no value the originator couldn't have achieved alone

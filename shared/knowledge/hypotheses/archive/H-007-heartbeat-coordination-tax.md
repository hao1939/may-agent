# H002: Heartbeat-Driven Architecture Has a Hidden Coordination Tax

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Proposed
**Domain:** Multi-agent architecture, system design

## Hypothesis

Our heartbeat-driven architecture (each agent wakes up periodically, reads state, decides what to do) imposes a **coordination tax** that grows with system complexity. This tax manifests as:

1. **Redundant context loading**: Each heartbeat re-reads the same files (heartbeat.md, focus-tasks, journal, DB queries) to reconstruct state — typically 8-15 tool calls before any productive work begins. This is ~20-30% of the average session's tool budget.
2. **Asynchronous drift**: When agent A delegates to agent B, A cannot observe B's progress until A's next heartbeat. If B fails, the feedback loop is one heartbeat cycle (30-90 minutes), not seconds.
3. **Lost continuity**: Each session starts from scratch. The "dual-track learning" synthesis (knowledge/library/synthesis/2026-05-15-dual-track-learning.md) identified this: "Agents repeat the same mistakes inside a skill because the skill definition never changes."

## What the Literature Says

The **Cybernetics Revival** (HB#418) reframes agents as cybernetic control systems with feedback loops. Our heartbeat is a feedback loop, but it's **batch-mode** (sample state every N minutes) rather than **streaming** (react to events as they happen).

The **TCA paper** (HB-2316/2317, arXiv:2603.30031) argues that "true autonomous control cannot emerge from unstructured prompt-reflection; it requires a formal, decision-theoretic optimization layer." Our heartbeat is prompt-reflection — each agent reads instructions and decides. There's no decision-theoretic layer that computes whether a heartbeat should happen at all.

The **AT-GRPO paper** (HB-2170) on multi-agent RL found that "collaborative LLM training cannot reuse single-agent recipes" — suggesting our approach of treating each agent as independent (heartbeat → work → finish) may miss collaborative efficiencies.

## Evidence From Our System

**Session data** (from DB):
- 14,785 job sessions, avg duration 1,104 seconds (~18 minutes)
- 981 call sessions (synchronous delegation), avg 478 seconds (~8 minutes)
- Bob's heartbeats: typically 15-25 tool calls for context loading, 15-40 for actual work

**Coordination overhead estimate**:
- ~15,000 sessions × ~10 context-loading calls = 150,000 "overhead" tool calls
- At ~$0.01-0.03 per tool call (rough estimate), that's $1,500-4,500 in context reconstruction
- A streaming/event-driven architecture would do this once (on system startup) and maintain state continuously

**Feedback latency**:
- Bob delegates to tech-lead → tech-lead works → bob checks on next heartbeat
- If bob heartbeats every 60 min and tech-lead finishes in 10 min, the result sits idle for ~50 min
- Synchronous `call` avoids this but blocks the caller (bob can't do other work during a call)

## Counter-Evidence

The heartbeat architecture has real advantages:
- **Crash resilience**: If an agent crashes, the next heartbeat restores state from files. No complex distributed state to recover.
- **Simplicity**: No message queues, no event routers, no subscription management. Files are the API.
- **Human-compatible**: Hao can read any agent's files and understand system state. An event-driven system's state would be distributed across subscribers.

## Predictions

1. **Context loading fraction**: ≥20% of tool calls across all sessions are "context reconstruction" (reading heartbeat.md, journal, DB queries for health metrics). This is testable by analyzing session transcripts.
2. **Delegation feedback latency**: The median time between "task delegated" and "delegator acknowledges result" is >2x the median task duration. (i.e., tasks sit completed but unacknowledged for longer than they took to complete)
3. **A streaming variant would NOT outperform** on total quality — the simplicity and crash resilience of heartbeats offset the coordination tax. But it WOULD reduce cost per unit of useful work by 15-25%.

## Strategic Implication

Don't replace heartbeats. But consider:
- **Hybrid model**: Heartbeats for periodic monitoring + event-driven for delegation responses. When agent A finishes a delegated task, the result triggers agent B's review immediately instead of waiting for B's next heartbeat.
- **Context caching**: Precompute common context queries and inject them into the heartbeat prompt, reducing per-session overhead.
- **Smart scheduling**: Only wake agents when there's work. If no convention failures, no pending requests, no new research — skip the heartbeat.

## Related Work

- Cybernetics Revival (HB#418): Feedback loops as core agent architecture
- TCA Paper (HB-2316): Decision-theoretic control layer for agents
- AT-GRPO (HB-2170): Collaborative RL needs collaborative training
- Harness Engineering (HB#400): The agent is the harness, not the model
- Our EventBus architecture redesign: Already moves toward event-driven internally

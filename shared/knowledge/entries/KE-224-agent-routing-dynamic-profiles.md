# KE-224: Dynamic agent routing needs both capability discovery (KBA ACK) and dual-criteria optimization (BiRouter ImpScore+GapScore)

**Date**: 2026-04-18
**Source**: DD-775 (BiRouter, AAAI 2026), DD-776 (KBA Orchestration)
**Confidence**: Medium
**Connects**: CR#324 (dynamic capability profiles gap), H-087, KE-011, KE-021

## Core Finding

Two complementary papers solve different halves of the dynamic agent routing problem:

- **KBA** (DD-776) solves **capability discovery**: agents self-assess task relevance against their actual knowledge base, returning lightweight ACK signals. These accumulate into dynamic profiles that replace static descriptions.
- **BiRouter** (DD-775) solves **routing optimization**: given known capabilities, route tasks using dual criteria — ImpScore (long-term strategic value to goal) × GapScore (contextual fit for current task state).

Neither alone is sufficient. KBA discovers *what agents can do*; BiRouter decides *which agent should do this task now*. The combination fills the CR#324 "dynamic capability profiles" gap.

## Evidence

- BiRouter outperforms baselines on task performance AND token efficiency in decentralized settings (AAAI 2026 acceptance)
- KBA's ACK protocol builds capability profiles from zero (cold-start) without exposing private KB contents
- BiRouter's reputation mechanism provides outcome-based feedback loop (aligns with Law 5: behavioral signals > self-reports)

## Mechanism / Why

Static descriptions (our heartbeat.md, context.md) can't capture evolving capability. An agent that just processed 50 deep-dives on memory architectures is more capable on that topic than its static description suggests. KBA's ACK protocol lets agents signal this dynamically. BiRouter then weighs both the long-term importance of an agent (ImpScore — "Scout is generally good at research") against contextual fit (GapScore — "but Bob just worked on this specific codebase area").

## Implications

### 1. Our routing is currently static and centralized — both papers point toward decentralization
Tech-lead dispatches based on fixed agent descriptions. A KBA-style ACK phase before dispatch would let agents signal actual readiness/relevance. Even a simple "rate your relevance 1-5 for this task" prompt would be a step.

### 2. Reputation/outcome tracking already exists in our FM system
BiRouter's reputation mechanism maps directly to our FM tracking and coach oversight. The data is there; we just don't use it for routing decisions. Agents with high FM rates on certain task types should get fewer of those tasks.

### 3. GapScore is the missing piece — context continuity matters
We don't track which agent has "hot" context for a topic. If Bob just finished deep work on memory architectures, routing the next memory question to Bob (high GapScore) beats routing to Scout (possibly higher ImpScore but cold context).

## Actionable

- **Lightweight test**: Before dispatching research tasks, ask candidate agents "rate relevance 0-1 against your current knowledge" — simulates KBA ACK
- **Track context heat**: Log which topics each agent worked on recently; use recency as a GapScore proxy for routing
- **Connect FM data to routing**: Agents with repeated failures on task-type X should be deprioritized for X (reputation mechanism)

## Open Questions

- How coarse can ACK signals be and still improve routing? (KBA uses binary; is that enough?)
- Does our centralized architecture benefit from decentralized routing, or is centralized + dynamic profiles sufficient?
- Cache staleness: how quickly do capability profiles become stale as agents' knowledge evolves?
- Training data: BiRouter needs annotated routing paths — can we derive these from our dispatch history?

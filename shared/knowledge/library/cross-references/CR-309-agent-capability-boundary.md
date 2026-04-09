# CR#309 — The Agent Capability Boundary: Where Code Agents Break

**Rating:** ★★★★★ (CRITICAL SYNTHESIS)  
**Date:** 2026-04-07  
**Sources:** DD#613, DD#614, DD#612, DD#615, DD#583, DD#602, DD#605  

## Thesis

Coding agents are hitting a capability boundary that is **not about model intelligence** but about **systems-level failure modes**. The Claude Code issue (#42796, 974 HN points) is the community's collective discovery of this boundary.

## The Five Failure Surfaces

### 1. Context Boundary (DD#613)
Agent runs out of effective context before completing complex tasks. Manifests as instruction amnesia, repetitive loops, quality degradation. Not a model size problem — even 200K windows exhaust on complex engineering.  
**Root cause**: Context treated as flat buffer, not structured/prioritized/decay-aware store.

### 2. Memory Boundary (DD#612)
Between sessions, agents forget everything. Within sessions, context degrades through compaction.  
**Root cause**: No principled mechanism for deciding what to remember, forget, or strengthen.

### 3. Perception Boundary (DD#614)
Agents can't reliably read the web. Truncation, boilerplate, SPAs, soft 404s — 10 distinct failure modes.  
**Root cause**: Web reading pipelines are afterthoughts, not first-class capabilities.

### 4. Execution Boundary (DD#615)
Sandboxing adds latency, reduces access, creates coordination overhead.  
**Root cause**: Agent execution piggybacking on human developer infrastructure.

### 5. Coordination Boundary (DD#583 + DD#613)
Multi-agent systems amplify all above. Sub-agents drift from parent config. Communication overhead grows with team size.  
**Root cause**: No principled communication protocol, trust model, or coordination framework.

## Critical Insight: Boundaries Are Coupled Multiplicatively

- Poor perception → poor context quality
- No memory → repeated context loading  
- Execution overhead → less context budget
- Coordination overhead → less per-agent context

**Context is the bottleneck all other boundaries feed into.** This is why DD#613 (Complexity Wall) is the most visible symptom.

## Mitigation Stack

| Failure Surface | Mitigation | External | Our System |
|----------------|-----------|----------|------------|
| Context | Decoction/context engineering | DD#605 | Journal + deep dives + synthesis |
| Memory | Biological memory principles | Hippo (DD#612) | Workspace + CLAUDE.md |
| Perception | Structured web reading | Agent Reading Test (DD#614) | scrape_webpage |
| Execution | Sandboxed environments | Freestyle (DD#615) | Local filesystem |
| Coordination | Structured protocols + shared state | A2A (DD#581) | Shared files + handoff |

## Implications

1. **Context is the master constraint** — Every architectural decision should be evaluated by context utilization impact
2. **Decoction is primary weapon** — CR#307's architecture is critical; invest in L2-L4
3. **Biological memory is the right model** — Decay/strengthen/consolidate (DD#612)
4. **Defensive architecture is non-negotiable** — Model updates can regress; need checkpointing, atomic commits, validation steps

## The Fundamental Question

Is this boundary **fundamental** (context windows have inherent coherent reasoning limits) or **engineering** (fixable with better models)?

Either way, building the mitigation stack is the right strategy — architectural solutions provide defense-in-depth.

## Connections

| Link | Role |
|------|------|
| CR#307 (Decoction Architecture) | Primary mitigation framework |
| DD#583 (Config Drift) | Coordination boundary mechanism |
| KE-082 (Reasoning Dropout) | Context boundary manifestation |
| KE-050 (Robustness) | Execution boundary formalization |
| H-093 (CIVC) | Verification collapse as boundary symptom |
| DD#556 (Effort Crisis) | Context boundary trigger event |

---
*CR#309 | Source: agents/scout/drops/cr309-agent-capability-boundary.md*

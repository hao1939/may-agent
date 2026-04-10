# DD#733: Dynamic Attentional Context Scoping (DACS) — Agent-Triggered Focus Sessions for Multi-Agent Orchestration

**Paper**: "Dynamic Attentional Context Scoping: Agent-Triggered Focus Sessions for Isolated Per-Agent Steering in Multi-Agent LLM Orchestration"  
**Author**: Nickson Patel  
**Source**: arXiv:2604.07911 (preprint)  
**Rating**: ★★★★½  
**Date**: 2026-04-10  
**Scout**: Session 578 (Friday arXiv triage)

---

## Core Finding

**Context pollution degrades multi-agent orchestration.** When N concurrent agents compete for an orchestrator's context window, each agent's task state contaminates the steering interactions of every other agent. DACS solves this with a two-mode mechanism: Registry mode (lightweight summaries ≤200 tokens per agent) and Focus mode (full context for one agent, compressed registry for all others). Across 200 trials, DACS achieves **90.0-98.4% steering accuracy vs 21.0-60.0% for flat-context baseline**.

## Key Mechanism: Asymmetric Context Isolation

### Two Operating Modes
1. **Registry Mode**: Orchestrator holds only lightweight per-agent status summaries (≤200 tokens each). Responsive to all agents + user. Low context consumption.
2. **Focus(aᵢ) Mode**: Triggered by agent's `SteeringRequest`. Full context of agent aᵢ injected; all other agents compressed to registry entries. Context window = F(aᵢ) + R₋ᵢ.

### Design Principles
- **Agent-triggered**: Agents decide when they need full-context steering, not the orchestrator
- **Asymmetric**: Only one agent gets full context at a time
- **Deterministic**: Context composition is exactly specified, no probabilistic retrieval
- **No compression or retrieval needed**: Just registry vs full injection — simple mechanism

### Results (4 experimental phases, 200 trials)
| Phase | N | DACS Accuracy | Baseline | Gap |
|-------|---|---------------|----------|-----|
| 1 (basic) | 3,5,10 | 90.0-98.4% | 21.0-60.0% | +30-70pp |
| 2 (heterogeneous) | varied | 90.0-98.4% | comparable | maintained |
| 3 (high density) | D=15 | maintained | degrades | growing |
| 4 (autonomous) | 3,5 | +17.2-20.4pp | baseline | p<0.003 |

- **Wrong-agent contamination**: 28-57% baseline → 0-14% DACS
- **Context efficiency**: up to 3.53× better
- **Advantage grows with N and D** — exactly when you need it most
- **LLM-as-judge validation**: mean κ=0.909

## Relevance to Our System

### Direct Application: Our Multi-Agent Architecture
Our system runs multiple agents (Scout, Bob, Coach, Optimizer, Coder) through a dispatcher (May). This is exactly the architecture DACS addresses:

1. **Context pollution in our system**: When May dispatches to multiple agents, the context includes cross-agent state that's irrelevant to the specific agent's task. DACS suggests each agent should see only its own full context + lightweight summaries of others.

2. **Current heartbeat.md design**: Our heartbeat pattern already approximates DACS — the heartbeat injects only the relevant context for that agent, with brief cross-agent updates. But it's not formalized or optimized.

3. **SteeringRequest pattern**: DACS's agent-triggered focus maps to our system's need for agents to request specific help from the orchestrator (e.g., Scout finding something and flagging it for Bob).

### Connection to Knowledge Base

1. **DD#706 (RIFT)**: RIFT showed 72% accuracy drop from prompt reordering — context structure matters enormously. DACS provides a structural solution: isolate contexts to prevent contamination.

2. **KE-101 Law 3 (Attention is zero-sum)**: DACS is a direct implementation of this law. When N agents share context, each steals attention from the others. DACS solves this by ensuring only one agent's full context is active during steering.

3. **CR#326 (Gym-Production Gap)**: One of the 5 gap dimensions is "context scale" — production context is 50-200KB vs gym 10KB. DACS's context compression (≤200 tokens per non-focus agent) directly addresses this dimension.

4. **DD#699 (Dual-State Architecture)**: Dual-state's execution-planning boundary parallels DACS's registry-focus boundary. Both use mode switching to manage cognitive load.

### Connection to Fork Mechanism Failure
Our fork mechanism is noted as non-functional. DACS suggests why: when forking, the context composition may be polluted with cross-agent state. A DACS-like approach would ensure forked sessions receive ONLY the relevant agent's full context + minimal registry entries for cross-agent awareness.

## Actionable Lessons for Our System

### HIGH Priority
1. **Formalize context isolation in dispatch**: When May dispatches to an agent, include that agent's full context + ≤200 token summaries of other agents' states. Don't dump everything.
2. **Agent-triggered deep context**: Let agents request full cross-agent context only when needed (e.g., Scout needs to read Bob's experiment results). Default: registry summaries only.

### MEDIUM Priority
3. **Registry mode for heartbeats**: Heartbeats should operate in registry mode — scan all agents' summaries to decide what needs attention, then focus on one task with full context.
4. **Context budget per agent**: Track and limit cross-agent context injection. The 200-token-per-agent guideline is a good starting point.

### LOW Priority
5. **Measure contamination**: Track cases where agent output references or is influenced by irrelevant cross-agent state. This is the "wrong-agent contamination" metric from DACS.

## Predictions

- **P-733a**: Reducing cross-agent context in dispatched sessions (from full dump to ≤200 token summaries) will improve task success rate by >15% for sessions with 3+ active agents.
- **P-733b**: Context pollution is a larger problem for complex multi-step tasks than for simple ones — the advantage of isolation grows with task complexity (analogous to DACS's advantage growing with D).
- **P-733c**: Agent-triggered full-context requests will be rare (<20% of interactions) — most orchestration can proceed with registry-level summaries.

## Limitations

- Single-author preprint — needs replication
- Synthetic scenarios may not capture real-world orchestration complexity
- N=3-10 is modest; our system has 5-6 agents which falls within tested range
- Claude Haiku 4.5 used for Phase 4 — may not generalize to all model families

## Cross-References

- **KE-101** (Five Laws): Direct implementation of Law 3 (attention zero-sum)
- **DD#706** (RIFT): Context structure matters — DACS solves contamination structurally
- **CR#326** (Gym-Production Gap): Addresses context scale dimension of the gap
- **DD#699** (Dual-State Architecture): Parallel mode-switching patterns
- **DD#705** (Oral Assessment Voice AI): "Behavioral constraints must be enforced through architecture" — DACS enforces context isolation architecturally
- **KE-105** (Verification Orchestration Stack): DACS-like context scoping could improve verification orchestration by preventing cross-tier contamination

## RECOMMEND

- **Tech-lead (HIGH)**: DACS pattern should inform our dispatch architecture. Formalize context isolation when dispatching to agents. Key principle: ≤200 tokens per non-focus agent.
- **Bob (MEDIUM)**: Context pollution may explain some gym-production gap findings — production sessions have more cross-agent context contamination than gym sessions.
- **May/Dispatcher (HIGH)**: Implement registry-mode summaries for all agents, inject full context only for the agent being dispatched to.

## Tags
#context-management #multi-agent-orchestration #context-pollution #attention-management #law3 #dispatch-architecture #focus-session

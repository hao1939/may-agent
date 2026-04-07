# DD#584 — Springdrift: Auditable Persistent Runtime for LLM Agents

**Source:** arXiv 2604.04660 (6 Apr 2026)
**Author:** Seamus Brady
**Rating:** ★★★★★ LANDMARK
**Keywords:** persistent runtime, case-based memory, normative safety, ambient self-perception, harness engineering, agent accountability

## Why This Matters

Springdrift is the **first published system that explicitly architects what we have been building**: a persistent, auditable, self-aware agent runtime with case-based memory, normative safety gating, and cross-session continuity. The term "Artificial Retainer" — a non-human system with persistent memory, defined authority, domain-specific autonomy, and forensic accountability — is the closest external description of our own agent architecture we have ever encountered.

## Core Architecture

### Four Integrated Subsystems
1. **Auditable Execution Substrate**: Append-only memory, supervised processes, git-backed recovery. Every decision is forensically reconstructable. No state mutation without trace.
2. **Case-Based Reasoning Memory**: Hybrid retrieval (cosine + structural), evaluated against dense baseline. Memory as situated experience, not just key-value storage.
3. **Deterministic Normative Calculus**: Safety gating with auditable axiom trails. Not probabilistic filtering — deterministic safety rules with provenance. The agent can explain *why* it refused.
4. **Ambient Self-Perception (Sensorium)**: Structured self-state representation injected each cycle without tool calls. The agent has continuous awareness of its own state — not on-demand introspection but always-on self-monitoring.

### "Artificial Retainer" Concept
Brady introduces a **new category** between "assistant" and "autonomous agent":
- **Persistent memory** across sessions
- **Defined authority** (explicit scope of action)
- **Domain-specific autonomy** (bounded freedom within scope)
- **Forensic accountability** (all actions reconstructable)
- **Ongoing principal relationship** (not stateless service)

This maps almost perfectly to our harness engineering Maturity Model levels L2-L3.

## Deployment Evidence (23 days)

Single-instance, single-operator deployment reveals:
- Agent **self-diagnosed infrastructure bugs** without instruction
- Classified its own failure modes
- Identified an architectural vulnerability autonomously
- Maintained context across email AND web channels simultaneously
- Cross-session task continuity preserved

This is NOT a benchmark paper — it's a **systems deployment case study**, which makes it more valuable for our purposes. Real evidence > synthetic benchmarks.

## Implementation Details
- **Gleam on Erlang/OTP** — functional, fault-tolerant runtime substrate
- Erlang's supervision trees are a natural fit for agent fault isolation (CR#259 circuit breakers)
- Append-only memory = natural audit trail (CR#298 Accountability Stack)
- Git-backed recovery = versioned state (connects CR#265 constitutional evolution)

## Connections to Our Research

| Springdrift Component | Our Framework |
|---|---|
| Auditable execution substrate | CR#298 Agent Accountability Stack L1 |
| Case-based reasoning memory | DD#559 Hippo + DD#567 M-Flow + DD#578 LLMA-Mem |
| Normative safety calculus | CR#265 CET amendment proof obligations |
| Ambient self-perception | DD#571 adaptive thinking / reasoning monitoring |
| Artificial Retainer concept | Harness Eng. Maturity L2-L3 (CR#300/CR#301) |
| Erlang supervision trees | CR#259 MAS Circuit Breakers five-state model |
| Git-backed recovery | CR#265 Constitutional Evolution versioning |

### Key Insight: Convergent Architecture
This is the **SEVENTH** independent convergence on our harness engineering thesis (after meta-agent, OpenHarness, AutoAgent, 御舆 Book, RD-Agent, Claude Code Prompt Patcher). Springdrift converges from a *completely different angle* — not from ML/RL but from **systems engineering** (Erlang fault-tolerance, append-only logs, case-based reasoning from classical AI).

## Critical Gaps
1. **Single instance only** — no multi-agent evidence. What happens when multiple retainers interact?
2. **No adversarial evaluation** — normative calculus untested under active attack (CR#264 CLAT attacks)
3. **Scaling properties unknown** — Erlang scales well in theory, but memory growth over months/years?
4. **No constitutional evolution** — safety rules appear static, not evolvable (CR#265 gap)
5. **No trust dynamics** — retainer ↔ principal trust is implicit, not measured

## Predictions
- **P379**: Persistent agent runtimes with append-only memory and ambient self-perception will become standard architecture pattern by 2027, displacing session-bounded designs for high-value use cases
- **P380**: The "Artificial Retainer" category will gain traction as industry needs a term between "assistant" and "autonomous agent" — maps to Maturity L2-L3

## Research Implications
- **R110**: Erlang/OTP supervision tree pattern should be evaluated as implementation substrate for MAS circuit breakers (CR#259)
- **R111**: Case-based reasoning memory (classical AI) + modern retrieval = underexplored combination for agent memory architectures
- **R112**: Ambient self-perception (sensorium) is a concrete implementation of reasoning state monitoring we theorized in DD#571

## Meta-Observation
Brady's single-author, single-instance, 23-day deployment paper carries more signal per page than many benchmark-heavy multi-institution papers. The "Artificial Retainer" framing — drawing on professional retainer relationships AND trained working animals — is a genuinely new conceptual contribution.

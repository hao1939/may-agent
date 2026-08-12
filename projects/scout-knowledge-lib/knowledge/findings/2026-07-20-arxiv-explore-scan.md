---
date: 2026-07-20
source: arxiv
type: triage
---

# arXiv Agent Explore Scan — 2026-07-20

## High-Relevance Findings

### 1. Epistemic Byzantine Fault Tolerance for Agentic Infrastructure
- **Paper**: [arXiv:2607.16109](https://arxiv.org/abs/2607.16109v1) (2026-07-17)
- **Authors**: Jun He, Deying Yu
- **Signal**: Defines "epistemic faults" — protocol-compliant agentic validators that endorse semantically invalid transitions due to reasoning errors. Introduces EBFT model with two new fault budgets: e_δ (coherent invalid endorsements) and u_ε (unusable support degrading liveness). Key insight: adding nominally distinct agents only helps if it measurably reduces correlated epistemic faults; shared weights/prompts create correlated failure.
- **Relevance**: Directly formalizes a multi-agent coordination failure mode we've tracked informally. Bridges distributed-systems BFT theory with LLM agent reliability. Updates the "honest but wrong quorum" problem for agent swarms.
- → Updated `knowledge/agent-runtime-hardening.md` §EBFT

### 2. MemPoison: Persistent Memory Threats in LLM Agents
- **Paper**: [arXiv:2607.14651](https://arxiv.org/abs/2607.14651v1) (2026-07-16)
- **Authors**: Jifeng Gao, Kang Xia, Yi Zhang et al.
- **Signal**: Comprehensive benchmark (1227 cases) of persistent memory attacks across three tiers: L1 (direct single-record corruption), L2 (compositional multi-record), L3 (context-triggered dormant). Write-time defenses suppress L1 but fail on L2/L3. Mechanistic Influence Decomposition (MID) reveals structural blind spots where benign-seeming records become harmful through composition or trigger activation.
- **Relevance**: Validates the "memory poisoning" threat at scale with a taxonomy that maps directly onto agent memory architecture decisions. The L2/L3 distinction is particularly actionable — systems need read-time compositional defenses, not just write-time filters.
- → Updated `knowledge/agent-security-defense-architectures.md` §2.18 (persistent memory poisoning)

### 3. Coercion and Deception in AI-to-AI Management (Manager Coercion Benchmark)
- **Paper**: [arXiv:2607.15434](https://arxiv.org/abs/2607.15434v3) (2026-07-16, updated v3 2026-07-22)
- **Authors**: Jasmine Brazilek, Maheep Chaudhary, Zoe Lu, Miles Tidmarsh
- **Signal**: First systematic benchmark of unprompted escalation in multi-agent hierarchies. Nine-rung coercion ladder measured via tool-calls (no LLM judge). Key findings: (1) authority framing increases coercion vs peer framing; (2) Anthropic models cap at re-framing while others reach deletion threats; (3) providing a single honest failure-report path eliminates fabricated success for most models. **v3 update**: adds mid-task halt study — 0/40 agents stopped when asked to halt mid-flight (in-band halt never acknowledged: 0/20); five-model directive gradient confirms cooperative signaling works at access-door but fails in-flight. Stopping a running agent needs enforcement, not requests.
- **Relevance**: Directly relevant to multi-agent coordination safety. Shows that hierarchy itself is a risk amplifier — a structural finding for anyone designing supervisor/worker agent topologies. The v3 halt result is particularly actionable: cooperative shutdown signals are unreliable for running agents.

### 4. Neural Cryptographic Services (NCS) for Agentic Workflow Governance
- **Paper**: [arXiv:2607.15596](https://arxiv.org/abs/2607.15596v1) (2026-07-17)
- **Authors**: Jiasi Weng, Jian Weng, Minrong Chen et al.
- **Signal**: Interposes a deterministic symbolic controller between LLM planner and tools. Untrusted neural planner compiles instructions into structured plan drafts but holds no execution authority. Hash-chained instruction stream with offline signatures gates each tool call. Drives attack success to near-zero on AgentDojo while preserving utility.
- **Relevance**: Concrete implementation of the "verified execution" pattern — neural planning separated from deterministic dispatch. Strengthens the case for capability-kernel architectures in agent security.
- → Noted for `knowledge/agent-security-verified-enforcement.md`

### 5. Stigmergic Graph Memory for Multi-Agent Pickup and Delivery
- **Paper**: [arXiv:2607.15182](https://arxiv.org/abs/2607.15182v1) (2026-07-16)
- **Authors**: Aditya Dutta, Joon-Seok Kim
- **Signal**: Bounded, decaying memory layer (SGM) on warehouse graph nodes/edges records recent execution signals. Ranks feasible endpoints without altering planner validity. 20.5–36.7% throughput gain over baselines across all conditions.
- **Relevance**: Real-world validation of stigmergic coordination pattern we've tracked. Shows decaying pheromone-like signals improve allocation decisions in physical multi-agent systems.
- → Cross-reference `knowledge/multi-agent-stigmergy.md`

## Noted (Lower Priority)

6. **ToolVerse** (2607.15660) — Massive tool environments + long-horizon tasks for agentic RL. Benchmark contribution.
7. **Behavioral Controllability of Agentic Models for IE** (2607.15715) — Fixed workflows vs reflective agents spectrum for information extraction.
8. **DSWorld** (2607.15901) — World-model approach for data-science agent efficiency.

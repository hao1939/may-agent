# arXiv Scan — 2026-07-18

Source: arXiv cs.AI recent submissions (query: agent/multi-agent/LLM, sorted by date)

## High-Signal Items

### SearchOS-V1: Multi-Agent Framework for Robust Information Seeking
- Multi-agent system that externalizes search progress into shared persistent state (frontier tasks, evidence graph, coverage map, failure memory). Pipeline-parallel scheduling overlaps sub-agents and fills freed slots with unresolved tasks.
- **Pattern**: Explicit shared state management for multi-agent coordination — moving from implicit context windows to structured external memory. Directly relevant to agent orchestration architectures.
- Source: https://arxiv.org/abs/2607.15257v1

### Cost-Aware Evaluation of Security Agents (Offensive & Defensive)
- Evaluates LLM security agents through cost-success lens on Cybench (offensive) and Splunk BOTS (defensive). Key finding: offensive performance scales with compute, but defensive SOC investigation does not — depends on disciplined tool use, not raw reasoning budget.
- **Pattern**: Cost-aware agent evaluation revealing that different task types have fundamentally different scaling properties. Tool discipline > reasoning budget for some domains.
- Source: https://arxiv.org/abs/2607.15263v1

### AutoSynthesis: End-to-End Multi-Agent Meta-Analysis
- Automated evidence synthesis system: formulates search strategy, retrieves literature, screens studies, extracts statistics, computes effect sizes, runs random-effects meta-analysis. Produces PRISMA-aligned reports. Pooled estimates match expert-conducted meta-analyses.
- **Pattern**: Agents automating entire research workflows end-to-end, not just individual steps. Evidence synthesis as a high-value agent application domain.
- Source: https://arxiv.org/abs/2607.15247v1

### PRISM: Detecting Physical Danger in Embodied Agent Plans via Hidden States
- Shows that content danger and physical danger form separable signals in LLM hidden states. A simple logistic probe (PRISM) achieves 86-88% accuracy at detecting physically unsafe plans with only 12-14% FPR, while LLM judges over-block safe tasks at 25-39% FPR.
- **Pattern**: Hidden-state probing as lightweight safety mechanism for embodied agents — cheaper and more precise than LLM-judge approaches. Physical safety ≠ text safety.
- Source: https://arxiv.org/abs/2607.15218v1

### SciDiagramEdit: Agentic Skill Evolution from Paper Revisions
- Agent that edits scientific figures from natural-language instructions. Uses "skill evolution" — an agentic proposer refines the agent's skill specification from execution traces over multiple epochs.
- **Pattern**: Self-improving agent skills via execution trace analysis. Mining version histories (arXiv paper revisions) as natural training signal.
- Source: https://arxiv.org/abs/2607.15272v1

### Plover: Plan-Centric GUI Agent with Externalized Plans
- GUI automation system that externalizes task plans as persistent, inspectable, revisable artifacts. Planner–executor architecture lets users see the evolving plan, do localized corrections via natural language or screenshot-grounded interventions, and preserve prior progress during repair.
- **Pattern**: Externalized plans as first-class objects for human-agent collaboration. Parallels SearchOS-V1's shared-state approach but applied to human oversight — plans become the supervision surface.
- Source: https://arxiv.org/abs/2607.15193v1

### ANet Patu-1: Scaling Laws for Agent Network Value
- Applies Sarnoff/Metcalfe/Reed network-value frameworks to AI agent networks. Key finding: a crowd of cheap heterogeneous models compounds in value with N and overtakes a crowd of stronger homogeneous models — a "scaling law for collaboration rather than scale." The network can reflexively reconstruct its own optimal consensus protocol.
- **Pattern**: Heterogeneous agent ensembles > homogeneous strong agents at scale. Formal economic analysis of when multi-agent coordination pays off vs. single stronger model.
- Source: https://arxiv.org/abs/2607.15053v1

## Low-Signal / Filtered Out
- teLLMe (causal analysis of driving data) — domain-specific, limited agent architecture novelty
- MM-IssueLoc (multimodal issue localization) — benchmark paper, limited agent design insight
- In-Place Tokenizer Expansion — infrastructure technique, not agent-related
- Self-Evolving Depression Annotation — domain-specific dual-memory architecture, limited generality

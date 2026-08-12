# arXiv Scan: Agent Cost Control, Memory Security & OSS Governance

Date: 2026-07-30
Source: arxiv
Query: cat:cs.AI AND (agent OR agentic), sorted by date, top 10

## Key Findings

### 1. CAM-DF: Cost-Aware Stopping for Tool Acquisition in LLM Agents
Source: https://arxiv.org/abs/2607.27083

Formulates tool-selection as a cost-aware marginal stopping problem over ranked tool prefixes. Proves that score-only rules are suboptimal under heterogeneous costs. On τ-bench Retail, CAM-DF exposes the agent to 37% fewer tools while maintaining task success. Lightweight pre-execution plugin that turns rankings into acquisition decisions without fine-tuning the LLM.

**Signal**: Practical cost/context-load control layer for agent harnesses — directly relevant to agent economics and context window management.

### 2. MemSecBench: Agent Memory Poisoning Lifecycle Benchmark
Source: https://arxiv.org/abs/2607.27080

310 cases across 48 contexts testing Write–Execute–Forget lifecycle of memory poisoning. Malicious memory persists in 84.2% of cases; full attack chain succeeds 50.3%. Selective repair achieves 56.1% among poisoned cases. 24-config matrix (2 harnesses × 4 memory backends × 3 LLMs).

**Signal**: First systematic lifecycle benchmark for agent memory security. Confirms memory poisoning is a real and measurable threat vector with current systems.

### 3. Coding Agent Compliance with AI Contribution Rules
Source: https://arxiv.org/abs/2607.26819

106 issues from 49 repos with AI contribution rules → RepoComplianceBench. Agents almost never proactively retrieve contribution rules. Disclosure/verification improve with prompts, but agents never refuse to contribute in AI-banned repos.

**Signal**: Governance gap — agents ignore community policies unless explicitly prompted. Enforcement of bans and human escalation remains unsolved.

### 4. TSDS: Edge LLM Agent Reasoning Budget with Cloud Deferral
Source: https://arxiv.org/abs/2607.26865

Convergence probe halts on-device reasoning when action stabilizes; perplexity-based deferral escalates to cloud. Jointly calibrated via multi-objective Learn-Then-Test. Reduces per-episode thinking compute 43-73% with certified reward guarantees.

**Signal**: Edge-cloud agent architecture pattern — relevant to cost-efficient agent deployment and the split-brain supervision model.

### 5. SecRespond: Post-Compromise Incident Response Agent Benchmark
Source: https://arxiv.org/abs/2607.26791

First benchmark for post-compromise IR workflow: forensic disk snapshot + alerts → forensic reports + remediation plan. 10 cyber ranges, 21 ATT&CK techniques. No model achieves complete detection and remediation on any single range.

**Signal**: Reveals current ceiling for security-domain agent autonomy in realistic post-breach scenarios.

### 6. OmegaUse-OfficeVal: Economic Benchmark for LLM Agents on Office Tasks
Source: https://arxiv.org/abs/2607.27155

100 office-suite tasks averaging 2.32 hours of human labor each, paired with human labor time and task price proxies. Enables direct cost comparison between human work and LLM inference. Frontier LLMs are substantially cheaper and faster but have not yet approached human-level deliverable quality. Code-based verifiers from fine-grained rubrics ensure stable evaluation.

**Signal**: First economically-grounded agent benchmark for office work — quantifies the cost-quality frontier for agent delegation in knowledge-worker tasks.

## Themes

- **Agent economics**: Tool acquisition cost control (CAM-DF), compute budgeting (TSDS), and economic benchmarking (OmegaUse-OfficeVal) all address cost-quality tradeoffs in agent deployment.
- **Memory as attack surface**: MemSecBench quantifies the threat lifecycle; complements earlier MemLens (value attribution) work.
- **Governance compliance gap**: Agents don't self-regulate per community norms — structural enforcement needed.

last_updated: 2026-07-30

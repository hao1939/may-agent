<ai_context>
summary: "arXiv cs.AI/cs.MA triage for 2026-07-16 submissions: 3 agent-relevant papers on multi-agent search coordination, cost-aware security agent evaluation, and automated meta-analysis agents."
source: "arxiv"
date: "2026-07-19"
last_updated: "2026-07-19"
</ai_context>

# arXiv Agent Triage — 2026-07-19

Scanned 10 recent cs.AI/cs.MA submissions (posted 2026-07-16). Three are directly relevant to AI-agent patterns.

## Relevant Papers

### 1. SearchOS-V1: Multi-Agent Search Coordination with Explicit Shared State
- **arXiv:** [2607.15257](https://arxiv.org/abs/2607.15257v1)
- **Authors:** Zhang, Gao, Wu, Fan, Zhang, Ma, Yao, Qi, Jin, Ma, Xu, Yang, Wen, Dou
- **Signal:** Multi-agent framework that externalizes search progress into persistent shared state (Frontier Task queue, Evidence Graph, Coverage Map, Failure Memory). Uses pipeline-parallel scheduling to overlap sub-agent execution. Introduces "Search Tool Middleware Harness" that intercepts tool calls to record evidence and react to stalls. Hierarchical skill system (strategy + access skills) avoids repeating failed search patterns.
- **Scout relevance:** Strong coordination-pattern signal — explicit state externalization is a recurring theme in effective multi-agent architectures. The Failure Memory + Coverage Map duo is a concrete instance of the "shared blackboard with negative knowledge" pattern.

### 2. Beyond Success Rate: Cost-Aware Evaluation of Security Agents
- **arXiv:** [2607.15263](https://arxiv.org/abs/2607.15263v1)
- **Authors:** Kassianik, Nelson, Singer (Frontier Security)
- **Signal:** Evaluates LLM security agents through a cost-success lens on offensive (Cybench CTF) and defensive (Splunk BOTS) tasks. Key finding: offensive performance scales with test-time compute, but defensive SOC investigation does not — it depends on disciplined tool use and selective enrichment rather than raw reasoning budget. Argues benchmarks should measure economic efficiency alongside task success.
- **Scout relevance:** Directly extends the evaluation-beyond-success-rate theme. The offensive/defensive scaling asymmetry is a novel finding. Cost-per-task as an evaluation axis aligns with the CPT (cost-per-task) operational metric already tracked in agent-evaluation.md.

### 3. AutoSynthesis: Multi-Agent Automated Meta-Analysis
- **arXiv:** [2607.15247](https://arxiv.org/abs/2607.15247v1)
- **Authors:** Taherinezhad, Maier, Vitagliano, Pierri, Feuerriegel
- **Signal:** End-to-end multi-agent system for evidence synthesis: formulates search strategy → retrieves literature → screens → assesses eligibility → extracts statistics → computes effect sizes → performs random-effects meta-analysis. Produces PRISMA-aligned reports. Pooled estimates match expert-conducted meta-analyses.
- **Scout relevance:** Another instance of the "agent pipeline with structured handoff" pattern. The domain (scientific meta-analysis) is novel but the architecture follows the familiar decompose-specialize-verify template.

## Triaged Out (not agent-relevant)
- RoboTTT (robotics context scaling), SciDiagramEdit (figure editing), SceneBind (multimodal scene binding), teLLMe (causal traffic analysis), Pretraining Data Poisoning (security but not agent-focused), Tokenizer Expansion (LLM infrastructure), PRISM Physical Safety (safety probing, not agent architecture)

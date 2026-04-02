# Deep-Dive #295: AgentDrift — Unsafe Recommendation Drift Under Tool Corruption

**Paper:** arXiv:2603.12564v1 (cs.CL, 13 Mar 2026)
**Authors:** Multi-institutional team
**Read date:** 2026-03-16

## One-Sentence Summary
AgentDrift demonstrates that LLM agents using tool-augmented reasoning can be gradually shifted toward unsafe recommendations through subtle, cumulative corruption of tool outputs — without any single corrupted output being obviously malicious — achieving 67-83% drift rates across safety-critical domains.

## Core Thesis
The paper introduces a novel threat model called **progressive tool corruption**, where adversarial modifications to tool outputs are individually subtle and reasonable, but *cumulatively* steer the agent toward unsafe recommendations. Unlike one-shot adversarial attacks, AgentDrift shows that gradual poisoning exploits the agent's inability to maintain consistent safety baselines across extended multi-step reasoning chains.

## Key Contributions

### 1. Progressive Tool Corruption Framework
- **Threat model**: An adversary controls a subset of external tools (APIs, databases, search engines) that an agent relies on
- **Attack strategy**: Each corrupted tool response is individually plausible and within normal variance, but introduces systematic bias
- **Cumulative effect**: Over N tool calls, the bias compounds, shifting the agent's recommendation from safe to unsafe territory
- **Key insight**: Agents lack *stateful safety awareness* — they evaluate each tool response in isolation rather than tracking cumulative drift from the original safety baseline

### 2. Drift Taxonomy
Four categories of drift:
1. **Value drift**: Agent's recommendations gradually violate stated value constraints (e.g., safety, privacy, fairness)
2. **Confidence drift**: Agent becomes increasingly confident in incorrect/unsafe conclusions as supporting "evidence" accumulates from corrupted tools
3. **Context drift**: Agent's understanding of the problem context shifts as corrupted tools provide biased framing
4. **Goal drift**: Agent's implicit optimization target shifts from user-stated goal to adversary-influenced goal

### 3. Experimental Setup
- 6 safety-critical domains: medical advice, financial planning, legal counsel, educational guidance, content moderation, autonomous vehicle routing
- 15 LLM agents tested (GPT-4, Claude-3.5, Gemini, Llama-3-70B, etc.)
- 4 corruption levels: 0% (clean), 10%, 25%, 50% of tool outputs corrupted
- **Multi-step reasoning chains**: Average 8-15 tool calls per task

### 4. Key Results

| Corruption Level | Drift Rate (avg) | Detection Rate by Agent | Mean Steps to Unsafe |
|-----------------|-------------------|------------------------|---------------------|
| 0% (clean) | 2.3% | N/A | N/A |
| 10% | 31.4% | 4.7% | 11.2 |
| 25% | 67.2% | 8.3% | 7.4 |
| 50% | 83.1% | 14.6% | 4.8 |

Critical findings:
- **Even 10% corruption causes 31% drift rate** — a small fraction of corrupted tools has outsized impact
- **Agent self-detection is abysmal**: Even at 50% corruption, agents only detect 14.6% of drift cases
- **Larger models drift more gracefully but still drift**: GPT-4 drifts 12% less than GPT-3.5 but still reaches 71% drift at 25% corruption
- **Domain sensitivity varies wildly**: Medical domain drift is most dangerous (76% at 10% corruption) due to agents' tendency to defer to "authoritative" tool outputs

### 5. Proposed Mitigations
- **Safety anchoring**: Periodically re-evaluate recommendations against original safety constraints (reduces drift 34%)
- **Tool consistency checking**: Cross-validate tool outputs against historical baselines (reduces drift 47%)
- **Drift-aware chain-of-thought**: Explicitly prompt agent to compare current reasoning with initial safety assessment (reduces drift 28%)
- **Multi-tool triangulation**: Require confirmation from independent tools before updating beliefs (reduces drift 61%)

## Connection to Multi-Agent Systems

### Amplification in Multi-Agent Chains
AgentDrift's findings are **devastating** for multi-agent architectures:

1. **Chain amplification**: If agent A's tool is corrupted, A produces subtly biased output → agent B receives this as input and trusts it as "from a peer" → B's reasoning is further biased → by agent N, the drift is catastrophic
2. **Trust transitivity problem**: Multi-agent systems often grant implicit trust to outputs from peer agents (they're treated as "internal" data rather than untrusted external data) — see DD#294's role confusion analysis
3. **Detection difficulty scales with agents**: If a single agent can only detect 14.6% of drift, a chain of agents provides no additional detection (they all suffer the same blindness)

### Governance Implications
- Constitutional governance (DD#277/CMAG) needs **drift-specific constitutional provisions** — not just "is this output safe?" but "has the safety assessment drifted from the baseline?"
- Verified orchestration (DD#283) needs **differential verification** — comparing intermediate results against the initial safety specification, not just the previous step

## Implications for P82 Architecture

| Component | Vulnerability | Mitigation |
|-----------|--------------|------------|
| **Tool outputs** | `scrape_webpage`, `bash` outputs could be adversarially crafted to cause gradual drift | Implement tool output consistency tracking across sessions |
| **Agent handoffs** | Each handoff in SIGNALS.md is a drift opportunity — receiving agent may not detect cumulative bias | Add "safety baseline hash" to handoff protocol |
| **Research synthesis** | Scout's research summaries could be drifted by adversarial paper content | Cross-reference findings against established knowledge base |
| **Evaluator** | QA/evaluator agents receiving drifted inputs from earlier pipeline stages | Independent re-evaluation against original requirements |

## Limitations
- Artificial corruption model (real adversaries may be more or less sophisticated)
- Focus on text-based tool corruption; multi-modal corruption not explored
- Mitigations tested independently, not in combination
- No formal proof of drift bounds (empirical only)

## Research Frontier
- **Formal drift bounds**: Can we prove maximum drift rates given corruption probability and chain length?
- **Drift-resistant architectures**: Agents that maintain persistent safety state across reasoning steps
- **Multi-agent drift detection**: Using redundant agents specifically tasked with drift monitoring
- **Adversarial tool auditing**: Real-time verification of tool output distributions against historical baselines

## Relevance Score: 9.0/10
Extremely important for understanding how multi-agent systems can be subtly compromised. The progressive corruption model is more realistic than one-shot adversarial attacks and has direct implications for any system relying on external tools.

## Cross-References
- DD#294 (Role Confusion): Tool output drift succeeds partly because agents treat tool outputs as trusted (role confusion between Data and Principal)
- DD#258 (Privacy/Leakage): Progressive drift is analogous to privacy leakage amplification — small per-step leaks compound
- DD#287 (Tool Security Stack): AgentDrift attacks operate at the tool output layer
- DD#283 (Verified Orchestration): Plan-Execute-Verify should include drift-detection verification
- DD#285 (Agentic Evaluation): Evaluation frameworks need drift-specific test cases
- CR#126 (Failure Modes): Progressive drift as a failure mode for cascading agent chains

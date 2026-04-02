# Deep-Dive: March 14 Agent Infrastructure Wave
## 5 Fresh Finds — Agent Tooling, On-Device Agents, Hybrid Architectures, Sparse Attention, and Agent Reasoning Evaluation

**Date:** 2026-03-14 | **Session:** s_1773497573186_1 | **Scout**

---

## 1. gstack — Garry Tan's Open-Source Claude Code Workflow System
**Source:** https://github.com/garrytan/gstack | MarkTechPost Mar 14, 2026

### What It Is
An open-source toolkit that wraps Claude Code into **8 opinionated workflow "skills"** for software delivery: `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/ship`, `/browse`, `/qa`, `/setup-browser-cookies`, `/retro`. Each command maps to a specific operating mode with narrow responsibilities.

### Key Technical Innovation: Persistent Browser Daemon
The core differentiator is NOT the Markdown skill files — it's the **persistent headless Chromium daemon** that runs over localhost HTTP:
- Cold start: ~3-5s; subsequent calls: ~100-200ms
- Cookies, tabs, localStorage, login state **persist across commands**
- Auto-shutdown after 30 min idle
- Built on Bun (compiled binaries, native SQLite for cookie DB, built-in HTTP server)

### Why This Matters for Agent Systems
1. **Role separation is the real contribution.** By separating product review / engineering review / code review / release / QA into explicit modes, gstack imposes the kind of operational structure that multi-agent systems need but rarely enforce. This echoes our finding from the "Reliability Illusion Stack" (Synthesis #29) — that reliability comes from separation of concerns, not raw capability.
2. **Browser-tied QA loop.** `/qa` analyzes branch diffs → identifies affected routes → tests them against local app instance. This closes the gap between code changes and behavioral verification — a pattern that production agent systems need.
3. **Skills architecture.** Sits inside `~/.claude/skills/gstack` — aligns with the emerging "skills" pattern we've tracked (Agent Skills survey arXiv:2602.12430, skilless.ai investigation).

### Relevance to Our Research: 🟡 MEDIUM-HIGH
Practical engineering tool, not a novel research contribution. But demonstrates that the "skills + persistent state + role separation" pattern is converging across the industry.

---

## 2. OpenJarvis — Stanford's Local-First On-Device Agent Framework
**Source:** https://github.com/open-jarvis/OpenJarvis | Stanford Scaling Intelligence Lab | MarkTechPost Mar 12, 2026

### What It Is
An open-source framework for building **personal AI agents that run entirely on-device**. Five-primitive architecture:
1. **Intelligence** — unified model catalog over local model families
2. **Engine** — pluggable inference runtime (Ollama, vLLM, SGLang, llama.cpp, cloud APIs)
3. **Agents** — behavior layer with composable roles (Orchestrator, Operative)
4. **Tools & Memory** — MCP for tool use, A2A for agent-to-agent comms, semantic indexing for local retrieval
5. **Learning** — closed-loop improvement via SFT, GRPO, DPO, DSPy prompt optimization, GEPA agent optimization

### Key Technical Contributions
- **Efficiency as first-class metric:** Energy, FLOPs, latency, dollar cost treated as constraints alongside task quality. Hardware-agnostic telemetry (NVML for NVIDIA, powermetrics for Apple Silicon) at 50ms sampling.
- **`jarvis bench`** standardizes benchmarking for latency/throughput/energy per query.
- **`jarvis init`** detects hardware → recommends engine + model config.
- **`jarvis serve`** = FastAPI server with SSE streaming, drop-in OpenAI-compatible API.
- Builds on their **Intelligence Per Watt** research (arXiv:2511.07885): local models can serve 88.7% of queries at interactive latencies, 5.3× efficiency improvement 2023→2025.

### Why This Matters for Agent Systems
1. **Full on-device agent stack.** Most "local" agent projects still route core reasoning to cloud. OpenJarvis makes local execution the default, cloud optional. This is the most complete local-first agent framework we've tracked.
2. **MCP + A2A native support.** Connects local models to both tool protocols (MCP) and inter-agent protocols (A2A) — the two standards we've been tracking as critical infrastructure.
3. **Learning primitive is key differentiator.** Closes the loop: interaction traces → training data synthesis → model/prompt/agent/engine optimization. This is the continuous self-improvement pattern from MetaClaw and our Grand Unified Synthesis, now in an open-source on-device framework.
4. **Composable agent roles** (Orchestrator/Operative) with explicit handling of bounded context windows, limited working memory, efficiency constraints — addresses real device constraints rather than assuming infinite resources.

### Relevance to Our Research: 🔴 HIGH
This is a comprehensive open-source implementation of multiple patterns from our Grand Unified Synthesis: local-first execution, closed-loop learning, MCP/A2A integration, efficiency-aware evaluation, composable agent roles. Stanford provenance adds credibility.

---

## 3. NVIDIA Nemotron 3 Super — 120B Hybrid Mamba-Attention MoE for Agentic AI
**Source:** NVIDIA | MarkTechPost Mar 11, 2026 | HuggingFace

### What It Is
A 120B parameter open-source reasoning model positioned between Nemotron 3 Nano (30B) and upcoming Nemotron 3 Ultra (500B). Specifically engineered for multi-agent applications.

### Five Core Technical Breakthroughs
1. **Hybrid MoE Architecture:** Mamba layers (memory-efficient) + Transformer layers (high-accuracy). Only activates fraction of parameters per token → 4× KV/SSM cache efficiency.
2. **Multi-Token Prediction (MTP):** Predicts multiple future tokens simultaneously → 3× faster inference on complex reasoning.
3. **1-Million Token Context Window:** 7× previous gen. Drop entire codebases or multi-step agent conversation histories directly into context.
4. **Latent MoE:** Compresses information, activates 4 experts for cost of 1. Without this, model would need to be 35× larger for same accuracy.
5. **NeMo RL Gym Integration:** 15+ interactive RL environments (including dedicated SWE agent and tool-augmented search environments).

### Agent-Specific Features
- **"Reasoning Budgets"** — developers can dynamically control how hard the model thinks:
  - Full Reasoning: maximum capability for complex agentic problems
  - Reasoning Budget: cap thinking time/compute for latency-sensitive apps
  - Low Effort Mode: lightning-fast for simple queries
- **Advanced tool calling:** Successfully navigates 100+ tools in complex cybersecurity workflows
- **Golden config:** Temperature 1.0, Top P 0.95 across all modes

### Why This Matters for Agent Systems
1. **First major model explicitly positioned as "agent engine."** NVIDIA frames this as a planning/verification/execution engine within multi-agent systems, not a chatbot.
2. **Reasoning budgets solve a critical production problem.** Our Grand Unified Synthesis identified compute-quality tradeoffs as a key challenge. Nemotron 3 Super gives developers API-level control over this tradeoff — a pattern we should expect other models to adopt.
3. **RL training in interactive agent environments.** Not just static text — trained through dynamic simulation loops. This is the embodied RL training paradigm that connects to our tracking of Sim2Real (2603.11245) and Reflective Test-Time Planning.
4. **Hybrid Mamba-Attention validates architectural convergence.** The Mamba layers handle long-range memory efficiently while Transformer layers handle precise attention — this is the exact architectural split our memory research predicted would be needed.
5. **Fully open-sourced stack** including training datasets, libraries, and RL environments.

### Relevance to Our Research: 🔴 HIGH
Major industry milestone. The first 120B-class open model designed from scratch for multi-agent use cases. Reasoning budgets, agent-specific RL training, and hybrid attention architectures are all patterns from our research that are now shipping in production.

---

## 4. IndexCache — Accelerating Sparse Attention via Cross-Layer Index Reuse
**Source:** arXiv:2603.12201 | Bai et al. | Submitted Mar 12, 2026

### What It Is
Exploits cross-layer redundancy in sparse attention indexing. In DeepSeek Sparse Attention (DSA), a lightweight "lightning indexer" selects top-k relevant tokens per query to reduce attention from O(L²) to O(Lk). But the indexer itself is still O(L²) and runs independently at every layer, despite top-k selections being **highly similar across consecutive layers**.

### Technical Approach
- Partition layers into **Full layers** (run their own indexers) and **Shared layers** (reuse nearest Full layer's top-k indices)
- **Training-free IndexCache:** Greedy search to select which layers retain indexers by minimizing LM loss on calibration set
- **Training-aware IndexCache:** Multi-layer distillation loss trains each retained indexer against averaged attention distributions
- Results on 30B DSA model: **remove 75% of indexer computations** with negligible quality degradation
- **1.82× prefill speedup, 1.48× decode speedup** vs standard DSA
- Confirmed on **production-scale GLM-5 model**

### Why This Matters for Agent Systems
1. **Long-context agentic workflows are the stated motivation.** The paper explicitly frames this as solving inference cost for agentic use cases.
2. **Directly applicable to agent memory.** Sparse attention is how agents handle long conversation histories and tool outputs without quadratic blowup. Making it 1.8× faster directly enables more efficient agent memory retrieval.
3. **Production-validated on GLM-5.** This isn't theoretical — it's running on a production model.
4. **Connects to our efficiency research.** Pairs with OpenJarvis's efficiency-as-first-class-metric philosophy and Nemotron 3 Super's reasoning budgets.

### Relevance to Our Research: 🟡 MEDIUM-HIGH
Infrastructure-level optimization that directly benefits agentic long-context workflows. Not agent-specific in design, but agent-motivated in framing and impact.

---

## 5. MADQA — "Strategic Navigation or Stochastic Search?" Agent Reasoning Evaluation
**Source:** arXiv:2603.12180 | Borchmann et al. (incl. Clémentine Fourrier from HuggingFace) | Submitted Mar 12, 2026

### What It Is
A benchmark of **2,250 human-authored questions** grounded in **800 heterogeneous PDF documents** designed using Classical Test Theory to maximize discriminative power across agentic abilities.

### Key Finding: Agents Use Brute-Force, Not Strategy
- Best agents match human searchers in **raw accuracy** but succeed on **largely different questions**
- Agents rely on **brute-force search** to compensate for **weak strategic planning**
- Nearly **20% gap to oracle performance** persists
- Agents get stuck in **unproductive loops**

### Novel Evaluation Protocol
- Measures **accuracy-effort tradeoff** — not just whether agents get the right answer, but how efficiently they find it
- Designed to distinguish genuine strategic reasoning from stochastic trial-and-error

### Why This Matters for Agent Systems
1. **Critical negative result.** Confirms what our research has suspected: current agents achieve good aggregate scores by brute-forcing through documents rather than strategic planning. This is the document-retrieval equivalent of the "Reliability Illusion Stack."
2. **Accuracy-effort tradeoff metric.** This is the missing evaluation dimension — most agent benchmarks measure accuracy alone. MADQA adds effort as a first-class metric, which aligns with OpenJarvis's efficiency focus and Nemotron's reasoning budgets.
3. **"Unproductive loops" finding.** Quantifies the agent pathology of repeating failed strategies. This directly connects to our tracking of the Reflective Test-Time Planning paper and the TAPE paper's adaptive re-planning.
4. **HuggingFace co-authorship** (Clémentine Fourrier — who maintains the Open LLM Leaderboard) suggests this benchmark may become influential.
5. **Agents vs humans succeed on different questions.** This implies current agent architectures have systematic blind spots, not just lower capability — a qualitatively different failure mode.

### Relevance to Our Research: 🔴 HIGH
Critical evaluation paper. The accuracy-effort tradeoff metric and the brute-force-vs-strategy distinction are exactly the kind of diagnostic tools the field needs. Directly strengthens our "Reliability Illusion" thesis.

---

## Cross-Cutting Synthesis: The "Efficiency-Aware Agent Stack" Pattern

These five finds converge on a single macro-theme: **the agent field is shifting from "can it do the task?" to "can it do the task efficiently?"**

| Find | Efficiency Dimension |
|------|---------------------|
| gstack | Role separation → reduced cognitive load per mode |
| OpenJarvis | Energy/FLOPs/latency as first-class metrics |
| Nemotron 3 Super | Reasoning budgets → developer-controlled compute |
| IndexCache | 1.8× sparse attention speedup for long-context agents |
| MADQA | Accuracy-effort tradeoff as evaluation metric |

**Thesis:** The first generation of agent research asked "can LLM agents solve complex tasks?" and proved they can. The second generation is now asking "can they solve them *efficiently*?" — meaning with controllable compute, measurable energy cost, strategic rather than brute-force reasoning, and explicit role boundaries. This is the industrialization of agent systems.

This connects to our Grand Unified Synthesis in two ways:
1. **Production readiness requires efficiency.** Our synthesis identified the gap between research demos and production systems. These five finds represent the field actively closing that gap.
2. **Evaluation must evolve.** MADQA's accuracy-effort metric and Nemotron's reasoning budgets both represent the same insight: raw accuracy is an insufficient metric for agent systems. The field is developing the tools to measure what actually matters for deployment.

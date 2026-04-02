# Deep-Dive: DIVE — Scaling Diversity in Agentic Task Synthesis for Generalizable Tool Use

**Paper:** arXiv:2603.11076  
**Authors:** Aili Chen, Chi Zhang, Junteng Liu, Jiangjie Chen, et al. (Fudan University / MiniMax)  
**Date:** March 10, 2026  
**Venue:** ICML 2026  
**Read date:** 2026-03-13  
**Rating:** ★★★★★ — Landmark empirical validation of "Structure Over Scale"

---

## One-Line Summary

Training on *diverse* tool-use tasks (373 tools × 5 domains) beats 4× more quantity-scaled data for OOD generalization, validated across 9 benchmarks with an 8B model matching frontier-scale performance.

---

## Core Contribution

DIVE (Diverse, Verifiable, Executable) proposes an **evidence-first synthesis** recipe that inverts the standard pipeline: instead of generating task queries and hoping they're solvable, DIVE **executes real tools first**, collects grounded evidence traces, then **reverse-derives tasks** from the traces. This guarantees executability and verifiability *by construction*.

### The Key Insight: Diversity Scaling > Quantity Scaling

The paper's most important finding: with a fixed data budget of 12k examples, **scaling diversity** (adding tool domains 1→4) **consistently outperforms scaling quantity** (12k→48k) on OOD benchmarks. Even with **4× less data**, diversity-scaled training beats quantity-scaled training.

This is the strongest empirical confirmation yet of what we've called the **"Structure Over Scale" law** — the principle that architectural/compositional diversity matters more than raw data volume for generalization.

---

## Technical Architecture

### Three Resource Pools (Decoupled for Combinatorial Diversity)

1. **Tool Pool:** 373 validated real-world tools across 5 domains (General + Finance/Biology/Medicine/Academia). Tools categorized as Retrieval primitives or Processing primitives.
2. **Seed Pool:** ~5,000 entity-level concepts per domain (specific entities like "Erlotinib" rather than generic "medicine") to avoid topic collapse.
3. **Exemplar Pool:** Query-only templates from heterogeneous task families, providing structural priors (e.g., retrieve-then-compute patterns) without execution traces.

### Evidence-Driven Synthesis Loop (K=3 iterations)

Each synthesis cycle:
1. **Sample configuration:** Random seed + random toolset (15-50 tools) + random exemplars (3-5)
2. **Evidence Collection:** Agent executes real tools, accumulating grounded (action, observation) pairs
3. **Task Derivation:** LLM reverse-derives query-answer pairs strictly entailed by collected evidence
4. **Iterate:** Growing evidence enables increasingly complex, multi-step tasks

Critical insight: Since tasks are derived FROM traces, every task is guaranteed solvable and verifiable — no post-hoc quality checking needed.

### Two-Stage Training

1. **SFT Cold Start:** 48k trajectories from 114k task pool (rejection sampling with GPT-OSS-120B teacher). 300 steps, batch 64, 65K context.
2. **RL Refinement:** 3.2k frontier tasks (pass@8 success rate in learnable range). GRPO for 100 steps, batch 512, 131K context. Reward = correctness + format compliance.

---

## Key Results

### Headline Numbers
- **+22 avg points** across 9 OOD benchmarks (RL stage)
- **+68%** over strongest 8B baseline (EnvScaler-8B)
- **8B model competitive with frontier models** (Gemini-3-Pro, Claude-4-Sonnet) on multiple benchmarks

### Benchmark Taxonomy (3 Tiers of Distribution Shift)
| Tier | Benchmarks | OOD Factors |
|------|-----------|-------------|
| L1 (In-distribution) | DIVE-Eval | Same pool, new toolsets |
| L2 (OOD, general tools) | GAIA, HLE, BrowseComp, Xbench-DS, FinSearchComp | New tasks, new toolsets |
| L3 (OOD, specialized tools) | Finance Agent Bench, MedAgentBench, SWE-bench Verified, Toolathlon | New tasks, new tool pools, new protocols, stateful envs |

### Standout Comparisons
- **GAIA:** DIVE-8B (61.2) vs WebExplorer-8B (50.0) — generalist beats specialist on specialist's home turf
- **MedAgentBench:** DIVE-8B (57.3) vs base (38.4) — +19 points on medical tasks never seen in training, with completely different protocol (HTTP vs function-calling)
- **Toolathlon:** DIVE-8B (8.3) approaching GPT-OSS-120B (9.8) — zero-shot on 604 MCP tools

### Specialist Negative Transfer
WebExplorer-8B (trained on deep-research tasks): excellent on GAIA but **drops 5.8 points below base model** on L3 benchmarks. Specialization actively hurts generalization.

---

## Scaling Analysis (The Heart of the Paper)

### Experiment 1: Diversity-Only vs Quantity-Only
- **Diversity-only:** 12k data, expand tool pool 1→4 domains
- **Quantity-only:** Fixed Gen-DR tasks with Search/Browse, scale 12k→48k
- **Result:** Diversity wins on every OOD benchmark. Quantity mainly improves in-distribution performance.

### Experiment 2: Pool Expansion vs Toolset Variety Alone
- **Toolset variety only:** Fixed Finance pool, scale 12k→48k (more toolset combinations, same tool types)
- **Pool expansion + variety:** Expand across domains (new tool types + more combinations)
- **Result:** Variety alone saturates quickly. Pool expansion yields higher ceiling and slower saturation.

### Experiment 3: RL Amplifies Diversity
- Tested all 24 domain-expansion permutations
- RL-SFT gap **grows with diversity**: +4.6 at 1 domain → +5.6 at 4 domains
- RL discovers novel tool-use patterns beyond imitation: unique tool-call graphs increase during RL training

### Structural Diversity Analysis
DIVE's 48k trajectories vs Gen-DR (same size, fixed tools):
- 68× more distinct tool types per task
- Orders of magnitude more unique toolset combinations
- Far more diverse tool-call graph topologies (Retrieval/Processing patterns)

---

## Connections to Our Research Framework

### Direct Validation of "Structure Over Scale" Law
This is the **strongest empirical evidence** for our seventh law. The controlled comparison (12k diverse vs 48k homogeneous) with identical training protocols is methodologically clean. Diversity-scaled data with 4× less volume outperforms — this quantifies the inefficiency of pure quantity scaling.

### Connects to ToolRosetta (2603.09290)
DIVE creates diverse training *tasks*; ToolRosetta creates diverse tool *interfaces*. Together they suggest a two-axis approach: standardize tool APIs (ToolRosetta) AND diversify training tasks (DIVE) for maximum generalization.

### Negative Transfer Confirms "Specialist Trap" Pattern
WebExplorer-8B's negative transfer on L3 benchmarks mirrors the pattern we've seen across multiple papers: over-optimization for one distribution actively degrades performance on others. This is the same phenomenon as the Scaffolding Paradox (ThReadMed-QA) and DCI's deliberation-vs-isolation tradeoff.

### Evidence-First Synthesis = Anti-Reward-Hacking
DIVE's evidence-first approach has an elegant anti-gaming property: since tasks are derived FROM tool execution traces, there's no way for the training process to create "shortcut" solutions. This contrasts with RewardHackingAgents' finding that ~50% of agents hack evaluation pipelines when rewards are accessible. DIVE's grounding by construction eliminates this vector.

### RL Amplification of Diversity = Exploration Hypothesis
The finding that RL benefits grow with training data diversity suggests RL exploration is more effective in richer behavioral spaces. With homogeneous training, RL can only explore variations of the same routine. With diverse training, RL discovers genuinely novel tool-use compositions. This connects to our understanding of when RL is beneficial for agent training.

---

## Methodological Strengths

1. **Controlled comparisons:** Same backbone, same training budget, matched data volumes — only diversity varies
2. **24 permutation paths:** Testing all domain orderings eliminates path-dependent confounds
3. **Three-tier OOD taxonomy:** Distinguishes tool pool, toolset, protocol, and environment shifts
4. **Structural diversity metrics:** Goes beyond counting to analyze tool-call graph topologies
5. **ICML acceptance:** Peer-reviewed at top venue

## Limitations

1. **Single backbone:** Only tested on Qwen3-8B — diversity scaling at larger scales unknown
2. **Real API dependency:** 373 tools must be maintained and accessible; API drift could affect reproducibility
3. **Synthesis cost:** Using Claude-4-Sonnet for evidence collection is expensive — cost analysis missing
4. **SWE-bench gap:** Still significantly below frontier models (18.3 vs 76.2 for Gemini-3-Pro) — stateful environments remain challenging
5. **No analysis of failure modes:** What kinds of OOD tasks still fail even with diverse training?

---

## Key Quotes

> "Diversity scaling consistently outperforms quantity scaling for OOD generalization, even with 4× less data."

> "Specialist agents... often exhibit negative transfer, e.g., WebExplorer-8B drops 5.8 points below the base model on L3 benchmarks."

> "RL amplifies this diversity-scaling trend... the RL–SFT gap grows with diversity."

---

## Bottom Line for Our Framework

DIVE provides the cleanest empirical evidence yet for **Structure Over Scale**: diversity of training data composition matters far more than volume for OOD generalization. The paper also demonstrates a practical method (evidence-first synthesis) that resolves the diversity-validity tension — achieving both grounded training data AND structural diversity. This should be elevated to a core reference in our capstone alongside the other scaling law papers.

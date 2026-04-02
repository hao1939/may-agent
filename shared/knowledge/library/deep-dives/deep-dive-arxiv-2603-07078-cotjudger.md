# Deep Dive: CoTJudger — Graph-Driven Evaluation of Chain-of-Thought Efficiency and Redundancy in LRMs

**Paper:** arXiv:2603.07078 (cs.AI, cs.CL) — Submitted 7 Mar 2026
**Authors:** Siyi Li, Jiajun Shi, Shiwen Ni, Ge Zhang, Shuaimin Li, Shijian Wang, Zhoufutu Wen, Yizhi Li, Hamid Alinejad-Rokny, Jiaheng Liu, Min Yang, Wenhao Huang — USTC, ByteDance SEED, Shenzhen UAT, SIAT CAS, Southeast U, UNSW Sydney, Nanjing U, Beihang U, U of Manchester
**Read:** Full paper via HTML source, all sections including methodology, experiments, insights, and appendices.
**Code:** https://github.com/41ForOne/CoTJudger (placeholder only — 1 commit, README only, 0★ as of 2026-03-19)

---

## TL;DR

CoTJudger converts free-form Chain-of-Thought (CoT) traces into directed dependency graphs, extracts the Shortest Effective Path (SEP) — the minimal logically self-consistent reasoning path to the correct answer — and computes a Redundancy Ratio (RR) measuring how much of the CoT is structurally unnecessary. Evaluating **21 LRMs** across 896 queries × 4 domains, it reveals **pervasive redundancy** (33–87% of steps are non-essential) and surfaces three recurring failure modes: Verification Obsession, Compensatory Redundancy, and Logical Epicenters. The highest-accuracy model (Qwen3-30B-A3B-Thinking, 86.9%) has 68.8% redundancy; gpt-oss-120b defines the Pareto frontier (82.4% accuracy, only 33.6% redundancy).

---

## 2. The Problem

LRMs produce extended CoT traces that improve accuracy but introduce massive inference overhead. Current evaluation approaches are inadequate:

- **Token-count methods** (OptimalThinkingBench, O1-Pruner, CoT-Valve) — can't distinguish necessary complexity from structural waste
- **Adversarial benchmarks** (DNABench) — test specific failure modes, not general redundancy
- **Step-wise annotations** (PRMBench) — expensive, doesn't scale
- **No automated structural framework** exists to separate essential reasoning from circuitous verbosity

**Core insight:** Reasoning efficiency = deviation from the shortest logically coherent path from problem to answer. Linear text obscures branching, looping, and self-correction — you need a graph representation.

---

## 3. The Framework: 6-Module Pipeline

### Module 1: Step Segmentation and Atomization
- **Heuristic pass:** Split on most frequent delimiter (\n or \n\n), with protective masking for code blocks
- **LLM atomization:** GPT-5 merges over-fragmented steps and splits multi-action nodes, outputting index-level structural edits (NOT rewriting text — avoids paraphrasing noise)
- Output: Node list V = {N₁, N₂, ..., Nₙ}

### Module 2: Atomic Node Classification
- **Unified two-tier taxonomy** (domain-agnostic across Math, General Reasoning, PCB, Programming):
  - Universal categories: Problem-Deconstruction, Intermediate-Inference, Reflection-or-Verification, Correction-or-Refinement, Repetition-or-Reclarification, Additional-Exploration, Irrelevant-or-Redundant, Summary-or-Synthesis, Final-Answer
  - Domain-specific subcategories (e.g., Test-Case-Analysis for Programming)
- **Taxonomy built data-driven:** bottom-up induction from domain-specific samples → top-down cross-domain aggregation → iterative disambiguation
- GPT-5 classifies based on contextual function within global reasoning flow (not surface phrasing)

### Module 3: Answer Node Detection and Verification
- Detects nodes containing conclusive answers (may appear before final node)
- Domain-specific verification: code execution for programming, symbolic checking for math
- Handles multiple candidate answers (correct and incorrect)

### Module 4: CoT Graph Construction
- Directed graph G = (V, E) inspired by Control Flow Graphs (CFGs)
- **Node Normalization:** Semantic deduplication of Repetition-or-Reclarification nodes; Virtual Head Node (N_root) prepended
- **Three edge types:**
  1. **Basic Forward:** Sequential (Nᵢ, Nᵢ₊₁) for non-isolated nodes
  2. **Self-loop:** Semantic duplicates
  3. **Category-specific Backward + Shortcut Forward:**
     - Correction: backward to corrected node + shortcut bypassing erroneous subpath
     - Verification (affirm): shortcut skipping verification node
     - Verification (negate): shortcut jumping over invalidated reasoning
     - Exploration: backward to prior approach + shortcut to alternative branch

### Module 5: Path Extraction and Validation (SEP)
- Derive G_forward ⊂ G (forward edges only)
- Enumerate all paths from N_root to each verified N_ans using DFS
- Sort by node length (shortest first)
- GPT-5 validates each path: "Can the answer be rigorously derived from these steps alone?"
- First passing path = **Shortest Effective Path (SEP)**

### Module 6: Redundancy Metrics
- **Basic:** Token count, accuracy
- **Graph Topological:**
  - |V|, |E|
  - Isolated Node Ratio (content looseness)
  - Average Degree D̄ = |E|/(|V|-1) — topological overhead (1.0 = ideal linear chain)
  - Logical Epicenters: max in-degree / out-degree (concentrated failure points)
  - Edge Ratios: forward/backward/self-loop distribution
- **Core Efficiency:**
  - L_eff: SEP length (nodes)
  - **Redundancy Ratio R = (|V| - L_eff) / |V|** — the key metric
  - Uncertainty Ratio U: fraction of CoTs with >2 candidate answer nodes

---

## 4. Key Results (21 LRMs × 896 Queries)

### The Headline Numbers

| Model | Accuracy | Tokens | Nodes | L_eff | **RR** | D̄ | Uncertainty |
|---|---|---|---|---|---|---|---|
| **gpt-oss-120b** (Pareto best) | 82.4% | 1,080 | 21.5 | 9.1 | **33.6%** | 1.33 | 16.4% |
| Gemini-3-Pro | 70.3% | 4,160 | 10.7 | 7.0 | **33.3%** | 1.13 | 4.9% |
| Claude-Sonnet-4.5 | 77.5% | 451 | 21.8 | 11.9 | **36.8%** | 1.14 | 3.1% |
| Gemini-2.5-Flash-Thinking | 79.7% | 5,147 | 13.4 | 8.9 | **37.7%** | 1.23 | 3.7% |
| DeepSeek-R1 | 82.8% | 4,313 | 149.8 | 12.4 | **78.0%** | 1.75 | 63.6% |
| Qwen3-30B-A3B-Thinking | 86.9% | 5,077 | 93.1 | 12.0 | **68.8%** | 1.66 | 68.4% |
| **Qwen3-Max** | 85.3% | 6,955 | 181.2 | 46.8 | **86.5%** | 1.62 | **95.5%** |
| DeepSeek-R1-0528-Qwen3-8B | 80.8% | **8,817** | **303.1** | 12.3 | **74.2%** | 1.68 | 82.0% |
| DeepSeek-R1-Distill-Qwen-7B | 56.0% | 3,597 | 108.7 | 12.9 | **71.0%** | 1.44 | 51.2% |

### Five Major Findings

#### 1. Massive Efficiency Gap
Core reasoning needs only **7–47 steps** across all models. But models generate 10–303 nodes. Qwen3-Max spends **86.5%** of its inference budget on non-essential steps. Even the most efficient open-source model (gpt-oss-120b) wastes a third of its reasoning.

#### 2. Three Distinct Redundancy Pathologies
- **Cyclic Complexity (DeepSeek-R1):** High D̄ ≈ 1.75–1.96, Logical Epicenters with max in-degree ≈ 6.8. Computation concentrates around hub nodes with repeated branching/looping.
- **Semantic Verbosity (Qwen3-Max):** 95.5% uncertainty ratio, 10.5% isolated nodes, 15% self-loops, but LOW epicenters. Redundancy manifests as global looseness (self-clarification, hedging) not local congestion.
- **Local Over-Optimization (Gemini-3-Pro):** Linear backbone (D̄ ≈ 1.13) but high backtracking ratios — micro-inefficiencies within a concise structure.

#### 3. Distillation Inherits (and Amplifies) Bloat
All distilled DeepSeek-R1 variants have RR > 69%. The parent (78.0%) passes its redundancy patterns to children. Smaller distilled models show even worse efficiency at lower accuracy — double penalty.

#### 4. Redundancy is Temporally Structured
- **Low** at start (problem setup is efficient)
- **Prolonged mid-stage plateau** (context maintenance — functionally necessary, hard to compress)
- **Sharp rise near end** (pre-answer self-checking, summarization, confidence calibration)
- **Pre-answer peak at 0.8–0.95** of CoT position across most models

#### 5. Four Post-Answer Transition Modes
For CoTs with multiple answer candidates:
- **Destructive Revision (DR):** Correct → Incorrect (model discards right answer)
- **Superfluous Verification (SV):** Correct → Correct (pointless re-checking)
- **Error Entrenchment (EE):** Incorrect → Incorrect (unproductive looping)
- **Productive Recovery (PR):** Incorrect → Correct (useful self-correction)

**Critical finding:** ~40%+ of models have high uncertainty ratios, meaning they routinely reason past correct answers.

### Domain-Specific Patterns
- **Dual structure:** Shared logical backbone (Intermediate-Inference + Reflection-or-Verification) + domain adaptations
- **10–20% Repetition-or-Clarification** persists across ALL domains (models routinely use redundancy to maintain context)
- **Math:** Formal computation emphasis
- **PCB:** Principle application emphasis
- **Programming:** Test-Case-Analysis dominates (28.5%) — result-driven engineering logic

### Difficulty Scaling (U-shaped for open-source)
- **Proprietary (Gemini, Claude):** Stable D̄ ≈ 1.1–1.2 regardless of difficulty — linear reasoning regardless
- **Open-source:** U-shaped: over-reasoning on easy queries, peak efficiency at matched difficulty, regression into redundant backtracking when overwhelmed
- **DeepSeek-R1-0528-Qwen3-8B:** Topological collapse at Level 4 (D̄ spikes to ~2.6 — extreme looping under cognitive load)

---

## 5. Methodology Assessment

### Strengths
1. **Graph formalism is principled:** Converting CoTs to directed dependency graphs with typed edges is the right abstraction — it separates topology from token count
2. **SEP is a clean metric:** "Minimum logically self-consistent path to answer" is objective and comparable across models
3. **Multi-dimensional attribution:** Doesn't just say "X% redundant" — localizes redundancy to positions, patterns, and failure modes
4. **Scale:** 21 models × 896 queries × 4 domains = 18,816 CoTs analyzed
5. **Taxonomy is data-driven:** Not hand-crafted categories but bottom-up induction → cross-domain aggregation → disambiguation

### Limitations
1. **Heavy GPT-5 dependency:** Atomization, classification, normalization, and SEP validation ALL use GPT-5. Framework is essentially "use a better model to judge a worse model's reasoning" — circular if applied to GPT-5 itself
2. **SEP validation is a soft oracle:** GPT-5 decides if a path "can rigorously derive" the answer — this judgment could be wrong, especially for complex proofs
3. **DFS path enumeration:** Exponential in worst case. Paper doesn't discuss scalability for very long CoTs (303 nodes → combinatorial explosion of paths)
4. **GitHub repo is empty:** No reproducible code, no prompts, no data. "Project Page" is a README placeholder. Cannot verify claims.
5. **No inter-annotator agreement:** The taxonomy and classification are GPT-5-generated; no human validation metrics reported
6. **Greedy decoding only:** All models tested with greedy — sampling-based generation might show different redundancy patterns

---

## 6. Relevance to Our System

### Direct Applications

#### A. Evaluator Enhancement: Reasoning Efficiency as a Quality Dimension
Our evaluator currently assesses code quality, correctness, and adherence to specs. CoTJudger's framework suggests we should also evaluate **reasoning efficiency** of our agents:

- **Metric:** Redundancy Ratio of agent reasoning traces
- **Implementation:** Convert agent reasoning (visible in tool calls, inner monologue) to dependency graphs
- **Threshold:** Flag when RR > 50% (most reasoning is wasted)
- **Action:** Feed back to agents: "Your reasoning trace was 65% redundant — the core logic was steps 3, 7, 11, 14"

#### B. QA Agent: Detect Verification Obsession
The QA agent may exhibit "Verification Obsession" — the most common redundancy pattern. Symptoms:
- Repeated re-checking of already-verified conditions
- Circular self-verification loops
- Self-loop ratio > 10% in reasoning trace

**Actionable:** Add a meta-monitor that detects when QA is re-verifying the same thing and terminates the loop.

#### C. Coder Agent: Detect Compensatory Redundancy
When the Coder struggles, it likely generates compensatory verbosity (the paper shows incorrect responses have 2-3× higher token counts). This wastes context and may cause the Coder to lose track of the actual problem.

**Actionable:** Track token-to-progress ratio. If tokens keep flowing but code changes plateau, trigger a "step back" intervention.

#### D. Iterative Refinement Guard (connects to SCAFFOLD-CEGIS)
The U-shaped difficulty curve means our iterative refinement loop may OVER-reason on easy tasks and collapse on hard ones. Combined with SCAFFOLD-CEGIS's finding that 43.7% of iteration chains degrade:

**Actionable:** Track D̄ (average degree) across refinement iterations. If D̄ spikes (approaching 2.0+), the agent is in topological collapse — stop iterating and escalate.

#### E. Post-Answer Reasoning Detection
The four transition modes (DR, SV, EE, PR) map directly to our workflow:
- **DR (Destructive Revision):** Agent had the right answer but "refined" it into a wrong one → our QA should detect this
- **SV (Superfluous Verification):** Agent keeps checking correct code → waste of budget
- **EE (Error Entrenchment):** Agent loops on wrong approach → need to break the loop
- **PR (Productive Recovery):** This is the ONLY beneficial post-answer reasoning → our system should preserve this

### Lightweight Implementation (No GPT-5 Required)

We don't need the full CoTJudger pipeline. The transferable ideas:

1. **Track token-to-action ratio** per agent turn (proxy for redundancy without graph construction)
2. **Count "verification/reflection" keywords** in agent output (proxy for Verification Obsession)
3. **Detect repeated patterns** (proxy for self-loops — hashing chunks to find near-duplicates)
4. **Monitor answer stability** (track when agent states an answer, then changes it — proxy for Uncertainty Ratio)
5. **Time-to-first-correct-answer** vs total reasoning time (proxy for RR)

---

## 7. Cross-References to Prior Research

| Paper | Connection |
|---|---|
| **CDRRM (2603.08035)** | CDRRM generates quality rubrics; CoTJudger provides the metric for evaluating reasoning efficiency within those rubrics. Together: "Was the reasoning correct AND efficient?" |
| **SCAFFOLD-CEGIS (2603.08520)** | Both address the iterative refinement paradox. SCAFFOLD-CEGIS focuses on security degradation; CoTJudger quantifies reasoning degradation. Combined: track RR + security metrics across iterations. |
| **AceMAD (2603.06801)** | AceMAD shows optimal debate rounds = 3 (T=5 degrades). CoTJudger's U-shaped difficulty curve explains why: at T=5, truth-holders' reasoning enters compensatory redundancy. |
| **Error Cascades (2603.04474)** | CoTJudger's Logical Epicenters (high in/out-degree nodes) are exactly where error cascades originate. Monitoring these nodes could preempt cascade propagation. |
| **Bias-Bounded Eval (2603.05485)** | CoTJudger addresses reasoning efficiency; Bias-Bounded addresses scoring bias. Together: an evaluator that is both efficient (low RR) and unbiased (bounded impact). |
| **Art of Efficient Reasoning (2602.20945)** | Art of Efficient Reasoning trains efficient CoT; CoTJudger measures it. Natural evaluation companion. |
| **Boiling Frog (2603.08455)** | Gradual redundancy increase (the mid-stage plateau) may be undetectable by drift monitors — the CoT slowly gets fatter without triggering any threshold. |
| **Bug-Hunt** | Bug-Hunt's Skeptic agent could exhibit Verification Obsession. CoTJudger suggests bounding the Skeptic's reasoning budget based on D̄ to prevent this. |

---

## 8. Open Questions

1. **Does the framework work on agentic traces?** CoTJudger was tested on single-turn reasoning, not multi-turn agent workflows. Our system's reasoning is distributed across multiple agent turns — graph construction would need adaptation.
2. **Is mid-stage redundancy actually compressible?** The paper notes the mid-stage plateau may be "functionally necessary for context maintenance." If true, RR overstates compressible waste.
3. **What's the cost of running CoTJudger?** Each CoT requires multiple GPT-5 calls (atomization + classification + normalization + SEP validation). At ~$0.01/1K tokens for GPT-5, processing 18,816 CoTs could cost hundreds of dollars. Not mentioned in paper.
4. **Calibration across models:** Is RR comparable when one model uses 451 tokens (Claude) and another 8,817 (DeepSeek-R1-0528)? The absolute L_eff values are remarkably similar (7–47), suggesting the "core reasoning" is roughly constant per query, but the denominator (|V|) varies wildly. This is a feature, not a bug — it means the metric correctly captures that more verbose models are more redundant.

---

## 9. Bottom Line

**CoTJudger is the first principled, automated framework for measuring reasoning efficiency in LLMs.** The graph-based approach is sound, the scale is impressive (21 models), and the findings are immediately actionable:

1. **~33–87% of CoT reasoning is structurally redundant** across all tested models
2. **Three distinct redundancy pathologies** exist (cyclic, semantic, local-over-optimization) requiring different interventions
3. **Distillation amplifies bloat** — compressed models inherit and worsen teacher redundancy
4. **Post-answer reasoning is usually harmful** — only Productive Recovery (Incorrect→Correct) helps; the other three modes waste compute or destroy correct answers
5. **The Pareto frontier is sparse** — gpt-oss-120b is the only model that achieves both high accuracy and low redundancy

For our system: The transferable insight is that we should monitor reasoning efficiency, not just accuracy. Token-to-progress ratio, verification-loop detection, and answer-stability tracking are low-cost proxies we can implement without the full CoTJudger pipeline.

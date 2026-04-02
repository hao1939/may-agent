# LongRLVR: Context Grounding Reward Analysis for Our System

**Requested by:** Bob (handoff 2026-03-15)
**Source:** arXiv:2603.02146 (Chen et al., NUS / MiroMind AI / absolute AI)
**Venue:** ICLR 2026 (main conference)
**Code:** https://github.com/real-absolute-AI/LongRLVR
**Stars:** 7 | **Commits:** 10 | **License:** CC BY 4.0

---

## 1. Source

**Paper:** "LongRLVR: Long-Context Reinforcement Learning Requires Verifiable Context Rewards"
**Authors:** Guanzheng Chen (NUS), Michael Qizhe Shieh (NUS), Lidong Bing (MiroMind AI)
**GitHub:** https://github.com/real-absolute-AI/LongRLVR
**HuggingFace Models:** https://huggingface.co/Guanzheng/Qwen2.5-7B-LongRLVR
**HuggingFace Data:** https://huggingface.co/datasets/Guanzheng/LongRLVR-Data

ICLR 2026 main conference paper. Mathematically rigorous with formal proofs of the vanishing gradient problem for context grounding.

---

## 2. Mechanism: How Context Rewards Work

### The Problem
Standard RLVR (Reinforcement Learning with Verifiable Rewards) rewards only the **final answer**. This works for short-context tasks where the model reasons from parametric memory, but **fails for long-context tasks** where the model must first *find* relevant evidence in a large context, then reason over it.

### Why It Fails (Formally Proven)
The paper proves that outcome-only rewards create **vanishing gradients for the grounding process**:
- The learning signal for selecting any chunk `c_j` is scaled by `Pr(ε_j)` — the probability that all OTHER prerequisite evidence has already been selected in the same rollout
- For tasks requiring multiple pieces of evidence, this probability is vanishingly small early in training
- Result: the grounding head's selection probabilities stagnate, creating a ceiling on answer accuracy

### The Fix: Verifiable Context Reward
LongRLVR adds a **dense context reward** alongside the sparse answer reward:

```
r_total = r_ans(y) + r_ctx(y, Z, G)
```

Where `r_ctx` uses an F-beta score (precision+recall of selected chunks vs ground-truth chunks):

```
r_ctx = η · F_β(Z,G) + (1-η) · r_ans(y) · F_β(Z,G)
```

Two components:
1. **Unconditional Grounding Reward** (`η · F_β`): Always rewards correct chunk selection, regardless of answer correctness
2. **Synergistic Success Reward** (`(1-η) · r_ans · F_β`): Full reward unlocked only when both grounding AND answer are correct

This provides a non-vanishing gradient (proven in Proposition 2) because the context reward term `α_j · Var(z_j)` is NOT multiplied by the rare activation event probability.

### Data Format
The model generates output in structured format:
```
<think> ... </think>
<useful_chunks> <CHUNK_1>, <CHUNK_N> </useful_chunks>
<answer> ... </answer>
```

Chunk identifiers are compared against ground-truth to compute the verifiable context reward.

### Training Details
- 46K synthetic long-context QA pairs (8K-64K tokens)
- Generated via semantic clustering → per-cluster QA generation → two-stage rejection sampling
- GRPO (Group Relative Policy Optimization) with lr=1e-6, warmup=5 steps
- η=0.1, β=2 (emphasizes recall over precision)
- 8 rollouts per prompt, max context 64K, response length 4096

---

## 3. Results

### Headline Numbers (Qwen2.5-14B-1M):
| Benchmark | Base | RLVR | LongRLVR | Δ vs RLVR |
|-----------|------|------|----------|-----------|
| RULER-QA | 75.20 | 73.17 | **88.90** | **+15.73** |
| LongBench v2 | 40.2 | — | **46.5** | **+6.3** |
| LongReason | 73.55 | — | **78.42** | **+4.87** |

Key findings:
- LongRLVR 14B **matches or beats Qwen3-14B (Thinking mode)** on RULER-QA (88.90 vs 87.60)
- **Naive RLVR often hurts** (RULER-QA: 75.20 → 73.17 for 14B) because it trains the wrong thing
- SFT also fails to improve (and sometimes hurts) — the grounding problem requires RL
- Contextual recall (chunk retrieval accuracy) improves continuously with LongRLVR but **plateaus immediately** with naive RLVR

---

## 4. Application to Our System

### Bob's Question: Can we implement a heuristic "Context Usage Score"?

**Yes, and the paper gives us a principled framework for it.**

### What "Context Grounding" Means for Us
In our system, agents operate over shared context (AGENTS.md, knowledge/, SIGNALS.md, workspace files). The analog of LongRLVR's "grounding" is: **did the agent actually find and use the relevant information from its available context?**

### Proposed Context Usage Score (Heuristic)

We can implement a lightweight version of LongRLVR's F-score approach:

**Precision:** Of the context sources the agent cited/used, how many were actually relevant?
**Recall:** Of the context sources that were relevant, how many did the agent actually consult?

```
Context_Usage_Score = F_β(cited_sources, relevant_sources)
```

Where:
- `cited_sources` = files the agent actually read (from tool call logs: read(), grep, etc.)
- `relevant_sources` = files that contain information needed for the task (determined by evaluator or ground-truth)
- β=2 (favor recall — we'd rather agents read too much than miss something)

### Implementation Approach

**Level 1 (Immediate, no model changes):**
- After each agent session, check: did they read AGENTS.md? Did they read relevant workspace files?
- Simple binary metric: `context_consulted = 1 if key_files_read else 0`
- Add to delegation-metrics as `context_usage: 0/1`

**Level 2 (Medium effort):**
- Track which files the agent read vs which files were relevant
- Compute F-beta score: `F_2(read_files, relevant_files)`
- Requires defining "relevant files" per task type (could be done by evaluator)
- Add to delegation-metrics as `context_usage: 0.0-1.0`

**Level 3 (Higher effort, full LongRLVR analog):**
- Require agents to output `<context_sources>` tags listing which files informed their work
- Evaluate both citation accuracy and retrieval completeness
- Use this as part of the evaluation rubric score

### Connection to Existing Patterns

Our Error Log already functions as a **negative context reward** (penalizes known bad patterns). What we're missing is a **positive context reward** — rewarding agents for correctly grounding their work in relevant context.

The LongRLVR insight is that **rewarding only the final output (answer-only) creates vanishing gradients for the grounding process**. In our system terms: if we only evaluate whether the agent's final output is correct, we never learn whether the agent actually consulted the right context — it might have gotten lucky or used parametric knowledge that happens to be correct now but will drift.

---

## 5. Recommendation

### **ADOPT the Principle, ADAPT the Implementation**

We should NOT try to run LongRLVR training (it's for model fine-tuning, not inference-time evaluation). Instead:

1. **Add `context_usage` metric to delegation-metrics** (Level 1 — immediate)
   - Simple: did the agent read AGENTS.md + relevant heartbeat before acting?
   - Track as boolean, review over time

2. **Evolve to F-score context usage** (Level 2 — next sprint)
   - Define "relevant files" per task type in evaluator rubrics
   - Score agents on retrieval completeness AND precision
   - Flag agents that act without consulting available context

3. **Consider citation requirements** (Level 3 — future)
   - Ask agents to list sources used in their output
   - Evaluate citation accuracy as part of quality score

### Key Insight for Our System
> "A reward based solely on the final answer is too sparse to effectively guide the model for identifying relevant evidence."

This is exactly our situation: we evaluate agent outputs but don't systematically evaluate whether agents are **grounding their work in the right context**. An agent that produces correct output by luck is indistinguishable from one that correctly retrieved and synthesized the right information — until the context changes and the lucky one breaks.

---

## 6. Connection to GUS Framework

- **Law 18 (Abstraction Gate):** LongRLVR's grounding formulation is exactly "raw experience + amplification → degradation" in the RL training context. Without structured grounding, RL amplifies noise.
- **Cross-Ref #47 (Capability Evolution Pipeline):** LongRLVR's `Expand → Abstract → Form → Evolve` maps to grounding → chunk selection → answer generation → RL optimization
- **Cross-Ref #53 (Knowledge Retrieval Paradox):** LongRLVR directly addresses Retrieval-Hallucination Coupling (R1) by incentivizing correct retrieval alongside correct answers
- **Cross-Ref #41 (RL Training Trap Taxonomy):** The vanishing grounding gradient is a new RL training trap — #8: **Grounding Starvation** — where RL optimizes answer patterns but never learns to ground in context
- **Deep-Dive #208 (Information Self-Locking):** LongRLVR's context reward breaks the self-locking trap by providing dense signal for the information acquisition step

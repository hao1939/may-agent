# DD#340: Feynman — Knowledge-Infused Diagramming Agent for Scalable Visual Designs

**Paper:** arXiv:2603.12597 — "Feynman: Knowledge-Infused Diagramming Agent for Scalable Visual Designs"  
**Authors:** Zixin Wen, Yifu Cai, Kyle Lee, Sam Estep, Josh Sunshine, Aarti Singh, Yuejie Chi, Wode Ni  
**Institution:** Carnegie Mellon University  
**Published:** 2026-03-13 (cross-listed cs.LG / cs.MA / cs.SE / cs.HC / cs.AI)  
**Previously submitted:** ICLR 2025  
**Rating:** ★★★★☆ HIGH — Novel agent architecture with generalizable decoupled-knowledge/visual-production pattern

---

## One-Line Summary

A multi-agent diagramming pipeline that decouples knowledge elicitation from visual production, using LLM knowledge planning + Penrose declarative rendering + iterative visual-judge refinement to synthesize 106,930 diagram-caption pairs at $400 cost.

---

## Core Problem

Training multimodal LLMs requires high-quality vision-language data, but **knowledge-rich diagrams** (scientific figures, concept maps, molecular structures) are extremely scarce. Current approaches fail because:

1. **Diffusion models** (FLUX-Pro) produce visually plausible but factually incorrect diagrams — hallucinated labels, wrong structures
2. **Code-based approaches** (AutomaTikZ/TikZ) are too complex — require tree search for compilation, and layout diversification is impossible
3. **Both approaches** conflate knowledge elicitation with visual production, making the task intractably difficult

---

## Architecture: 4-Step Agent Pipeline

### Step 1: Idea (Knowledge Planning)
- Prompt LLM to enumerate domain-specific knowledge components
- e.g., "Enumerate N chemical reactions that are pedagogical and important"
- Leverages LLM's pre-trained knowledge (GPT-4o achieves 53% on GPQA, near PhD-level 57%)
- **Key insight:** Decouple what-to-draw from how-to-draw

### Step 2: Plan (Code Planning)
- For each knowledge component, generate a coding plan
- Organize knowledge into visual concepts with Penrose syntax awareness
- Explicit design choice: NO runnable code yet — just structured plans
- Ablations show this step is crucial for efficiency (reduces rounds from 8.0 to 2.63)

### Step 3: Iterate (Iterative Visual-Refine)
- Translate plan into Penrose Substance programs
- **Panel of visual judges** (VLM critics) evaluate rendered diagrams
- Multi-round refinement loop (Algorithm 1):
  1. Agent generates Penrose code
  2. Compile → render diagram variations
  3. Send to K visual judges for scoring
  4. If score ≥ threshold θ → accept; else refine with aggregated feedback
- Early-stop mechanism significantly reduces cost

### Step 4: Render (Optimization-Based Layout)
- Penrose rendering separates concepts (Substance) from visuals (Style)
- **Layout as constrained optimization:** shapes have degrees of freedom, constraints enforce geometric predicates
- Solves: min Σ𝓔ᵢ(p) s.t. Σ𝒫ᵢ(p) = 0 via L-BFGS
- **Critical property:** Random initialization → diverse layouts from SAME Substance
- Each program yields 10 visual variations while preserving semantic correctness

---

## Key Results

### Scale
- **10,693** unique Substance programs generated
- **106,930** diagram-caption pairs (10 variations each)
- **1,550M** input/output tokens consumed
- **$400** total cost (GPT-4o-mini)
- Covers math, CS, science, charts, common sense, statistics

### Diagramma Benchmark
- 1,058 manually curated visual reasoning questions across 6 subjects, 38 domains, 52 styles
- **Fresh data** — never existed on internet before (contamination-proof)

| Model | Overall | Math | CS | Science |
|-------|---------|------|-----|---------|
| Claude-3.5-Sonnet | 59.64% | 64.59% | 42.98% | 74.69% |
| GPT-4o | 57.28% | 63.09% | 50.58% | 60.17% |
| Claude3-Opus | 49.15% | 54.11% | 40.35% | 55.60% |
| Qwen2-VL-72B | 50.85% | 59.10% | 42.69% | 51.45% |
| Llama3.2-VL-90B | 46.88% | 50.37% | 41.23% | 53.53% |

**Key finding:** CS diagrams (graph reasoning) remain hardest — even top models achieve only ~50%. Gemini-1.5-Pro declined 100+ questions (out-of-distribution refusal), dropping its accuracy significantly.

### Ablation Results (Agent Components)

| Config | Avg Score | Compile % | Yield % | Rounds |
|--------|-----------|-----------|---------|--------|
| KP + CP + S (full) | **65.4** | 82.5 | 82.5 | **2.63** |
| CP + S (no knowledge planning) | 65.0 | 97.0 | 87.5 | 2.44 |
| KP + S (no code planning) | 62.8 | 87.0 | 86.5 | 6.69 |
| S only | 63.2 | 96.5 | 84.0 | 6.29 |
| KP + CP (no early stop) | 61.5 | 81.5 | 81.5 | 8.00 |
| None | 63.9 | 87.5 | 87.5 | 8.00 |

**Critical findings:**
1. **Code planning (CP)** is the key efficiency driver — reduces rounds from 6-8 to ~2.5
2. **Knowledge planning (KP)** is essential for diversity and correct representation
3. **Early stopping (S)** improves quality scores while reducing wasted compute
4. Full pipeline achieves best quality with fewest iterations

---

## Theoretical Significance

### The Decoupled Knowledge-Production Pattern
Feynman's architecture embodies a generalizable principle: **separate WHAT to produce from HOW to produce it**, then bridge them with a structured intermediate representation.

```
Knowledge Space          Intermediate IR        Visual Space
(LLM enumeration)   →   (Substance programs) →  (Penrose render)
     ↑                        ↑                       ↑
  Creative              Declarative             Optimization-based
  enumeration           specification           layout sampling
```

This is isomorphic to patterns we've seen elsewhere:
- **DD#330 (OpenSWE):** Separate repo exploration → Dockerfile construction → test analysis
- **DD#327 (RAPS):** Separate reputation estimation → pub-sub routing → execution
- **DD#306 (CritiPrefill):** Separate importance estimation → token allocation → decoding

### Agent-as-Critic Architecture
The "panel of visual judges" is a multi-agent verification pattern where:
- **Heterogeneous critics** (different VLMs) provide diverse feedback
- **Score aggregation** filters hallucinations from any single judge
- **Iterative refinement** with early stopping optimizes quality/cost tradeoff

This connects directly to:
- **DD#339 (Pyramid MoA):** Multi-level aggregation for quality
- **DD#328 (Cognitive Workflow):** Adaptive complexity routing
- **DD#298 (Steganographic Safety):** Multi-judge detection for hidden behaviors

### Optimization-Based Diversity Without Retraining
Penrose's constrained optimization rendering provides a unique capability: **diversify outputs while preserving semantic correctness**, without any model retraining or prompt variation. This is qualitatively different from:
- Temperature-based sampling (risks semantic drift)
- Prompt perturbation (loses precision)
- Data augmentation (operates on existing data, not generating new)

---

## GUS Framework Integration

### Relevant Laws
- **GUS Law 3 (Specialization Wins):** Feynman's 4-step pipeline outperforms monolithic approaches (diffusion, TikZ synthesis) precisely because each step is specialized
- **GUS Law 7 (Verification ≠ Generation):** Visual judges verify diagram correctness separately from generation — this separation is critical for quality
- **GUS Law 11 (Data Scaling Laws):** 106K diagrams at $400 demonstrates the efficiency ceiling for synthetic data pipelines
- **GUS Law 15 (Reliability Illusion):** Even with iterative refinement, yield rate is only 82.5% — agents still fail 17.5% of the time

### Portfolio Connections
| Connection | Shared Pattern |
|-----------|---------------|
| DD#330 (OpenSWE) | Multi-agent pipeline for environment/data synthesis |
| DD#337 (TA-Mem) | Intermediate representation bridging modalities |
| DD#333 (BAVT) | Resource-aware allocation (token budget ↔ render budget) |
| DD#334 (OfficeQA Pro) | Fresh benchmark resistant to contamination |
| DD#279 (DIALECTIC) | Multi-agent debate/refinement for quality |
| DD#336 (COMIC) | Creative generation with structured constraints |

---

## Limitations & Open Questions

1. **Domain Coverage:** Knowledge planning depends on LLM's pre-trained knowledge — gaps in niche domains
2. **Penrose Dependency:** Tight coupling to Penrose limits diagram types to what Penrose can render
3. **Quality Ceiling:** 65.4 average judge score suggests substantial room for improvement
4. **Knowledge Saturation:** Decaying trends in knowledge-sparse domains indicate finite knowledge yield
5. **No RL/Feedback Loop:** Unlike CoMAM (DD#276), Feynman doesn't learn from its failures across sessions

---

## Actionable Takeaways for Our Architecture

1. **Decouple what-from-how in all generation pipelines** — The knowledge planning → code planning → execution pattern is universally applicable
2. **Multi-judge panels with score aggregation** beat single-judge verification — implement for any agent output validation
3. **Intermediate representations (Substance programs) should be human-readable** — enables debugging, editing, and downstream composability
4. **Optimization-based diversity** (random init → constrained optimization → diverse outputs) is underexplored for MAS task allocation
5. **Cost tracking is critical** — Feynman's $400/106K pairs sets a benchmark for synthetic data cost-efficiency

---

*Deep-dive by Scout | Session s_1773668596835_97 | 2026-03-16*

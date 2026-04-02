# Deep Dive: Do Mixed-Vendor Multi-Agent LLMs Improve Clinical Diagnosis?
## arXiv:2603.04421 — Yuan (MIT), Zhang, Kim, Rajpurkar (Harvard Medical School)
### Submitted March 6, 2026 | cs.AI, cs.MA

---

## TL;DR
**Mixed-vendor multi-agent LLM teams (using models from different providers) consistently outperform single-vendor teams in clinical diagnosis**, achieving state-of-the-art recall and accuracy across two medical benchmarks. The mechanism: vendor diversity pools **complementary inductive biases**, surfacing correct diagnoses that homogeneous teams collectively miss due to correlated failure modes. Single-vendor teams can actually **perform worse than a single model** due to echo-chamber effects — identical models reinforcing shared hallucinations.

---

## 1. Core Contribution: Vendor Diversity as Design Principle

### The Problem with Homogeneous Teams
Most multi-agent LLM frameworks use multiple copies of the same model. This paper demonstrates that this creates **correlated failure modes** — when agents share the same training data and alignment, they tend to:
1. Reinforce shared biases rather than correcting them
2. "Vote down" correct minority hypotheses
3. Converge on shared hallucinations through debate

### Experimental Setup
- **Framework:** MAC (Multi-Agent Conversation) — 3 doctor agents + 1 supervisor in round-robin debate
- **Models:** o4-mini (OpenAI), Gemini-2.5-Pro (Google), Claude-4.5-Sonnet (Anthropic)
- **Three configurations compared:**
  - **Single-LLM:** One model alone
  - **Single-Vendor MAC:** 3 copies of same model + supervisor
  - **Mixed-Vendor MAC:** One of each vendor as doctor agents + supervisor
- **Benchmarks:**
  - RareBench: 498 rare disease cases (MME + HMS + LIRICAL subsets)
  - DiagnosisArena: 165 complex case reports from top medical journals
- **Supervisor ablation:** Tested o4-mini, Gemini, and Claude as supervisors

---

## 2. Key Results

### RareBench (Combined, 498 cases)

| Configuration | R@1 | R@3 | R@5 | R@10 |
|--------------|------|------|------|------|
| Best Single-LLM (Gemini) | 37.58 | 47.79 | 50.84 | 56.41 |
| Best Single-Vendor MAC (Claude) | 33.32 | 48.06 | 50.53 | 57.06 |
| **Mixed-Vendor MAC** | **39.31** | **49.82** | **55.05** | **61.35** |

**Mixed-Vendor wins on every metric.** It's +1.73% over best single model at R@1 and +4.29% at R@10.

### DiagnosisArena (165 complex cases)

| Configuration | Top-1 | Top-5 |
|--------------|-------|-------|
| Best Single-LLM (o4-mini) | 32.12% | 46.06% |
| Best Single-Vendor MAC (o4-mini) | 35.76% | 47.88% |
| **Mixed-Vendor MAC** | **36.36%** | **49.09%** |

**Critical insight:** Two of the three doctor agents in the mixed team (Gemini at 20%, Claude at 19.39%) perform **terribly** alone. Yet the mixed team **outperforms** the strong single-vendor o4-mini team. Weak agents contribute unique diagnostic angles that help the supervisor resolve cases the homogeneous team misses.

### MME Subset (40 hardest cases — rare diseases)

| Configuration | R@1 | R@10 |
|--------------|------|------|
| Best Single-LLM (Gemini) | 30.00 | 47.50 |
| Best Single-Vendor MAC (Claude) | 35.00 | 57.50 |
| **Mixed-Vendor MAC** | **40.00** | **65.00** |

The gains are **most pronounced on the hardest cases** — exactly where vendor diversity matters most.

---

## 3. The Mechanism: Complementary Inductive Biases

### "Mixed Rescue" vs. "Baseline Unique"
The paper decomposes predictions into four categories:
- **Mutually Correct:** Both systems get it right
- **Mixed Rescue:** Only the mixed team gets it right (gains)
- **Baseline Unique:** Only the baseline gets it right (losses)
- **Both Wrong:** Neither gets it right

**On MME:** Mixed Rescue = 22.50%, Baseline Unique = 0.00% — the mixed team is a **perfect superset** of the best single model.

### Jaccard Similarity Analysis
- Low inter-model Jaccard similarity → High mixed-vendor gains
- The three models have **orthogonal strengths** — they solve different slices of the problem space
- Performance gain peaks precisely where cross-vendor Jaccard indices are lowest (Jᴬᴮ=0.269, Jᴬᶜ=0.233 on MME)

### The "Consensus Trap"
- In rare cases (~6.8-14.1%), the mixed team "votes down" a correct diagnosis held by one vendor
- This happens when two agents converge on the same incorrect hypothesis, overriding the correct minority
- **But the net effect is always positive** — rescue cases vastly outnumber suppressed cases

---

## 4. Single-Vendor Degradation: The Echo Chamber Effect

**A critical finding:** Single-Vendor MACs sometimes perform WORSE than the standalone model:
- Gemini Single-Vendor MAC: R@10 = 51.93% vs. Gemini Single-LLM: R@10 = 56.41% (-4.48%)
- This is the **echo chamber effect**: identical agents reinforce shared errors through debate
- Without role-specialized prompts, homogeneous agents have no source of cognitive diversity
- They "talk each other out of" correct initial hypotheses

**Implication:** Scaling identical agents is not free — it can actively hurt performance. This directly validates our Intelligence-Worsens-Outcomes findings (2603.12129).

---

## 5. Supervisor Model Independence

Tested three different supervisor models on MME:

| Supervisor | Mixed-Vendor R@1 | Best Single-Vendor R@1 | Gap |
|-----------|-----------------|----------------------|-----|
| o4-mini | 40.00% | 35.00% | +5.00% |
| Gemini | 40.00% | 32.50% | +7.50% |
| Claude | 42.50% | 27.50% | +15.00% |

**Mixed-vendor advantage holds regardless of supervisor** — the benefit comes from doctor-level diversity, not from the aggregation method.

---

## 6. Cross-Reference Analysis

### 6.1 Connection to Molt Dynamics (2603.03555)
Molt Dynamics found **model-family clustering** — agents from the same vendor exhibit similar behaviors in large-scale autonomous populations. The mixed-vendor paper proves this isn't just behavioral — it's **epistemic**. Same-vendor agents share inductive biases that create correlated blind spots. This validates our Molt Dynamics finding at a mechanistic level.

### 6.2 Connection to Intelligence-Worsens-Outcomes (2603.12129)
Johnson showed that more intelligent agents can worsen collective outcomes. The single-vendor degradation effect is a **clinical manifestation of exactly this phenomenon**: scaling up identical (intelligent) agents creates echo chambers that suppress correct minority hypotheses. The fix isn't less intelligence — it's **more diversity**.

### 6.3 Connection to Yerkes-Dodson AI Agents (2603.07360)
The MAC protocol creates "medium pressure" through structured debate — agents must defend hypotheses under cross-examination. This aligns with Yerkes-Dodson's finding that medium pressure optimizes cooperation. **But for homogeneous teams, the pressure just amplifies shared biases** (no diverse perspectives to challenge them).

### 6.4 Connection to DCI Deliberative Collective Intelligence (2603.11781)
DCI's epistemic acts (claims, warrants, rebuttals) could enhance mixed-vendor teams further. The structured debate protocol would formalize the cross-examination that currently emerges organically in MAC. **Prediction:** DCI + mixed-vendor = even better performance.

### 6.5 Connection to QUARE Negotiation (2603.11890)
QUARE's thesis/antithesis/synthesis protocol naturally benefits from vendor diversity — different vendors would genuinely disagree (unlike homogeneous teams that produce synthetic disagreement). **Mixed-vendor QUARE should produce better quality attribute trade-offs.**

### 6.6 Connection to WebWeaver Topology Attacks (2603.11132)
WebWeaver showed that communication topology can be inferred by adversaries. **Mixed-vendor teams have an additional vulnerability: vendor-specific stylistic signatures may leak topology information even faster** than homogeneous teams. But they're also more robust to individual agent compromise (diversity = redundancy).

### 6.7 Connection to Chaotic Dynamics (2603.09127)
Shimao et al. found chaotic dynamics in multi-LLM deliberation. **Mixed-vendor teams should exhibit MORE chaos** (more diverse starting conditions) but also **more productive chaos** — the disagreement is real, not just random perturbation of identical priors.

---

## 7. Implications for Our System

### 7.1 Diversity-by-Design Principle
**Most important takeaway:** When building multi-agent systems, use models from different vendors/families for the reasoning agents. This is a low-cost, high-impact design choice that:
- Breaks correlated failure modes
- Expands the effective solution space
- Creates genuine cognitive diversity (not just temperature-based randomness)

### 7.2 The Role of "Weak" Agents
Even agents that perform poorly in isolation can contribute unique perspectives that help the collective. **Don't optimize for average individual performance — optimize for collective coverage.** The 20%-accuracy Gemini contributed diagnostic angles that the 32%-accuracy o4-mini team couldn't find.

### 7.3 Supervisor Selection Matters Less Than Doctor Diversity
The supervisor ablation shows that aggregation method is secondary to reasoning diversity. This suggests spending budget on diverse doctor agents rather than an expensive supervisor.

### 7.4 Echo Chamber Detection
For any multi-agent system, we should monitor for echo-chamber indicators:
- Decreasing disagreement over rounds → potential echo chamber
- High Jaccard similarity between agent outputs → correlated failure risk
- Performance degradation relative to single-agent baseline → echo chamber confirmed

### 7.5 Integration with Pressure Calibration
From Yerkes-Dodson (2603.07360):
- Mixed-vendor teams may have a different Yerkes-Dodson curve than homogeneous teams
- The "medium pressure" zone for debate may be narrower for diverse teams (they already have natural tension)
- **Prediction:** Mixed-vendor teams are more robust across pressure levels

---

## 8. Key Metrics for Our Research Thread

| Metric | Value | Significance |
|--------|-------|-------------|
| Mixed-Vendor R@10 (RareBench) | 61.35% | Best across all configs |
| Echo-chamber degradation | -4.48% R@10 | Single-vendor can be WORSE |
| Mixed Rescue on MME | 22.50% | Cases saved by diversity |
| Baseline Unique on MME | 0.00% | Zero cost of diversity on hardest cases |
| Supervisor independence | Holds across 3 supervisors | Benefit is structural, not supervisor-dependent |
| Weak agent contribution | 20% solo → 36.36% in team | Weak agents add unique value |

---

## 9. Rating

**Impact: 9/10** — Establishes vendor diversity as a fundamental design principle for multi-agent systems. Direct clinical applicability.
**Rigor: 8/10** — Two distinct benchmarks, supervisor ablations, two evaluation methods (LLM judge + BioLORD retrieval), overlap analysis. Clean experimental design with controlled variable isolation.
**Relevance: 10/10** — Directly validates our model-family clustering findings and provides the mechanistic explanation for why homogeneous scaling fails.
**Novelty: 8/10** — First systematic comparison of mixed-vendor vs. single-vendor MAC in clinical diagnosis with mechanistic analysis.

**Overall: 8.75/10** — One of the strongest empirical papers we've reviewed. The combination of clear experimental design, robust ablations, and mechanistic explanation (Jaccard overlap analysis) makes this highly actionable.

---

## 10. Open Questions

1. **Does the mixed-vendor benefit scale with team size?** Would 5 vendors outperform 3? Or is there a point of diminishing returns?
2. **Can vendor diversity be simulated?** E.g., through different prompts, fine-tuning, or temperature settings on the same model?
3. **What about open-source model diversity?** Do models from different open-source families (Llama, Mistral, Qwen) show the same complementary effect?
4. **Domain specificity of inductive biases?** Are some vendor pairs more complementary in certain medical domains?
5. **Dynamic vendor selection?** Could a meta-agent select the optimal vendor mix based on case characteristics?
6. **Interaction with agent roles?** Would role-specialized prompts + vendor diversity compound the benefits?
7. **Cost-performance frontier?** What's the Pareto-optimal trade-off between number of vendors, model size, and diagnostic accuracy?

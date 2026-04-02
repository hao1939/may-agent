# Judge Reliability Harness (JRH) — Analysis for Our System

**Requested by:** Bob (handoff 2026-03-15)
**Source:** arXiv:2603.05399 (Dev et al., RAND Corporation)
**Venue:** Agents in the Wild Workshop @ ICLR 2026
**Code:** https://github.com/RANDCorporation/judge-reliability-harness
**Stars:** 15 | **Commits:** 9 | **License:** CC BY 4.0

---

## 1. Source

**Paper:** "Judge Reliability Harness: Stress Testing the Reliability of LLM Judges" (arXiv:2603.05399)
**Authors:** Sunishchal Dev, Andrew Sloan, Joshua Kavner, Nicholas Kong, Morgan Sandler — all RAND Corporation, Santa Monica, CA.
**GitHub:** https://github.com/RANDCorporation/judge-reliability-harness

This is a **production-quality open-source tool** from RAND (a well-respected research institution). The paper was accepted at ICLR 2026's agent safety workshop.

---

## 2. Mechanism: The 6 Test Families

JRH generates **synthetic perturbation test suites** for any LLM judge. Given a benchmark dataset + judge config (model, prompt template, rubric), it produces and validates perturbations that probe different failure modes.

### Test Types:

| Test | Type | How It Works | What It Measures |
|------|------|-------------|------------------|
| **Label Flip** | Discriminative | Rewrites response to clearly violate rubric while preserving topic/structure | Can the judge detect semantic inversion? |
| **Format Invariance** | Consistency | Changes layout only: blank lines, extra spaces, indentation — no text changes | Is judge invariant to formatting? |
| **Semantic Paraphrase** | Consistency | Paraphrases response: different words, same meaning | Is judge invariant to wording? |
| **Verbosity Bias** | Consistency | Creates longer/shorter variants with identical factual content | Does judge over-reward length? |
| **Stochastic Stability** | Consistency | Sends identical inputs multiple times | Are scores consistent across runs? |
| **Synthetic Ordinal** | Calibration | Generates synthetic samples targeting each ordinal score level | Is the grading scale calibrated? |

**Agentic Mode (bonus):** Supports Inspect AI evaluation files. Two sub-tests:
- **Agent Perturbation:** Modifies agentic transcripts to induce rubric violations
- **Agent Positives:** Steers transcripts toward satisfying rubric criteria

**Generation pipeline:** Seed dataset → perturbation pipelines → optional human-in-the-loop review (UI for accept/reject/edit) → judge evaluation → aggregated reliability metrics.

**All tests are generated, not static datasets.** The harness uses LLMs (GPT-4o-mini for generation, Gemini 3 Pro for validation) to create the perturbations, then validates them before scoring.

---

## 3. Key Findings from the Paper

Evaluated 4 judges (GPT-4o, Claude Sonnet 4.5, Llama 4.1 Maverick 17B, Gemini 2.5 Pro) across 4 benchmarks (FORTRESS, HarmBench, Persuade, AgentHarm):

### Critical Results:
1. **No judge is uniformly reliable.** Every model has failure modes on every benchmark.
2. **Formatting perturbations cause larger reliability drops than semantic perturbations.** This is deeply concerning — judges are more sensitive to whitespace than to meaning.
3. **Task-dependence is extreme.** Claude Sonnet 4.5 has highest volatility on Persuade (σ=17.18%) but lowest on HarmBench (σ=11.13%); Gemini shows the exact inverse pattern.
4. **Agentic evaluations expose qualitatively different failure modes.** Claude Opus 4.5 misses subtle violations (68.75% on perturbations vs 93.75% on positives). Gemini over-penalizes corrected transcripts.
5. **Cost ≠ quality.** Llama 4.1 Maverick 17B matches or beats premium judges at $0.001/accuracy-point vs $0.02+/accuracy-point for Claude/GPT-4o.

### Cost per Accuracy Point:
| Model | Overall $/acc-point |
|-------|-------------------|
| Llama Maverick 4.1 | **$0.0010** |
| Gemini 2.5 Pro | $0.0080 |
| GPT-4o | $0.0196 |
| Claude Sonnet 4.5 | $0.0223 |

### Detailed Empirical Results (from full paper Section 5):

**Cross-Benchmark Patterns:**
- **Semantic paraphrase is the most robust test across all benchmarks** — lowest score was 40% (Gemini 2.5 Pro on Persuade). Other judges scored 80%+ on paraphrase.
- **Format invariance is the WEAKEST test** — judges consistently fail more on formatting changes than semantic ones (except FORTRESS). This means typos/whitespace harm scores more than meaning changes.
- **Binary vs ordinal task effect is dramatic** — FORTRESS/HarmBench (binary yes/no) show much higher reliability than Persuade (ordinal 1-6 scale).

**Volatility Inversion (Table 4):**
| Model | Persuade σ | HarmBench σ |
|-------|-----------|-------------|
| Claude Sonnet 4.5 | **17.18%** (highest) | **11.13%** (lowest) |
| Gemini 2.5 Pro | **11.10%** (lowest) | **17.17%** (highest) |

This perfectly inverted pattern proves reliability is task-model-coupled, not a model property.

**Persuade Ordinal Metrics (the toughest benchmark):**
| Model | Pearson ρ | MAE |
|-------|----------|-----|
| GPT-4o | **0.960** | **0.23** |
| Llama Maverick 4.1 | 0.953 | 0.29 |
| Gemini 2.5 Pro | 0.935 | 0.34 |
| Claude Sonnet 4.5 | 0.901 | 0.48 |

GPT-4o best on ordinal accuracy; Claude worst. But flip to binary safety tasks and Claude is most consistent.

**AgentHarm Agentic Results (Figure 6):**
| Model | agent_perturbation | agent_positives | Overall |
|-------|-------------------|-----------------|---------|
| GPT-4o | 87.5% | 93.75% | **90.6%** |
| Llama 4 Maverick | 87.5% | 93.75% | **90.6%** |
| Gemini 2.5 Pro | 87.5% | 75.0% | 81.25% |
| Claude Opus 4.5 | 68.75% | 93.75% | 81.25% |

Key asymmetries:
- **Claude Opus:** High false-negative rate — misses violations (68.75% on perturbation detection). Concerning for safety evaluation.
- **Gemini:** Over-penalizes corrected transcripts (75% on positives). Concerning for false-positive evaluation noise.
- **GPT-4o & Llama Maverick:** Most balanced and highest overall.

**Note on Claude Sonnet 4.5 Bug:** During AgentHarm experiments, Sonnet 4.5 showed inconsistencies between natural-language reasoning and returned structured scores. This was NOT seen in Opus 4.5 or Haiku 4.5 or any other model. They switched to Opus 4.5 for AgentHarm specifically.

**Human-in-the-Loop Validation:** For FORTRESS/Persuade/HarmBench, no human edits were needed — LLM-generated perturbations were accurate. For AgentHarm, 14/16 agent_perturbation transcripts needed human editing, vs only 2/16 agent_positives. This reflects safety guardrail limitations in GPT-4o-mini when asked to degrade transcripts.

---

## 4. Integration Assessment for Our System

### Can we run it locally?
**Yes, with caveats.**
- **Requirements:** Python venv, `uv` package manager, API keys for the perturbation generator (GPT-4o-mini) and validator (Gemini 3 Pro)
- **Framework:** Installable via `uv sync --extra dev --native-tls`
- **Entry point:** `main.py` with Quickstart.ipynb notebook
- **Config:** `.env` file with API keys

### Can we test our Evaluator agent?
**Partially.** Our Evaluator uses structured prompts (not Inspect AI format), so:
- ✅ **Free-response mode tests** (label flip, format invariance, paraphrase, verbosity, stochastic stability) can be adapted if we format our Evaluator's input/output into JRH's schema
- ⚠️ **Agentic mode** requires Inspect AI log format — would need an adapter
- ⚠️ **Synthetic ordinal** only applies if our Evaluator uses ordinal scores (it does for some rubrics)

### Integration Effort:
- **Low (1-2 days):** Run JRH's basic perturbation tests against our Evaluator prompt by formatting our evaluation samples into JRH's input schema
- **Medium (3-5 days):** Build adapter for our agentic transcripts → Inspect AI log format
- **High (1+ week):** Full integration with our CI pipeline + custom benchmark datasets

---

## 5. Recommendation

### **ADOPT — High Priority**

**Reasoning:**
1. **Direct validation of our most critical assumption.** Our system relies heavily on LLM-as-evaluator. JRH would tell us *exactly* how reliable that evaluator is under perturbation.
2. **Formatting sensitivity finding is an immediate risk.** Different agents format output differently. If our Evaluator is sensitive to formatting (as JRH found for all tested judges), we're getting inconsistent evaluations right now.
3. **Stochastic stability test is trivially applicable.** Just send the same evaluation 10 times and check variance. Can do this TODAY without even installing JRH.
4. **Cost-effectiveness insight is actionable.** If Llama Maverick matches GPT-4o at 1/20th the cost, we should test it as an evaluator.

### Immediate Actions (No JRH installation needed):
1. **Manual stochastic stability test:** Run our Evaluator on the same agent output 10 times. Record variance.
2. **Manual format invariance test:** Take a passing agent output, add/remove blank lines, re-evaluate. Does the score change?
3. **Manual label flip test:** Take a clearly failing output, re-submit. Take a clearly passing output, re-submit. Check calibration.

### With JRH Installation:
1. Format 20-30 representative evaluation samples into JRH input schema
2. Run basic perturbation suite against our Evaluator config
3. Generate reliability heatmap
4. Use results to either (a) improve Evaluator prompt robustness, or (b) switch to a more reliable judge model

---

## 6. Connection to GUS Framework

This paper strongly validates multiple GUS findings:
- **Law 15 (Reliability Illusion):** Judges reporting high accuracy actually have significant blind spots
- **Law 21 (Multi-Layer Optimization Paradox):** Evaluator unreliability is one of the layers
- **Cross-Ref #29 (Reliability Illusion Stack):** JRH empirically confirms that evaluation-layer inflation is real and measurable
- **Cross-Ref #64 (Orchestration Verification Problem):** JRH is essentially the practical tool version of our theoretical finding that "verification requires independent assessment"
- **Deep-Dive #212 (Reasoning Judges Adversarial):** JRH's formatting sensitivity finding complements our finding that reasoning judges enable *more effective* adversarial exploitation

The key meta-insight: **reliability of the judge is a testable property, and no judge passes all tests.** This is exactly GUS Mechanism 20 (Metric Temporal Blindness) made concrete.

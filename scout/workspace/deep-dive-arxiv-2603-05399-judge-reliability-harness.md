# Deep Dive: arXiv:2603.05399 — Judge Reliability Harness (JRH)

**Paper:** "Judge Reliability Harness: Stress Testing the Reliability of LLM Judges"
**Authors:** Sunishchal Dev, Andrew Sloan, Joshua Kavner, Nicholas Kong, Morgan Sandler (RAND Corporation)
**Published:** 2026-03-05
**Code:** https://github.com/RANDCorporation/judge-reliability-harness (MIT, Python, 14⭐, 1 fork)
**Sponsor:** US Government (Contract FA8702-15-D-0002) via Carnegie Mellon SEI

---

## What It Is

An open-source Python library that generates validation suites to stress-test LLM judges. Given a benchmark dataset + judge configuration (model + rubric + prompt template), JRH automatically generates perturbations, runs them through the judge, and produces reliability reports with bootstrapped confidence intervals and cost curves.

**Key insight from the paper: No judge they evaluated is uniformly reliable across benchmarks.** Reliability is a property of the (model × task × perturbation-type) triple, not of the model alone.

---

## Architecture

### Pipeline (4 stages)

1. **Ingest** — Load dataset, normalize to `{request, response, expected}` schema via column mapping
2. **Perturb** — Run synthetic data pipelines to generate test variants (LLM-generated perturbations validated by a separate LLM)
3. **Judge** — Evaluate perturbations with the judge under test (via LiteLLM — supports any OpenAI-compatible API)
4. **Report** — Compute metrics (sklearn-based), bootstrap CIs, cost curves, emit JSON report

### Reliability Tests (11 types across 5 categories)

**Discriminative (should change the score):**
- `label_flip` — Rewrite response to logically contradict the original while preserving structure

**Consistency (should NOT change the score):**
- `format_invariance_1` — Extra blank lines between paragraphs
- `format_invariance_2` — Extra spaces within sentences
- `format_invariance_3` — Added tabs/indentation
- `semantic_paraphrase` — Synonyms, reordering, equivalent expressions
- `answer_ambiguity` — Identical input repeated (tests within-sample stochastic stability)
- `verbosity_bias_long` — Expand response with more detail, same content
- `verbosity_bias_short` — Condense response, same content

**Ordinal:**
- `synthetic_ordinal` — Generate responses targeting specific rubric score levels (few-shot + temperature ramping + cosine similarity filtering)

**Stability:**
- `stochastic_stability` — Duplicate inputs across multiple seeds/repetitions

**Agentic (multi-turn transcripts):**
- `agent_perturbation` — Edit agent transcript to induce rubric violations (planner → editor → verifier pipeline)
- `agent_positives` — Preserve/confirm passing transcripts (measures false positive rate)

### Key Technical Features

- **Human-in-the-loop review UI** — Web interface at localhost:8765 for accept/reject/edit of generated perturbations during generation
- **LiteLLM integration** — Any model accessible through LiteLLM can be both the judge-under-test and the perturbation generator
- **Multi-judge mode** — Run multiple judges on identical perturbation sets for direct comparison
- **Inspect AI integration** — Native ingestion of Inspect `.eval` archives for agentic evaluation
- **Cost tracking** — Tracks token costs per model, generates cost-per-accuracy-point metrics
- **Config-driven** — YAML configs with sensible defaults; override only what differs

---

## Experimental Results (Key Findings)

**Benchmarks tested:** HarmBench (safety, binary), FORTRESS (national security, binary), PERSUADE (essay scoring, ordinal 1-6), AgentHarm (agentic harm, multi-turn)
**Judges tested:** GPT-4o, Claude Sonnet 4.5, Llama 4.1 Maverick, Gemini 2.5 Pro

### Finding 1: Formatting perturbations cause larger drops than semantic perturbations
- Across all non-FORTRESS benchmarks, judges achieved their **lowest scores on format invariance tests**
- Extra whitespace, tabs, and spacing changes degrade judge accuracy more than paraphrasing or verbosity changes
- Implication: Different LLMs' output formatting quirks create systematic bias in judge-based comparisons

### Finding 2: Reliability is task-dependent — rankings invert across benchmarks
- Claude Sonnet 4.5: highest volatility on PERSUADE (σ=17.18%), lowest on HarmBench (σ=11.13%)
- Gemini 2.5 Pro: lowest volatility on PERSUADE (σ=11.10%), highest on HarmBench (σ=17.17%)
- **Rankings literally invert** between ordinal and binary classification tasks

### Finding 3: Agentic evaluations expose asymmetric failure modes
- GPT-4o & Llama Maverick: best overall (accuracy=0.906 on AgentHarm)
- Claude Opus 4.5: 93.75% on agent_positives but only 68.75% on agent_perturbation → **high false negative rate** (misses subtle violations in multi-turn transcripts)
- Gemini 2.5 Pro: better on perturbation (87.5%) but only 75% on positives → **high false positive rate** (over-penalizes correct transcripts)

### Finding 4: Smaller models can match or beat frontier judges
- Llama 4.1 Maverick (17B active params) matched GPT-4o on AgentHarm at significantly lower cost
- Cost-per-accuracy-point varies dramatically across models (Table 1 in paper)

### Finding 5: PERSUADE ordinal results
- GPT-4o: ρ=0.960, MAE=0.23 (best)
- Llama Maverick: ρ=0.953, MAE=0.29
- Gemini 2.5 Pro: ρ=0.935, MAE=0.34
- Claude Sonnet 4.5: ρ=0.901, MAE=0.48 (worst)

---

## Integration Assessment for Our Evaluation Pipeline

### What We Could Use Directly

1. **Format invariance tests** — The 3 format perturbation types (whitespace, spacing, indentation) are dead simple, don't require LLM calls to generate, and are the most effective at exposing judge fragility. We could generate these deterministically for our evaluation inputs.

2. **Label flip test** — For any binary evaluation (pass/fail on tasks), generating label-flipped responses and checking our evaluator catches the inversion is a basic sanity check.

3. **Verbosity bias tests** — Our evaluator scores agent work products; verbosity bias would show if we're rewarding padding over substance.

4. **Stochastic stability test** — Run the same evaluation multiple times and measure variance. Zero implementation cost; pure insight.

5. **Cost tracking** — Their cost-per-accuracy-point metric is valuable for judge selection. We should track this if we're comparing evaluator models.

### What Requires More Work

6. **Agentic mode** — Their Inspect-based transcript perturbation pipeline is the most architecturally interesting part. Our agents produce multi-turn work, which is exactly what this tests. BUT: it requires Inspect `.eval` format logs, and we'd need to either adopt Inspect's logging format or write an adapter.

7. **Synthetic ordinal generation** — Useful if our evaluator uses ordinal scales (not just pass/fail). The temperature ramping + few-shot + cosine similarity filtering is a solid generation strategy.

### Synergy with arXiv:2603.05485 (Bias-Bounded Evaluation)

The JRH and bias-bounded eval papers are **highly complementary**:
- JRH provides the **test generation infrastructure** (perturbations, automation, reporting)
- Bias-Bounded Eval provides the **theoretical framework** (A-BB guarantees, Lipschitz shrinkage, calibrated noise)
- Together: use JRH to generate perturbation suites → measure sensitivity → apply bias-bounded calibration → report with (τ, δ) guarantees

### Synergy with danpeg/bug-hunt

Bug-hunt's adversarial 3-agent pattern (Hunter/Skeptic/Referee) could serve as a **judge configuration** tested by JRH. Run bug-hunt as the judge, use JRH to stress-test whether the adversarial trio is more reliable than a single judge across perturbation types.

---

## Strengths

- **Practical, not theoretical** — This is a working tool, not a research framework. YAML config → run → report.
- **MIT license** — No restrictions on integration.
- **LiteLLM-based** — Already supports any model we might use.
- **HITL review** — The human-in-the-loop UI for perturbation quality control is a genuinely useful feature for building high-quality test suites.
- **Multi-judge comparison** — Built-in support for comparing multiple judges on identical data.
- **RAND Corporation backing** — Institutional credibility; funded by US government for AI safety evaluation.

## Weaknesses

- **Early stage** — Only 14⭐, 1 fork. Last push 2026-02-23 (12 days before paper). Unclear ongoing maintenance commitment.
- **No CI/CD visible** — No GitHub Actions, no badges. Test suite exists but unclear if actively run.
- **OpenAI-centric defaults** — Default configs use GPT-4o-mini everywhere. LiteLLM supports others, but example configs are OpenAI-only.
- **Limited benchmarks evaluated** — 4 benchmarks, 4 judges. The experimental surface is narrow for strong generalization claims.
- **Generation quality depends on generator model** — Perturbation quality is only as good as the LLM generating them. No ground-truth validation beyond LLM-based verification (generator ≠ validator, but both are LLMs).
- **No programmatic perturbations** — Format invariance tests use LLMs when they could be deterministic regex transformations (cheaper, more reliable). The authors acknowledge this implicitly by having the perturbation instructions say "just add whitespace" but still route through an LLM.

---

## Concrete Next Steps

1. **[LOW EFFORT]** Run stochastic stability test on our evaluator — duplicate 10 evaluation inputs, run 3x each with different seeds, measure score variance. No JRH needed; we can DIY this today.

2. **[LOW EFFORT]** Implement deterministic format perturbations — Write a simple Python script that takes evaluation inputs and generates whitespace/spacing/indentation variants. Test our evaluator's invariance. This is the highest-signal, lowest-cost test from the paper.

3. **[MEDIUM EFFORT]** Run JRH against our evaluator — Clone the repo, format our evaluation data into their CSV schema, run the full suite, read the report. Requires: API keys for generator model, our evaluator accessible via LiteLLM.

4. **[MEDIUM EFFORT]** Integrate verbosity bias tests into our eval pipeline — Before scoring, generate short+long variants of agent outputs and check score stability. Flag evaluations where verbosity correlates with score.

5. **[HIGH EFFORT]** Adopt the agentic perturbation pipeline — Requires either adopting Inspect logging format or writing an adapter. High value for testing evaluator reliability on multi-turn agent work, but significant integration work.

6. **[STRATEGIC]** Combine JRH + bias-bounded calibration — Use JRH to measure our evaluator's sensitivity profile, then apply Lipschitz shrinkage and (τ, δ) guarantees from arXiv:2603.05485 to produce calibrated, reliability-bounded scores.

---

## Bottom Line

**JRH is the most directly usable tool we've found for evaluator reliability testing.** It's not a research artifact — it's a working pipeline with config-driven execution, multi-judge comparison, and cost tracking. The key empirical finding (formatting > semantic perturbations for judge fragility) is immediately actionable. The agentic mode is architecturally the most interesting but requires the most integration work.

**Recommendation: Start with deterministic format perturbations (next step #2) — it's the highest-ROI test the paper identifies, and we don't even need JRH to do it. Then evaluate running JRH against our evaluator (next step #3) as a one-off diagnostic.**

The paper's most important strategic insight: **reliability is a property of the (model × task × perturbation) triple, not the model alone.** Any evaluator we deploy needs per-task reliability characterization, not just an overall accuracy number.

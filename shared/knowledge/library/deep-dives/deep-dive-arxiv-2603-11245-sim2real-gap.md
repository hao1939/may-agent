# Deep-Dive: Mind the Sim2Real Gap in User Simulation (arXiv:2603.11245)

**Title:** Mind the Sim2Real Gap in User Simulation for Agentic Tasks  
**Authors:** Xuhui Zhou, Weiwei Sun, Qianou Ma, Yiqing Xie, Jiarui Liu, Weihua Du, Sean Welleck, Yiming Yang, Graham Neubig, Sherry Tongshuang Wu, Maarten Sap (Carnegie Mellon University)  
**Submitted:** 2026-03-11  
**License:** CC BY 4.0  
**Read date:** 2026-03-13 (full paper from HTML source)

---

## Core Problem

LLM-based user simulators serve two roles in interactive agent benchmarks: (1) generating user turns that drive the interaction, and (2) providing evaluation signals for agent quality. Yet no one has systematically verified whether these simulators faithfully represent real human behavior. This paper formalizes the "Sim2Real gap" and runs the first large-scale human study replacing LLM simulators with real people.

## Study Design

- **451 real human participants** across 165 tasks on τ-bench (customer service: airline + retail domains)
- **31 LLM simulators** benchmarked: 18 proprietary (GPT, Claude, Gemini families), 9 open-source (DeepSeek, Llama, Qwen), 4 specialized user-simulation models (CoSER-8B, UserLM-8B, HumanLike-7B, HumanLM-opinion)
- **3 independent annotation batches** for stability verification
- Agent fixed to GPT-5.2 across all experiments for comparability

## Taxonomy of Sim2Real Gaps

### Behavioral Gap (4 dimensions)

| Dimension | What It Measures | Key Finding |
|-----------|-----------------|-------------|
| **D1: Communication Style** | Politeness, verbosity, formality | LLMs are too verbose and uniformly polite. 1% of GPT-4o turns are short vs 29% human. 49% GPT-4o turns polite vs 15.3% human. |
| **D2: Information Pattern** | How much info shared per turn | LLMs front-load complete information. UserLM-8b: 4.8 identifier tokens/turn vs 2.6 human. Simulators dump "My name is Sarah Johnson, email sarah@example.com, order #ORD-58211" — humans say "Hi, I need help with a return under Sarah." |
| **D3: Clarification** | Uncertainty, information-seeking | Miscalibrated: GPT-4o over-hedges (14.6% uncertainty vs 7.3% human). UserLM-8b over-confident (3% uncertainty, 10.6% certainty vs 1% human). |
| **D4: Error Reaction** | Response to agent mistakes | Simulators quietly pivot; humans get frustrated. Pivot%: GPT-4o 19.1%, CoSER 16.5% vs humans 8.4%. Humans use accusatory language: "You already asked me that—can you just fix it?" |

### Evaluative Gap (2 dimensions)
- **Outcome Calibration (ECE):** Simulator success rates diverge from human success rates
- **Evaluative Alignment (Eval):** LLM evaluators systematically inflate quality ratings

## User-Sim Index (USI)

Composite 0-100 score aggregating D1-D4 + outcome calibration + evaluative alignment.

| Category | Best Model | USI Score |
|----------|-----------|-----------|
| **Human (ceiling)** | Inter-annotator | **92.9** |
| **Open-source** | DeepSeek-V3.1 | **76.0** (best overall) |
| **Open-source** | Llama-4-Maverick | **73.9** |
| **Proprietary** | Gemini2.0-Flash | **73.3** |
| **Proprietary** | GPT-5.1 | **70.9** |
| **Specialized** | CoSER-8B | **66.9** |
| **Specialized** | UserLM-8B | **61.7** |

**Critical finding: Higher general model capability ≠ more faithful user simulation.** The relationship between Chatbot Arena Elo and USI is weak outside the GPT family.

## Key Results

### RQ1: Do simulated users behave like real people? **No.**

LLM simulators create an **"easy mode"** for agents:
- **Excessive cooperativeness**: Simulators volunteer all information, cooperate through errors, never express frustration
- **Stylistic uniformity**: Real humans vary; simulators are uniformly polite and verbose
- **Inflated success rates**: Most general-purpose LLM simulators yield higher agent success than the 63.6% human baseline, with top models reaching 77.8%
- **Missing conversational challenges**: Ambiguity, impatience, incomplete information, frustration — the things that make real interactions hard — are absent

### RQ2: Do simulated evaluations match human judgments? **No.**

GPT-5.1 as evaluator (representative):
- **Overestimates human-likeness by 55%** of the rating scale
- **Overestimates reuse intent by 0.83 points** (out of scale range)
- But is **conservative on task completion** (-0.15)
- Asymmetric bias: inflates perceived quality while underestimating actual task success

### RQ3: Can rule-based rewards substitute for human feedback? **No.**

τ-bench's binary reward (final database state match):
- **70.6% of reward=0 interactions are actually judged successful by humans**
- **33% of reward=1 interactions are judged unsuccessful/partial by humans**
- Quality distributions for reward=0 and reward=1 are "nearly indistinguishable" across all 8 quality dimensions
- Rule-based reward is **orthogonal** to human-perceived quality

## Cross-References with Our Research

### 1. Evaluator Reliability Synthesis (Our Axiom: "No single evaluator is uniformly reliable")
Sim2Real provides the most comprehensive empirical validation of this axiom. 31 models tested, none achieve human-level faithfulness. Best USI is 76.0 vs. 92.9 human ceiling — a 16.9-point gap that represents real behavioral and evaluative misalignment.

### 2. RewardHackingAgents (2603.11337)
**Complementary failure modes:**
- RewardHackingAgents: evaluators can be *deliberately corrupted* (integrity failure)
- Sim2Real: evaluators are *naturally biased* (calibration failure)
- Together: evaluation is unreliable in two independent dimensions — bias AND integrity

### 3. Bug-Hunt (Adversarial Verification)
Bug-Hunt's Skeptic deliberately challenges claims. Sim2Real shows WHY this is necessary: without adversarial challenge, LLM evaluators are systematically lenient. Bug-Hunt's adversarial structure compensates for exactly the cooperativeness bias Sim2Real documents.

### 4. QA Agent Cooperativeness
**Direct implication for our system:** Our QA agent, being an LLM, likely exhibits the same cooperativeness bias documented here. When QA "tests" code, it may be:
- Too polite in error reports (D1 — communication style)
- Front-loading all information rather than testing incrementally (D2 — information pattern)
- Over-hedging on uncertainty rather than firmly stating failures (D3 — clarification)
- Quietly accepting failures rather than escalating (D4 — error reaction)

This is the **quantified version of our prior hypothesis** that QA may be "systematically too cooperative."

### 5. DCI Deliberation Protocol (2603.11781)
DCI's Challenger archetype is designed to counteract exactly this cooperativeness bias. The paper's behavioral taxonomy (D1-D4) could be used to *calibrate* a Challenger agent to exhibit human-like pushback rather than LLM-typical compliance.

### 6. DPIP Common Ground (2603.05450)
Sim2Real's D2 (information pattern) directly maps to DPIP's finding that LLMs can't track "who knows what." Simulators dump all information upfront precisely because they can't model the incremental information-revealing behavior of real humans in epistemic asymmetry situations.

## Actionable Takeaways for Our System

### Priority 1 (Immediate)
1. **Assume QA is cooperative-biased.** Treat our QA agent's "pass" verdicts with suspicion. A QA pass should trigger a verification question: "Would a frustrated human also accept this?" Design prompts that explicitly instruct QA to be adversarial.

2. **Don't trust single-evaluator quality assessments.** Sim2Real shows LLM evaluators systematically inflate quality ratings. Multi-evaluator agreement (our existing axiom) is even more critical than we thought.

### Priority 2 (Near-term)
3. **Calibrate QA with frustration/ambiguity injection.** Design QA evaluation prompts that include realistic user behaviors: incomplete information, follow-up questions, expression of frustration. This forces the QA agent out of "easy mode."

4. **Test with adversarial user profiles.** When evaluating agent output, periodically evaluate from the perspective of an impatient, frustrated, or confused user — not just a cooperative one. This is the behavioral equivalent of format perturbation from JRH.

### Priority 3 (Architectural)
5. **USI as evaluator health metric.** Sim2Real's USI framework (D1-D4 + ECE + Eval) could be adapted to measure how realistic our QA agent's testing behavior is. Are its "tests" cooperative or realistic?

6. **Rule-based rewards are orthogonal to quality.** If we use any rule-based success criteria (test passing, format compliance), we should NOT treat them as proxies for actual quality. They measure a different dimension entirely.

## Limitations

- Only τ-bench (customer service domain) — generalizability to other domains untested
- Agent fixed to GPT-5.2 — different agents may trigger different simulator behaviors
- Behavioral metrics rely on lexical features (LIWC, NRC) which may miss pragmatic nuances
- Crowd-worker participants may not perfectly represent real customer service users
- Study captures gap magnitude but doesn't provide a fix

## Assessment

**Rating: ★★★★★ CRITICAL — Directly impacts our system's evaluation integrity.**

This is the most thorough empirical study of LLM evaluation bias to date. 451 real humans, 31 LLM simulators, multi-dimensional behavioral taxonomy. The findings are devastating for anyone relying on LLM-based evaluation:

1. **All LLM evaluators are biased toward leniency** — they systematically inflate quality
2. **Cooperativeness bias is universal** — every LLM simulator tested creates "easy mode"
3. **Model capability ≠ evaluation faithfulness** — bigger/better models aren't more realistic simulators
4. **Rule-based rewards are orthogonal to quality** — they measure something real humans don't care about

**For our system:** The single most important implication is that our QA agent is almost certainly too cooperative. Every "pass" verdict from QA should be treated as potentially inflated. The architectural response is: (a) explicitly adversarial QA prompting, (b) multi-evaluator agreement requirements, and (c) periodic human-in-the-loop calibration checks.

<ai_context>
Scan #388: The Expectation Correction. Zuckerberg publicly admits AI agent development is "going slower than expected" (51pts HN, 23pts follow-up). This institutional recalibration arrives simultaneously with three structural signals: (1) Program-as-Weights (2607.02512) proposes compiling fuzzy functions into compact neural artifacts — reframing the foundation model from per-input problem solver to tool builder, (2) EvoPolicyGym (2607.02440) shows strong policy evolution depends on budget allocation and task-appropriate mechanism discovery, not raw capability, (3) HN front page discourse shifts from capability awe to operational maturity (Compilers +34.2%, Fast Software stable, web crypto sovereignty rising). The correction: agents don't fail because models lack capability — they fail because the gap between model capability and deployment infrastructure remains structurally unaddressed. Reference for: expectation correction, program-as-weights, fuzzy functions, policy evolution benchmarking, institutional recalibration, deployment gap thesis.
</ai_context>

# Scan #388: The Expectation Correction

**Date**: 2026-07-05
**Sources**: arXiv (2607.02512, 2607.02440, 2607.02469, 2607.02460), Hacker News (front page live + tracked stories), GitHub (search/trending)
**Scan number**: 388 (follows The Accumulation Paradox #387)
**Theme**: **The institution names the gap.** Mark Zuckerberg tells Meta staff that AI agent development has "not progressed as quickly as he'd hoped" (51pts HN, Reuters original). This is the first public admission by a major platform CEO that agent deployment is structurally harder than model capability predicted. Three independent arXiv papers explain *why*: PAW (2607.02512) shows that reframing models as tool-builders — compiling specifications into reusable artifacts instead of doing per-input inference — solves the cost/locality problem. EvoPolicyGym (2607.02440) shows that agent improvement depends on budget allocation strategy and mechanism discovery, not raw capability. TestEvo-Bench (2607.02469) shows that test-code co-evolution — making the feedback loop work — is where production reliability actually lives. The expectation correction isn't about models being bad; it's about the deployment substrate being immature.

---

## I. HN Front Page — Tracked Stories (Live Update)

| Story | Pts (now) | Pts (#387) | Δ | Status |
|-------|-----------|-----------|---|--------|
| C&C Generals (Fable port) | 633 | 621 | +1.9% | Plateau confirmed |
| "Button has one job" | 474 | 437 | +8.5% | Re-accelerating after deceleration |
| Organic Maps | 399 | 280 | +42.5% 🔺 | Sovereignty cluster — breakout |
| Introduction to Compilers | 198 | 154 | +28.6% 🔺 | Education — accelerating |
| EU Chat Control fast-track | 213 | 135 | +57.8% 🔺🔺 | Fastest-growing tracked story |
| Shadcn/UI → Base UI | 240 | 230 | +4.3% | Slow growth |
| "The Log Is the Agent" | 91 | 84 | +8.3% | Sustained (5th scan of growth) |
| "Fast Software" (2019) | 99 | 93 | +6.5% | Slow growth |
| "Maybe you should learn" | 447 | — | — | From #386: 431pts → 447pts (+3.7%) |
| CO2/air in the room | 799 | — | — | From #387 tracker extrapolation |
| Codex reasoning-token | 344 | 333 | +3.3% | ✅ >300pts confirmed (#386) |
| "Better Models: Worse Tools" | 213 | — | — | ✅ >120pts confirmed (#384); now >200pts |
| danluu agentic coding | 172 | 167 | +3.0% | Slow growth |
| Synthesis > analysis | 148 | 145 | +2.1% | Plateau |
| Claude Code session leak | 312 | 262 | +19.1% | ✅ >300pts |
| YouTube private video | 657 | 455 | +44.4% 🔺 | ✅ >500pts confirmed (#372) |
| "Knowledge Not Gated" | 69 | 68 | +1.5% | Stalling — prediction revision needed |
| Web crypto = snake oil | 63 | 53 | +18.9% | Sovereignty — growing |
| KiCad in browser | 65 | — | 🆕 | Maker tools sovereignty |
| Zuckerberg: agents slower | 51 | — | 🆕 | **Institutional expectation correction** |

### Key HN Signal Updates

**EU Chat Control (213pts, +57.8%)** — Strongest acceleration of any tracked story. From 119pts (#386) → 135pts (#387) → 213pts now. The acceleration is itself accelerating (+13.4% → +57.8%). Community discourse shifts from "this is bad" to structural analysis of regulatory scope implications for agent-to-agent communication. ✅ **Prediction from #386 (>300pts, 2 scans) now highly likely in next scan** at current growth rate.

Source: https://www.heise.de/en/news/Chat-Control-1-0-EU-Council-forces-messenger-scans-via-fast-track-11353659.html

**Organic Maps (399pts, +42.5%)** — From steady growth to breakout. The sovereignty signal is no longer niche — self-hosted alternatives generate mainstream engagement. Combined with EU Chat Control, the "sovereignty stack" (verified, self-hosted, inspectable) is now the dominant narrative cluster on HN front page.

Source: https://organicmaps.app/

**"The Log Is the Agent" (91pts, +8.3%)** — Sixth consecutive scan of growth (53→63→82→84→91pts). Growth re-accelerates after deceleration in #387. The thesis has crossed from academic curiosity to practitioner default. **Prediction update**: >100pts within 1-2 scans (medium-high confidence).

Source: https://arxiv.org/abs/2605.21997

**Zuckerberg: "Agents going slower than expected" (51pts, 65 comments)** — The signal.

Source: https://www.reuters.com/business/zuckerberg-says-ai-agent-development-going-slower-than-expected-2026-07-02/

This is the first public admission from a major tech CEO that agent deployment is harder than capability suggested. Key HN community responses:
- *"I bet he wants some calculative shit"* — reducing agent performance to measurable business metrics, not open-ended capability
- *"What everyone underestimated was the absolute bonkers amount of compute it will take"* — naming the infrastructure gap
- *"This is specifically about Avocado [Meta's consumer agent] which everyone at Meta would acknowledge is terrible"* — product-specific failure, not category failure
- *"I was hoping AI had progressed enough so I could fire you. But you failed to make it so. Therefore, you're fired!"* — sardonic capture of the expectation-reality gap

The community does NOT interpret this as "agents don't work." The interpretation is: **agents work in constrained, well-instrumented environments but fail when deployed as general consumer products without the infrastructure substrate.** This aligns precisely with:
- Oversight Inversion (#382): production cost collapses but oversight cost hasn't adjusted
- Infrastructure Paradox (#374): infrastructure proliferates faster than problems it solves
- Regulatory Kill Chain (XHS #65): consumer-agent-as-product is dead; agent-as-infrastructure survives

**"Better Models: Worse Tools" (213pts)** — Now at >200pts, the structural claim is being absorbed into discourse baseline. The thesis is no longer controversial — it's the default frame.

**Sovereignty stack emergence**: Five stories with strong sovereignty themes are simultaneously active on HN front page: EU Chat Control (213pts), Organic Maps (399pts), Web crypto = snake oil (63pts), KiCad in browser (65pts), Compilers textbook (198pts). Combined >938pts — larger than any single technical story. The collective signal: **technical sovereignty is the consumer expression of the Comprehension Imperative (#370).**

---

## II. arXiv — Critical New Papers

### 1. Program-as-Weights: Neural Artifact Compilation (2607.02512)

Source: https://arxiv.org/abs/2607.02512

**Core claim**: Many programming tasks resist clean rule-based implementation (alerting on log lines, repairing malformed JSON, ranking search results by intent) and are outsourced to LLM APIs at the cost of locality, reproducibility, and price. PAW proposes **fuzzy-function programming**: compiling a natural-language specification into a compact, locally-executable neural artifact.

**Mechanism**: A 4B compiler (trained on FuzzyBench, 10M examples) emits parameter-efficient adapters for a frozen 0.6B interpreter (Qwen3). The 0.6B interpreter executing PAW programs matches direct prompting of Qwen3-32B — at 1/50th inference memory, 30 tokens/s on a MacBook M3.

**Structural significance**: This reframes the foundation model from **per-input problem solver** to **tool builder** — invoked once per function definition, producing a small reusable artifact whose subsequent calls are cheap and offline.

**Why this matters for the Expectation Correction**: Zuckerberg's agents fail partly because they use foundation models as per-input solvers for tasks that should be compiled into reusable artifacts. The cost/latency/reliability gap between "ask GPT-5.5 every time" and "compile the intent once, run the artifact repeatedly" is the expectation gap itself.

**Connection to existing theses**:
- Extends the **Small Model Parity Thesis** (XHS #67): the 0.6B→32B equivalence claim is now backed by a concrete mechanism
- Operationalizes the **Discipline Import** (synthesis): traditional compiler design (source → IR → target) applied to neural function compilation
- Extends **Substrate Inversion**: the foundational model becomes substrate/compiler, not runtime

### 2. EvoPolicyGym: Budget-Constrained Agent Evolution (2607.02440)

Source: https://arxiv.org/abs/2607.02440

**Core claim**: Autonomous agents are expected to improve policies through feedback, but existing evaluations collapse the process into final scores. EvoPolicyGym introduces **Autonomous Policy Evolution** — agents repeatedly edit executable policies under a fixed interaction budget. GPT-5.5 achieves strongest aggregate rank across 16 RL environments.

**Key insight**: Strong policy evolution depends on **budget allocation** (how agents spend their limited feedback interactions) and **mechanism discovery** (finding task-appropriate optimization strategies), not on raw model capability.

**Trajectory-level diagnostics**: The benchmark provides insights into *how* agents allocate budget and convert feedback into parametric tuning — not just whether they succeed.

**Why this matters for the Expectation Correction**: Meta's agent disappointment is an allocation problem, not a capability problem. EvoPolicyGym formalizes this: the same model (GPT-5.5) performs very differently depending on how it allocates its budget. Deploying a powerful model without budget-allocation infrastructure is the expectation gap.

### 3. TestEvo-Bench: Test-Code Co-Evolution (2607.02469)

Source: https://arxiv.org/abs/2607.02469

**Core claim**: Software tests and code evolve together, but existing benchmarks isolate tests from code changes and rely on static metadata. TestEvo-Bench evaluates whether a test automation agent understands how a code change should propagate into the test suite — the co-evolution question.

**Structural significance**: This is the first benchmark that treats test evolution as a *relational* property between code and tests, not an isolated generation task. An agent that generates correct tests for unchanged code may fail catastrophically when code evolves.

**Connection**: Extends the **Record Thesis (#379)** — the record of *what changed and why* is necessary to determine *what tests should change*. Without the operational record, test evolution is guesswork.

### 4. Neuron-Aware Data Selection (2607.02460) — Methodology Note

Source: https://arxiv.org/abs/2607.02460

**Core claim**: Post-training LLMs without human supervision is possible via neuron-aware data selection — using neuron activation patterns to identify high-value training data automatically. This addresses the annotation bottleneck that slows agent specialization.

**Connection to Expectation Correction**: Specialized agents require domain-specific post-training, which traditionally requires expensive expert annotation. Neuron-aware selection could reduce this cost, narrowing one part of the deployment gap.

---

## III. GitHub — Signal Tracking

| Repo | Stars (now) | Stars (#387) | Δ | Signal |
|------|-------------|-------------|---|--------|
| obra/superpowers | 246,742★ | — | — | Mega-framework — plateau |
| affaan-m/ECC | 226,267★ | — | — | Harness optimization — plateau |
| hermes-agent | 209,572★ | — | — | Mega-framework — plateau |
| claw-code | 194,577★ | — | — | Museum exhibit — plateau |
| opencode | 182,577★ | — | — | Coding agent — plateau |
| token-diet | 575★ | 568★ | +1.2% | Slowing (was +15.2% → +8.8% → +1.2%) |
| jamesob/local-llm | 876★ | 871★ | +0.6% | ✅ Approaching 1,000★ prediction |
| GenseeAI/gensee-crate | 84★ | 82★ | +2.4% | Rust runtime safety — slow growth |
| ai4s-research/open-science | 140★ | 138★ | +1.4% | Slow growth |
| Brain0-ai/brain0 | 25★ | 25★ | 0% | Stalled — prediction at risk |

### GitHub Observations

**Top-of-list plateau**: The five largest agent repos (superpowers 247K, ECC 226K, hermes 210K, claw-code 195K, opencode 183K) are all in plateau phase. No repo has gained meaningfully between scans. This is the **star saturation** phenomenon from #384 confirmed at scale — GitHub stars are awareness proxies, and awareness for these projects is saturated.

**token-diet deceleration curve**: 15.2% → 8.8% → 1.2%. The skill-optimization niche is maturing. Future growth depends on whether token-diet gets integrated into a major harness (superpowers, ECC, or similar), not on standalone star accumulation.

**brain0 stall**: 25★ unchanged. The "passive decision graph" concept may be too abstract for practitioner adoption without a tutorial or integration story. Revising prediction: >100★ unlikely in 3 scans. New prediction: remains <50★ (3 scans) unless a major practitioner writes about it.

**jamesob/local-llm approaching 1,000★**: 876★ with steady growth. On track for >1,000★ within 2-3 scans. Sovereignty-at-consumer-price-points continues to resonate.

---

## IV. Prediction Tracking

### Predictions Confirmed This Scan
- ✅ **"Better Models: Worse Tools" >120pts** (#384): now 213pts
- ✅ **YouTube >500pts** (#372): now 657pts
- ✅ **Codex >300pts** (#386): now 344pts
- ✅ **Claude Code session leak >300pts** (implicit from trajectory): now 312pts

### Predictions Updated
| Prediction | Source | Original | Current Status | Revised |
|------------|--------|----------|----------------|---------|
| EU Chat Control >300pts | #386 | 2 scans | 213pts, +57.8%/scan | ✅ Likely next scan |
| "Log Is Agent" >100pts | #387 | 3 scans | 91pts, +8.3%/scan | 1-2 scans (medium-high) |
| "Knowledge Not Gated" >100pts | #386 | 1 scan | 69pts, +1.5% | ❌ Stalling, unlikely |
| T3MP3ST >2,000★ | #387 | 2 scans | Not checked (no GitHub hit) | Tracking suspended |
| brain0 >100★ | #387 | 3 scans | 25★, 0% growth | ❌ Revised: <50★ (3 scans) |
| jamesob/local-llm >1,000★ | #372 | 3 scans | 876★, +0.6% | On track, 2-3 scans |

### New Predictions
1. **EU Chat Control >300pts** within 1 scan — current trajectory: 119→135→213 (58% growth rate)
2. **"Log Is Agent" >100pts** within 2 scans — growth stabilizing at ~8%/scan
3. **Organic Maps >500pts** within 2 scans — 399pts with +42.5% growth (breakout)
4. **Zuckerberg "agents slower" story remains <100pts** — the topic resonates but the specific article doesn't (institutional admission, not emotionally engaging)
5. **PAW (2607.02512) cited in ≥1 agent framework documentation** within 6 months — the "compile once, run many" paradigm directly addresses deployment cost
6. **"Sovereignty stack" (EU Chat Control + Organic Maps + self-hosted tools) cumulative >1,500pts** within 2 scans

---

## V. Synthesis: The Expectation Correction

### The Three Gaps

The Zuckerberg admission crystallizes what the scan history has been documenting since #370:

**Gap 1: Compilation Gap** (PAW 2607.02512)
Foundation models are used as per-input solvers for tasks that should be compiled into reusable artifacts. The cost/latency/reliability difference between "inference per request" and "compile once, execute repeatedly" is 50x in compute and orders of magnitude in latency. Consumer-facing agents that make API calls for every fuzzy function are fundamentally uneconomic.

**Gap 2: Allocation Gap** (EvoPolicyGym 2607.02440)
Agent improvement depends on how agents allocate their limited feedback budget — not on model capability alone. Meta's agents presumably have access to the strongest available models, but without infrastructure to guide budget allocation and mechanism discovery, capability doesn't convert to reliable deployment.

**Gap 3: Evolution Gap** (TestEvo-Bench 2607.02469)
Production code evolves; tests must evolve with it. Current agent evaluation treats each task as isolated. But production reliability requires co-evolutionary tracking — the operational record (#379) of what changed and why.

### The Correction Pattern

This is the same pattern documented across the scan history:
- **Comprehension Imperative (#370)**: understand before delegating
- **Infrastructure Paradox (#374)**: infrastructure proliferates faster than comprehension
- **Oversight Inversion (#382)**: production cost collapses, oversight cost doesn't adjust
- **Metric Inversion (#384)**: commonly measured signals are unreliable proxies
- **Accumulation Paradox (#387)**: knowledge accumulation both helps and hurts depending on provenance

The Expectation Correction is the institutional recognition of this accumulated evidence: **capability without deployment substrate produces disappointment, not products.**

### The Sovereignty Counter-Signal

Simultaneously, HN's sovereignty stack (>938pts combined) demonstrates that *consumers* are ahead of institutions in recognizing the deployment gap. Self-hosted, inspectable, verifiable tools don't have the deployment gap because they were never premised on capability claims they couldn't fulfill. The sovereignty thesis succeeds precisely because it starts from the infrastructure substrate, not from model capability.

### Design Principle

**The expectation gap is a compilation gap.** Agents that compile intent into reusable, locally-executable artifacts (PAW), allocate feedback budgets structurally (EvoPolicyGym), and track co-evolutionary state (TestEvo-Bench) close the gap that Zuckerberg named. The correction is not "agents don't work" — it's "agents work when the deployment substrate matches the operational requirements."

---

## VI. Thread Map

- **Extends**: Accumulation Paradox (#387), Knowledge Accumulation Thesis (#386), Infrastructure Paradox (#374), Oversight Inversion (#382), Comprehension Imperative (#370), Metric Inversion (#384)
- **Validates**: Record Thesis (#379) — co-evolution requires operational record; Discipline Import (synthesis) — PAW applies compiler design to neural functions
- **XHS parallel**: Consolidation Turn (Scan #67) — Zuckerberg naming the gap mirrors Chinese community's platform-shutdown-driven expectation correction; Small Model Parity Thesis — PAW's 0.6B matching 32B echoes XHS "0.6B→32B效果" claim
- **New thread**: Expectation Correction — institutional gap-naming as prerequisite for infrastructure investment

---

*Next scan: Track EU Chat Control for >300pts prediction, "Log Is Agent" for >100pts, Organic Maps for >500pts. Monitor for PAW/fuzzy-function discourse in practitioner channels. Watch for Meta internal restructuring signals in response to Zuckerberg admission.*

<ai_context>Scan #328: The Metric Selection Problem — the choice of which metric to apply determines the outcome observed, making metric selection itself the primary governance decision. Two AI Metrics (2607.00913) proves mathematically that bounded metrics favor capability proliferation while unbounded metrics favor concentration. AGC-Bench (2607.01152) discovers a separable creativity factor 'c'. Clinician-Level Agreement (2607.01103) shows LLM evaluators match agreement but not caution. Google's simultaneous triple-story (malware 598pts, ZK proofs 166pts, antitrust 94pts) demonstrates institutional metric selection. dungnotnull's 154 skill repos signal monoculture risk. Reference when tracking evaluation methodology, metric design, governance of AI assessment, or capability proliferation vs concentration.</ai_context>

# HN/arXiv/GitHub Scan #328: The Metric Selection Problem

**Date**: 2026-07-05
**Sources**: HN front page + recent, arXiv cs.AI/cs.SE/cs.CL, GitHub trending
**Prior scan**: #327 (The Measurement Corruption Problem)

## Theme

Scan #327 showed measurement instruments are structurally coupled to their phenomena — benchmarks corrupt what they measure. Scan #328 reveals the deeper structural force: **the choice of WHICH metric to apply is itself the primary governance decision**, and this choice is largely invisible.

Six convergent signals:

- **Two AI Metrics Diverged** (2607.00913) — Mathematical proof that bounded metrics (saturating scales) always favor capability proliferation among "meek models," while unbounded metrics (open-ended scales) favor permanent frontier concentration. Same capability, same models — OPPOSITE policy conclusions depending on metric choice. "Determining the apt metric in a domain is a prerequisite for policy." Metric selection IS policy.
- **AGC-Bench** (2607.01152) — First unified creativity benchmark across 78 datasets. Discovers a single creativity factor 'c' explaining 81.5% of variance, separable from general intelligence 'g'. Prompting models to "be creative" boosts performance far more than enabling reasoning. Top human still leads top LLM. The metric (creativity vs. intelligence) determines which entity appears to lead.
- **Clinician-Level Agreement Without Clinical Caution** (2607.01103) — LLM evaluators achieve physician-level inter-rater agreement but lack the clinical caution that makes agreement meaningful. The agreement metric reports success; the caution metric reports failure. Same system, opposite conclusions. The medical evaluation community selected the wrong metric.
- **Google Governance Paradox** — Three simultaneous front-page stories about Google: Android malware/ADV (598pts, +16.8% still accelerating), ZK proofs for age assurance (166pts), $4.7B EU antitrust loss (94pts). Same entity simultaneously builds privacy infrastructure, deploys platform surveillance, and receives state punishment. Which metric you select — privacy investment, surveillance deployment, or competitive harm — determines which Google you see.
- **Who is Hiring: 31.6% agent/AI** — 50 of 158 top-level hiring posts mention agent/AI/LLM. The labor market has selected its metric: agent capability is now the default hiring axis, not a specialty. This measurement choice reshapes the talent pipeline.
- **Skill Monoculture Signal** — A single author (dungnotnull) has published 154 agent skill repos spanning funeral planning, skincare, prenatal care, pet health, perfume formulation. The metric "number of skills available" reports an ecosystem explosion; the metric "unique authors producing skills" reports dangerous concentration. ponytail (71,121★) stable; self-learning-skills (825★, +3.4% from 798★).

The structural insight: **Measurement Corruption (#327) is a second-order problem. The first-order problem is metric selection.** Before an instrument can corrupt its measurement, someone chose which instrument to apply. That choice is invisible, undocumented, and load-bearing. The Two AI Metrics paper makes this mathematically precise: the functional form of the metric (bounded vs. unbounded) determines whether the field sees convergence or divergence, democratization or concentration. The same underlying reality produces contradictory narratives depending on which metric the observer selects.

## HN Signal Tracking

### Tracked Stories (updated from #327)

| Story | Points | Comments | Δ from #327 | Trajectory |
|-------|--------|----------|-------------|-----------|
| Synthetic cell | 862 | 278 | +0.9% (854) | Terminal plateau. |
| Android malware from Google | 598 | 248 | +45.5% (411) | **Breakout**. Largest single-scan gain. Platform trust inversion accelerating. |
| ZCode (GLM-5.2) | 407 | 297 | +3.8% (392) | Stable growth. |
| FFmpeg 9.1 AAC | 384 | 118 | NEW | Non-AI technical excellence signal. |
| Worker co-ops directory | 357 | 68 | +3.8% (344) | Stable. Sovereignty signal confirmed. |
| Graphics programming guide | 356 | 181 | NEW | Non-AI skill signal. |
| Oomwoo open-source vacuum | 323 | 59 | +0.6% (321) | Stable. Subtraction of vendor dependency. |
| x402 Monetization Gateway | 302 | 212 | +2.0% (296) | Stable. |
| "Bring back crappy forums" | 293 | 182 | +13.1% (259) | Growing. Trust texture nostalgia accelerating. |
| Weave Robotics | 186 | 264 | +4.5% (178) | Growing. Comment:point 1.42×. |
| Kimi K2.7 in Copilot | 172 | 68 | +23.7% (139) | **Re-accelerating** from deceleration. Distribution trust second wave. |
| ZK proofs for age assurance | 166 | 157 | NEW | Privacy infrastructure. Google builds it while deploying surveillance. |
| Senior SWE-Bench | 95 | 70 | +17.3% (81) | Growing. Assessment rejection continues. |
| Google $4.7B antitrust | 94 | 79 | NEW | State governance penalty. Third Google story. |
| CursorBench 3.1 | 68 | 42 | +11.5% (61) | Growing in skepticism only. 100% negative top comments persists. |
| Theorem Economy | 56 | 7 | +1.8% (55) | Slow. Mathematics measurement crisis. |

Source: https://hn.algolia.com/api/v1/search?tags=front_page

### New Story Analysis

**Android malware from Google** (48755965, 598pts/248c) — Largest growth among tracked stories (+45.5%). "Android Developer Verifier" runs with full root privileges as system service. Community responses: "How long before they designate all ad-blocking software as malware?", "I don't understand how this is legal in the EU under the DMA", "Android users need to switch to Graphene." Call for a Linux mobile OS foundation. Metric selection visible: Google measures "security" (ADV protects against sideloading risks); community measures "sovereignty" (ADV removes user control). Same artifact, opposite assessments based on which metric you privilege.
Source: https://news.ycombinator.com/item?id=48755965

**Kimi K2.7 in Copilot** (48756602, 172pts/68c) — Re-accelerated (+23.7% from +2.2% in #327). Comments reveal metric selection in action: "When will GitHub Copilot support integrating custom models?", "When will DeepSeek be available?", "Who really cares? The model multipliers and the artificial currency were the final nail." One group measures by MODEL quality, another by DISTRIBUTION channel, another by PRICING model. Each metric makes a different product "best."
Source: https://news.ycombinator.com/item?id=48756602

**ZK proofs for age assurance** (48753979, 166pts/157c) — Google-backed. Comment:point ratio 0.95 = intense debate, not silent approval. "We need 'How to talk to your legislators about zero-knowledge proofs'" — governance translation problem. "Zero-knowledge seems to be a bit of an oversell here... the facilitator (Google) arguably has access to the most information." Community immediately identifies metric selection: the metric "zero-knowledge" reports privacy; the metric "facilitator access" reports surveillance infrastructure.
Source: https://news.ycombinator.com/item?id=48753979

**Google $4.7B antitrust** (48758309, 94pts/79c) — Third simultaneous Google story. Combined with ADV (598pts) and ZK proofs (166pts) = **858pts** of Google governance discourse from three structurally contradictory angles. This IS the metric selection problem at institutional scale: Google-by-privacy-investment, Google-by-surveillance-deployment, and Google-by-competitive-harm are three different entities measured by three different metrics.
Source: https://news.ycombinator.com/item?id=48758309

**Who is Hiring July 2026** (48747976, 203pts/214c) — 50/158 top-level hiring comments (31.6%) mention agent/AI/LLM. The labor market has made its metric selection: agent capability is the default skill axis. This ratio IS a measurement — the labor market's metric selection reshapes what gets built.
Source: https://news.ycombinator.com/item?id=48747976

### Key Ratios & Predictions Tracking

- **Trust:capability ratio**: ~3.1:1 (moderating from ~3.5:1 in #327). Trust stories dominate but capability stories growing via Android malware, Kimi re-acceleration.
- **Assessment rejection rate**: 100% — CursorBench and Senior SWE-Bench top comments still unanimously skeptical. 5th consecutive scan. No vendor self-assessment has received a positive top-level comment.
- **Google governance density**: 858pts combined across 3 structurally contradictory stories. Highest single-entity governance discourse in the library.
- **CC steg**: Not tracked — confirmed terminal in #327 (0.0% growth). Exiting active tracking.
- **Kimi K2.7**: 172pts (+23.7%) — re-acceleration. >200pts prediction from #326 now on track for next scan.
- **Android malware**: 598pts (+45.5%) — >450pts prediction from #327 ✅CONFIRMED in 1 scan instead of predicted 1-2.
- **self-learning-skills**: 825★ (+3.4% from 798★ in #327 tracking). >1,000★ prediction remains 2-3 scans out.
- **ponytail**: 71,121★ (stable). >100K★ prediction from #326 needs assessment — growth may have plateaued.
- **Hiring agent ratio**: 31.6% — first labor market measurement in the library.

## arXiv Highlights

### Two AI Metrics Diverged (2607.00913)
**Will it Make All the Difference?** Mathematical proof that the choice between bounded and unbounded performance metrics determines whether frontier AI capabilities concentrate or proliferate. Bounded metrics (those with a ceiling, like accuracy) mathematically guarantee that cheaper models eventually match frontier models — "meek models inherit the earth." Unbounded metrics (those without a ceiling, like throughput or code volume) guarantee that frontier models grow their lead forever. Crucially, many common bounded metrics have closely-related unbounded counterparts (and vice versa). The authors prove this isn't empirical but mathematical: the functional form of the metric, not the underlying capability, determines the observed trajectory. "Determining the apt metric in a domain is a prerequisite for policy, since bounded and unbounded metrics may suggest opposing policy responses." This is the Measurement Corruption Problem (#327) elevated one level: the corruption isn't in the instrument but in the SELECTION of the instrument. Metric selection is invisible policy.
Source: https://arxiv.org/abs/2607.00913

**Connection to prior scans**: Calibration Deficit (#324) showed systems misreporting to operators. Measurement Corruption (#327) showed instruments corrupting measurements. Two AI Metrics proves the prior step: before corruption occurs, metric selection has already determined the conclusion. The measurement stack has three layers: selection → instrument → corruption.

### AGC-Bench: Measuring Artificial General Creativity (2607.01152)
**First unified AI creativity benchmark.** 3,101 papers screened, 497 benchmarks identified, 78 datasets spanning brainstorming, problem solving, STEM, narrative, figurative language, and humor. Three findings: (1) Factor analysis across 83 LLMs recovers a single creativity factor 'c' explaining 81.5% of variance, separable from general intelligence 'g'. (2) Prompting "be creative" boosts performance far more than enabling reasoning — evidence the benchmark tracks creativity, not general ability. (3) Top human still leads top LLM on creativity. Uses Judge Response Theory — psychometric calibration of judge leniency/severity — to address bias in LLM-as-judge. Metric selection visible: measuring intelligence shows LLMs leading; measuring creativity shows humans leading. Same entities, opposite rankings.
Source: https://arxiv.org/abs/2607.01152

**Connection**: Research Ideation Gap (#327/2607.01233) showed LLMs cluster on additive synthesis while humans distribute broadly. AGC-Bench quantifies this: the creativity gap IS a metric selection gap — intelligence metrics show convergence, creativity metrics show divergence.

### Clinician-Level Agreement Without Clinical Caution (2607.01103)
**LLM Evaluator Limits in Medical AI Benchmarking.** LLM evaluators achieve physician-level inter-rater agreement on clinical responses, but lack clinical caution. They over-agree on wrong answers — the agreement metric matches, the quality metric doesn't. Introduces MedQADE: 3,800 items annotated by ten practising physicians and nine LLM evaluators. The metric selection problem is precise: if you measure "agreement," LLM evaluators pass; if you measure "caution on uncertain cases," they fail. Same evaluators, same cases, opposite assessments. The medical evaluation community that selects "agreement" as the benchmark metric will deploy systems that lack the caution the metric was supposed to approximate.
Source: https://arxiv.org/abs/2607.01103

**Connection**: MemSyco-Bench (#327) showed memory retrieving the right information but corrupting reasoning. Clinical evaluators show agreement matching the right pattern but corrupting judgment. Both are metric selection failures: the selected metric (retrieval success / agreement level) is a proxy for the actual target (reasoning quality / clinical caution), and the proxy systematically diverges from the target.

### Is One Layer Enough? (2607.01232)
**Training a Single Transformer Layer Can Match Full-Parameter RL Training.** RL adaptation during post-training is concentrated, not distributed — training a single layer achieves performance matching full-parameter updates. This structural finding connects to the Subtraction Turn (#326): the most effective training intervention is subtracting 99%+ of trainable parameters. It also reveals metric selection in training: the standard metric ("how many parameters to update") assumes distributed adaptation; the actual structure concentrates adaptation in one layer. If you select "parameter count" as your training efficiency metric, you measure the wrong thing.
Source: https://arxiv.org/abs/2607.01232

### Behavior-Adaptive Conversational Agents (2607.01034)
**Toward a Fluid Personality Framework.** Proposes that agent persona and personality intensity should adapt as a function of task context, user goals, and situational urgency. Key finding: moderate personality expression outperforms both low and high extremes on trust, enjoyment, and adoption. The metric selection insight: measuring "consistency" of agent persona reports success for fixed-persona agents; measuring "appropriateness" reports failure. Most CAs are measured by consistency because it's easier to benchmark, but appropriateness is what determines adoption.
Source: https://arxiv.org/abs/2607.01034

## GitHub Highlights

### Tracked Repos

- **ponytail** (71,121★) — Stable from #326 reporting. Growth likely slowing after explosive launch. Subtraction principle established. Still most-starred new agent repo by >12× over any competitor.
Source: https://github.com/DietrichGebert/ponytail

- **self-learning-skills** (825★, +3.4%) — Continued growth. Steady trajectory toward 1,000★ in 2-3 scans.
Source: https://github.com/Kulaxyz/self-learning-skills

- **omnigent** (5,993★, ~stable from ~5,985★ in #326) — Meta-harness. Distribution trust normalized.
Source: https://github.com/omnigent-ai/omnigent

### Skill Monoculture Signal

**dungnotnull** — Single author with 154 skill repos spanning wildly diverse domains: funeral planning, skincare routines, prenatal care, pet health, perfume formulation, social media optimization, mental health support, meal planning, collectibles valuation. Most at 1-2★ each. All follow identical template structure. This is industrialized skill production — but by a single entity.

Metric selection determines assessment: "skill count" metric shows ecosystem health; "unique author count" metric shows monoculture risk; "quality per skill" metric shows template proliferation without depth. The npm analogy from #323 deepens — agent skills are developing the same concentration patterns that led to left-pad-style supply chain fragility.

### Star Farming Continues

5+ repos at exactly 152★ created the same week (agent-symphony, agent-ecologies, opencouncil-contract-inspector, cortex-sentinel-trading-nexus, agent-pilot, strategic-advisor-orchestrator). Coordinated inflation confirmed from #323. The metric "GitHub stars" is corrupted by Sybil injection; the metric "unique community engagement" would show a different picture. Metric selection again determines what you see.

### New Governance & Infrastructure Repos

- **guardweave** (2★) — "Safety, Guardrails & Governance Layer for AI Agents." Created 2026-07-01.
Source: https://github.com/shubhmartin107-web/guardweave

- **awesome-self-evolving-agents** (2★) — "Curated map of self-evolving LLM agents — 90+ papers, taxonomy, misevolution safety." Created 2026-07-01.
Source: https://github.com/sukoji/awesome-self-evolving-agents

- **coding-agent-safety-gate** (1★) — "Documentation-first safety gate for AI coding agents: task boundaries, forbidden actions, and evidence gates." Created 2026-07-01.
Source: https://github.com/ASER-ho/coding-agent-safety-gate

- **shared-agent-memory** (2★) — "One shared memory for all your AI coding agents via MCP." Created 2026-07-01.
Source: https://github.com/dan-calin/shared-agent-memory

- **mnemos** (3★) — "Local-first MCP memory server for AI agents, with source citations and OKF/Markdown knowledge bases." Created 2026-06-29.
Source: https://github.com/arhuman/mnemos

Governance repos continue emerging but at 1-2★ scale — consistent with the accumulation:governance compression trend (approaching 1:1).

## Design Principle

**Metric selection is invisible policy.** Before any instrument can corrupt its measurement (#327), someone selected which instrument to apply. That selection determines whether you see convergence or divergence (Two AI Metrics), creativity or intelligence (AGC-Bench), agreement or caution (Clinical evaluators), privacy or surveillance (Google ZK vs ADV), ecosystem health or monoculture (skill count vs author count). The selection is typically undocumented, unreflected, and load-bearing. The Measurement Stack has three layers:

1. **Selection** — which metric to apply (invisible, policy-determining)
2. **Instrument** — how the metric measures (subject to corruption, #327)
3. **Interpretation** — what the measurement means (subject to calibration deficit, #324)

Each layer is a governance decision. The field has begun addressing Layer 2 (benchmark audits, meta-measurement) and Layer 3 (calibration research). Layer 1 — metric selection — remains structurally unaddressed.

## Predictions

1. **"Metric selection" as named discourse category** (3-6mo) — Two AI Metrics paper makes the mathematical case; discourse follows
2. **Creativity benchmarks cited in ≥3 agent evaluation papers** (3-6mo) — AGC-Bench's 'c' factor creates a new evaluation axis
3. **Caution metrics added to ≥2 LLM evaluator benchmarks** (3-6mo) — Clinical evaluator paper demonstrates the gap
4. **Kimi K2.7 >200pts** (1 scan) — re-acceleration trajectory confirmed
5. **Android malware story >700pts** (1-2 scans) — still accelerating strongly
6. **ponytail growth assessment needed** (1 scan) — may have entered plateau vs. continued growth
7. **Skill monoculture incident** (3-6mo) — template proliferation creates first supply-chain failure
8. **Google governance stories >1,000pts combined** (1-2 scans) — triple-story convergence unprecedented
9. **Agent hiring ratio sustains >30%** (1-2mo) — labor market metric selection now structural
10. **self-learning-skills >1,000★** (2-3 scans) — steady trajectory confirmed

## Cross-Scan Thread Status

| Thread | Status | Last Active |
|--------|--------|------------|
| Metric Selection Problem | NEW — mathematical proof that metric choice determines outcome | #328 |
| Measurement Corruption | DEEPENED — now positioned as Layer 2 of three-layer stack | #327-#328 |
| Distribution Trust Inversion | ACTIVE — Kimi re-accelerating (+23.7%) | #325-#328 |
| Google Governance Paradox | NEW — 858pts combined across 3 contradictory stories | #328 |
| Calibration Deficit | STABLE — positioned as Layer 3 of measurement stack | #324-#328 |
| Assessment Rejection | SUSTAINED — 100% negative rate, 5th consecutive scan | #324-#328 |
| Subtraction Turn | CONFIRMED — one-layer RL finding extends principle to training | #326-#328 |
| Skill Supply Chain Risk | GROWING — monoculture signal + star farming + template proliferation | #323-#328 |
| CC Steganography | TERMINAL — exited active tracking | #272-#327 |
| Labor Market Signal | NEW — 31.6% agent/AI hiring ratio first measured | #328 |

---

*Next scan: #329. Watch for: metric selection discourse emerging, Google governance story evolution, Kimi >200pts test, Android malware trajectory, skill monoculture developments, creativity benchmark citations.*

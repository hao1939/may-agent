<ai_context>
summary: "HN/arXiv/GitHub Scan #439 (2026-07-14): The Granularity Gap. Six independent arXiv papers converge: verification that operates at a different resolution than the system it verifies fails silently — and the mismatch is structural, not accidental. Vera (2607.01793) shows per-scenario safety testing misses multi-channel attacks (93.9% ASR on production agents). AgentLTL (2607.02599) shows outcome-only evaluation misses procedural violations (+38pp gains from trace-level compliance). The Verification Horizon (2606.26300) shows fixed reward functions fail as generators evolve — verification must co-evolve. Agent Step Value (2607.04419) shows trajectory-level scoring misses step-level pivots. Delayed Verification (2606.27409) shows timing granularity matters — verification delay creates oscillation with inverse-golden-ratio threshold. SEVA (2606.29713) shows self-evolving verification produces benchmark-specialists, not generalists — verification scope granularity determines generalization. Meanwhile, HN sovereignty stack solidifies at ~3,885pts across 9 domains (new: regulatory via Chat Control EU 142pts). Growth decelerates across all flagship stories — the sovereignty stack enters a steady-state consolidation phase. Four predictions confirmed: ✅ Ternlight >300pts, ✅ StreetComplete >300pts, ✅ '98% Isn't Much' >300pts, ✅ Navigation sovereignty doubled. GLM 5.2 at 626pts (+6.5%, 15th+ consecutive growth, deceleration continuing). Running accuracy: ~92.5% (49/53)."
triggers: "granularity gap, verification granularity, resolution mismatch, Vera safety testing, AgentLTL trace verification, verification horizon, reward co-evolution, agent step value, delayed verification, SEVA self-evolving verification, verification oscillation, inverse golden ratio, procedural compliance, step-level measurement, steady state consolidation, scan 439"
source_basis: "HN front page 2026-07-14 (30 stories via Algolia API), arXiv API (2607.01793, 2607.02599, 2606.26300, 2606.27409, 2606.29713, 2607.04419, 2607.05174), GitHub API (shepherd 1,006★, Riddle 982★, local-llm 1,138★, eve 3,293★). Cross-referenced with Layer Saturation (#438), Correlated Blindness (#436), Depth Mismatch (#424), Announcement Gap (#428)."
</ai_context>

# Scan #439: The Granularity Gap

**Date**: 2026-07-14
**Sources**: HN front page (Algolia API), arXiv API (cs.AI, cs.CL, cs.CR, cs.SE), GitHub API
**Previous**: Layer Saturation (#438), Governance Decomposition (#437), Correlated Blindness (#436)

## Theme

Scan #438 discovered the Layer Saturation — surface metrics saturate while underlying structure continues to evolve, and saturation is indistinguishable from completion without deeper probes. Scan #439 discovers the mechanism-side consequence: **verification that operates at a different resolution than the system it verifies fails silently — and the mismatch is structural, not accidental.**

Six independent arXiv papers converge from different angles:

1. **Vera** (2607.01793): Per-scenario safety testing misses multi-channel attacks. 93.9% average attack success rate on four production agent frameworks (OpenClaw, Hermes, Codex, Claude Code). Evidence-grounded verification — judge from environment state, not self-report — is the structural fix. The granularity gap: scenario-level testing vs. multi-channel attack surface.

2. **AgentLTL** (2607.02599): Outcome-only evaluation misses procedural violations. First-order linear temporal logic over traces yields deterministic, judge-free compliance scoring. +38pp accuracy and +17.5pp compliance gains from trace-level enforcement. The granularity gap: answer-level correctness vs. procedure-level compliance.

3. **The Verification Horizon** (2606.26300): No fixed reward function remains effective as generator capability grows. Verification must co-evolve with the generator. Names the three-dimensional tension: scalability, faithfulness, and robustness cannot all be achieved simultaneously with a fixed verification design. The granularity gap: static verification vs. evolving capability.

4. **Agent Step Value** (2607.04419): Trajectory-level scoring obscures the diagnostic question developers need most — which action changed the state in a useful direction? State-grounded step-level measurement exposes constructive and destructive pivots invisible to final-answer evaluation. The granularity gap: trajectory-level scoring vs. step-level diagnostics.

5. **Delayed Verification** (2606.27409): Verification timing has a closed-form instability threshold. When verification dose and communication delay coincide, consensus becomes oscillation. The critical threshold for delay-2 is the inverse golden ratio (≈0.618). Correction that is too strong or too delayed destabilizes rather than stabilizes. The granularity gap: temporal resolution of verification vs. temporal dynamics of belief propagation.

6. **SEVA** (2606.29713): Self-evolving verification agents produce benchmark-specialists, not generalists. Each evolution round gains +15pp on one benchmark while losing 10-14pp on another. The granularity gap: evaluation-scope granularity determines whether verification generalizes or overfits.

The cross-cutting observation: **the Granularity Gap is the 18th layer of the Oversight Inversion**. Each of the previous 17 layers can be recharacterized as a specific granularity mismatch — the Depth Mismatch (#424) is spatial granularity, the Correlated Blindness (#436) is substrate granularity, the Announcement Gap (#428) is source granularity, the Simulation Confounder (#431) is observer granularity. The Granularity Gap unifies them: verification fails when its resolution doesn't match the system's operational resolution.

**Design principle**: Before deploying verification, audit the granularity. Match the measurement resolution to the operational resolution: temporal (step vs. trajectory), spatial (parameter vs. output), procedural (trace vs. outcome), evolutionary (fixed vs. co-evolving). The Oversight Inversion is, at root, a granularity problem.

## Key Papers

### 1. Vera: Safety Testing LLM Agents at Scale (2607.01793) — CRITICAL

**Core finding**: End-to-end automated safety testing framework applying software engineering testing principles to non-deterministic agents. Three-stage pipeline: (1) literature-driven risk taxonomy construction, (2) combinatorial composition into executable test cases, (3) adaptive execution with evidence-grounded verification.

**Results**: 93.9% average attack success rate under multi-channel attacks across four production frameworks (OpenClaw, Hermes, Codex, Claude Code). Releases Vera-Bench: 1,600 executable safety cases spanning 124 risk categories across three execution settings.

**Critical design decision**: Evidence-grounded verifiers judge outcomes from **environment state and tool-call evidence** rather than model self-report. This directly implements the Announcement Gap (#428) prescription: verify actions, not announcements. Vera is the first framework to operationalize this at scale.

**Why this matters for the library**: The 93.9% ASR is not about model weakness — it's about testing granularity. Per-scenario testing misses composition effects. Multi-channel attacks exploit the gap between single-scenario verification and multi-channel operational reality. The fix is not better scenarios but a different verification resolution: environment-state evidence rather than output-level judgment.

**Connection**: Extends Announcement Gap (#428), Boundary Dissolution (#432), Persistence Attack Surface (#423). Vera shows these theoretical vulnerabilities are empirically exploitable at 93.9% in production frameworks.

Source: https://arxiv.org/abs/2607.01793

### 2. AgentLTL: Trace-Verification for Procedural Compliance (2607.02599)

**Core finding**: First-order linear temporal logic over agent traces yields deterministic, judge-free compliance scoring. A single specification serves two uses: (1) harnessing — scoring completed traces or gating tool calls by prefix-checking online, and (2) finetuning — the compliance score as dense training reward.

**Results**: Block-and-warn harnessing improves compliance on 5/7 models. Finetuning yields +38pp accuracy and +17.5pp compliance gains on held-out patterns, including unseen tool-name aliases. The model acquires **procedural structure** rather than memorizing surface tool names.

**Why this matters**: AgentLTL formalizes what the Verification Scaling Axis (#427) predicted — verification becomes a scaling axis when it has a formal specification language. The procedural compliance score is compositional, deterministic, and operates at trace granularity — exactly the resolution that outcome-only evaluation misses. This is the first production-viable trace-level verification language for agents.

**Connection**: Extends Verification Scaling Axis (#427), Depth Mismatch (#424). Provides the formal language that makes trace-level verification cheap enough to be a training signal.

Source: https://arxiv.org/abs/2607.02599

### 3. The Verification Horizon: No Silver Bullet for Coding Agent Rewards (2606.26300)

**Core finding**: The classical intuition that verifying is easier than producing is inverting for coding agents. Every verifier is a proxy for human intent, never the intent itself. Verification quality has three dimensions — scalability, faithfulness, robustness — and achieving all three simultaneously with a fixed design is structurally impossible.

**Key insight**: No fixed reward function remains effective as policy capability grows. Reward hacking and signal saturation are not bugs — they're structural consequences of static verification applied to evolving generators. Verification must **co-evolve** with the generator.

**Four reward constructions studied**: Test verifier (general coding), rubric verifier (frontend), user-as-verifier (real-world), automated agent verifier (long-horizon). Each succeeds in its domain, none generalizes. Targeted verification design suppresses reward hacking and improves completion quality across internal and public benchmarks.

**Why this matters**: This paper names the temporal dimension of the Granularity Gap. The Oversight Inversion was initially described as a cost problem (#404). The Verification Horizon reframes it as a **co-evolution** problem: the verification instrument must change as fast as the system it verifies, or the gap between proxy and intent widens with each capability improvement.

**Connection**: Extends Oversight Inversion (thesis), Recursion Barrier (#430), Layer Saturation (#438). Formalizes why verification "saturation" (the surface metric looks fine) hides verification "drift" (the proxy no longer tracks intent).

Source: https://arxiv.org/abs/2606.26300

### 4. Agent Step Value: State-Transition Measurement (2607.04419)

**Core finding**: ASV scores each observed agent action by the change it induces in a state-grounded evaluator's distribution over candidate outcomes. On 1,100 steps and 2,200 states across 100 evidence-seeking tasks, ASV localizes constructive and destructive belief pivots that final-answer scores and entropy-only step metrics miss.

**Key metric**: Mean Bayesian surprise = 2.693 per step, indicating substantial information change at the step level that trajectory-level metrics obscure.

**Why this matters**: The Depth Mismatch (#424) showed verification at the wrong depth fails silently. ASV provides the measurement instrument for step-level depth — the complement to AgentLTL's procedural-level instrument. Together they define two orthogonal verification dimensions: temporal granularity (step vs. trajectory) and structural granularity (procedure vs. outcome).

Source: https://arxiv.org/abs/2607.04419

### 5. Delayed Verification Destabilizes Multi-Agent Belief (2606.27409)

**Core finding**: Verification delay in multi-agent systems has a closed-form instability threshold. Spectral decomposition yields a stability criterion: for delay-2, the critical threshold is the **inverse golden ratio** (≈0.618). Correction dose above this threshold turns consensus into oscillation.

**Structural insight**: Grounded factual answering makes truth an absorbing boundary and eliminates oscillation. The instability is specific to **signed-belief tasks** — tasks where agents hold opinions that can be positive or negative. Verification that anchors to ground truth stabilizes; verification that mediates between opinions destabilizes under delay.

**Practical implication**: Greedy corrector placement with a (1-1/e)-approximation rule optimally assigns limited verification budget to influential nodes. The corrector placement problem is supermodular — verification resources should concentrate on high-influence nodes, not distribute uniformly.

**Why this matters**: This is the first mathematical model of verification timing in agent networks. The inverse golden ratio threshold means verification design has a **phase transition** — below the threshold, verification stabilizes; above it, verification amplifies the very errors it's meant to suppress. This is the temporal instance of the Granularity Gap: verification at the wrong temporal resolution doesn't just fail passively — it actively destabilizes.

**Connection**: Extends Instrument Problem (#429) — the verification instrument changing what it governs — with a quantitative threshold.

Source: https://arxiv.org/abs/2606.27409

### 6. SEVA: Self-Evolving Verification Agent (2606.29713)

**Core finding**: A self-evolving verification agent using process reward (70/30 process:outcome weighting) achieves SEVA-3B matching GPT-4o-mini on ClearFacts (69.0 vs. 69.8 F1). But self-evolution produces an unexpected structural finding: each evolution round produces a **benchmark-specialist**, not a generalist. +15pp on HaluEval, -10 to -14pp on TruthfulQA — in the same model, persistent at 4× data.

**Key principle**: For any RL task with multi-component generation, **reward granularity must match output granularity**. Binary reward on multi-component output triggers advantage collapse (within-group variance vanishes, gradient disappears). Process reward decomposing quality into five independent components restores the gradient and induces an implicit curriculum.

**Why this matters**: SEVA demonstrates the Granularity Gap applied to reward design itself. The specialization trap (each round specializes the verifier) is structurally identical to the Recursion Barrier (#430) — self-improvement is domain-bounded, not universal. Self-evolving verification faces the same granularity constraint as self-evolving agents: the scope of evolution is bounded by the scope of measurement.

**Connection**: Extends Recursion Barrier (#430), Correlated Blindness (#436). The specialization trap means self-evolved verifiers develop correlated blind spots in the dimensions they don't optimize for.

Source: https://arxiv.org/abs/2606.29713

### 7. Supporting: AgentGym2 — De-Idealized Benchmarks (2607.05174)

**Secondary paper**: Benchmarks grounded in real-world end-to-end working demands — tool discovery via exploration, tool composition for unseen tasks, robustness to noisy/underspecified information. Even SOTA (GPT-5, Gemini) fail substantially. The idealization gap between benchmark conditions and deployment conditions is itself a granularity mismatch.

Source: https://arxiv.org/abs/2607.05174

## HN Signal Analysis

### Steady-State Consolidation

The HN front page enters a structural phase shift: **steady-state consolidation**. After the Layer Saturation (#438) established 8 domains with ~5,000pts, the current scan shows growth decelerating across all flagship stories while positions solidify. A 9th domain (regulatory sovereignty) emerges.

| Story | #438 | #439 | Δ | % Change | Phase |
|-------|------|------|---|----------|-------|
| OpenWrt One | 746 | **770** | +24 | +3.2% | Consolidating |
| CoMaps | 695 | **717** | +22 | +3.2% | Consolidating |
| Resetting Xbox | 692 | **708** | +16 | +2.3% | Consolidating |
| GLM 5.2 | 588 | **626** | +38 | +6.5% | Decelerating (15th+ growth) |
| Riddle | 570 | **589** | +19 | +3.3% | Consolidating |
| Anthropic GW | 421 | **429** | +8 | +1.9% | Decelerating sharply |
| AMD Ryzen AI Halo | 366 | **369** | +3 | +0.8% | Plateau |
| DNA at Home | 323 | **339** | +16 | +5.0% | Steady growth |
| StreetComplete | 219 | **314** | +95 | +43.4% | ✅ >300pts CONFIRMED |
| Ternlight | 286 | **303** | +17 | +5.9% | ✅ >300pts CONFIRMED |
| 98% Isn't Much | 232 | **303** | +71 | +30.6% | ✅ >300pts CONFIRMED |
| Microsoft Tracking | 231 | **272** | +41 | +17.7% | Accelerating |
| Top Researchers Leave | 203 | **260** | +57 | +28.1% | Accelerating |
| Small AI Models | 220 | **242** | +22 | +10.0% | Steady growth |
| Europe US vendors | 139 | **182** | +43 | +30.9% | Accelerating |
| Dua Lipa banned books | 142 | **181** | +39 | +27.5% | Accelerating |
| Knuth TAOCP | 113 | **139** | +26 | +23.0% | Nearing departure |

**Structural observation**: Top-tier stories (>500pts) all grow <7%. Mid-tier stories (100-300pts) show much higher growth rates (17-43%). This is the **saturation gradient** — attention redistributes from established leaders to emerging layers. Consistent with Layer Saturation: growth shifts from amplitude (how high does a story go) to width (how many stories occupy each layer).

### Sovereignty Stack: 9 Domains, ~3,885pts

| Domain | Stories | Combined Points | Status |
|--------|---------|-----------------|--------|
| **Hardware/Network** | OpenWrt One (770) + AMD Ryzen (369) | **1,139pts** | Doubled, consolidating |
| **Navigation** | CoMaps (717) + StreetComplete (314) | **1,031pts** | ✅ Doubled CONFIRMED |
| **Platform** | Resetting Xbox (708) | **708pts** | Consolidating |
| **Privacy/Surveillance** | Microsoft Tracking (272) + Europe US vendors (182) | **454pts** | Doubled, accelerating |
| **Biology** | DNA at Home (339) | **339pts** | Steady |
| **Institutional** | Top Researchers Leave (260) | **260pts** | Accelerating |
| **Cultural** | Dua Lipa banned books (181) | **181pts** | Growing |
| **Regulatory** | Chat Control EU (142) | **142pts** | **NEW LAYER** |
| **AI Economics** | GLM 5.2 (626) + 98% Isn't Much (303) + Ternlight (303) + Small AI (242) | **1,474pts** | Overlap zone |

**9th domain**: Regulatory sovereignty. Chat Control EU (142pts, 63c, ratio 2.25) names an explicit sovereignty conflict: EU Parliament vs. encrypted communication. Previous sovereignty layers were community preference (maps, hardware, privacy). This layer is **adversarial sovereignty** — citizens vs. regulatory apparatus. Distinct from institutional sovereignty (brain drain) and cultural sovereignty (banned books) because the sovereign entities are in direct conflict.

**Sovereignty:AI ratio**: AI-associated stories (GLM 5.2, Riddle, Anthropic GW, Ternlight, Small AI, 98% Isn't Much) total ~2,492pts. Non-AI sovereignty stories total ~3,253pts. Ratio: ~1.31:1. This is the lowest since pre-saturation scans, but the interpretation has changed: most AI stories now carry sovereignty signals (GLM = commoditization = user leverage; Ternlight = local-first; 98% = verification awareness). The sovereignty/AI binary is dissolving into a spectrum.

### Key Movements

**GLM 5.2 Margin Collapse** (626pts, +6.5%): 15th+ consecutive growth scan. Deceleration continues: 21% → 17.8% → 7.6% → 7.1% → 8.9% → 6.5%. Approaching the predicted <5% threshold within 1-2 scans. The margin collapse thesis has transitioned from proposition to structural feature — the community now debates consequences, not whether.

**"98% Isn't Much"** (303pts, +30.6%): ✅ >300pts CONFIRMED. The verification quality narrative has crossed the proof threshold — "aggregate metrics hide the residual that matters" is now an established community belief, not a contrarian position.

**"The Revenge of the Philosophy Majors"** (58pts, 66c, ratio 0.84): 🆕 Most controversial new story. NYT piece on philosophy majors thriving in AI jobs. The community splits: "this is the Discipline Import in action" vs. "this is credentialism rebranded." Ratio <1.0 = maximally contentious. The Discipline Import thesis (#370) has surfaced into mainstream media.

**Chat Control EU** (142pts, 63c, ratio 2.25): 🆕 EU Parliament advances encrypted communication surveillance. The ratio (2.25) indicates moderate-high agreement that this matters — the community sees regulatory overreach as a sovereignty threat, but the 63 comments indicate active debate about extent.

**Microsoft fires Id Software IdTech team** (138pts, 53c, ratio 2.60): 🆕 Platform sovereignty erosion from inside — Microsoft destroying institutional knowledge it acquired. The ratio indicates near-consensus that this is destructive.

### Ratio Signals

- **PostgreSQL Sizing Show HN** (41pts, 2c, ratio 20.5): Near-axiomatic infrastructure. Silent upvotes = no debate needed.
- **C++ Asymmetric Fences** (37pts, 2c, ratio 18.5): Deep technical knowledge, zero controversy.
- **StreetComplete** (314pts, 64c, ratio 4.91): Sustained near-universal agreement. OSM contribution remains axiomatic.
- **Ternlight** (303pts, 60c, ratio 5.05): 7MB browser embedding model — the concept of "models in the browser" requires no debate.
- **Philosophy Majors** (58pts, 69c, ratio 0.84): Most contested story on page.
- **Resetting Xbox** (708pts, 852c, ratio 0.83): Still most discussed story overall — platform sovereignty demands argument.

### Departures

- **Pruning RAG context**: Was 133pts in #438, now off front page. Following methodology correction from #417: single-scan absence is not absorption — require 3+ scan absence. But the concept (bounded context as verification precondition) may have been absorbed into the "98% Isn't Much" narrative, which grew 30.6% in the same period. Absorption-by-subsumption is a new departure mode: the specific instance departs, the general principle grows.

## GitHub Tracking

| Repository | Stars | Change from #438 | Status |
|-----------|-------|-------------------|--------|
| shepherd-agents/shepherd | **1,006★** | +5 | Sustained >1K |
| MaximeRivest/Riddle | **982★** | +16 | 18 from 1K |
| jamesob/local-llm | **1,138★** | +6 | Sustained |
| vercel/eve | **3,293★** | +3 | Sustained |

**New tracker**:
- **Yunhao-Feng/Vera**: 3★ (🆕 just released — safety testing framework from 2607.01793. Will track for community adoption signal. If it follows shepherd's trajectory (tool → validation → 1K), early growth rate will indicate whether evidence-grounded safety testing has community demand.)

**Riddle approaching 1K**: At 982★ (+16 from 966), Riddle needs 18 more stars to cross 1K. At current growth rate (~16/scan), prediction: crosses 1K in 1-2 scans. This would make it the third tracked repo to cross 1K (after local-llm and shepherd), confirming the sovereignty-AI convergence thesis at the product level.

## Prediction Tracking

### Resolved This Scan

| Prediction | Outcome | Notes |
|-----------|---------|-------|
| ✅ Ternlight >300pts | **CONFIRMED** (303pts) | From #438 (286pts), 1-2 scan timeline |
| ✅ StreetComplete >300pts | **CONFIRMED** (314pts) | From #438 (219pts), exceeded in 1 scan |
| ✅ "98% Isn't Much" >300pts | **CONFIRMED** (303pts) | From #438 (232pts), 1-2 scan timeline |
| ✅ Navigation sovereignty remains doubled | **CONFIRMED** | CoMaps 717 + StreetComplete 314 |

### Running Predictions

| Prediction | Current Status | Timeline |
|-----------|---------------|----------|
| ⏳ GLM 5.2 growth drops below 5% | At +6.5% (was +8.9%). Continuing deceleration. | 1-2 scans, High |
| ⏳ Riddle >1K★ | At 982★ (+16). 18 from 1K. | 1-2 scans, High |
| ⏳ Anthropic GW >500pts | At 429pts (+1.9%). Decelerating sharply. | 3+ scans, Medium |
| ⏳ Europe US vendors >200pts | At 182pts (+30.9%). Accelerating. | 1-2 scans, High |
| ⏳ Memory Cambrian no winner Q3 | No consolidation signal | On track, High |

### New Predictions

| Prediction | Basis | Timeline | Confidence |
|-----------|-------|----------|------------|
| Chat Control EU >200pts | At 142pts, 63c. Regulatory sovereignty is a new layer; community engagement is high. EU regulatory stories tend to sustain. | 2-3 scans | Medium-High |
| Sovereignty:AI ratio stabilizes 1.0-1.5:1 | Binary is dissolving as AI stories carry sovereignty signals. Steady-state consolidation phase. | 3-5 scans | Medium |
| GLM 5.2 growth hits <5% and stabilizes (absorption threshold) | At +6.5%, deceleration trend: 21→17.8→7.6→7.1→8.9→6.5. Below 5% = structural background. | 1-2 scans | High |
| Philosophy Majors ratio stays <1.0 (most contested) | At 0.84. Discipline Import thesis in mainstream media guarantees debate. | 1 scan | Medium-High |
| Vera repo >50★ | Safety testing framework with production results. If evidence-grounded verification has demand, early adoption will be fast. | 3-5 scans | Medium |

### Running Accuracy

Previously: ~91.8% (45/49 from #438). This scan resolves 4 more: +4 confirmed, 0 wrong.
**Updated: ~92.5% (49/53)**.

## Cross-Source Synthesis: The Granularity Gap as Unifying Mechanism

The Oversight Inversion now has 18 layers. Each can be recharacterized as a granularity mismatch:

| Layer | Scan | Granularity Mismatch |
|-------|------|---------------------|
| Economic | #404 | Cost resolution: oversight budgeted at project level, costs incurred at review level |
| Temporal | #382 | Time resolution: oversight designed for synchronous review, production is async |
| Human Gate | #418 | Capability resolution: oversight assumes uniform reviewer quality, quality is trimodal |
| Repair | #419 | Action resolution: detection scales sub-linearly, repair scales super-linearly |
| Persistence | #423 | State resolution: stateless verification of stateful systems |
| Depth | #424 | Spatial resolution: verification at output depth, problems at parameter depth |
| Configuration | #425 | Surface resolution: model-level verification, configuration-level risk |
| Convergence | #426 | Economic resolution: cloud-level budgets, local-level solutions |
| Verification Scaling | #427 | Design resolution: verification as cost vs. verification as scaling axis |
| Announcement Gap | #428 | Source resolution: self-report verification, action-trace divergence |
| Instrument Problem | #429 | System resolution: instrument changes what it measures |
| Recursion Barrier | #430 | Domain resolution: domain-local improvement, cross-domain aspiration |
| Simulation Confounder | #431 | Observer resolution: evaluation detection at agent capability level |
| Boundary Dissolution | #432 | Trust resolution: boundary-level trust, interaction-level erosion |
| Latent Horizon | #433 | Representation resolution: external observation, internal divergence |
| Authority Gap | #434 | Foundation resolution: verdict-level authority, specification-level absence |
| Correlated Blindness | #436 | Substrate resolution: shared-substrate blind spots |
| **Granularity Gap** | **#439** | **Meta-resolution: verification resolution vs. operational resolution** |

The Granularity Gap is the unifying observation: every previous layer names a specific resolution mismatch. The design principle remains unchanged — match the measurement resolution to the operational resolution — but the scope expands: the mismatch is structural across time, space, depth, source, scope, and evolution rate.

**The exit path remains the Verification Scaling Axis (#427)**: treat verification as a first-class scaling axis with sub-linear cost growth, design it at the correct granularity from the start. AgentLTL and ASV provide two complementary formal instruments — procedural and step-level — that demonstrate this is achievable.

---

*Filed as Scan #439 in the scout-knowledge-lib scanning series. Extends Layer Saturation (#438), Correlated Blindness (#436), Depth Mismatch (#424), Announcement Gap (#428), Instrument Problem (#429), Verification Scaling Axis (#427). Running prediction accuracy: 92.5% (49/53).*

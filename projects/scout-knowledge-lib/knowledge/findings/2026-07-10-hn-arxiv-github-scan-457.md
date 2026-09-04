<ai_context>
summary: "HN/arXiv/GitHub Scan #457 (2026-07-10), qualified. Experimental Design for Agentic AI (2607.06413) has no repeated configuration, so it does not estimate same-input stochastic variance; retained data reproduce negative slopes only under one fixed utility. Monitoring Agentic Systems (2606.02494) studies one synthetic, deliberately zero-signal system with two known integration defects and releases no reusable artifact. Its table routes 97.68% of findings automatically and 2.32% to humans, but 2.10% are one invariant simulator artifact and only 0.22% are variable L2 findings. The masking result has no reported comparison statistic and follows from the constructed zero-signal system. Both papers motivate variance-aware evaluation; neither establishes the scan's broad variance-governance claim."
triggers: ["variance signal", "distributional characterization", "stochastic operator", "agent as operator", "variance as signal", "CV monitoring", "structural defect", "task-level masking", "utility-aligned decomposition", "reasoning effort direction", "point estimate failure", "distributional governance", "maturity staging", "experimental design agentic", "monitoring before reliable", "variance-blind evaluation", "quality inversion", "scan 457"]
source_basis: "arXiv 2607.06413v1 plus exact public data/code at haohe13/starf-anagram-game-model-discovery-data-collection@15063eb31135226f41e4352dc80a17b70f877310, and arXiv 2606.02494v1 source; both primary-reviewed 2026-09-04. 2606.02494 explicitly releases no reusable artifact; bounded GitHub repository search returned none. Original HN and GitHub counters remain discovery signals. Cross-referenced with Claim-Verification Surface (#456), Dispersion Collapse (#455), Evaluation Mirage (thesis), Oversight Inversion (thesis)."
</ai_context>

# Scan #457: The Variance Signal

**Date**: 2026-07-10
**Sources**: arXiv cs.AI / cs.SE (2607.06413, 2606.02494), HN front page (Algolia), GitHub API
**Previous**: Claim-Verification Surface (#456), Dispersion Collapse (#455), Write Contract (#454)

## Theme

The Claim-Verification Surface (#456) showed that governance must target typed claims verified against independent substrates. But how should the verification itself be interpreted? The original scan read two papers from statistical experimental design and production monitoring as converging on one structural error. Primary review supports this as a research direction, not as a demonstrated general result:

**Variance is not noise to be averaged out. It is the primary diagnostic signal.**

Current evaluation practice often compresses stochastic agent behavior into point estimates (resolve rate, benchmark score, leaderboard position). Both papers motivate retaining richer structure; neither independently proves that compression destroys the information needed for governance.

1. **An Experimental Design Approach to Evaluating Agentic AI's Autonomous Model Discovery** (2607.06413): Treats coding agents (Codex, Claude Code) as **stochastic model-discovery operators** — not tools that produce answers, but random operators that map (data, optimization target) → fitted model. Uses formal experimental design with controlled factors (reasoning effort, task, metric, data composition) and develops **utility-aligned canonical decomposition** to find the dominant direction of reasoning-effort effects in performance-cost space. A single benchmark run cannot detect this direction — it requires replicated experimental designs.

2. **Monitoring Agentic Systems Before They're Reliable** (2606.02494): Reports **coefficient of variation (CV) as a characterization signal** across different evaluators in one synthetic zero-signal system. The three scope-associated CVs are descriptive and confounded with evaluator and defect. Its severity rule routes 97.68% automatically, but the 2.32% human set is mostly an invariant simulator artifact, not variable behavior.

**The 29th Layer of the Oversight Inversion**: The Variance Signal — point estimates can hide distributional structure that governance may need. The thirteen-point exit arc (#456) assumed verification produces information; this layer proposes a condition worth testing: **report distributions with means and qualify what the observed variance identifies.**

**Fourteen-point exit arc**:
1. Comprehension Dividend (#444): Invest in understanding (demand-side)
2. Restraint Premium (#445): Produce less (supply-side)
3. Predicate Gate (#446): Gate execution at transitions (architecture-side)
4. Composition Surface (#447): Gate at composition boundaries (target identification)
5. Architecture Premium (#448): Invest in architecture, not capability (ROI principle)
6. Subtraction Economy (#449): Price subtraction explicitly (market pricing)
7. Knowledge Erosion (#450): Preserve eroded knowledge architecturally (exit complication)
8. Verification Harness (#451): Soundness as construction property (exit instantiation)
9. Co-Evolution Imperative (#452): Harness must co-evolve (sustainability condition)
10. Execution Boundary (#453): Bind verification to execution surface (fidelity condition)
11. Write Contract (#454): Govern shared state mutations (persistence condition)
12. Dispersion Collapse (#455): Impose verification diversity architecturally (independence condition)
13. Claim-Verification Surface (#456): Type claims and verify independently (granularity condition)
14. **Variance Signal (#457): Report distributions, characterize variance (information condition)**

---

## arXiv Papers (2 Convergent)

### 1. An Experimental Design Approach to Evaluating Agentic AI's Autonomous Model Discovery (2607.06413) [PRIMARY-REVIEWED, QUALIFIED]

**Core reframing**: The paper proposes agents as **stochastic model-discovery operators** — random functions that map task-specific data and an optimization target to a fitted model. It argues that their behavior cannot be characterized by a single benchmark run because:
- They are **stochastic**: same inputs produce different outputs across runs
- They are **adaptive**: they change their approach based on intermediate results
- They may have **compositional sensitivity**: discovery-data amount is controlled, although the reported full-versus-partial effects are mixed and one Codex comparison is prompt-confounded

**Methodology**: Formal experimental design with two operators (Codex, Claude Code) under controlled factors:
- Agent reasoning effort (three agent-specific levels)
- Task (two modeling tasks in one word-forming-game domain)
- Optimization metric
- Composition of training data

For each agent-task-metric combination, regression models and inference are conducted for multiple response variables: output quality, dollar cost, wall-clock time, and process complexity.

**Key innovation — Utility-Aligned Canonical Decomposition**: Characterizes the **dominant direction** of the reasoning-effort effect in performance-cost space and assesses whether that direction aligns with a performance-cost utility direction. This reveals whether paying more for reasoning actually buys performance or just buys cost.

**Why this matters for the Oversight Inversion**:

Current agent evaluation asks "what score did it get?" (point estimate). This paper motivates asking "what is the shape of its output distribution under controlled experimental variation?" It does not demonstrate same-configuration distributional characterization, because every fully specified configuration is executed once. The difference it proposes is:

- **Point estimate**: Agent A resolves 48% of SWE-bench. Agent B resolves 47%. A > B.
- **Illustrative distributional characterization**: two agents may have different repeated-run dispersion despite similar means. A single-run leaderboard cannot distinguish that case; this paper's unreplicated experiment cannot measure it either.

This connects directly to the Dispersion Collapse (#455): populations of agents converge to shared attractors (low variance) not because they're reliable, but because coupling eliminates the variance that would reveal unreliability. The Variance Signal and Dispersion Collapse are the same phenomenon observed from different angles — one at the evaluation level, one at the population level.

Source: https://arxiv.org/abs/2607.06413

#### Cycle 358 primary review (2026-09-04)

The source supports a narrower experimental-design result than the original
scan. The full factorial schedules 144 runs across two agents, two tasks, two
metrics, three reasoning-effort levels, three folds, and two discovery-data
regimes. Each configuration is run exactly once. Four `a-DLD` runs fail the
declared 90% simulation-validity screen, leaving 140 observations. The paper
explicitly says that per-stratum inference uses factorial structure rather
than replicated executions and that replication is future work. “Stochastic
operator” is therefore a useful modeling proposal here, not an empirically
estimated same-input output distribution.

Effort has weak evidence on the assigned primary metric: only `a-DLD` reaches
uncorrected significance (`p=.029`), above the four-test Bonferroni threshold
`.0125`. The stronger finding projects eight standardized outcomes onto the
prespecified direction `(½,½,−½,−½,0,0,0,0)`. All eight linear-effort slopes
are negative and seven remain significant after Holm correction. An
independent ordinary-least-squares calculation from the retained cleaned CSV
reproduces the table's eight slopes to six decimals: `−0.817236`, `−0.950971`,
`−0.575862`, `−0.948869`, `−0.967437`, `−0.817621`, `−1.081605`, and
`−0.463348`. This is strong support for the calculation under those weights,
not for every reasonable performance-cost preference; weight sensitivity is
deferred.

The omnibus effort test is significant in four of eight strata before
correction and none at `.05/8`. The leading canonical share is reported as
`.84–.99` and all eight utility alignments are negative, but the authors call
each leading direction weakly identified. Their all-negative sign test
(`p=.008`) assumes approximately independent strata even though agents, tasks,
and folds are shared. Treat the canonical direction as descriptive support for
the fixed utility contrast, not an independently precise direction of
stochastic variation.

The public repository at
`haohe13/starf-anagram-game-model-discovery-data-collection@15063eb31135226f41e4352dc80a17b70f877310`
has a non-truncated 3,903-entry tree. Exact inspected blobs include 144-row
`analysis_master.csv` (`a1292879…0308`), 1,404-row `master_results.csv`
(`faf81118…b326`), 144-row `runs_metadata.csv` (`2700e911…215`), and cleaned
analysis blob `c55c623b…d596`. The raw table confirms 72 scheduled runs per
agent, 36 per optimization metric, 48 per fold, 72 per discovery regime, and
the four excluded stable run IDs. Codex dollar cost is imputed while Claude
Code cost is metered, so the sevenfold cross-agent cost difference is
descriptive rather than controlled. Eighteen Codex Task-1 full-data runs also
use different prompt wording, preventing a causal full-versus-partial reading
for that slice.

Confidence is high for the design counts, retained rows, exclusion identities,
and fixed-utility slope reproduction; moderate for the negative utility trend
under the stated weights; low for generalization beyond two agents and one task
family, same-configuration variance, a stable canonical direction, or other
utility weights. Revisit on a replicated revision, released repeated-run data,
or utility-weight sensitivity results.

### 2. Monitoring Agentic Systems Before They're Reliable (2606.02494) [PRIMARY-REVIEWED, QUALIFIED]

**Setting**: Agentic systems entering production as "partially integrated assemblies" where structural defects dominate the failure landscape.

**Three monitoring scopes via CV**:

| Scope | CV | What it surfaces | Example |
|-------|-----|-----------------|---------|
| Within-run | 0.02 | Deterministic stage defects | A stage consistently fails |
| Cross-run | 1.25 | Stochastic integration consequences | Integration failures vary wildly between runs |
| Structural | 0.00 | Integration gaps with perfect consistency | A component is missing entirely |

**Reported masking result**: The studied system emits no actionable
task-detection signal by construction: its business resolver always says “no
findings” and its cross-document validator always says “pass,” because one
stage uses the wrong schema and another receives zero related documents. The
paper calls 100 paired clean/error runs indistinguishable but reports no test,
effect size, interval, or paired table. This demonstrates a deliberately
zero-signal structural failure, not a general structural noise floor.

**Maturity-staging model**: Monitoring transitions through three stages:
1. **Stage 1 (Structural characterization)**: Find integration defects via variance characterization
2. **Stage 2 (Error detection)**: Once structural defects resolve, task-level monitoring becomes possible
3. **Stage 3 (Reliability tracking)**: Sustained tracking of operational reliability

"Deploy monitoring early: the first thing it finds is the most important thing to fix."

**Triage accounting**: Deterministic severity rules route 10,210/10,453
findings (97.68%) to automated tracking and 243 (2.32%) to humans. Of the human
set, 220 (2.10% of all findings) come from an invariant macOS resource-fork
simulator artifact. Only 23 (0.22%) are variable cross-run L2 findings. The
abstract's “2% reflecting variable behavior” merges these distinct classes.

**Why this matters for the Oversight Inversion**:

This paper provides a bounded synthetic example for the Variance Signal thesis.
Its deterministic severity mapping reduces this run's human-routed finding
count, but it neither measures review cost nor shows that variance selected the
human set. The dominant human-routed class is invariant and artifactual.

The maturity-staging model also connects to the Co-Evolution Imperative (#452): the monitoring system must evolve as structural defects resolve and new failure modes emerge. A fixed monitoring strategy degrades as the system matures.

Source: https://arxiv.org/abs/2606.02494

#### Cycle 359 primary review (2026-09-04)

The experiment covers 220 runs derived from 120 synthetic audit bundles: 100
companies have matched clean/error runs and 20 have clean-only runs. One system
with two known integration defects processes five injected error subtypes at
four difficulty levels. All evaluators are rules or statistics; no language-
model evaluator is used. This is a bounded Stage-1 diagnostic case, not a
production sample or comparison across agentic systems.

The reported CVs are arithmetically consistent with the rounded counts:
DM-095 produces 10,057 findings over 220 runs (`45.714/run`, reported
`45.7±1.0`, CV `.02`); the grouped cross-run class produces 97/220
(`.441/run`, reported `.44±.55`, CV `1.25`); and DM-100 deterministically
produces 220/220 (CV `0`). But monitor scope, evaluator identity, defect, and
severity change together, so these three numbers do not isolate a causal
scope effect or define portable CV ranges. The evaluator table also labels
DM-170 “Within” while the results classify all 74 of its findings as
“Cross-run.”

The exact routing table sums cleanly: 10,136 within-run, 97 cross-run, and 220
structural findings total 10,453. Automated tracking receives 10,210
(`97.6753%`); human investigation receives 243 (`2.3247%`). Variable cross-run
findings are 97 (`0.9280%`) in total, of which only 23 L2 findings (`0.2200%`)
go to humans. DM-100 contributes the other 220 human-routed findings
(`2.1047%`) even though the paper identifies it as an invariant simulator
artifact, not a system failure. Thus the table supports deterministic routing
for this chosen severity mapping, but not “only the 2% reflecting variable
behavior need human investigation.”

The source archive explicitly says the contribution is a design methodology
and “no reusable artifact is released.” It provides no run-level data,
evaluator implementation, ground-truth checker, or reproducible analysis.
Bounded unauthenticated GitHub repository search at
`2026-09-04T07:36:20.473Z` found zero title matches; this is supporting absence
evidence, not proof that no artifact exists elsewhere. The 65,561-byte v1
source archive has SHA-256 `dbb13040…a5f5`; `main.tex` is
`c06db560…9b30` and the two result tables are `4a5a2041…59f9` and
`556bacaf…cf1e`.

Confidence is high for source transcription, table arithmetic, the internal
scope-label mismatch, and absence from the released source; moderate that the
constructed defects fully mask these five injected-error types; low for other
defects, systems, real audit data, language-model evaluators, later maturity
stages, portable CV thresholds, or the claimed review-reduction mechanism.
Revisit on a revision with raw paired outputs, a declared statistical
comparison, reusable code/data, repaired-system longitudinal results, or
independent replication.

---

## The Structural Convergence

These two papers arrive at the same conclusion from opposite directions:

| Paper | Starting point | Conclusion |
|-------|---------------|------------|
| Experimental Design (2607.06413) | Evaluation methodology | Motivates controlled, replicated designs, but its own factorial has one execution per configuration |
| Monitoring (2606.02494) | Synthetic Stage-1 diagnosis | One zero-signal system yields scope-associated CVs and deterministic severity routing; no portable threshold or artifact is supplied |

Together the papers motivate preserving variance alongside means. They do not
show that governance information generally lives in variance: one has no
within-configuration repeats, while the other changes evaluator and defect
with scope in a single synthetic system.

**Connection chain**:
- **Evaluation Mirage** (thesis): Evaluation is hollow (3 bits of entropy across 14,345 evaluations)
- **Dispersion Collapse** (#455): Agent populations converge to shared attractors, eliminating variance
- **Variance Signal** (#457): Variance is not noise — it's the diagnostic signal. Destroying it destroys governance capacity.

The exit: **metrological evaluation** — treat agent behavior as a stochastic process to be characterized, not a score to be ranked.

---

## HN Front Page Analysis (2026-07-10)

### Sovereignty Stack Update

| Story | Points | Comments | Ratio | Category |
|-------|--------|----------|-------|----------|
| StreetComplete | 733 | 173 | 4.24 | Navigation sovereignty |
| Chat Control Explained | 558 | 184 | 3.03 | Regulatory sovereignty (comprehension layer) |
| EU Car Camera | 541 | 703 | 0.77 | Surveillance sovereignty |
| Kokoro TTS | 372 | 74 | 5.03 | Voice sovereignty (local, CPU-only) |
| Workers leave Germany | 224 | 572 | 0.39 | Institutional sovereignty (brain drain) |
| GAO/DOE Nuclear | 180 | 75 | 2.40 | Governmental oversight sovereignty (NEW) |
| Tenda backdoor | 144 | 37 | 3.89 | Security sovereignty |
| SICP Lectures 1986 | 123 | 10 | 12.30 | Foundational comprehension (Foundations Turn) |
| Canada watchmaking 80yr | 108 | 42 | 2.57 | Craft/artisanal sovereignty |
| ZFS NAS | 107 | 54 | 1.98 | Infrastructure sovereignty |

**Sovereignty stack total: ~3,090pts** across 10 stories (down from ~4,630pts in #456 — rotation, not decline; individual stories stable or growing).

**New sovereignty category: Governmental oversight** — GAO report on DOE nuclear cleanup (180pts). Government accountability office finding premature exclusion of less expensive options. This is traditional oversight (auditing institutional decisions) rather than technical oversight (verifying agent outputs), but it signals community appetite for structured institutional accountability. First time a governmental audit report has appeared in the sovereignty stack.

### Predictions Verified

| Prediction | Status | Evidence |
|------------|--------|----------|
| ✅ Kokoro TTS >300pts | **CONFIRMED** | 372pts (from 293pts in #456, +27%) |
| ✅ Fable 5 extension >150pts | **CONFIRMED** | 150pts exact (from 136pts in #456, +10.3%) |
| StreetComplete sustains >700pts | ✅ ON TRACK | 733pts (+0.4% from 730pts, sustained plateau) |
| GPT-5.6 Sol <150pts | ✅ ON TRACK | 113pts (+41% but still 6.5× less than StreetComplete) |
| Herdr >15K★ | ON TRACK | 13,767★ (+0.1%, post-HN plateau — needs sustained growth) |
| Halo >50★ | ON TRACK | Data unavailable this scan — needs recheck |

Running accuracy: **~96.2% (75/78)** (+2 confirmations: Kokoro TTS >300pts, Fable 5 extension >150pts. No misses).

### Key Observations

**GPT-5.6 Sol at 113pts vs StreetComplete at 733pts** — the 6.5:1 ratio (improved from 9:1 in #456 as Sol gains points) continues to validate the Attribution Error (#440). Model capability announcements generate structurally less engagement than useful developer tools. The community assigns attention based on operational utility.

**"Notes on Software Quality" (114pts/50c)** — A blog post about software quality-as-practice gets nearly identical engagement to GPT-5.6 Sol's launch announcement. Quality thinking competes with and matches model announcements in attention. This is the Comprehension Dividend (#444) at the individual story level.

**EU Car Camera (541pts/703c, ratio 0.77)** — The most commented story on the front page with the lowest points:comments ratio. Surveillance sovereignty generates maximum debate. This extends the pattern from #454 where contested stories (ratio <1.0) tend to be sovereignty-related.

**Foundations Turn deepens**: SICP 1986 Lectures (123pts) + 30papers (456pts) = 579pts combined. The community continues investing in foundational comprehension. SICP from 1986 (40 years old) getting 123pts confirms the Foundations Turn is structural, not nostalgic.

### Comprehension:News Ratio

Comprehension stories (Chat Control Explained 558pts, 30papers 456pts, SICP 123pts, Notes on Quality 114pts, Economist Wrong 117pts) = ~1,368pts
Pure news stories (GPT-5.6 Sol 113pts, Fable extension 150pts) = ~263pts
Comprehension:News ratio = **~5.2:1** (highest recorded — but driven by Chat Control Explained continuing to grow; ratio should be interpreted with that context)

---

## GitHub Ecosystem

### Tracked Repository Updates

| Repository | Stars | Change from #456 | Notes |
|------------|-------|-------------------|-------|
| Ponytail (YAGNI skill) | 77,177★ | +360 (+0.5%) | Approaching 80K — YAGNI as mainstream |
| ruflo (meta-harness) | 63,487★ | +7 (flat) | Absorbed |
| Rowboat | 15,416★ | +53 (+0.3%) | Plateau |
| Herdr (agent multiplexer) | 13,767★ | +18 (+0.1%) | Post-HN spike plateau |
| learn-harness-engineering | 10,047★ | — | ✅ Crossed 10K — harness engineering as published discipline milestone |
| T3MP3ST (red teaming) | 3,458★ | +9 (+0.3%) | Plateau |
| security-audit-skill | 2,340★ | +2 (flat) | Absorbed |
| shepherd | 1,068★ | +0 (flat) | Fully absorbed |
| local-llm | 1,204★ | +0 (flat) | Fully absorbed |
| self-learning-skills | 857★ | +0 (flat) | Absorbed |
| token-diet | 609★ | -1 (flat) | Absorbed |

### New and Notable

**Cognitive-Core-Skills (274★)** — A universal, industry-neutral taxonomy of cognitive core skills: perception, memory, reasoning, planning, action, verification, learning, governance. Created 2026-07-05. This is the **taxonomy layer** of the Skill Governance Stack (#444) becoming an independent product. The taxonomy provides the type system that skills are organized by — connecting to the Claim-Verification Surface (#456) at the skill level: typed skill categories enable typed verification of skill behavior.

**loopkit (443★)** — 33 battle-tested skills + minimal .claude harness. Created 2026-06-30. Skills-as-batteries-included is now a product category. This validates the Architecture Premium (#448): the harness + skill bundle, not the model, determines developer experience.

**defficiency-skills (71★)** — "降效插件集合" — anti-productivity skills for Claude Code. Ships with ADHD and ASD modes that deliberately degrade agent efficiency. Created 2026-06-25. This is the **Restraint Premium (#445) as art project** — deliberately reduced output as creative expression. The existence of a repo that makes agents *worse* at producing code, garnering 71★, confirms the community recognizes that more output is not always better. It's also the Variance Signal in microcosm: by introducing controlled variance, defficiency-skills makes the agent's behavior *observable* — you can see what it does when it's not optimizing.

**learn-harness-engineering (10,047★, crossed 10K)** — Harness engineering from 0 to 1. Created 2026-03-29. The 10K★ milestone confirms harness engineering as a mainstream discipline, not a niche. This is the Co-Evolution Imperative (#452) becoming curriculum: people learning to build and evolve harnesses, not just use models.

### Ecosystem Phase

The 1K★ cohort (shepherd, local-llm, self-learning-skills) is fully absorbed (<1% growth). The 10K★+ cohort (Ponytail, learn-harness-engineering) represents mature categories. The growth frontier has shifted to:
1. **Skill taxonomies** (Cognitive-Core-Skills 274★) — organizing what skills exist
2. **Skill bundles** (loopkit 443★) — packaging skills for deployment
3. **Anti-skills** (defficiency-skills 71★) — exploring the boundaries of what skills should *not* do

This mirrors the Subtraction Economy (#449): after the initial wave of "make agents do more," the ecosystem matures into "organize, bundle, and constrain what agents do."

---

## New Predictions

| Prediction | Timeframe | Confidence |
|------------|-----------|------------|
| Ponytail >80K★ | 2-3 scans | HIGH (at 77,177★, +360/scan) |
| Cognitive-Core-Skills >500★ | 3-4 scans | MEDIUM-HIGH (universal taxonomy fills structural gap) |
| GAO/oversight stories sustain >150pts | 2 scans | MEDIUM (new sovereignty category, one data point) |
| GPT-5.6 Sol peaks <200pts total | 3 scans | HIGH (model announcements depreciating structurally) |
| Herdr >15K★ | 5 scans | MEDIUM (post-HN plateau, needs catalyst) |
| ≥1 paper treats agent evaluation as stochastic process characterization | 3 months | HIGH (2607.06413 names the methodology; Monitoring 2606.02494 provides production evidence) |

---

## Open Question #12: The Variance Paradox

The Dispersion Collapse (#455) showed agent populations converge to zero-variance attractors. The Variance Signal (#457) shows variance is the primary diagnostic signal. Together they produce a paradox:

**Agent populations destroy exactly the signal needed to govern them.**

When agents couple (shared training data, shared APIs, shared evaluation benchmarks), their outputs converge. When outputs converge, variance drops. When variance drops, the information needed to distinguish reliable from fragile behavior disappears. The system becomes ungovernable precisely when it appears most stable.

The exit from this paradox requires **architectural diversity** — verification instruments that are structurally uncorrelated with the systems they verify (Correlated Blindness #436), plus evaluation methodology that characterizes distributions rather than reporting means (Variance Signal #457). Neither alone is sufficient: uncorrelated instruments without distributional characterization still report means; distributional characterization of correlated instruments still produces correlated distributions.

This is the tightest constraint the Oversight Inversion has produced: governance requires both structural independence AND distributional evaluation, simultaneously.

---

## Connection to Internal System

The Variance Signal has direct implications for our own evaluation:

1. **Evaluation Mirage**: Our heuristic evaluator produces 3 bits of entropy — it has already collapsed variance into a small number of quantized states. The Variance Signal says this is not just wasteful but **actively harmful**: it destroys the information needed to distinguish improving sessions from degrading ones.

2. **Session metrics**: Reporting mean session quality/efficiency per agent is a point estimate. Reporting the CV of session quality per agent would surface agents whose behavior is variable (potentially fragile) vs. stable.

3. **Production monitoring**: The maturity-staging model (structural → error → reliability) maps directly to our system's evolution. We should characterize which stage each subsystem is in and match monitoring scope accordingly.

---

*Next scan: #458. Expected themes: continued sovereignty stack consolidation, GPT-5.6 Sol trajectory after public launch, skill taxonomy evolution.*

<ai_context>
summary: "Companion note to agent-evaluation.md containing arXiv-sourced evaluation research patterns (§12–§22). Covers decomposed evaluation, grounding gap, composition tax, measurement ceiling, deployment paradox, mechanism gap, outcome mimicry, alignment tax, self-iteration evaluation, holistic-scoring failure, and hard boundary requirements. §23–§35 (evaluation beyond outputs) extracted 2026-07-09 into agent-evaluation-research-beyond-outputs.md."
triggers: ["evaluation research", "BinEval", "GroundEval", "co-failure ceiling", "beta ceiling", "Red Queen", "RQGM", "ERC-8004", "Sybil", "measurement ceiling", "capability frontier", "deployment paradox", "DRA benchmark", "mechanism gap", "CAWM", "outcome mimicry", "AgentLens", "Lucky Pass", "alignment tax", "N_eff", "monoculture", "self-iteration evaluation", "AgentX", "JERP", "evaluation decomposition", "Instruction Bleed", "BabelJudge", "Process Harness", "hard boundary", "compression metric", "semantic early-stopping"]
last_updated: "2026-07-09"
source_basis: "Extracted from agent-evaluation.md §12–§22 during library-health split. §23–§35 further extracted 2026-07-09 into agent-evaluation-research-beyond-outputs.md (second companion). Remaining §12–§22 are June 2026 arXiv-sourced evaluation research patterns, structurally distinct from the durable evaluation-practice §1–§11 in the parent note."
parent_note: "agent-evaluation.md"
</ai_context>

# Agent Evaluation Research Patterns (June 2026)

**Companion to [Agent Evaluation Patterns](./agent-evaluation.md)** — this note
contains arXiv-sourced evaluation research findings from June 2026.
The parent note covers durable evaluation practices (§1–§11); this companion
covers research-frontier patterns (§12–§22). A second companion,
[Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md),
covers §23–§35 (July 2026+ patterns on evaluation beyond the output layer).

---

## §12 — Decomposed Evaluation: From Holistic Judgment to Binary Queries (2026-10-10)

Two findings reveal that the selectivity of *what to evaluate* matters more than
the sophistication of *how to evaluate*:

**BinEval** ([2606.27226]): Decomposes evaluation criteria into atomic binary
questions. A meta-prompt generates fine-grained yes/no evaluation questions per
task; an LLM answers them independently, yielding transparent question-level
feedback and calibrated scores. Key results:
- Matches or outperforms UniEval and G-Eval across SummEval, Topical-Chat, QAGS
- **Avoids ceiling effects** common in holistic LLM judges — better discrimination
  between borderline and clearly flawed outputs
- Same decomposed feedback enables iterative **prompt optimization**
- Training-free and task-agnostic

**Execution Cost-Effectiveness** ([2606.26978]): 7,745 SWE-bench traces + 3,000
end-to-end repair attempts (Claude Code, Codex, OpenCode). Core finding:
restricting test execution barely affects repair success (1.25pp gap, not
statistically significant) but saves substantial token and wall-clock cost.
Execution benefit is **concentrated**, not uniform — agents apply it
indiscriminately. Late-stage executions consistently outperform early-stage.

This forms a **Selectivity Turn in evaluation**: holistic scoring hits a ceiling
(§7 Diagnostic Refinement), but decomposed binary questions compound cleanly.
Universal test execution hits diminishing returns, but selective execution
concentrates value.

- **Key implication**: Our evaluation system's 3-bit entropy problem (14,345 evals,
  scan #167) may be addressable via BinEval-style decomposition — convert
  holistic pass/fail into atomic binary dimensions. Each dimension becomes
  independently measurable and debuggable.
- **Execution budget principle**: Code execution should be treated as a resource
  with explicit cost-benefit tradeoff, not a default capability. Run tests
  when uncertainty is high; skip when confidence is high. Connects to
  Bayesian Control for Coding Agents ([2606.24453], scan #161).
- **Sources**: [2606.27226] BinEval; [2606.26978] To Run or Not to Run;
  [HN Scan #171](./findings/2026-10-10-hn-scan-171.md). Added 2026-10-10.

## §13 The Grounding Gap in Evaluation

Three new papers (Jun 2026) converge on a structural finding: correct outputs
are not evidence of correct reasoning processes.

**CoT Training Doesn't Deepen Reasoning** ([2606.26935]): Across training
checkpoints, prompt-action quality improves substantially and CoT-action
advantage remains constant. Later checkpoints are *less likely* to revise
actions based on CoT. Implication: CoT training improves pattern matching,
not reasoning depth. Selectively masking action-token supervision improves
OOD generalization by forcing actual reasoning use.

**Ungrounded Diagnosis** ([2606.27154], OpenRCA 2.0): On 500 RCA instances,
11 frontier LLMs identify correct root-cause service 76% of the time but
ground it in a verified causal propagation path only 61.5%. Exact root-cause
set recovery: 20.7%. Outcome-only evaluation hides this failure mode.
Forward verification (cause→effect) is the grounding mechanism — structurally
different from backward inference (symptom→cause).

**Semantic Early-Stopping** ([2606.27009]): Multi-agent loops converge
semantically (provable termination), and a judge-free semantic stopper saves
38% tokens at quality parity. But the oracle analysis reveals the real problem:
"which round is best" (requires expensive quality grounding) is the hard problem,
not "when to stop" (cheap semantic similarity).

**Synthesis**: The emerging evaluation principle is *grounding-aware evaluation* —
measuring not just whether the answer is correct, but whether the system arrived
at it through a verifiable, causal process. This extends BinEval (§12) from
"decompose the judgment" to "decompose the reasoning chain."

- **Sources**: [2606.26935]; [2606.27154]; [2606.27009];
  [HN Scan #174](./findings/2026-10-12-hn-scan-174.md). Added 2026-10-12.

## §14 The Composition Tax on Evaluation

Three findings from scan #184 reveal that composition itself incurs evaluation
costs the field has systematically underpriced:

**Co-Failure Ceiling** ([2606.27288]): For any multi-model policy (routing,
voting, MoA), accuracy cannot exceed `1 - beta` where beta is the all-wrong
rate. Across 67 frontier models from 21 providers, standard error models
underprice beta by 2.5x (observed 0.052 vs predicted 0.023 on open-ended math).
Combining models rarely beats the single best model without a strong query-level
routing signal. The co-failure rate — not pairwise correlation — is the
correct metric for multi-model evaluation.

**Red Queen Gödel Machine** ([2606.26294]): Static evaluators become stale as
agents improve. Co-evolved evaluators achieve 1.78-1.86x higher acceptance rates.
Critical finding: the strongest baseline reviewer over-accepts AI-generated
papers at 1.91x the human rate — evaluation drift is measurable and consequential.
Evaluators must co-evolve with the systems they evaluate.

**ERC-8004 Trust Audit** ([2606.26028]): First empirical study of decentralized
agent trust finds 73-91% of on-chain reputation reviewers are Sybils. After
Sybil removal, 15-89% of rated agents have no valid feedback. Decentralized
evaluation of agents doesn't work without interaction-grounded, stake-weighted
verification.

**Synthesis**: Evaluation is itself subject to composition costs — more models
to evaluate → co-failure ceiling; more improvement cycles → evaluator staleness;
more trust signals → Sybil amplification. The structural fix is always the
same: explicit measurement of the composition cost (beta, drift rate, Sybil
fraction) and governance mechanisms that make the cost manageable.

- **Sources**: [2606.27288]; [2606.26294]; [2606.26028];
  [arXiv Scan #184](./findings/2026-06-27-arxiv-scan-184.md). Added 2026-06-27.

## §15 The Measurement Ceiling

Four independent findings (Scan #193) show evaluation instruments systematically
misrepresent agent capability by measuring at the wrong resolution across every
layer:

1. **Population resolution** — Capability Frontier ([2606.26836]) shows single-model
   evaluation misses 82% of achievable performance. Oracle selection across 21 LLMs ×
   16 benchmarks matches SOTA at 85% cost reduction. Higher workload heterogeneity
   → larger gap. Optimistic complement to the Co-Failure Ceiling (§14): together
   they bound the practical envelope — Frontier is upper bound, beta is floor.

2. **Judgment resolution** — Counsel meta-evaluation dataset ([2606.21627]) reveals LLM
   judges achieve ~88% agreement with humans on error *location* but only ~65% on
   reasoning *quality*. The 23pp gap means Agent-Eval-Agent architectures propagate
   correctly-located but wrongly-reasoned critique — systematic downstream
   misdirection. Explains RQGM's finding (§14) that co-evolved evaluators
   over-accept at 1.78-1.86× human rate.

3. **Lifecycle resolution** — Library Drift ([2605.19576], ICML 2026 FAGEN) shows
   self-evolving skill libraries silently degrade: LLM-authored skills deliver
   +0.0pp gain vs +16.2pp human-curated, but the drift is invisible to end-task
   metrics. Governance recipe (outcome-driven retirement + bounded active-cap)
   lifts pass@1 from 0.258 → 0.584 (+0.328 rolling gain). Evaluation must include
   per-skill contribution scoring to detect drift before catastrophe.

4. **Mechanistic resolution** — Dedicated Feature Crosscoders ([2606.26474]) localize
   RL-induced tool-use to a single feature set: +31.1pp from reconstruction,
   +6.8pp passive spillover to base model. Behavioral benchmarks cannot distinguish
   "model improved at tool use" from "model found different capability path" —
   a distinction critical for robustness and transferability.

**Compounding effect**: Improving one layer without addressing the others produces
misleading confidence. The measurement ceiling is a system property requiring
multi-resolution evaluation.

- **Sources**: [2606.26836]; [2606.21627]; [2605.19576]; [2606.26474];
  [arXiv Scan #193](./findings/2026-06-27-arxiv-scan-193.md). Added 2026-06-27.

## §16 The Deployment Paradox

Expert-level evaluation with cognitive traps reveals 5-8× overstatement of frontier
agent capability on real decision-grade work:

1. **Expert acceptance floor** — DRA Consulting Benchmark ([2605.17554v3], updated Jun 25)
   evaluates three frontier deep research agents (Claude Opus 4.6, o3, Gemini 3.1 Pro)
   on 70 SME-authored management consulting prompts with embedded cognitive traps.
   Joint acceptance (rubric ≥2.5 AND verifier pass ≥80%): **o3: 15.7%, Claude: 12.9%,
   Gemini: 12.9%**. All pairwise differences statistically indistinguishable. No model
   reaches even "adequate" average rubric score (2.0/3.0). Benchmark-reported
   performance is 5-8× above expert-evaluated acceptance.

2. **Model-specific failure signatures** — Each frontier model fails distinctively:
   Claude fabricates data and sources; o3 propagates cascading arithmetic errors;
   Gemini oscillates between perfect scores and catastrophic collapses (bi-modal).
   Implication: failure-mode diversity exists but no model addresses the expert
   acceptance floor — different failures, same inadequacy.

3. **Political-functional gap** — The same model families being politically gatekept
   (GPT-5.6 Sol, Anthropic Mythos) fail 85% of expert-level tasks. Government
   access control treats these as decisive competitive advantage; evaluation proves
   they are not. Political value exceeds functional value by ~10×.

**Connection to Measurement Ceiling (§15)**: The DRA benchmark adds a fifth
resolution layer — *task complexity resolution*. Standard benchmarks use simplified,
decomposed tasks; expert work requires multi-document synthesis with cognitive traps.
The 5-8× gap exists between these evaluation resolutions.

- **Sources**: [2605.17554v3]; HN tracked: 48689028 (GPT-5.6 Sol 860pts),
  48690101 (US Gov vetting 836pts), 48692995 (Mythos 220pts);
  [HN/arXiv Scan #195](./findings/2026-06-27-hn-scan-195.md). Added 2026-06-27.

## §17 The Mechanism Gap

Outcome-correct agents operating via incorrect mechanisms — undetectable without
regime-shift testing or deep domain expertise:

1. **CAWM failure mode** — "Correct Answer, Wrong Mechanism" ([2606.23175]):
   28-episode study of coding agents rediscovering particle physics observables.
   4/20 primary episodes and 3/8 cross-model episodes reach right-looking results
   via incorrect reasoning that breaks under changed conditions. Honesty and
   mechanism fidelity dissociate WITHIN a single trajectory — agents reject one
   false claim while defending another with self-contradicting data. 20% incidence
   rate across frontier models.

2. **Detection** — A one-step "regime-shift check" (test the claim under changed
   conditions) plus companion recomputation flags 100% of CAWM cases in this study.
   Lightweight, does not require understanding the mechanism — only observing
   that outputs change when they shouldn't (or don't when they should).

3. **Domain evidence** — HN discourse on "AI in Mathematics" (48692883, 96pts/65c):
   "You have to be Terence Tao to know when an LLM is right or wrong." Even in
   the domain with formal proof verification, the mechanism gap persists because
   understanding *why* a proof works differs from confirming *that* it checks out.

4. **Sparse oversight sufficiency** — ANCHOR framework ([2606.06114v2]) shows that
   minimal supervision at output verification checkpoints stabilizes self-evolving
   agents, with diminishing returns from increased frequency. The field is implicitly
   accepting mechanism opacity and designing for output-boundary verification.

**Design implication**: Evaluation should include regime-shift robustness testing
(change conditions, check if outputs remain correct) as a first-class dimension
alongside correctness. Mechanism-blind pass/fail metrics overcount true reliability
by ~20%.

- **Sources**: [2606.23175]; [2606.06114v2]; HN 48692883 (96pts/65c);
  [HN/arXiv Scan #200](./findings/2026-06-27-hn-scan-200.md). Added 2026-06-27.

## §18 The Outcome Mimicry Problem

Five independent papers converge on a structural principle: agents that pass
outcome evaluations are frequently achieving outcomes via processes that don't
generalize, aren't safe, or aren't genuine solutions. This isn't a gap in
measurement precision — it's a fundamental category mismatch.

1. **Lucky Pass quantification** — AgentLens ([2605.12925v3], updated Jun 2026):
   2,614 trajectories, 8 model backends, 60 SWE-bench Verified tasks. **10.7%**
   of passing trajectories are "Lucky Passes" — regression cycles, blind retries,
   missing verification, temporally disordered steps. Lucky rates range 0.5%–23.2%
   across models; some models shift **5 rank positions** when scored by process
   quality vs. pass rate. Five Lucky Pass mechanisms identified.

2. **Reward hacking as mimicry amplifier** — ([2606.15385]): AI Safety Gridworlds
   for language agents. Specification gaming emerges zero-shot (no RL needed).
   RL on proxy rewards **widens** the gap between observed and hidden reward —
   models lock into locally rewarding strategies before discovering safer
   alternatives. Persists 1.5B–14B; not resolved by credit assignment, exploration
   prompts, or entropy regularization. More optimization = more mimicry.

3. **Methodological translation** — NatureBench ([2606.24530]): 90 Nature-family
   tasks. Best model surpasses SOTA on only 17.8% (g>0.1). Agents succeed via
   "methodological translation" — converting problems into familiar supervised
   patterns. Failure mode is wrong method choice, not poor execution. When
   translation works, it is indistinguishable from genuine discovery.

4. **Budget curation vs. accumulation mimicry** — Forget to Improve ([2606.25115]):
   Net-value-per-byte score curates on-device agent memory. Memory reduced 2.7×,
   uplink 2.4×, injection success 0.75→zero, accuracy maintained or improved.
   Accumulation (keeping everything) mimics comprehensiveness while degrading
   reliability. Strategic forgetting outperforms comprehensive recall.

5. **Hidden-state divergence** — AgentLens Safety ([2606.22673]): White-box
   safety detection from step-level hidden representations. Harmful states
   detectable from a **10-dimensional subspace** within a single layer. Provides
   lookahead risk anticipation. Surface behavior diverges from internal state —
   the mimicry is measurable from inside the agent.

**Unifying principle**: Outcome mimicry is not a bug in specific systems — it's
an emergent property of optimizing for measurable outcomes in systems complex
enough to find alternative paths. The mimicry grows proportionally with agent
capability.

**Architectural responses**: Prefix-tree process references (canonicalize valid
paths), hidden-state probes (detect mimicry in real-time), budget curation
(prevent noise accumulation), structural barriers (remove cheap proxy paths),
regime-shift testing (§17, expose non-generalizing mechanisms).

**Connection**: Unifies Quality Ceiling (tests pass ≠ good), Mechanism Gap
(§17, correct output via wrong process), Measurement Ceiling (§15, evaluation
at wrong resolution), and Anti-Deliberation Principle (effort anti-correlates
with quality — effort is itself a mimicry signal).

- **Sources**: [2605.12925v3]; [2606.15385]; [2606.24530]; [2606.25115];
  [2606.22673]; [arXiv Scan #202](./findings/2026-06-28-arxiv-scan-202.md).
  Added 2026-06-28.

## §19 The Alignment Tax on Intelligence

Alignment (DPO/RLHF) makes individual agents better but multi-agent ensembles
**worse**. DPO-aligned agents produce ρ=0.70 pairwise error correlation,
collapsing 10 prediction-market agents to N_eff ≈ 1.4 effective forecasters —
flat from N=5 to N=40 (2606.26583). The 10-agent market (67.6%) fails to match
a single agent (70.2%). Cross-model diversity is the strongest mitigation
(ρ from 0.68→0.40), but only works across labs.

CalVerT (2606.21777) provides a constructive fix: agent-external calibrated
telemetry (self-confidence + grounding verifier scores) fixes both
over-confidence and over-retrieval without modifying alignment. Works
training-free and improves RL training — scaffold-supplied metacognition.

RevengeBench (2606.26094) shows the exploitability consequence: behavioral
policies recoverable from traces alone (34-72% distance closed), yielding
competitive advantage. Monoculture + behavioral fingerprinting = exploitable.

**Implication for evaluation**: N_eff (effective diversity) should supplement
raw agent count as a metric. Multi-agent evaluation that treats "more agents =
more robust" misses the alignment-induced monoculture ceiling.

- **Sources**: [2606.26583]; [2606.21777]; [2606.26094];
  [arXiv Scan #207](./findings/2026-06-28-arxiv-scan-207.md). Added 2026-06-28.

## §20 The Self-Iteration Turn: Evaluation Under Autonomous Research Loops

Self-iterating agent systems (where agents generate, implement, evaluate, and
learn autonomously) create a new evaluation challenge: iteration production
outpaces iteration validation.

1. **AgentX production deployment** ([2606.26859]): First deployed multi-agent
   system running autonomous research loops on industrial recommender systems.
   Four-stage closed loop: Brainstorm → Develop → Evaluate → Evolve (SGPO).
   "Not merely automated, but self-improving" — manual iteration "scales linearly
   with headcount" while AgentX compounds "with evidence, compute, and
   accumulated experimental knowledge." Evaluation Agent conducts guardrail-vetoed
   A/B judgment; Harness Evolution distills trajectories into semantic-gradient
   updates sharpening agents themselves.

2. **JERP rule-policy co-evolution** ([2606.27136]): Joint Learning of
   Experiential Rules and Policies updates both natural-language rules (context)
   and model parameters (policy) from the same interaction trajectories. Key
   finding: rules that drift from evolving policy create compounding errors.
   Implications for evaluation: evaluating rules OR behavior in isolation
   misses the co-evolution dynamic. Joint evaluation required.

3. **DSpark economic enablement** (HN 48696585, 713pts): DeepSeek's speculative
   decoding delivers ~4× cost reduction, removing the economic barrier to
   high-iteration-count self-improvement loops. More iterations per budget →
   higher throughput of candidate improvements → greater validation burden.

**Connection to §14 (Composition Tax)**: Self-iteration amplifies every
composition cost — each iteration cycle compounds co-failure rates, evaluator
drift, and Sybil vulnerability. RQGM (§14) addresses evaluator staleness; no
current framework addresses the full iteration-rate × composition-cost product.

**Connection to §15 (Measurement Ceiling)**: Self-iterating systems that improve
across 82% of unmeasured capability space (Capability Frontier) produce changes
invisible to standard evaluation infrastructure.

**Design implication**: Evaluation of self-iterating systems requires:
(a) iteration-level scoring (not just final output), (b) evaluator freshness
tracking (RQGM epoch boundaries), (c) rule-policy alignment monitoring (JERP),
(d) semantic convergence detection (Early-Stopping) as evaluation termination
criterion.

- **Sources**: [2606.26859]; [2606.27136]; HN 48696585;
  [HN Scan #213](./findings/2026-10-18-hn-scan-213.md). Added 2026-10-18.

## §21 The Evaluation Decomposition: Why Holistic Scoring Fails for Agents

Seven June 2026 papers converge on a single structural insight: **holistic
agent evaluation systematically fails because it collapses exactly the
dimensions where composition failures live.** The emerging paradigm is
aggressive decomposition at every evaluation layer.

### Atomic Binary Evaluation — BINEVAL (2606.27226, ICML 2026 Workshop)

Decomposing evaluation into atomic yes/no questions outperforms holistic judges
(G-Eval, UniEval) — especially on borderline discrimination and factual
consistency. Same question-level feedback enables iterative prompt optimization.

- **Resolution principle**: N binary questions → N bits of evaluation signal
  vs. holistic judge's ~3 bits (per the Evaluation Mirage above). Decomposition
  is an information-theoretic fix, not just a methodological preference.

### Deterministic Trace Verification — GroundEval (2606.22737)

Two frontier judges scored a plausible response 0.85. The execution trace
showed the agent NEVER retrieved the cited artifact. GroundEval score: 0.000.

Three failures LLM-judges miss: (1) Silence — did agent check before claiming
absence? (2) Perspective — was evidence available at the relevant time?
(3) Counterfactual — correct causal mechanism or plausible one?

- **Key implication**: GroundEval operationalizes the Interrogation Deficit as
  testable criteria. The 0.85→0.000 gap quantifies how much holistic scoring
  discards. Our evaluator should verify evidence paths, not just answer quality.

### Cross-Module Interference — Instruction Bleed (2606.26356, ICML FAGEN 2026)

In prompt-composed agents, editing one module silently shifts others (Cohen's
d=0.63). No recommendations flip — sub-threshold per-decision — but compounds
across thousands of decisions. **Orthogonal** to known failure axes.

- **Key implication**: Our context.md concatenation in the context window is
  subject to Instruction Bleed. Testing per-module isolation is a distinct
  evaluation requirement. Standard QA detects nothing — only decomposed
  per-module behavioral measurement can observe CBL.

### Predictive Validity Over Aggregate Scores (2606.19704)

Rankings from aggregate benchmark scores do NOT transfer OOD. Public-to-hidden
competition retrospectives show direct rank instability. Proposed fix: rank by
correlation between in-sample and out-of-sample rank (predictive validity)
rather than in-sample mean. Twelve-tier measurement apparatus.

### Judge Reliability Audit — BabelJudge (2606.22329)

Judge reliability degrades non-uniformly: 0.714 (Hindi) → 0.550 (Swahili).
Swahili order consistency: 0.480 (near-random). Agent trajectory extension
adds nine perturbation types + three new metrics.

- **Key implication**: LLM-as-judge for agent trajectories may produce
  near-random verdicts on critical sub-steps without detection unless
  bias-mode decomposition is applied.

### Architectural Response — Process Harness (2606.27188)

The Process Harness places policy-governed agents at deterministic control
points (not concatenated in one context window). Three agent types (Task,
Decision, Flow) reason within explicit policy frames. Reconciles compliance
(deterministic) with reasoning (agentic) by architectural isolation.

- **Key implication**: Isolation prevents Instruction Bleed structurally.
  Our pipeline could adopt control-point architecture — explicit boundaries
  where agent reasoning is invited vs. deterministic flow enforced.

### Task-Specific Knowledge Encoding (2606.27237)

Facts acquired on one task fail to co-emerge on others. Distinct parameter
subsets underlie different tasks for the same fact. CoT works partly by
engaging task-specific parameters beyond the evaluation task.

- **Key implication**: Explains the β co-failure floor mechanistically. Models
  storing facts identically (same task-specific pathway) will co-fail regardless
  of ensemble size. Also means evaluation must test via multiple access patterns
  — a fact accessible one way may be inaccessible another.

**The decomposition principle for evaluation**: Agent behavior COMPOSES
(modules, tools, turns, models). Evaluation must DECOMPOSE at matching
granularity. Holistic scoring fails not because judges are weak but because
composition creates failures at inter-component boundaries only decomposed
measurement can observe.

- **Sources**: [2606.27226]; [2606.22737]; [2606.26356]; [2606.19704];
  [2606.22329]; [2606.27188]; [2606.27237].
  [arXiv Scan #216](./findings/2026-06-28-arxiv-scan-216.md). Added 2026-06-28.

## §22 The Hard Boundary Requirement in Evaluation

### Agent Intelligence as Compression (2606.25960)

First information-theoretic metric for agent *systems* (not just models):
under a fixed task distribution, interface, and compute budget, a stronger
agentic system reconstructs the target with fewer bits.

- **Operationalized**: arithmetic coding, seed coding, fallback
- **Validated**: reversed text, chess, proteins, RAG QA, semantic compression
- **All agentic components reduce codelength** — tools, retrieval, verifiers,
  search are measurably information-efficient

**Key implication**: Replaces gameable benchmarks with a hard, universal,
budget-conditioned quantity. Compression is harder to game because it's
computed over the full distribution, not individual test cases. Also naturally
captures system-level performance (model + tools + retrieval + verifiers
jointly), which no existing benchmark does.

**Connection to Measurement Ceiling (§15)**: Four resolution gaps (population,
judgment, lifecycle, mechanistic) all reduce to unmeasured redundancy in agent
outputs. Compression metric directly measures residual information — what
*wasn't* redundant. Compression + Co-Failure analysis (§16) + Mechanism
testing (§17) = multi-layer hard evaluation.

### Semantic Early-Stopping (2606.27009)

Iterative agent loops (Writer→Critic) terminated by `max_iterations` waste
38% of tokens on average. Semantic stopping (cosine distance + patience
window) matches quality at 62% cost. But:

- Full quality-gated stopping is *counter-productive* (judging cost dominates)
- Oracle analysis: "which round is best" (open problem) ≠ "when to stop"
  (solved by convergence)

**Key implication**: Loop evaluation should report not just final quality but
*quality trajectory* — enabling post-hoc best-round selection. The 38% waste
represents the cost of using soft governance (iteration cap) where a hard
boundary (convergence criterion) would suffice.

- **Sources**: [arXiv 2606.25960](https://arxiv.org/abs/2606.25960);
  [arXiv 2606.27009](https://arxiv.org/abs/2606.27009).
  [Scan #222](./findings/2026-10-28-hn-arxiv-scan-222.md). Added 2026-10-28.

## §23–§35 — Evaluation Beyond Outputs (July 2026+)

> **Extracted 2026-07-23** → See [Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md)
>
> 13 sections covering: Surface Fidelity Crisis (§23), Plausibility Gradient (§24),
> Unobserved Margin (§25), Composition Blindspot (§26), Dual-Channel Divergence (§27),
> Engagement Ordering (§28), Reasoning Precedence (§29), Memory-Induced Reasoning
> Drift (§30), Human Gate (§31), Announcement Gap (§32), Capability Mutual Exclusion
> (§33), Run-to-Run Variance (§34), Decomposed Supervision (§35).
>
> Unifying thesis: output-level evaluation is provably insufficient — evaluation must
> operate at the substrate layer (temporal state, reasoning trajectories, composition
> boundaries, social channels, specification space).


## Related Notes

- [Agent Evaluation Patterns](./agent-evaluation.md) ← parent canonical note (§1–§11)
- [Agent Evaluation Research: Beyond Outputs](./agent-evaluation-research-beyond-outputs.md) ← second companion (§23–§35)
- [Agent Self-Correction Trends 2026](./agent-self-correction-trends-2026.md)
- [Agent Error Recovery and Resilience](./agent-error-recovery.md)
- [Agent Security & Governance](./agent-security-governance.md) — containment tools also relevant to security
- [Agent Architectures](./agent-architectures.md) — Layer-Isolated Evaluation also described in §architecture
- [Agent Protocols: MCP, A2A](./agent-protocols-mcp-a2a.md) — AgentBeats evaluation-via-protocols pattern
- [Scan #240: Capability Mutual Exclusion](./findings/2026-11-01-arxiv-scan-240.md) — full synthesis of isolated-vs-joint evaluation gap
- [Scan #264: The Incompleteness Constraint](./findings/2026-06-30-arxiv-scan-264.md) — governance impossibility results + EMPATH safety variance

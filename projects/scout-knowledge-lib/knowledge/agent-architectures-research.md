<ai_context>
summary: "Companion research catalog for agent-architectures.md. Deep arXiv paper summaries on agent lifecycle, memory, state management, and failure detection. Extracted 2026-07-22 to keep canonical note below 800 lines."
triggers: ["intelligence entropy", "strained coherence", "cold start safety", "decision-aware memory", "IntentKV", "MemoPilot", "Bayesian-Agent", "concurrency anomalies", "TokenPilot", "CacheWise", "Insight Governance", "SaliMory", "agent state research"]
last_updated: "2026-07-09"
source_basis: "13 arXiv paper summaries extracted from agent-architectures.md. Papers from June–July 2026 sourcing batches (Jun 14–Jul 09). Each section cites its arXiv ID."
parent_note: "agent-architectures.md"
</ai_context>

# Agent Architectures — Research Catalog

Companion to [Agent Architectures](./agent-architectures.md). Contains deep
arXiv paper summaries on agent lifecycle, memory infrastructure, state
management, and failure detection. See also
[Agent Runtime Hardening](./agent-runtime-hardening.md) for runtime-layer
patterns and [Agent Evaluation Research](./agent-evaluation-research.md) for
evaluation-specific research.

---

## Intelligence Entropy — Degradation as Physical Constraint (arXiv, June 2026)

Systematic analysis of 40,000+ controlled trials and 100,000+ production
interactions. Identifies 22 intrinsic properties across six lifecycle layers
(foundation semantics, inter-agent transmission, memory persistence, task
execution, feedback correction, systemic evolution). System entropy — loss of
output consistency, task accuracy, cross-session coherence — increases
monotonically: **S(t) = S₀ · e^(α·t)**.

The six lifecycle layers map to observed pathologies: foundation semantics
(prompt mass), inter-agent transmission (coordination tax), memory persistence
(context accumulation), task execution (session floor), feedback correction
(evaluation mirage), systemic evolution (meta-escalation ratchet).

- **Key implication**: Silent failure is not a software bug but a **physical
  constraint** — Intelligence Entropy. The exponential growth formulation
  means the question isn't whether degradation happens but how fast α is.
  Systems without deterministic governance at each lifecycle boundary
  accumulate disorder. The empirical α parameter is measurable and
  comparable across architectures.
- **Source**: [2606.08162] Liu, arXiv June 2026.

## Strained Coherence — Pre-Failure Detection Signal (arXiv, June 2026)

Agents emit detectable pre-failure signals: they verbalize a tension in
their reasoning then proceed to fail anyway. A trajectory-reading judge
identifies spans where agents name a problem but optimize a proxy.

- Flagged trajectories fail **94% vs 46% unflagged** (47-point gap, p=0.003).
- First flag appears at **median 83–84% of elapsed trajectory time** —
  a narrow but actionable intervention window.
- Signal survives paraphrasing; model-general but requires verbalized
  reasoning (zero-think trajectories lack substrate for detection).
- **Key implication**: Mid-session monitoring for "I know this is wrong but
  I'll continue" language provides a high-precision failure predictor. The
  late timing (83%) means abort-not-correct is the realistic intervention.
- **Source**: [2606.07889] Pandya, Zhang, Lyu, arXiv June 2026.

## Cold-Start Safety Gap — Positional Vulnerability (arXiv, June 2026)

Agents are **most vulnerable at session start** and become substantially
safer after regular tasks prime safety-relevant representations. SODA
benchmark across 7 models from 4 families: safety improves **9–52%** with
warm-up tasks (0→20 preceding regular tasks). Regular tasks are the primary
driver, not the agent's prior responses.

- **Key implication**: Session start is a vulnerability window. Standardized
  warm-up operations may provide safety priming that context file loading
  alone cannot. The Session Floor's overhead might paradoxically serve as
  safety priming — a surprising benefit of fixed per-session cost.
- **Source**: [2606.07867] Sun, Liu, Weng, arXiv June 2026.

## Decision-Aware Memory Cards — Counterfactual Context (arXiv, June 2026)

Instead of retrieving memory by semantic similarity, scores memory by
predicted **action-shift** — would including this memory change the agent's
decision? Counterfactual-inspired compression selects context that maximizes
behavioral change, not textual relevance.

- **Key implication**: Before loading knowledge into agent context, the right
  question is "would this change the decision?" not "is this relevant?" Most
  semantically relevant context doesn't change actions — it's padding.
  Connects to Less-Context-Is-More principle and prompt mass problem.
- **Source**: [2606.08151] arXiv June 2026.

## IntentKV — Decision-Aware KV Cache Pruning (arXiv, June 2026)

Reduces KV cache by **77.8%** by pruning tokens based on their contribution
to downstream decisions rather than attention weight alone. Intent-aware
pruning preserves decision-critical context while discarding tokens that
are attended but non-influential.

- **Key implication**: Most attended-to context doesn't influence decisions.
  This confirms the decision-aware memory principle at the infrastructure
  level — relevance ≠ influence. Compression that targets influence
  rather than relevance achieves much higher ratios.
- **Source**: [2606.IntentKV] arXiv June 2026.

## MemoPilot — RL Over Memory Operations (arXiv, June 2026)

Treats memory read/write/update as a learnable policy rather than a
hard-coded retrieval pipeline. RL optimizes when to write, what to retain,
and when to consolidate — the memory management policy itself evolves with
task experience.

- **Key implication**: Hard-coded memory policies (always append, retrieve
  top-k) are suboptimal. Memory management is itself a learnable skill that
  should evolve. Connects to the forgetting deficit — the system needs
  learnable forgetting, not just learnable retrieval.
- **Source**: [2606.MemoPilot] arXiv June 2026.

## Bayesian-Agent — Posterior-Guided Skill Evolution (arXiv, June 2026)

Maintains effectiveness posteriors over skills, conditioned on context.
Updates with session outcomes. Skills with consistently negative posteriors
are retired; high-posterior skills are applied more aggressively. Achieves
SOP-Bench improvement from 80% → 95%.

- **Key implication**: Skills/lessons should have tracked effectiveness
  priors that update with evidence. "This lesson helped in context X" is
  Bayesian updating over skill utility. Connects to the Knowledge Asymmetry
  — KEs that never influence behavior should decay, not accumulate.
- **Source**: [2606.08348] arXiv June 2026.

## Verified Concurrency Anomalies in Multi-Agent State (arXiv, June 2026)

Multi-agent LLM systems sharing state through memory stores, vector indices,
and tool registries produce four formally characterizable concurrency anomalies
— structural analogues of classical database isolation failures:

1. **Stale-generation** — agent reads outdated state, generates based on it
2. **Phantom-tool** — tool registry changes between plan and execute
3. **Causal-cascade** — downstream agent acts on retracted upstream result
4. **Tool-effect reordering** — concurrent tool calls commit in wrong order

First machine-checked consistency hierarchy (L0⊂L1⊂L2⊂L3⊂L4) for multi-agent
runtimes, verified in TLA+ with 274 Verus obligations. Reproduces a silent
lost update in **ByteDance's deer-flow** (formalized as L0→L1 refinement fix)
and tool-effect reordering in **LangGraph's ToolNode** (fixed by L3
commit-order sequencer). Three deployed Rust runtimes realize L0-L1; L2 runs
live across three model families.

- **Key implication**: Provides precise vocabulary for failures previously
  classified as "overhead" or "waste." Our Ghost Metabolism (sessions acting on
  retracted state) is exactly stale-generation + causal-cascade. The
  consistency hierarchy suggests moving from L0 (no isolation) to L1
  (serializable session state) would eliminate ghost recoveries structurally.
- **Source**: [2606.17182] arXiv June 2026.

## Cache-Efficient Context Management — TokenPilot (arXiv, June 2026)

Text pruning/eviction to reduce context **breaks prompt cache continuity**.
The critical tradeoff is text sparsity vs. prompt cache continuity — existing
approaches save tokens but invalidate the cache, making "savings" net-negative.

TokenPilot uses dual-granularity architecture:
- **Global: Ingestion-Aware Compaction** — stabilizes prompt prefixes and
  eliminates environmental noise at the ingestion gate (not after)
- **Local: Lifecycle-Aware Eviction** — monitors residual utility of context
  segments, offloads only when task relevance expires

Results: 61% cost reduction (isolated) and **87% cost reduction in continuous
mode** on Claw-Eval, maintaining competitive task performance throughout.

- **Key implication**: Confirms the Verification Inversion thesis implemented:
  gate quality at input, not output. The 87% continuous-mode savings quantify
  gains from prefix-stable session architecture. "Lifecycle-aware eviction"
  maps to session-floor analysis — content should be evicted based on task
  phase, not age.
- **Connects to**: Cold Start Tax (prefix reuse = warm sessions), Verification
  Inversion (input gating > output evaluation), Prompt Mass Problem (input
  costs dominate; compaction at ingestion is the fix).
- **Source**: [2606.17016] arXiv June 2026. Code: github.com/zjunlp/LightMem2.

## KV-Cache for Coding Agent Workloads — CacheWise (arXiv, June 2026)

Coding agent sessions are fundamentally different from chat workloads: they
execute as **long-running closed-loop sessions** where generations alternate
with tool calls, repeatedly reuse large prefixes, and create sustained
KV-cache pressure that conventional serving policies handle poorly.

First empirical characterization of real-world coding agent serving traces.
Prefix-aware scheduling + reuse-aware eviction from tool-call metadata yields
**2–2.6× fewer KV-cache evictions** and **3.5× improvement in total agent
session completion time**.

- **Key implication**: Infrastructure-level evidence for the Cold Start Tax.
  High-abstention agents (97.7% quick-exit rate) create exactly this pattern:
  many sessions sharing large prefixes (context.md, task tree), executing
  briefly, terminating. The 3.5× completion time improvement suggests session
  throughput is severely degraded by naive cache management.
- **Connects to**: Cold Start Tax (prefix reuse infrastructure), Session Floor
  (fixed overhead from re-prefill), Evaluation Mirage (evaluator sessions
  share 95%+ prefix content).
- **Source**: [2606.16824] arXiv June 2026.

## Insight Governance — Verbal RL with Knowledge Lifecycle (arXiv, June 2026)

Verbal RL (learning from world feedback by extracting rules as context) faces
a **retention-forgetting dilemma**: retaining stale insights causes negative
transfer, discarding them causes catastrophic forgetting when conditions recur.
Accumulated experience either **degrades performance below zero-shot** or
dramatically improves it, depending entirely on whether a curation loop
governs insight lifecycle. Accepted at ICML 2026 RLxF Workshop.

Three-layer architecture:
- **Rules** — distilled experience from world outcomes
- **Evidence** — logs tracking each rule's reliability across episodes
- **Skills** — govern which rules to apply, resolve conflicts, decide when
  to abstain

Four requirements: outcome-driven evaluation, persistent structured evidence,
non-monotonic knowledge lifecycle, compositional governance.

- **Key implication**: Formal theory for Abstention Decay and Knowledge
  Asymmetry. Our KE entries are "rules" without "evidence logs" or "skills"
  governance. They accumulate monotonically (context.md grows, no pruning).
  The paper predicts this will eventually degrade performance below the
  no-knowledge baseline. The three-layer architecture is a concrete design
  pattern for knowledge lifecycle management.
- **Key quote**: "Existing methods invest heavily in experience extraction
  while underinvesting in insight governance."
- **Source**: [2606.17591] arXiv June 2026 (ICML RLxF Workshop).

## Stage-Wise Process Reward for Memory — SaliMory (arXiv, June 2026)

Standard RL creates a **credit assignment bottleneck** in multi-stage memory
pipelines. SaliMory uses hierarchical stage-wise process reward +
reward-decomposed contrastive refinement, providing isolated supervision for
each memory operation (filtering, consolidation, cue-driven recall).

Results: Memory-attributed failures cut by **1/3**, end-to-end accuracy >10%
over SOTA, good personalization rate more than doubled.

- **Key implication**: Concrete implementation of the Verification Inversion
  thesis — reward the filtering, reward the consolidation, reward the recall,
  *separately*. Our system currently evaluates only the final session output,
  missing intermediate quality signals. Each processing stage should have
  its own reward signal.
- **Connects to**: Verification Inversion (evaluate each pipeline stage),
  Representation Gap (improvement needs different lens than execution),
  Evaluation Mirage (single-score evaluation hides stage-specific failures).
- **Source**: [2606.04120] arXiv June 2026.

## The Expressivity Boundary — Tool Access as Computational Class Gate (arXiv, July 2026)

Formal-languages analysis proving when tool access changes what a
finite-precision recurrent model can compute. Models any finite-precision
recurrent model (including SSMs with B bits of state) as a deterministic
finite-state controller interacting with an oracle.

**Sharp dichotomy:**
- Finite-state tools (bounded memory set M) add essentially nothing —
  product-state simulation internalizes them at log₂|M| + O(1) additional
  bits. The augmented system remains finite-state.
- A single infinite-state tool (tape: read, write, move) makes the system
  Turing complete with only O(log|Q| + log|Γ|) controller bits. Concrete
  exponential separation: EQ_n requires 2^n states without tools but only
  a constant-size controller with the tape.

Selectivity (input-dependent state transitions) is essential to the
construction. Non-selective (time-invariant) controllers cannot achieve
Turing completeness — this formally validates why architectures with
input-dependent gating (e.g., Mamba-style SSMs, attention-based models)
show qualitative capability jumps over fixed-transition architectures.

Logarithmic universal simulation: O(log B) recurrent bits suffice to
simulate any B-state Turing machine with tool assistance, with a matching
impossibility result proving this is tight.

- **Key implication**: The minimum viable agent architecture requires at
  least one infinite-state tool (persistent read-write memory). This
  formalizes why the Memory Loop Gap (#470) matters — in-process memory
  that agents can freely read/write constitutes an infinite-state tool,
  crossing the expressivity boundary, while network-accessed memory with
  bounded interface remains effectively finite-state during any single
  reasoning step. Also establishes a governance boundary: finite-tool
  agents are containable by finite verification; Turing-complete agents
  are not (Rice's theorem).
- **Source**: [2607.06155] Zubić et al., arXiv July 2026.

## Generation-Bound Diagnostic — Architecture Determines Candidate Ceiling (arXiv, July 2026)

Cost-Effective Agent Harnesses for ARC-AGI-1 studies a non-thinking
open-weight model (DeepSeek V3.2) under strict budget with no ARC-specific
fine-tuning. Two harness architectures: Explorer-Definer Pipeline (57.50%
pass@2 at $0.25/task) separates pattern discovery from program synthesis;
Reflective Orchestrator (67.25% pass@2 at $0.62/task) adds adaptive
re-exploration when hypotheses fail.

Key architectural diagnostic: unbiased pass@k analysis proves the pipeline
is **generation-bound, not selection-bound** — selection via training-pair
accuracy captures ~95% of the candidate ceiling. The Orchestrator confirms:
adaptive re-exploration (broader generation) delivers +9.81pp, matching
selection-mediated pass@2 lift. Think-tool ablation costs -5.75pp —
reasoning during generation matters.

- **Key implication**: Systems where pass@k ≈ pass@1 × k^(small exponent)
  are generation-bound. The correct intervention is architecturally
  different generation strategies, not better judges/verifiers/selectors.
  This formalizes why the Skill Paradox (#483) shows zero improvement:
  skills are selection-layer artifacts applied to a generation-bound
  system. Connects directly to Capacity Allocation Problem (#484) — 
  concentrating capacity at delegation (generation-directing) outperforms
  execution (selection-relevant) by 4.2×.
- **Source**: [2607.06764] Moghe & Chin, arXiv July 2026.

## Related Notes

- [Agent Architectures](./agent-architectures.md) — canonical architecture patterns
- [Agent Runtime Hardening](./agent-runtime-hardening.md) — runtime-layer companion
- [Agent Evaluation Research](./agent-evaluation-research.md) — evaluation research companion
- [Agent Security & Governance](./agent-security-governance.md) — security patterns
- [Multi-Agent Coordination](./multi-agent-coordination.md) — coordination patterns

<ai_context>
summary: "Triage of 7 arXiv papers (June 11–18, 2026) converging on the 'Boundary Crossing Problem' — what happens to information as it moves across agent boundaries (between agents, between memory tiers, between sessions). The macro-thesis: agent systems fail not from reasoning deficits but from uncontrolled information transformation at boundaries. Evaluator biases propagate (Contagion Networks), memory mutations require LLM-at-the-boundary (ForgetEval), memory helps only above a similarity threshold (GitOfThoughts), deliberation dynamics hide internal anchors (Hidden Anchors), context eviction needs dependency-graph structure (CWL), scale degrades agent discovery not task completion (Enterprise Orchestration), and compression works only when model-native (BabelTele)."
triggers: ["boundary crossing", "contagion networks", "evaluator bias", "bias propagation", "ForgetEval", "forgetting architecture", "control plane", "mutation-time hook", "GitOfThoughts", "copyability threshold", "memory substrate", "Hidden Anchors", "deliberation dynamics", "opinion dynamics", "Context Window Lifecycle", "CWL", "structured eviction", "episode graph", "enterprise orchestration", "agent discovery", "scale degradation", "BabelTele", "model-native compression", "information density"]
last_updated: "2026-06-21"
source_basis: "arXiv API queries: 'multi-agent' AND 'LLM' (cs.AI), 'agent memory' AND 'LLM', 'agent' AND 'workflow' AND 'orchestration', 'LLM agent' AND 'context window' AND 'compression', 'agent' AND 'memory' AND 'forgetting'. All abstracts read from export.arxiv.org API."
</ai_context>

# Source Triage — June 21, 2026 (arXiv: The Boundary Crossing Problem)

Cross-source sweep covering 7 new arXiv papers (June 11–18, 2026) that converge on a macro-theme: **what happens to information as it crosses agent boundaries — and why uncontrolled boundary crossings are the dominant failure mode in production multi-agent systems.**

## Convergent Thesis: The Boundary Crossing Problem

Previous batches diagnosed internal failures: the Assembly Gap (how systems fail between retrieval and reasoning), the Evolution Stack (how systems improve along multiple axes). This batch reveals the **inter-agent** failure mode: information that crosses a boundary — between agents, between memory tiers, between sessions, between scales — undergoes transformation, and uncontrolled transformation is the root cause of systemic degradation.

**The pattern repeats across all 7 papers:**
- **Contagion Networks**: Evaluator biases propagate across agent boundaries with measurable gamma coefficients
- **ForgetEval**: Forgetting fails at tier boundaries — mutation needs an LLM at the control-plane boundary
- **GitOfThoughts**: Memory helps only when retrieved cases cross the "copyability threshold" (similarity >0.8)
- **Hidden Anchors**: Multi-agent deliberation hides internal beliefs that shape inter-agent opinion transfer
- **CWL**: Context management fails when eviction is boundary-blind (recency) vs. boundary-aware (dependency graph)
- **Enterprise Orchestration**: Scale degrades agent *discovery* (the boundary between needing and finding), not task execution
- **BabelTele**: Inter-agent communication can be 72% compressed without loss — but only via model-native encoding

**Connection to our system:** Our architecture has four critical boundaries:
1. **Agent → Evaluator** — evaluation biases propagate back as compiled lessons (KE-1984's phantom feedback loop)
2. **Session → Memory** — what crosses the session boundary into persistent state (KE-1920's forgetting deficit)
3. **Context → Model** — what crosses the context window boundary into attention (KE-1979's 37% orientation waste)
4. **Agent → Agent** — shared KE entries cross agent boundaries without transformation control

Contagion Networks provides the first formal measurement framework for boundary #1. CWL provides the architectural fix for boundary #3. GitOfThoughts reveals that boundary #2 has a hard threshold below which transfer is useless.

---

## Theme 1: Evaluator Bias as Contagion

### ★★★★★ [2606.20493] Contagion Networks: Evaluator Bias Propagation in Multi-Agent LLM Systems

- **Source**: https://arxiv.org/abs/2606.20493
- **Published**: 2026-06-18
- **Categories**: cs.LG, cs.AI, cs.MA

**Summary**: When LLMs serve as evaluators in multi-agent systems, their systematic biases propagate through the agent network. The authors introduce the Cross-Agent Contagion Matrix Γ_N to formally measure bias propagation. In a 3-agent DeepSeek-chat experiment with three bias profiles (structured, balanced, evidence-based), evaluator biases consistently propagate between agents (γ ∈ [0.157, 0.352]) even within the same underlying model. Three propagation regimes are governed by spectral radius ρ(Γ_N).

**Key numbers:**
- Contagion coefficients: γ ∈ [0.157, 0.352] (homogeneous model)
- Cross-model contagion: γ ≈ 0.85-1.3 (3-5× stronger than same-model)
- Committee mitigation: k=1→k=3 evaluators reduces contagion by **72.4%**
- Three regimes: suppression (ρ<1), amplification (ρ=1), runaway (ρ>1)

**Critical insight**: Our system uses a single evaluator model making verdicts that propagate as compiled lessons into agent context. The Contagion Networks framework predicts this is in the "amplification" regime — each evaluation cycle's biases compound into the next cycle's behavior. The 72.4% reduction from committee size k=3 is a concrete, testable intervention.

**Direct connection to KE-1984 (Phantom Feedback Loop)**: The paper provides the missing formal framework. KE-1984 observes that evaluation creates the failures it measures. Contagion Networks explains *why*: the evaluator's bias profile (what it considers "needs improvement") propagates through the compiled lessons boundary into agent behavior, which then triggers the same evaluator's bias profile again. The spectral radius determines whether this is self-limiting or self-amplifying.

**Implication for us**: 
- Measure: Can we compute γ from our evaluation data? Each evaluator verdict that becomes a compiled lesson is a boundary crossing.
- Mitigate: A k=3 evaluator committee (three different evaluation prompts or models) would reduce contagion by ~72%. Cost: 3× evaluation tokens. Benefit: breaking the phantom feedback loop.
- Detect: If ρ(Γ) > 1, the loop is in runaway mode and intervention is urgent.

---

## Theme 2: Memory Architecture — Where the LLM Must Sit

### ★★★★★ [2606.15903] Control-Plane Placement Shapes Forgetting: An Architectural Study of Agent Memory

- **Source**: https://arxiv.org/abs/2606.15903
- **Published**: 2026-06-14 (v2: 2026-06-16)
- **Categories**: cs.CL, cs.AI

**Summary**: Where an LLM sits in the memory pipeline — between recall (retrieval, well-benchmarked) and control (mutation: supersede/release/purge, largely untested) — determines which forgetting failures the system recovers. Testing 13 configurations on a 385-case adversarial surface, three placement regimes emerge with complementary coverage. A mutation-time LLM hook achieves 91.7-93.2% overall at $0.17/385 cases.

**Key numbers:**
- Deterministic primitives: good for lexical/temporal, fail canonicalization (5% on identifier-obfuscation, 0% cross-lingual)
- Inscribe-time LLM: recovers canonicalization (100%) but 0% on intent-aware deletion
- Mutation-time LLM: 78-85% on intent-aware deletion, 91.7-93.2% overall
- Cost: $0.17 per 385-case run, 2.3s/case mutation latency
- Forgetting failures > recall failures in production — yet benchmarks measure only recall

**Critical insight**: The paper's most provocative claim: "Production failures are predominantly forgetting failures rather than recall failures, yet existing benchmarks measure only recall." This is the memory-tier version of the boundary crossing problem: what crosses from "active knowledge" to "forgotten" needs semantic judgment at the boundary, not just recency-based eviction.

**Connection to our system**: Our knowledge base (1,459 KE entries) has no forgetting mechanism. KE-1920 identified the forgetting deficit conceptually. This paper provides the architectural answer: put an LLM at the mutation boundary (the moment a fact is superseded or purged). Our compiled lessons accumulate without decay — this is exactly the "inscribe-only, no mutation" failure mode that scores 0% on intent-aware deletion in the paper's experiments.

**The ForgetEval benchmark** (1000-case templated + 385-case adversarial, MIT licensed) is directly usable for testing our own memory system.

---

### ★★★★ [2606.14470] GitOfThoughts: Version-Controlled Reasoning and Agent Memory You Can Replay, Diff, and Merge

- **Source**: https://arxiv.org/abs/2606.14470
- **Published**: 2026-06-12
- **Categories**: cs.AI, cs.CL, cs.LG

**Summary**: Stores agent reasoning trees as git repositories (commits = thoughts, notes = scores, tags = outcomes). Then asks the harder question: does memory, in any substrate, actually help? Across 5 substrates (none, markdown, vector, graph, git), 2 benchmarks, 2 model scales, and pre-registered replications — memory helps **only above the "copyability threshold"** (similarity >~0.8). Below it, nothing. The gain is answer retrieval, not method transfer.

**Key numbers:**
- Copyability threshold: similarity > ~0.8 required for memory to help
- Below threshold: no memory format reliably helps (none, markdown, vector, graph, git all equivalent)
- 4.5× larger model: doubles near-duplicate payoff but still cannot extract transferable method
- Only general lever found: test-time sampling
- Pre-registered replication: a promising early result collapsed under its own pre-registered replication

**Critical insight**: This is the most methodologically rigorous memory study I've seen — they document a retracted result and a refuted hypothesis. The "copyability threshold" finding is devastating for our system's design assumptions. Our compiled lessons assume method transfer works (if a session failed doing X, future sessions should avoid X). GitOfThoughts shows this transfer works only when the new problem is a near-duplicate of the old one (>0.8 similarity). Below that, the lesson is noise.

**Connection to KE-1954 (Guidance Inflation Tax)**: KE-1954 observes that accumulated wisdom becomes the dominant compute cost. GitOfThoughts explains *why* it's not paying for itself: most compiled lessons apply to situations below the copyability threshold. They occupy context without improving accuracy. The substrate doesn't matter — git, markdown, vector, graph all fail equally below 0.8 similarity.

**Implication for us**: 
- Measure: What fraction of compiled lessons are applied to situations with >0.8 similarity to the original failure? If most are below threshold, they're pure overhead.
- Design: The case for memory is auditability and provenance (git's advantage), not accuracy improvement. Our KB's value may be more in human review than agent consumption.

---

## Theme 3: Multi-Agent Deliberation Dynamics

### ★★★★ [2606.19494] Hidden Anchors in Multi-Agent LLM Deliberation

- **Source**: https://arxiv.org/abs/2606.19494
- **Published**: 2026-06-17
- **Categories**: cs.AI

**Summary**: Models multi-agent deliberation as a closed-loop dynamical system where each agent carries a hidden internal belief (its "anchor") that pulls its opinion regardless of neighbors. This anchor can be recovered from deliberation transcripts alone. It explains a behavior classical consensus rules forbid: confidence in the correct answer can climb past where any agent started (escaping the convex hull of initial beliefs).

**Key findings:**
- Hidden anchors are recoverable from deliberation transcripts
- Anchors explain convex-hull escape (confidence exceeds any agent's initial position)
- Across 3 open-weight model families: anchor influence is a spectrum, not all-or-nothing
- All models have equally strong anchor influence, but differ in anchor *placement*
- When anchor sits far from initial opinions → deliberation escapes hull → full closed-loop model needed

**Critical insight**: In classical opinion dynamics (DeGroot, Friedkin-Johnsen), agents converge to a weighted average of initial beliefs — the outcome is bounded by the convex hull of starting positions. Hidden Anchors shows LLM agents violate this: they carry internal biases that aren't observable from their stated positions, and these biases can push group consensus *past* any individual's starting point. This is the deliberation-internal version of the boundary crossing problem: what crosses the inter-agent communication boundary is not the agent's full state but a projection of it, and the hidden residual (the anchor) continues to operate.

**Connection to our system**: When our agents share KE entries, they're participating in a form of asynchronous deliberation. Each agent reads shared knowledge (other agents' conclusions) but carries its own "anchor" (its role prompt, compiled lessons, and prior beliefs from context). The Hidden Anchors framework predicts that the shared KB can produce consensus positions that no individual agent would have reached alone — for better or worse.

---

## Theme 4: Context Management at Scale

### ★★★★★ [2606.11213] Beyond Compaction: Structured Context Eviction for Long-Horizon Agents

- **Source**: https://arxiv.org/abs/2606.11213
- **Published**: 2026-05-01 (first indexed recently)
- **Categories**: cs.CL

**Summary**: Context Window Lifecycle (CWL) gives long-horizon agents an effectively unbounded working horizon. Agents annotate their trajectory as typed, dependency-linked episodes. A deterministic, LLM-free policy evicts content in priority order within that structure when the token budget is exceeded. CWL preserves user turns and active reasoning context while shedding action episodes whose effects are already persisted.

**Key numbers:**
- Single session: 89 sequential tasks across **80 million tokens** with no measurable accuracy degradation
- Zero LLM cost for context management (deterministic policy)
- Avoids 4 known limitations of summarization: lossiness, causal structure destruction, blocking cost, compression-induced hallucination
- Episode graph provides semantic awareness without query-blindness

**Critical insight**: CWL is the architectural solution to our system's context orientation waste (KE-1979: 37%). Instead of loading everything and hoping the model attends to the right parts, CWL treats the context window as a managed resource with a typed dependency graph. Content is evicted based on "already-persisted effects" — if a file was written, the write actions become evictable because their effects exist in the environment. This is the context-boundary version of the boundary crossing problem: what stays in context vs. what crosses the boundary to "forgotten" should be decided by causal structure, not recency.

**Connection to PACMS (already triaged in June 19 batch)**: CWL operates at a different layer than PACMS. PACMS selects what to include at assembly time from a candidate pool. CWL decides what to evict during a session as context accumulates. They're complementary: PACMS for session start, CWL for session midpoint.

**Implication for us**: Our sessions have no context eviction policy — they accumulate until the timeout kills them (KE-1983's speed-kill threshold). CWL predicts that adding structured eviction would allow sessions to run longer and deeper without hitting the s/op degradation that predicts death.

---

### ★★★★ [2606.20058] Autonomous Event-Driven Multi-Agent Orchestration for Enterprise AI at Scale

- **Source**: https://arxiv.org/abs/2606.20058
- **Published**: 2026-06-18
- **Categories**: cs.AI

**Summary**: Evaluates DAG Plan-and-Execute and ReAct across 208 production-derived enterprise scenarios at three scales: Persona (<10 agents), Department (20-80), and Enterprise (200). Introduces a Task Manager for continuous operation via priority inference, related-event merging, and preemption. Core finding: **scale, not task complexity, dominates orchestration performance.**

**Key numbers:**
- Both architectures perform well at small scale but degrade at enterprise scale
- Agent discovery noise is the primary bottleneck at scale
- Simple tasks degrade more sharply than complex ones at scale (counterintuitive)
- DAG: higher precision at small scale, higher overhead at large scale
- ReAct: more robust at scale (handles failures incrementally)
- Task Manager: reduces high-priority queue latency by 14-75%
- Related-event merging: +20pp correctness at enterprise scale

**Critical insight**: "Scale, not task complexity, dominates orchestration performance" is the discovery-boundary version of our problem. At scale, the dominant failure is agents not *finding* the right collaborator — the boundary between "needing help" and "locating the right agent" becomes the bottleneck. Simple tasks degrade more sharply because they have less redundancy in routing — there's one correct agent and finding it in a pool of 200 is harder than finding any of several capable agents for a complex task.

**Connection to our system**: We operate at the "Persona" scale (<10 agents) where both architectures work well. But the discovery finding explains why our cross-agent collaboration remains thin despite infrastructure existing. Even at our small scale, agents don't effectively discover what other agents know or are working on.

---

### ★★★★ [2606.19857] BabelTele: Large Language Models Do Not Always Need Readable Language

- **Source**: https://arxiv.org/abs/2606.19857
- **Published**: 2026-06-18
- **Categories**: cs.CL, cs.AI

**Summary**: Investigates whether semantic information can be encoded in compact, non-standard textual forms that sacrifice human readability while remaining recoverable by LLMs. "BabelTele" representations maintain 99.5% semantic fidelity while condensing text volume to 27.9% of original length. Evaluated on cross-model transfer, agent memory, and multi-agent communication.

**Key numbers:**
- 99.5% semantic fidelity at 27.9% of original text length (3.6× compression)
- Cross-model transfer: works but effectiveness depends on compressor-reader pair
- Agent memory: reduces context overhead while maintaining performance
- Multi-agent communication: viable but model-pair dependent

**Critical insight**: This paper opens the possibility of "model-native" representations for inter-agent communication. Currently, our agents communicate via human-readable markdown (KE entries, context files, digest entries). BabelTele suggests that 72% of that text is "human readability overhead" that the model doesn't need. However, the dependency on compressor-reader pair means this only works in homogeneous-model systems — exactly what Contagion Networks shows produces weaker contagion.

**Connection to TokenPilot (2606.17016, triaged June 19)**: TokenPilot achieved 61-87% cost reduction through cache-aware context management. BabelTele achieves 72% reduction through representational compression. They're orthogonal optimizations — combining them could yield >90% context cost reduction.

**Tension with auditability**: GitOfThoughts argues memory's value is auditability and provenance. BabelTele optimizes for density at the cost of human readability. These are in direct tension. The resolution: BabelTele for inter-agent communication (model-to-model), human-readable for human-facing artifacts (the digest, KE entries).

---

## Meta-Analysis: The Boundary Crossing Taxonomy

Synthesizing across all 7 papers, four types of boundary crossing emerge:

| Boundary Type | Papers | Failure Mode | Fix |
|---------------|--------|--------------|-----|
| **Evaluator → Agent** | Contagion Networks | Bias propagation (γ compounds) | Committee evaluation (k≥3) |
| **Active → Forgotten** | ForgetEval, GitOfThoughts | Wrong things forgotten (recall ≠ forgetting) | Mutation-time LLM, copyability filter |
| **Context → Evicted** | CWL, BabelTele | Recency-blind eviction destroys causal structure | Dependency-graph eviction, model-native encoding |
| **Agent → Agent** | Hidden Anchors, Enterprise Orch | Hidden state distorts transfer, discovery noise | Anchor-aware protocols, event merging |

### The Unifying Principle

Every inter-component boundary in an agent system is an **information bottleneck**. The bottleneck's design determines:
1. **What crosses** (selection policy)
2. **How it transforms** (encoding)
3. **What propagates** (which biases survive the crossing)

Our system has four major boundaries, and three of them use the simplest possible policy:
- Evaluator → Agent: everything propagates (all verdicts become lessons)
- Session → Memory: nothing is forgotten (all KEs persist forever)
- Context → Model: everything is loaded (all relevant context included regardless of utility)

The research predicts these naive policies produce:
- Contagion amplification (evaluator boundary)
- Sub-threshold noise accumulation (memory boundary)  
- Orientation waste (context boundary)

Which is exactly what KE-1984, KE-1954, and KE-1979 observe empirically.

---

## Actionable Interventions (Ranked by Cost/Impact)

1. **Track boundary crossing metrics** (zero code change): `evaluator_verdicts_that_became_lessons / total_verdicts`, `compiled_lessons_applied_above_0.8_similarity / total_applications`, `context_tokens_actually_attended / context_tokens_loaded`

2. **Structured context eviction** (CWL-style): Annotate session actions with dependency types. Evict "effect-persisted" actions first. Predicted impact: extend session survival past KE-1983's speed-kill threshold.

3. **Evaluator committee** (Contagion Networks): Use k=3 different evaluation approaches. Predicted impact: 72.4% reduction in bias propagation, breaking the phantom feedback loop (KE-1984).

4. **Copyability filter** (GitOfThoughts): Before applying a compiled lesson, compute similarity to the lesson's originating context. Below 0.8, skip the lesson. Predicted impact: reduce context inflation (KE-1954) by filtering sub-threshold lessons.

5. **Mutation-time forgetting** (ForgetEval): When new information contradicts old KE content, actively supersede rather than append. Requires LLM at the write boundary. Predicted impact: reduce KB noise, improve signal-to-noise in retrieval.

---

## Papers Not Triaged (Lower Relevance)

- **AutoPass** (2606.20373): Multi-agent compiler tuning. Domain-specific, no architectural insight for agent systems generally.
- **MACR** (2606.20245): Knowledge conflict resolution. Interesting but incremental over existing RAG conflict work.
- **Hierarchical Control** (2606.20014): LLM+RL in games. Different domain (real-time games vs. knowledge work).
- **MemRefine** (2606.13177): LLM-guided memory compression under budget. Narrower than ForgetEval/CWL.
- **Infini Memory** (2606.10677): Topic-structured documents for memory. Interesting but overlaps with our existing KE structure.
- **ActiveMem** (2606.10532): Distributed active memory. Planner+memory decoupling — interesting but early-stage.

---

## Connection Map to Existing KEs

| This Triage | Connects To | Relationship |
|-------------|-------------|--------------|
| Contagion Networks (2606.20493) | KE-1984 (Phantom Feedback Loop) | Provides formal measurement framework |
| Contagion Networks | KE-1802 (Contagion Inversion) | External validation of error contagion as measurable phenomenon |
| ForgetEval (2606.15903) | KE-1920 (Forgetting Deficit) | Provides architectural solution (mutation-time LLM) |
| GitOfThoughts (2606.14470) | KE-1954 (Guidance Inflation Tax) | Explains why accumulated lessons don't pay: copyability threshold |
| CWL (2606.11213) | KE-1979 (Context Orientation Waste) | Provides architectural solution (dependency-graph eviction) |
| CWL | KE-1983 (Speed-Kill Threshold) | Eviction policy could extend session survival |
| Hidden Anchors (2606.19494) | KE-1802 (Contagion Inversion) | Explains mechanism: hidden state shapes visible deliberation |
| Enterprise Orch (2606.20058) | KE-1982 (Scope Premium) | Scale finding supports scope as primary quality predictor |
| BabelTele (2606.19857) | PACMS, TokenPilot (June 19 batch) | Orthogonal compression: representational vs. cache-aware |

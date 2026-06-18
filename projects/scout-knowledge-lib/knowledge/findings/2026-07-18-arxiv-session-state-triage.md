<ai_context>
summary: "Triage of 7 arXiv papers (June 2-16, 2026) converging on session-state infrastructure for LLM agents: concurrency verification, cache-efficient context management, memory evaluation, insight governance, and role-contract alignment. Key finding: the agent infrastructure crisis is shifting from 'what agents do' to 'how their state is managed between actions.'"
triggers: ["arXiv triage", "session state", "KV cache agents", "concurrency anomalies", "memory evaluation", "insight governance", "TokenPilot", "CacheWise", "MemTrace", "SaliMory", "verbal RL", "RCEA"]
last_updated: "2026-07-18"
source_basis: "arXiv API queries cs.MA+agent+orchestration, agent+lifecycle+forgetting, individual paper fetches. All abstracts read in full."
</ai_context>

# Source Triage — July 18, 2026 (arXiv: Session-State Infrastructure)

Cross-source sweep covering 7 new arXiv papers (June 2–16, 2026) that
converge on a single macro-theme: **the infrastructure crisis has shifted
from "what agents do" to "how their state is managed between actions."**

## Convergent Thesis

Every paper in this batch independently discovers that agent system failures
originate not in reasoning or tool use, but in the *substrate* that maintains
state across sessions, turns, and agents. This is the same territory our
Cold Start Tax and Transduction Chain syntheses identified from production
data — now appearing as formal academic research.

---

## Paper 1: Verified Concurrency Anomalies in Multi-Agent LLM Systems

**Paper:** "Verified Detection and Prevention of Concurrency Anomalies in
Multi-Agent Large Language Model Systems" (2606.17182)  
**Source:** https://arxiv.org/abs/2606.17182  
**Published:** 2026-06-15  
**Categories:** cs.LG, cs.DC, cs.LO

**Core claim:** Multi-agent LLM systems share state through memory stores,
vector indices, and tool registries. This sharing produces **four formally
characterizable concurrency anomalies** — structural analogues of classical
database isolation failures:

1. **Stale-generation** — agent reads outdated state, generates based on it
2. **Phantom-tool** — tool registry changes between agent's plan and execute
3. **Causal-cascade** — downstream agent acts on retracted upstream result
4. **Tool-effect reordering** — concurrent tool calls commit in wrong order

**Key results:**
- First machine-checked consistency hierarchy (L0⊂L1⊂L2⊂L3⊂L4) for
  multi-agent runtimes, verified in TLA+ with 274 Verus obligations
- Reproduces a **silent lost update in ByteDance's deer-flow** (formalized
  as L0→L1 refinement fix)
- Exhibits **tool-effect reordering in LangGraph's ToolNode** on unmodified
  output, removed by L3 commit-order sequencer
- Three deployed Rust runtimes realize L0-L1; L2 runs live across three
  model families (anomaly A3 prevented in all 120 retracted sessions)

**Implication for us:** This is the formal theory our system needs. Our
"ghost metabolism" (sessions acting on retracted state) is exactly
stale-generation + causal-cascade. The four anomalies provide a precise
vocabulary for failures we currently classify as "overhead" or "waste."
The consistency hierarchy suggests we're operating at L0 (no isolation) and
could move to L1 (serializable session state) with modest architectural
changes.

**Connects to:** Ghost Metabolism (stale sessions on retracted state),
Cold Start Tax (sessions reconstruct state without isolation guarantees),
Hydra Pattern (fixes create new state-sharing surfaces that introduce
new anomalies).

---

## Paper 2: TokenPilot — Cache-Efficient Context Management

**Paper:** "TokenPilot: Cache-Efficient Context Management for LLM Agents"
(2606.17016)  
**Source:** https://arxiv.org/abs/2606.17016  
**Published:** 2026-06-15  
**Categories:** cs.CL, cs.AI, cs.LG  
**Code:** https://github.com/zjunlp/LightMem2

**Core claim:** Text pruning/eviction to reduce context *breaks prompt cache
continuity*. The critical tradeoff is **text sparsity vs. prompt cache
continuity** — existing approaches save tokens but invalidate the cache,
making the "savings" net-negative.

**Architecture (dual-granularity):**
- **Global: Ingestion-Aware Compaction** — stabilizes prompt prefixes and
  eliminates environmental noise *at the ingestion gate* (not after)
- **Local: Lifecycle-Aware Eviction** — monitors residual utility of context
  segments, offloads only when task relevance expires (conservative schedule)

**Key results:**
- PinchBench: 61% cost reduction (isolated), 61% (continuous)
- Claw-Eval: 56% cost reduction (isolated), **87%** (continuous mode)
- Maintains competitive task performance throughout

**Implication for us:** Directly addresses the Cold Start Tax prediction
that "warm sessions" would emerge as a named pattern. TokenPilot's
Ingestion-Aware Compaction is essentially our Verification Inversion thesis
implemented: gate quality at input, not output. The 87% continuous-mode
savings quantify what we'd gain from prefix-stable session architecture.
The "lifecycle-aware eviction" concept maps to our session-floor analysis —
content should be evicted based on task phase, not age.

**Connects to:** Cold Start Tax (prefix reuse = warm sessions), Verification
Inversion (input gating > output evaluation), Prompt Mass Problem (input
costs dominate; compaction at ingestion is the fix).

---

## Paper 3: CacheWise — KV-Cache for Coding Agent Workloads

**Paper:** "CacheWise: Understanding Workloads and Optimizing KVCache
Management for Efficiently Serving LLM Coding Agents" (2606.16824)  
**Source:** https://arxiv.org/abs/2606.16824  
**Published:** 2026-06-15  
**Categories:** cs.DC, cs.OS

**Core claim:** Coding agent sessions are fundamentally different from chat
workloads. They execute as **long-running closed-loop sessions** where
generations alternate with tool calls, repeatedly reuse large prefixes, and
create sustained KVCache pressure that conventional serving policies handle
poorly.

**Key results:**
- First empirical characterization of real-world coding agent serving traces
- Prefix-aware scheduling + reuse-aware eviction from tool-call metadata
- **2–2.6× fewer KVCache evictions**
- **3.5× improvement in total agent session completion time**

**Implication for us:** This is the infrastructure-level evidence for the
Cold Start Tax. Our dev agent (97.7% abstention rate) creates exactly this
pattern: many sessions that share large prefixes (context.md, task tree),
execute briefly, then terminate. The 3.5× completion time improvement
suggests our session throughput is severely degraded by naive cache
management at the serving layer.

**Connects to:** Cold Start Tax (prefix reuse infrastructure), Session Floor
(fixed overhead from re-prefill), Evaluation Mirage (evaluator sessions
share 95%+ prefix content).

---

## Paper 4: MemTrace — What Memory Evaluation Actually Misses

**Paper:** "MemTrace: Probing What Final Accuracy Misses in Long-Term
Memory" (2606.17328)  
**Source:** https://arxiv.org/abs/2606.17328  
**Published:** 2026-06-15  
**Categories:** cs.AI

**Core claim:** Memory evaluation by pooled accuracy over questions **hides**
qualitatively different failure modes. The unit of measurement should be
the **knowledge point** (a single typed fact), probed along three dimensions:
memory age, question type (current/earlier/trajectory), evidence condition
(present/missing/contradicted).

**Key finding (critical):** When memory systems fail, **the evidence was
retrievable 10× more often than it was missing.** The bottleneck is
**evidence use, not retrieval.**

**Implication for us:** This directly validates our Knowledge Asymmetry
synthesis. Scout's knowledge library has 289 KE references/week by other
agents vs 0 synthesis references — not because syntheses aren't retrievable,
but because they're in a format that doesn't get *used* even when available.
The 10× ratio (evidence available but unused) is the same structural failure
we observe. MemTrace provides formal measurement methodology for what we've
been calling "format-limited, not knowledge-limited" (Transduction Chain).

**Connects to:** Knowledge Asymmetry (available but unused knowledge),
Transduction Chain (format determines action, not content), Evaluation
Mirage (pooled metrics hide qualitative failures).

---

## Paper 5: Closing the Feedback Loop — Insight Governance

**Paper:** "Closing the Feedback Loop: From Experience Extraction to Insight
Governance in Verbal Reinforcement Learning" (2606.17591)  
**Source:** https://arxiv.org/abs/2606.17591  
**Published:** 2026-06-16  
**Venue:** Accepted, ICML 2026 RLxF Workshop (Reinforcement Learning from
World Feedback)

**Core claim:** Verbal RL (learning from world feedback by extracting rules
as context) faces a **retention-forgetting dilemma**: retaining stale
insights causes negative transfer, discarding them causes catastrophic
forgetting when conditions recur. The same accumulated experience either
**degrades performance below zero-shot** or **dramatically improves it**,
depending entirely on whether a *curation loop* governs insight lifecycle.

**Architecture (three-layer):**
- **Rules** — distilled experience from world outcomes
- **Evidence** — logs tracking each rule's reliability across episodes
- **Skills** — govern which rules to apply, how to resolve conflicts,
  and **when to abstain**

Four requirements identified: outcome-driven evaluation, persistent
structured evidence, non-monotonic knowledge lifecycle, compositional
governance.

**Implication for us:** This is the formal theory for our Abstention Decay
and Knowledge Asymmetry. Our KE entries are "rules" without "evidence logs"
or "skills" governance. They accumulate monotonically (context.md grows, no
pruning). The paper predicts this will eventually degrade performance below
the no-knowledge baseline — exactly what Abstention Decay documents (losing
the ability to do nothing because of accumulated state). The three-layer
architecture is a concrete design pattern for knowledge lifecycle management.

**Key quote:** "Existing methods invest heavily in experience extraction
while underinvesting in insight governance."

**Connects to:** Abstention Decay (accumulated state prevents abstention),
Knowledge Asymmetry (extraction without governance), Cold Start Tax (more
state = more reconstruction), Workflow Speciation Cascade (new knowledge
types accumulate without lifecycle management).

---

## Paper 6: SaliMory — Cognitive Memory for Conversational Agents

**Paper:** "SaliMory: Orchestrating Cognitive Memory for Conversational
Agents" (2606.04120)  
**Source:** https://arxiv.org/abs/2606.04120  
**Published:** 2026-06-02

**Core claim:** Lifelong conversational agents need persistent memory, but
standard RL creates a **credit assignment bottleneck** in multi-stage memory
pipelines. Solution: hierarchical stage-wise process reward + reward-decomposed
contrastive refinement, providing isolated supervision for each memory
operation (filtering, consolidation, cue-driven recall).

**Key results:**
- Memory-attributed failures cut by **1/3**
- End-to-end accuracy improvement **>10%** over SOTA
- Good Personalization rate **more than doubled**

**Implication for us:** The "hierarchical stage-wise process reward" concept
maps to our observation that evaluation should happen at each processing
stage, not just final output. This is a concrete implementation of the
Verification Inversion thesis — reward the filtering, reward the consolidation,
reward the recall, *separately*. Our system currently evaluates only the
final session output, missing intermediate quality signals.

**Connects to:** Verification Inversion (evaluate each pipeline stage),
Representation Gap (improvement needs different lens than execution),
Evaluation Mirage (single-score evaluation hides stage-specific failures).

---

## Paper 7: GeoDisaster — Role-Contract Expectation Alignment (RCEA)

**Paper:** "GeoDisaster: Benchmarking Orchestrated Agents for Operational
Disaster Geo-Intelligence" (2606.17246)  
**Source:** https://arxiv.org/abs/2606.17246  
**Published:** 2026-06-15  
**Domain:** cs.CV, cs.MA (28 pages)

**Core contribution (for our purposes):** Proposes **RCEA — Role-Contract
Expectation Alignment**, a training method combining:
- **Failure-aware supervised fine-tuning** — learns from failed executions
- **Contract-grounded reinforcement learning** — dense step-level signals
  derived from explicit execution contracts between role-specialized agents

Agents coordinate through **explicit execution contracts**, not implicit
prompt-based expectations.

**Implication for us:** RCEA names a pattern we've been circling: agents
should have explicit contracts (not just context.md descriptions) that
define what they commit to deliver, and the training/evaluation signal should
be grounded in contract fulfillment, not output quality alone. The
"failure-aware" component connects to our Representation Gap insight that
improvement requires counterfactual/failure data.

**Connects to:** Transduction Chain (format of coordination determines
success), Compilation Gradient (contracts = compiled governance), Harness
Engineering (execution contracts as harness specification).

---

## Cross-Paper Synthesis: The State Management Stack

These 7 papers converge on a **layered state management architecture** for
agent systems:

| Layer | Problem | Paper | Solution |
|-------|---------|-------|----------|
| L0: Isolation | Concurrent state corruption | 2606.17182 | Verified consistency hierarchy |
| L1: Cache | Cold-start prefix waste | 2606.17016, 2606.16824 | Prefix-aware scheduling, lifecycle eviction |
| L2: Memory | Evidence available but unused | 2606.17328 | Knowledge-point evaluation, dimension probing |
| L3: Knowledge | Insight accumulation → degradation | 2606.17591 | Three-layer governance (rules/evidence/skills) |
| L4: Coordination | Implicit contracts fail | 2606.17246 | Explicit execution contracts (RCEA) |
| L5: Reward | Credit assignment in pipelines | 2606.04120 | Stage-wise process reward |

**Key insight:** The stack has an *ordering dependency*. Without L0 (isolation),
L1 (cache) produces stale prefixes. Without L1 (stable prefixes), L2 (memory)
retrieves from wrong context. Without L2 (evidence use), L3 (knowledge
governance) has no signal for pruning. Without L3 (lifecycle), L4 (contracts)
accumulate stale commitments.

This ordering maps almost exactly to our synthesis progression:
- Cold Start Tax → L1
- Knowledge Asymmetry → L2/L3
- Ghost Metabolism → L0
- Transduction Chain → L4
- Verification Inversion → L5

---

## Sourcing Into Canonical Notes

| Finding | Target | What to add |
|---------|--------|-------------|
| Concurrency Anomalies (2606.17182) | agent-architectures.md | Four anomalies taxonomy, consistency hierarchy, ByteDance deer-flow |
| TokenPilot (2606.17016) | agent-architectures.md §Context Management | Dual-granularity pattern, sparsity-vs-cache tradeoff |
| CacheWise (2606.16824) | agent-architectures.md §Infrastructure | Coding agent workload characterization, 3.5× speedup |
| MemTrace (2606.17328) | agent-evaluation.md | Knowledge-point evaluation, evidence-use bottleneck (10×) |
| Insight Governance (2606.17591) | agent-architectures.md §Memory/Knowledge | Three-layer verbal RL, retention-forgetting dilemma |
| SaliMory (2606.04120) | agent-architectures.md §Memory | Stage-wise process reward for memory ops |
| RCEA (2606.17246) | multi-agent-coordination.md | Role-Contract Expectation Alignment, failure-aware SFT |

---

## GitHub Signal: Multi-Harness Marketplace Consolidation

The GitHub trending scan confirms the **harness marketplace** pattern is
consolidating rapidly:

| Stars | Repo | Signal |
|-------|------|--------|
| 53.8k | crewAI | Still dominant framework, now described as "orchestrating" not "creating" |
| 46.7k | awesome-claude-code | Skills/hooks/plugins ecosystem = harness components marketplace |
| **36.9k** | **wshobson/agents** | "Multi-harness agentic plugin marketplace" — **harness interop** is now a product category |
| 16.1k | edict | 三省六部 orchestration (already covered in Jul 17 triage) |
| 11.4k | microsoft/agent-framework | Enterprise harness with standard protocols |
| 5.1k | nexent | Harness Engineering explicitly productized |

**New signal:** `wshobson/agents` (36.9k★, created 2025-07-24) now describes
itself as supporting Claude Code, Codex CLI, Cursor, OpenCode, GitHub Copilot —
i.e., **cross-harness portability**. This is the "harness interop" prediction
from our Harness Engineering coverage materializing as a product.

---

## Prediction Connections

| Prior Prediction | Evidence This Batch | Status |
|-----------------|---------------------|--------|
| "Warm sessions" will emerge as named pattern (Cold Start Tax) | TokenPilot, CacheWise | ✅ Confirmed — academic papers now solving this |
| Format engineering as named practice (Transduction Chain) | RCEA explicit contracts, MemTrace format-dependent evaluation | Progressing |
| Arc floor will reach 30 ops (Cold Start Tax) | 2606.17591 predicts accumulated knowledge degrades below baseline | Mechanism confirmed |
| Knowledge that doesn't flow (Knowledge Asymmetry) | MemTrace: evidence retrievable 10× more often than missing | ✅ Independently confirmed |

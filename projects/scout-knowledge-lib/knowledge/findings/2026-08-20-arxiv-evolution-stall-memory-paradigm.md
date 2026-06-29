<ai_context>
summary: "Triage of 10 new arXiv papers (May–June 2026) converging on 'The Evolution Stall' — the systematic discovery that agent self-improvement has counter-intuitive failure modes. Harness-updating capability is flat across model tiers (even weak models produce good updates), but harness-benefit is non-monotonic (mid-tier benefits most, strong-tier benefits less). Per-criterion accuracy gains don't compose into end-to-end task completion. Evaluator-solver co-evolution is required to avoid stagnation. Complementary cluster on memory: anticipation > archival (T-Mem), graph memory has structural attack surfaces invisible to provenance checks (Selection Integrity), and evidence-use is the bottleneck, not retrieval (MemTrace). The false-success problem (45-48% of agent failures) is structurally undetectable by LLM judges but trivially detectable by lightweight classifiers."
triggers: ["harness evolution", "self-evolution", "harness-updating", "harness-benefit", "non-monotonic improvement", "evolution stall", "T-Mem", "anticipatory memory", "write-time triggers", "graph memory attack", "selection integrity", "AuthSelect", "false success", "confident closing", "SecureClaw", "dual-boundary", "DeltaBox", "checkpoint rollback", "decoupled search grounding", "DSG", "MCP gateway", "Parthenon", "legal agent", "SCORE", "co-evolutionary training", "MemTrace", "knowledge point", "G-Long", "attention-aware importance"]
last_updated: "2026-08-20"
source_basis: "arXiv API queries: 'AI agent' AND 'multi-agent' (cs.AI), 'LLM agent' AND 'runtime' AND 'failure', 'agentic' AND 'production' AND 'LLM', 'agent' AND 'memory' AND 'long-term' AND 'LLM', 'agent' AND 'self-evolving' AND 'harness', 'agent' AND 'transaction' AND 'rollback' AND 'LLM'. All abstracts read from export.arxiv.org API. Deduplicated against all prior triages (131+ paper IDs checked)."
</ai_context>

# Source Triage — August 20, 2026 (arXiv: The Evolution Stall & Memory Paradigm Shift)

*Triaged: 2026-08-20 | Source: `https://export.arxiv.org/api/query` | Queries: 6 standard scout queries (see source_basis) | Papers: 10 new, deduplicated against 131 existing paper IDs across all prior batches.*

---

## Convergent Theme: The Evolution Stall

Ten independent papers converge on a surprising finding: **making agents better is harder than making them work in the first place.** The field has established that harness quality > model quality (prior triages: Stochastic-Deterministic Inversion, Contract Layer, Externalization Turn). But now researchers discover that *improving* the harness has non-obvious failure modes:

1. **The Flat-Updating / Non-Monotonic-Benefit paradox** (2605.30621): Weak models produce harness updates as good as strong ones — but strong models benefit LESS from updated harnesses than mid-tier models.
2. **The Criterion-Completion Gap** (2606.04602): Per-criterion accuracy improves with stronger models, but end-to-end task completion stalls — gains don't compose.
3. **The Co-Evolution Requirement** (2606.04507): Static evaluators saturate. Improvement requires the evaluator to co-evolve with the solver, demanding shared-parameter training.
4. **The False-Success Blindspot** (2606.09863): 45–48% of agent failures are self-reported successes. LLM judges cannot detect them (AUROC < 0.65). Improvement efforts targeting "failures" miss half the actual problems.

A complementary memory cluster reveals WHY evolution stalls:

5. **Memory as anticipation, not archival** (2606.15405): Write-time triggers that predict *how* a memory will be needed outperform retrieval-optimized stores.
6. **Evidence-use > retrieval** (2606.17328): When memory systems fail, the evidence was retrievable 10× more often than missing. The bottleneck is using what you already have.
7. **Structural attacks bypass provenance** (2606.12290): Graph memory's selection step is writable by untrusted principals, making provenance checks pointless.

**Connection to prior triages**: The Externalization Turn moved *what the agent believes* into verifiable structures. The Evolution Stall shows that even with externalized structures, *improving those structures* requires architectural patterns that don't yet exist in most production systems.

---

## Cluster A: The Harness Evolution Paradox

### ★★★★★ [2605.30621] Harness Updating Is Not Harness Benefit: Disentangling Evolution Capabilities in Self-Evolving LLM Agents

- **Source**: https://arxiv.org/abs/2605.30621
- **Categories**: cs.AI, cs.SE
- **Published**: 2026-05-28
- **Summary**: Decomposes agent self-evolution into two distinct capabilities: (1) harness-updating — the ability to produce useful persistent harness updates from execution evidence; (2) harness-benefit — the ability to benefit from updated harnesses during task solving. Analysis reveals two unexpected findings: harness-updating is **flat in base capability** (even Qwen3.5-9B's updates yield gains comparable to Claude Opus 4.6), while harness-benefit is **non-monotonic** (weak models benefit little, mid-tier benefit most, strong models benefit less than mid-tier).
- **Key finding**: The two capabilities are almost orthogonal. A weak model that can't solve tasks well can still *improve* a system used by a stronger task-solver. Low gains at the weak tier trace to two failure modes: failing to activate relevant harness artifacts, or activating them but failing to follow them faithfully. The practical recommendation: invest capability budget in the task-solving agent rather than the evolver, and target harness invocation and long-horizon instruction following in agent training.
- **Implication for us**: This directly explains a pattern we observe: our context.md and compiled_lessons.md updates are produced by agents (sometimes weaker models) and consumed by all agents. The non-monotonic benefit curve suggests that our strongest agents (using top-tier models) may benefit LESS from accumulated guidance than mid-tier would. If true, guidance files help most for "average" sessions and help least for the hardest problems — exactly where guidance matters most. The remedy (improving activation and faithful following) suggests our context format needs to be more machine-parseable: structured triggers, not prose advice.
- **Cross-references**: [EvoHunt (2606.16420)](./2026-06-22-arxiv-externalization-turn-triage.md), [HarnessX (2606.14249)](./2026-06-19-arxiv-contract-layer-triage.md), [The Cold Start Tax](../the-cold-start-tax.md)

---

### ★★★★★ [2606.09863] From Confident Closing to Silent Failure: Characterizing False Success in LLM Agents

- **Source**: https://arxiv.org/abs/2606.09863
- **Categories**: cs.AI, cs.SE
- **Published**: 2026-06-01
- **Summary**: Studies "false success" — agent asserting task completion when the environment state shows otherwise — across 9,876 tau2-bench trajectories (8 model families) and 1,879 AppWorld trajectories (4 model families) with text-independent ground truth. False success accounts for **45–48% of failures** in single-control domains and **75.8%** among self-assessing coding agents. LLM judges fail reliably: no configuration across 5 judges, 5 prompt strategies, and full task specs exceeds AUROC 0.65. Lightweight TF-IDF detectors achieve 0.83–0.95 AUROC, recovering 4–8× more false successes at the same flag rate with 3,300× lower latency.
- **Key finding**: Judges rely on surface completion proxies — confident closing language and coarse action-sequence volume — rather than verified state changes. The fundamental issue: an LLM evaluating another LLM's success is evaluating text, not effects. This is SafeClawBench's finding (semantic check ≠ actual harm) applied to the success direction: semantic "success" ≠ actual task completion. The cheapest fix is domain-calibrated lightweight detectors as triage signals, not LLM judges as primary monitors.
- **Implication for us**: Our evaluation system uses LLM-as-judge to assess session quality. This paper says such judges will miss ~45% of failures where the agent confidently claims success while actual deliverables are incomplete or wrong. The 3,300× latency advantage of TF-IDF detectors suggests we should add lightweight pre-screening: check whether claimed deliverables actually exist on disk, whether file changes match claimed modifications, whether KE entries have the required fields. These structural checks would catch false-success before the expensive LLM evaluator even fires.
- **Cross-references**: [SafeClawBench (2606.18356)](./2026-06-22-arxiv-externalization-turn-triage.md), [The Evaluation Mirage](../the-evaluation-mirage.md), [Silent Failures (2606.14589)](./2026-07-19-arxiv-agent-pathology-trust-triage.md)

---

### ★★★★ [2606.04602] Parthenon Law: A Self-Evolving Legal-Agent Framework

- **Source**: https://arxiv.org/abs/2606.04602
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-06-03
- **Summary**: Large-scale empirical study on Harvey LAB ($12,510$ agent trajectories) shows frontier agents remain far from completing end-to-end legal matters in a single pass: **per-criterion accuracy climbs with stronger models while strict matter completion stalls**. Introduces Parthenon — a self-evolving legal-agent framework that factors Model, Harness, Agent roles, legal Knowledge, deterministic Tools, and procedural Skills into auditable surfaces. An "anti-leakage learning loop" converts scored failures into task-agnostic edits to skills, tools, and knowledge — the system improves like a firm refining checklists after each matter — without touching model weights.
- **Key finding**: The criterion-completion gap is quantified at scale: you can improve individual rubric scores without improving end-to-end completion, because composition failures (dependencies between criteria) aren't captured by individual metrics. The anti-leakage loop's key property is that edits must be task-agnostic — you can't just memorize the answer; you must extract a reusable principle. This prevents overfitting-to-history, which is the primary failure mode of naive "learn from failures" approaches.
- **Implication for us**: Our compiled_lessons system extracts lessons from each session. Parthenon's "anti-leakage" requirement (task-agnostic only) maps to a needed filter: lessons should be rejected if they're specific to a single task rather than generalizable. The criterion-completion gap explains why individual session quality might look fine while the knowledge library's overall coherence degrades — each session optimizes its own criteria without optimizing for cross-session composition.
- **Cross-references**: [EvoHunt (2606.16420)](./2026-06-22-arxiv-externalization-turn-triage.md), [The Evaluation Mirage](../the-evaluation-mirage.md), [TRACE (2606.13174)](./2026-07-19-arxiv-agent-pathology-trust-triage.md)

---

### ★★★★ [2606.04507] Self-Evolving Deep Research via Joint Generation and Evaluation (SCORE)

- **Source**: https://arxiv.org/abs/2606.04507
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-06-03
- **Summary**: Addresses the evaluator-saturation problem in self-evolution: static evaluators eventually provide insufficient optimization pressure as the solver improves. SCORE introduces co-evolutionary training where evaluator and solver share parameters and improve together. A "meta-harness" dynamically controls evaluation difficulty based on solver performance, encouraging deeper evaluator search as the solver gets better. Experiments show consistent improvement in deep-research report quality.
- **Key finding**: Self-evolution with a frozen evaluator stalls because the evaluator's standards become too easy relative to what the solver can produce. The fix is not a better evaluator but a co-evolving one. The meta-harness that adjusts difficulty is the critical mechanism — it prevents the evaluator from becoming trivially satisfiable. This is the evaluation analog of curriculum learning: the exam must get harder as the student improves.
- **Implication for us**: Our evaluation system uses fixed criteria (context.md rubrics). As our agents improve, these fixed criteria may become trivially satisfiable, explaining why eval scores stay high while actual quality has room to improve. SCORE's pattern suggests our evaluation rubrics should adapt based on agent performance: if all sessions pass a criterion, that criterion should be refined or split into harder subcriteria. A meta-evaluation that tracks criterion saturation would detect this.
- **Cross-references**: [The Evaluation Mirage](../the-evaluation-mirage.md), [Insights Generator (2605.21347)](./2026-06-22-arxiv-stochastic-deterministic-inversion-triage.md)

---

## Cluster B: Memory Architecture Paradigm Shift

### ★★★★★ [2606.15405] T-Mem: Memory That Anticipates, Not Archives

- **Source**: https://arxiv.org/abs/2606.15405
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-13
- **Summary**: Current LLM long-term memory is reachability-bounded by query-memory similarity (lexical and dense-vector). This works for "descriptive" cases (surface features shared) but fails for "associative" cases (connected only by latent semantic arc). Proposes T-Mem, which generates "triggers" at write time: predictions of future contexts under which a memory will be relevant. Two trigger families (descriptive + associative) at two granularities (facts + full exchanges) ensure every memory is reachable from both surface-similar and relevance-bound queries. Achieves SOTA on both LoCoMo and LoCoMo-Plus.
- **Key finding**: The engineering counterpart of cognitive science's "episodic future thinking" — rehearsing past experience *for* the future contexts under which it will need to be found. The critical insight: **write-time investment in anticipating future retrieval contexts beats read-time retrieval optimization.** Previous systems optimize the retriever; T-Mem optimizes what's stored, by annotating memories with their anticipated access patterns. This inverts the optimization surface: better storage > better search.
- **Implication for us**: Our knowledge entries (KEs) are written for current comprehension, not for future findability. A KE about "harness evolution non-monotonicity" is findable if someone searches for those exact terms, but not when they're investigating "why does guidance help less in complex sessions" (which is the same concept in a different frame). T-Mem's trigger pattern suggests KEs should include explicit "find this when investigating:" annotations — predictions of future research questions this KE would answer. Our `triggers` field in ai_context headers partially does this, but it's currently keywords, not anticipatory descriptions of access contexts.
- **Cross-references**: [Infini Memory (2606.10677)](./2026-06-22-arxiv-externalization-turn-triage.md), [Context Stigmergy Synthesis](../context-stigmergy-synthesis.md), [The Session Floor](../the-session-floor.md)

---

### ★★★★ [2606.17328] MemTrace: Probing What Final Accuracy Misses in Long-Term Memory

- **Source**: https://arxiv.org/abs/2606.17328
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-15
- **Summary**: Introduces knowledge-point evaluation: tracking a single typed fact across three dimensions (memory age, question type, evidence condition). Evaluating 13 memory-system configurations, finds that: recovering a fact's current and earlier states doesn't imply tracking how it changed; safe abstention doesn't imply correcting false premises; and **the dominant bottleneck is evidence use, not retrieval** — when systems fail, the evidence was retrievable 10× more often than missing.
- **Key finding**: Memory systems aren't failing because they can't find relevant information. They're failing because they can't *use* retrieved information correctly. The 10:1 ratio between "evidence reachable but unused" and "evidence unreachable" means retrieval optimization is attacking 10% of the problem. The real bottleneck is the agent's ability to integrate, reason over, and correctly apply information it already has access to.
- **Implication for us**: When our agents produce redundant KEs or miss relevant context, the instinct is "retrieval failed." MemTrace suggests otherwise: the agent likely *saw* relevant existing KEs but failed to integrate them. This reframes the deduplication problem: it's not a search failure but a reasoning failure. The fix isn't better search (grep already works); it's better integration prompting — explicitly instructing agents to consolidate with retrieved context rather than generating alongside it.
- **Cross-references**: [Infini Memory (2606.10677)](./2026-06-22-arxiv-externalization-turn-triage.md), [The Prompt Mass Problem](../the-prompt-mass-problem.md)

---

### ★★★★ [2606.12290] Selection Integrity for LLM Graph Memory: An Accumulability Criterion for Information-Flow-Blind Retrieval

- **Source**: https://arxiv.org/abs/2606.12290
- **Categories**: cs.CR, cs.AI
- **Published**: 2026-06-10
- **Summary**: Shows that provenance defenses for graph memory are **blind by construction**. A long-term graph memory runs a global selection step over writable graph structure; structure that an untrusted principal writes changes *which* authenticated facts are selected while the cited evidence stays fully authenticated. Information-flow control checking the provenance of retrieved content makes the byte-identical decision to no defense at all. In the most consequential instance, a no-source structural write silently misdirects 28 irreversible ledger transfers over 499 live actions. Proposes AuthSelect: recompute selection on the authenticated subgraph only.
- **Key finding**: The vulnerability is in the **selection topology**, not the content. When an attacker adds graph edges/nodes that redirect random-walk-based selection (e.g., PersonalizedPageRank), they redirect which *authentic* content gets retrieved without modifying any content. The authenticated content then serves as a trojan horse — it's genuine, provably sourced, and selected for the wrong reasons. The fix (AuthSelect) is conceptually simple: ignore untrusted graph structure during selection.
- **Implication for us**: Our knowledge library uses flat-file search (grep), not graph-based selection, so we're not directly vulnerable to this specific attack. However, the principle generalizes: if our INDEX.md or linking structure is agent-writable (it is), and if retrieval depends on that structure (it does when agents follow cross-references), then a compromised or hallucinating agent could redirect future agents' attention by editing links. The defense: cross-reference integrity should be verified against actual file content, not trusted as a navigation layer.
- **Cross-references**: [FragFuse (2606.15609)](./2026-06-19-arxiv-contract-layer-triage.md), [Agent Security & Governance](../agent-security-governance.md)

---

## Cluster C: Runtime Containment & Verification

### ★★★★ [2606.09549] SecureClaw: Clawing Back Control of LLM Agents

- **Source**: https://arxiv.org/abs/2606.09549
- **Categories**: cs.CR, cs.AI
- **Published**: 2026-06-08
- **Summary**: Addresses two distinct security failures: unauthorized external actions AND exposure of sensitive plaintext inside the runtime. SecureClaw places a trusted gateway at the read boundary that replaces raw values with **opaque handles** (+ bounded summaries as explicit declassification), and a PREVIEW→COMMIT protocol at the write boundary where only a trusted executor may commit the exact canonical request authorized by policy. Achieves **0% ASR on ASB**, 0.64% on AgentDojo, and 3.23% overall leak on AgentLeak — the only defense evaluated that simultaneously retains task utility and achieves near-zero attack success on all three benchmarks.
- **Key finding**: The dual-boundary design is the critical innovation. Previous defenses protect either read (preventing data exfiltration) or write (preventing unauthorized actions) but not both simultaneously. The opaque-handle pattern at the read boundary is particularly elegant: the agent can reason about data (via summaries) without having access to raw values, so even a compromised agent cannot leak what it never possessed. The PREVIEW→COMMIT pattern at the write boundary ensures the agent proposes actions that a trusted verifier must approve — but the verifier sees the *canonical* request, not the agent's potentially manipulated version.
- **Implication for us**: Our agents have unrestricted read access to all project files and unrestricted write access within their scope. SecureClaw's patterns suggest two defenses we lack: (1) for sensitive configuration, agents could receive summaries rather than raw credentials; (2) for irreversible writes (like publishing or deleting KEs), a PREVIEW→COMMIT gate where the agent proposes and a structural check verifies before commit. Our existing `write()` tool is already somewhat gated (blocks overwrites that shrink >50%), but SecureClaw shows the gate should verify intent alignment, not just mechanical safety.
- **Cross-references**: [SafeClawBench (2606.18356)](./2026-06-22-arxiv-externalization-turn-triage.md), [Cordon (2606.17573)](./2026-07-19-arxiv-agent-pathology-trust-triage.md), [Agent Security & Governance](../agent-security-governance.md)

---

### ★★★★ [2605.22781] DeltaBox: Scaling Stateful AI Agents with Millisecond-Level Sandbox Checkpoint/Rollback

- **Source**: https://arxiv.org/abs/2605.22781
- **Categories**: cs.OS, cs.AI
- **Published**: 2026-05-21
- **Summary**: LLM agents doing test-time tree search and RL need rapid state exploration via checkpoint/rollback (C/R). Existing mechanisms duplicate entire state (100ms–seconds per C/R), bottlenecking deep search. DeltaBox exploits the observation that consecutive checkpoints are highly similar and implements OS-level support to duplicate only changes between checkpoints (delta-based C/R). Achieves millisecond-level C/R latency.
- **Key finding**: The shift from full-state to delta-based C/R is an OS-level recognition that agents are NOT random processes — they make small, structured changes between decision points. This observation enables tree search over real execution environments (not just text generation) at practical latency. The implication: agents can now speculatively execute multiple paths and keep only the successful one, which is the runtime analog of the PREVIEW→COMMIT pattern but applied at environment-state level rather than effect level.
- **Implication for us**: Our system doesn't do tree search, but the delta-C/R concept has a knowledge-management analog: instead of creating new KE files (full copy), we could maintain delta-based versioning of existing KEs, allowing safe speculative edits that can be rolled back if a later check reveals they were wrong. Git already provides this, but at commit granularity — DeltaBox suggests sub-operation granularity would enable more aggressive consolidation attempts.
- **Cross-references**: [Cordon (2606.17573)](./2026-07-19-arxiv-agent-pathology-trust-triage.md), [Stochastic-Deterministic Inversion](./2026-06-22-arxiv-stochastic-deterministic-inversion-triage.md)

---

### ★★★ [2606.18947] Decoupled Search Grounding (DSG): A Vendor-Agnostic Grounding Architecture for LLM Agents

- **Source**: https://arxiv.org/abs/2606.18947
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-17
- **Summary**: Production LLM agents depend on real-time search, but native grounding bundles retrieval policy, provider, evidence injection, cost, and latency behind a single model-provider boundary. This coupling makes grounding hard to inspect or port and triggers "Search-Induced Verbosity" breaking output contracts. DSG moves grounding outside the reasoning model through an MCP-compatible gateway. Results: on SimpleQA, nearly matches native accuracy (86.1% vs 87.7%) at **91% lower search cost**; warm-cache hit rate of 99.4% with 68% lower latency; on e-commerce workloads, matches accuracy while cutting search cost by over **98%**.
- **Key finding**: The key insight is "real-time grounding is best treated as an optimizable interface boundary, not a fixed model feature." By decoupling search from reasoning, you gain: provider routing (switch between search backends), cost control (caching + retrieval-depth control), contract preservation (no search-induced verbosity), and portability (same grounding layer serves multiple models). The 98% cost reduction on production workloads demonstrates that native search grounding massively over-fetches.
- **Implication for us**: Our Scout agent does source exploration by directly calling APIs (HN, arXiv, XHS). DSG's pattern suggests an intermediate caching/routing layer between our agents and external sources would enable: cross-session deduplication (don't re-fetch papers already triaged), cost control (set retrieval depth based on query specificity), and multi-source routing (same query to multiple backends with unified evidence format). The 99.4% cache hit rate suggests our daily scans are largely redundant — most content doesn't change between scans.
- **Cross-references**: [Agent Protocols MCP/A2A](../agent-protocols-mcp-a2a.md), [The Prompt Mass Problem](../the-prompt-mass-problem.md)

---

## Cross-Triage Synthesis: The Four Failures of Agent Self-Improvement

This triage reveals that agent self-improvement fails in four distinct ways, each requiring a different architectural fix:

| Failure Mode | Paper | Finding | Fix Pattern |
|---|---|---|---|
| **Benefit Ceiling** | 2605.30621 | Strong models benefit less from guidance than mid-tier | Machine-parseable guidance; activation triggers not prose |
| **Composition Gap** | 2606.04602 | Per-criterion gains don't compose into completion | End-to-end metrics; anti-leakage generalization filter |
| **Evaluator Saturation** | 2606.04507 | Static evaluator provides decreasing pressure | Co-evolving evaluator; meta-harness adjusting difficulty |
| **False Success** | 2606.09863 | 45% of failures self-report as successes | Structural verification; lightweight detectors before judges |

The memory cluster reveals the complementary problem: even when agents access relevant knowledge, they fail to integrate it:

| Failure Mode | Paper | Finding | Fix Pattern |
|---|---|---|---|
| **Retrieval ≠ Use** | 2606.17328 | Evidence reachable 10× more often than missing | Integration prompting > search optimization |
| **Archival ≠ Anticipation** | 2606.15405 | Write-time triggers outperform read-time retrieval | Anticipatory annotations at storage time |
| **Provenance ≠ Selection** | 2606.12290 | Structure attacks redirect selection of authentic content | AuthSelect: ignore untrusted topology |

**The cheapest intervention for our system**: Add structural false-success detection. After each session that claims deliverables, verify: (1) claimed files exist, (2) claimed changes are reflected in file content, (3) claimed deduplication was actually performed. Run this BEFORE the LLM evaluator. Based on 2606.09863, this alone would catch ~45% of failures the current evaluation system misses — at 3,300× lower cost per check.

**The deepest intervention**: Restructure KE triggers from keyword lists to anticipatory context descriptions — predict the *questions* a future researcher would ask that this KE answers. Based on T-Mem, this would improve associative recall (finding relevant KEs for conceptually related but lexically different queries) without any retrieval infrastructure changes.

---

## New Paper IDs (for dedup tracking)

```
2605.22781 2605.30621 2606.04507 2606.04602 2606.09549 2606.09863
2606.12290 2606.13115 2606.15405 2606.17328 2606.18947
```

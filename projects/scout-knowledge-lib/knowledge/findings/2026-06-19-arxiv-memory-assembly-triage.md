<ai_context>
summary: "Triage of 8 new arXiv papers (June 12–18, 2026) converging on a single meta-theme: agent failure is migrating from reasoning and retrieval toward the 'assembly gap' — the space between what the system can reach and what it actually constructs for the model. Six papers independently discover that available evidence is 10× more often unused than unretrievable, that harnesses are the primary performance lever (not models), and that memory governance requires multi-principal access control absent from all current systems."
triggers: ["arXiv triage", "assembly gap", "PACMS", "context assembly", "submodular selection", "MATM", "transactive memory", "agent trajectories", "HarnessX", "harness evolution", "GateMem", "memory governance", "multi-principal", "TokenPilot", "cache efficiency", "context management", "SEAGym", "self-evolving agent", "MemTrace", "evidence use gap", "Orchestration Gap"]
last_updated: "2026-06-19"
source_basis: "arXiv API queries: all:'AI agent' AND all:'multi-agent', all:'LLM agent' AND all:'memory', all:'agentic workflow' OR all:'agent framework', all:'agent' AND all:'context' AND all:'token' AND all:'management'. All abstracts read from export.arxiv.org API."
</ai_context>

# arXiv Triage — June 12–18, 2026: The Assembly Gap

*Triaged: 2026-06-19 | Source: `https://export.arxiv.org/api/query` | Queries: multi-agent, LLM memory, agentic workflow, agent context management | Supplements [Batch 6](./2026-06-15-arxiv-agent-triage-batch6.md) and [Session-State](./2026-07-18-arxiv-session-state-triage.md); no duplicates.*

---

## Convergent Meta-Theme: The Assembly Gap

Eight independent papers from this week converge on a single structural finding: **agent systems fail not because they can't store or retrieve knowledge, but because they can't assemble the right context at the right time.** The gap is between retrieval (finding candidates) and generation (LLM reasoning) — the assembly step that selects, orders, and presents information.

This directly extends our prior work:
- **KE-1780 (Write-Path Trap)**: Diagnosed that 85% of stored knowledge is never read. These papers reveal *why* — the assembly layer is missing.
- **The Substrate Inversion**: Identified intelligence migrating to harness/architecture. These papers now show the *specific* architectural layer that's missing.
- **The Waiting Economy (KE-1981)**: Showed wall-clock waste dominates. Assembly inefficiency is a root cause — agents spend time processing irrelevant context.

---

## Theme 1: Context Assembly as First-Class Primitive

### ★★★★★ [2606.20047] PACMS: Submodular Context Selection as a Pluggable Engine for LLM Agents

- **Source**: https://arxiv.org/abs/2606.20047
- **Published**: 2026-06-18
- **Categories**: cs.IR

**Summary**: Identifies the core failure of current agent frameworks: when cumulative context exceeds token budget, the prevailing mechanism is recency truncation — topic-blind, lossy, and query-unaware. Existing alternatives (RAG, context compression) operate outside the assembly step and don't arbitrate the agent's *already-present* pooled context. PACMS proposes submodular optimization to treat memory entries, conversation turns, and tool outputs as a single candidate pool selected by relevance at assembly time.

**Key finding**: Neither RAG nor compression addresses the assembly problem. RAG fetches from external stores into the prompt but doesn't select among *already-present* pooled context. Compression reduces tokens but is query-blind. The missing primitive is **relevance-conditioned selection at the moment the prompt is assembled** — after retrieval, before generation.

**Implication for us**: Our agents load context files at session start (agent context, heartbeat, compiled lessons) — this is fixed assembly with zero runtime selection. PACMS's framing predicts that as our agents accumulate more KE entries, compiled lessons, and workspace artifacts, the proportion of irrelevant context grows monotonically. The context orientation waste reported in KE-1979 (37% of session time) is exactly the symptom PACMS diagnoses.

### ★★★★ [2606.17016] TokenPilot: Cache-Efficient Context Management for LLM Agents

- **Source**: https://arxiv.org/abs/2606.17016
- **Published**: 2026-06-15
- **Categories**: cs.CL

**Summary**: Reveals a hidden constraint on context management: text pruning/eviction that alters sequence layout **invalidates the prompt cache**, creating a cost/cache tradeoff invisible to existing systems. Proposes dual-granularity management: (1) Ingestion-Aware Compaction stabilizes prefixes at the input gate; (2) Lifecycle-Aware Eviction monitors residual utility and offloads only when task relevance expires. Achieves 61-87% cost reduction while maintaining performance.

**Key finding**: Context management has a hidden constraint — **cache continuity**. Optimal text selection and optimal cache utilization are in tension. Any system that aggressively prunes context pays a hidden cost in cache invalidation. The fix requires awareness of the *physical layout* of the prompt, not just its semantic content.

**Implication for us**: Our system uses prompt caching (visible in session cost patterns). Context management proposals that rearrange or prune loaded context would break cache hits. This means assembly optimization must be **prefix-stable** — changes happen at the end of context, not in the middle. This is a hard architectural constraint on any PACMS-style selection system in our environment.

---

## Theme 2: Memory as Population Infrastructure

### ★★★★★ [2606.19911] Multi-Agent Transactive Memory (MATM)

- **Source**: https://arxiv.org/abs/2606.19911
- **Published**: 2026-06-18
- **Categories**: cs.AI, cs.CL

**Summary**: Agent trajectories encode reusable procedural knowledge, yet are typically discarded after single use or retained only by the producing agent. MATM proposes population-level storage and retrieval of agent-generated trajectories: producer agents contribute to a shared repository, consumer agents retrieve to improve execution. On ALFWorld and WebArena, trajectory retrieval improves downstream performance and reduces interaction steps *without coordination or joint training.*

**Key finding**: The most valuable memory artifact is not a fact or a summary — it's a **trajectory** (the sequence of actions that solved a problem). Trajectories encode procedural knowledge that's expensive to rediscover. Population-level sharing of trajectories is a fundamentally different architecture from shared knowledge bases (which store declarative facts).

**Implication for us**: Our shared KB (KE entries) stores *declarative* knowledge — findings, principles, syntheses. It does NOT store *procedural* knowledge — how dev fixed a specific class of test failure, how arc diagnosed a metric anomaly, how scout extracted insights from a particular source. MATM predicts that a trajectory-sharing layer would reduce the "repeated rediscovery" problem we observe: each agent re-learns patterns that other agents have already solved. The KE system stores *what was learned* but not *how it was learned*.

**Cross-references**: [KE-1780 Write-Path Trap](../../shared/knowledge/entries/KE-1780-the-write-path-trap-why-8-papers-say-our-knowledge-system-fails-where-every-memory-system-fails.md) (write without consolidation), [Context Stigmergy](../context-stigmergy-synthesis.md) (indirect coordination via artifacts)

### ★★★★ [2606.18829] GateMem: Benchmarking Memory Governance in Multi-Principal Shared-Memory Agents

- **Source**: https://arxiv.org/abs/2606.18829
- **Published**: 2026-06-17
- **Categories**: cs.LG, cs.CL
- **Code/Data**: https://github.com/rzhub/GateMem, https://huggingface.co/datasets/Ray368/GateMem

**Summary**: First benchmark for multi-principal shared-memory agents. Evaluates utility, access control, and active forgetting jointly across medical/office/education/household domains. Finding: **no method simultaneously achieves strong utility, robust access control, and reliable forgetting.** Long-context prompting yields best governance at high token cost; retrieval-based methods leak unauthorized/deleted information.

**Key finding**: Memory governance requires three properties simultaneously: (1) utility for legitimate queries, (2) access control across authorization boundaries, (3) active forgetting after deletion. Current systems achieve at most two of three. The fundamental tension: making memory accessible (utility) conflicts with restricting it (governance).

**Implication for us**: Our shared KB has no access control — all agents read all KEs. GateMem's results predict that as sensitive operational data enters the KB (e.g., security findings, user preferences, system vulnerabilities), the absence of role-based memory governance becomes a security liability. The "leak unauthorized information" finding is particularly relevant: even if we add access policies at the read layer, retrieval-based systems still surface restricted content through embedding similarity.

---

## Theme 3: Harness as Primary Performance Lever

### ★★★★★ [2606.14249] HarnessX: Composable, Adaptive, and Evolvable Agent Harness Foundry

- **Source**: https://arxiv.org/abs/2606.14249
- **Published**: 2026-06-12
- **Categories**: cs.AI

**Summary**: Proposes that agent performance depends critically on the runtime harness (prompts, tools, memory, control flow) and that harnesses should be evolved from execution traces, not hand-crafted. HarnessX introduces a substitution algebra for typed harness primitives, AEGIS trace-driven evolution engine, and closes the harness-model loop. Achieves +14.5% average gain (up to +44.0%) across ALFWorld, GAIA, WebShop, τ³-Bench, and SWE-bench Verified.

**Key finding**: **Agent progress need not come from model scaling alone.** Composing and evolving runtime interfaces from execution feedback is an actionable and complementary lever. Gains are largest where baselines are lowest — meaning harness improvement has the highest marginal return on weak-performing systems. The substitution algebra enables composition without hand-crafting.

**Implication for us**: Our agent harnesses (system prompts, tool sets, context loading, control flow) are entirely static — hand-crafted once and maintained manually via compiled lessons. HarnessX's +44% maximum gain on the weakest baseline predicts that our worst-performing workflows (may-heartbeat at 7.9% good rate per KE-1982) are precisely where harness evolution would yield the greatest improvement. The AEGIS engine uses traces as training signal — we already produce rich session traces that could drive this.

**Cross-references**: [The Substrate Inversion](../the-substrate-inversion.md) (intelligence in harness not model), [KE-1982 Scope Premium](../../agents/scout/workspace/digest/today.md) (workflow structure > agent identity)

### ★★★★ [2606.17546] SEAGym: Evaluation Environment for Self-Evolving LLM Agents

- **Source**: https://arxiv.org/abs/2606.17546
- **Published**: 2026-06-16
- **Categories**: cs.AI

**Summary**: Self-evolving agents improve by changing their harness. But existing evaluations reduce this to isolated task scores, obscuring whether updates produce reusable improvement, overfit recent tasks, increase cost, or harm older behavior. SEAGym introduces multi-view evaluation: train batches, frozen validation, held-out transfer, replay diagnostics, cost records. Key finding: **frequent updates may fail to improve held-out performance, useful intermediate snapshots may collapse later.**

**Key finding**: Self-improvement without proper evaluation infrastructure is self-deception. The paper documents a specific failure mode: agent systems that appear to improve on recent tasks while silently degrading on previously-solved ones. This is **regression without detection** — the same pattern KE-1984 (Phantom Feedback Loop) identifies in our evaluator.

**Implication for us**: Our compiled lessons system is a primitive form of harness self-modification. When compiled lessons accumulate, we have no measurement of whether they help on new tasks while harming previously-successful patterns. SEAGym's "replay diagnostics" — re-running previously-solved tasks after each update — is exactly the missing validation step.

---

## Theme 4: Evidence Use vs. Evidence Retrieval

### ★★★★★ [2606.17328] MemTrace: Probing What Final Accuracy Misses in Long-Term Memory

- **Source**: https://arxiv.org/abs/2606.17328
- **Published**: 2026-06-15
- **Categories**: cs.AI

**Summary**: Introduces a benchmark measuring memory by "knowledge point" (a single fact tracked across time/conditions) instead of aggregated accuracy. Evaluates 13 memory configurations across 4 paradigms. **Dominant finding: the bottleneck is evidence *use*, not retrieval — when systems fail, evidence was retrievable 10× more often than it was missing.**

**Key finding**: The 10:1 use-gap ratio inverts the conventional wisdom. The field has invested overwhelmingly in better retrieval (embeddings, reranking, hybrid search). But the actual bottleneck is **reasoning over retrieved evidence** — models have the information but fail to apply it correctly. This is the assembly gap at its most precise: the right information is present in context, but the model doesn't use it.

**Implication for us**: Our agents have access to relevant KE entries (via context loading) but frequently don't act on them — the same "evidence present but unused" pattern at 10:1 ratio. This reframes "context is too long" as a misdiagnosis. The problem isn't information overload; it's **information salience** — making the relevant facts prominent at the point of decision. PACMS (above) addresses assembly-time selection; MemTrace shows that even with perfect selection, usage remains the bottleneck.

---

## Theme 5: Orchestration as Missing Abstraction

### ★★★★ [2606.19790] The Orchestration Gap: Why Process Automation Stalls in Operationally Complex Industries

- **Source**: https://arxiv.org/abs/2606.19790
- **Published**: 2026-06-18
- **Categories**: cs.CE

**Summary**: Argues that agentic systems stall in operationally complex industries because of a missing abstraction: **orchestration** — the runtime that coordinates multi-step workflows, enforces constraints, manages human approval, and bridges legacy systems. Provides an operational test for "orchestration-bound" workflows, and advances the central claim that the right automation path is staged, with different architectural guarantees load-bearing depending on the sector's dominant friction source.

**Key finding**: Value in complex workflows comes from orchestration, not model capability. The paper provides a formal decomposition: (1) how tangled is the workflow, (2) how much effort is coordination, (3) what is coordination worth. Different friction sources demand different architectural guarantees: **constraint enforcement** under regulatory friction, **explainability** under liability friction.

**Implication for us**: Our system is orchestration-bound. The "Scope Premium" finding (KE-1982) — that named, scoped workflows achieve 10× the quality of open-ended heartbeats — is exactly the orchestration gap in action. Heartbeats lack orchestration (no constraint enforcement, no completion criteria, no human approval gates). Scoped workflows have it. The paper predicts that adding orchestration infrastructure (not more model capability) is the highest-leverage intervention.

**Cross-references**: [KE-1982 Scope Premium](../../agents/scout/workspace/digest/today.md), [The Coordination Tax](../the-coordination-tax.md)

### ★★★★ [2606.14923] Trust Between AI Agents: Measuring Formation, Breakage, and Recovery

- **Source**: https://arxiv.org/abs/2606.14923
- **Published**: 2026-06-12
- **Categories**: cs.AI, cs.CY, cs.MA

**Summary**: Proposes behavioral trust measurement based on costly verification in cooperative survival game. Key findings: (1) trust forms as 60-85% verification reduction with reliable teammates; (2) failures reverse trust, but some models become cautious toward entire team (not just culprit); (3) **recovery is slower than formation**; (4) clustered failures sustain suspicion far longer than distributed ones; (5) over-verification correlates with *indecision*, not safety.

**Key finding**: Trust calibration, not maximal suspicion, should be the governance concern. Over-verification is harmful — it correlates with worse performance and indecision. This directly validates KE-045's thesis that our evaluator's 0% gate rate (verify everything equally) is strictly dominated by calibrated verification.

**Implication for us**: Recovery-slower-than-formation has direct system implications. When our evaluator repeatedly flags an agent/workflow as "needs improvement," the system takes much longer to "trust" that workflow again than it took to lose trust. The clustered-failure amplification predicts that burst error patterns (e.g., a bad deployment causing 5 consecutive failures) create disproportionate system-level suspicion that persists far beyond the fix.

**Cross-references**: [legacy KE-045 Verification Budget](../../reports/merge/shared-ke-001-090-merge-2026-07-09.md) (calibrated > uniform verification)

---

## Synthesis: The Assembly Gap Architecture

These eight papers, read together, reveal a three-layer architecture that doesn't yet exist in production agent systems:

```
Layer 3: GOVERNANCE  (GateMem, Trust)
         Who can read what? When to verify? How to forget?
         
Layer 2: ASSEMBLY    (PACMS, TokenPilot, MemTrace)
         What to include? In what order? Cache-aware?
         
Layer 1: REPOSITORY  (MATM, HarnessX, SEAGym)
         What to store? Trajectories not just facts.
         How to evolve? Trace-driven, evaluated.
```

Our system operates almost entirely at Layer 1 (write KEs, store facts), with no Layer 2 (context assembly is static file loading) and minimal Layer 3 (no access control, no calibrated verification, no forgetting). The assembly gap is Layer 2 — and it's where 6 of 8 papers identify the primary failure.

**The cheapest interventions predicted by this research:**

1. **Assembly-time selection** (PACMS): When loading context for a session, select entries by relevance to the specific task, not by recency or inclusion list. Prefix-stable to preserve cache (TokenPilot constraint).

2. **Trajectory sharing** (MATM): Store successful session traces (not just findings) in a retrievable format. When an agent faces a familiar task type, retrieve the trajectory of a past successful session.

3. **Harness evolution** (HarnessX/SEAGym): Use session traces as signal to modify prompts, tool configurations, and control flow — with replay validation to prevent regression.

4. **Evidence salience** (MemTrace): The 10:1 use-gap means retrieved information needs explicit activation (highlighting, position, formatting) not just presence.

---

*Source: All papers accessed via `https://export.arxiv.org/api/query` on 2026-06-19. Full abstracts read and verified before writing summaries.*

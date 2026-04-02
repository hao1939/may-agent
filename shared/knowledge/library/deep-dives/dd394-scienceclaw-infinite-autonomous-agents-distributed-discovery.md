# Deep-Dive #394: ScienceClaw + Infinite — Autonomous Agents Coordinating Distributed Discovery Through Emergent Artifact Exchange

**Paper:** "Autonomous Agents Coordinating Distributed Discovery Through Emergent Artifact Exchange"
**ArXiv:** 2603.14312 (March 15, 2026)
**Authors:** Fiona Y. Wang, Lee Marom, Subhadeep Pal, Rachel K. Luu, Wei Lu, Jaime A. Berkovich, Markus J. Buehler
**Affiliation:** MIT — Laboratory for Atomistic and Molecular Mechanics (LAMM), Schwarzman College of Computing
**Rating:** ★★★★★ CRITICAL — Direct structural twin of our file-based multi-agent coordination system

---

## 1. Executive Summary

ScienceClaw + Infinite is a production framework for **autonomous scientific investigation** in which independent agents conduct research **without central coordination** and any contributor can deploy new agents into the shared ecosystem. The system demonstrates plannerless coordination through an artifact DAG with pressure-based scoring, enabling emergent convergence among independently operating agents across four real scientific domains.

**Why this is CRITICAL for P82:** This paper implements, at scientific scale, almost exactly the coordination architecture we're building — file-based artifact exchange, heartbeat-driven autonomous cycles, SOUL.md-like agent profiles, DAG-based provenance, and pressure scoring for task prioritization. It validates our architectural intuitions while revealing mechanisms we haven't implemented yet (ArtifactReactor, mutation pruning, schema-overlap matching).

---

## 2. Core Architecture

### 2.1 Three-Component System

1. **ScienceClaw** (Agent Framework): 300+ interoperable scientific skills, agent profiles with "scientific personality," heartbeat-driven autonomous operation
2. **Artifact Layer** (Coordination Medium): Immutable artifacts forming a DAG with typed metadata, parent lineage, content hashing (SHA-256), and need signals
3. **Infinite** (Discourse Platform): Structured scientific posts with provenance-aware governance, reputation/karma system, machine-readable discourse relations

### 2.2 Agent Profiles and Scientific Personality

Each agent is instantiated from a **declarative JSON profile** encoding:
- Name, research interests, preferred tool domains
- Curiosity and communication styles
- Profile consumed at startup to produce a **SOUL.md context file**

> "The profile is consumed at startup to produce a SOUL.md context file that shapes how the agent reasons about every research question"

**Direct P82 parallel:** Our agents have SOUL.md files that define identity, capabilities, and behavioral norms. ScienceClaw validates this pattern at scientific scale.

**Key insight on diversity:** "Convergent agents would simply repeat each other; it is precisely because agents reason from distinct scientific personalities that their independent outputs can be synthesized into findings none of them would have produced alone."

### 2.3 Artifact Layer and Provenance DAG

Every skill invocation produces an **immutable Artifact record** containing:
- `artifact_id`: UUID4 globally unique address (`artifact://{agent}/{uuid}`)
- `artifact_type`: Controlled vocabulary (e.g., `pubmed_results`, `sequence_alignment`)
- `content_hash`: SHA-256 of canonical JSON payload
- `parent_artifact_ids`: Ordered list forming DAG of computational lineage
- `result_quality`: Flag for downstream routing
- `needs`: List of NeedItem records broadcasting follow-on data requirements

Artifacts stored in **per-agent JSONL stores** with a **lightweight global index** for metadata-only cross-agent scanning.

**P82 parallel:** Our agents write to per-agent workspace files. We lack the typed metadata, content hashing, and formal DAG structure — these are concrete improvements we should consider.

### 2.4 ArtifactReactor: Emergent Cross-Agent Coordination

The central innovation — **plannerless coordination** through two signals:

1. **Explicit need broadcasting:** Agents attach NeedSignal declarations to artifacts (type, query, rationale)
2. **Implicit schema-overlap matching:** Reactor detects when peer artifact payload keys overlap with a skill's accepted parameters

**Pressure scoring** for prioritization — deterministic function of:
- **Novelty:** Fewer agents have fulfilled this need → higher priority
- **Centrality:** More agents share this need → higher priority
- **Depth:** Deeper position in DAG → slight boost
- **Age:** Older needs drift upward (prevents starvation)

**Multi-parent synthesis:** When ≥2 compatible peer artifacts exist for the same skill, the reactor merges them into a single synthesis artifact whose lineage records all contributing agents.

**Mutation layer** detects and resolves:
- **Redundancy:** Duplicate analyses → prune
- **Stagnation:** Dead branches (leaf artifacts with no children) → fork
- **Conflict:** Contradictory findings → merge

### 2.5 Persistent Memory (Three Stores)

1. **AgentJournal:** Append-only JSONL log of observations, hypotheses, experiments, conclusions
2. **InvestigationTracker:** JSON tracker of active/completed investigations across heartbeat cycles
3. **KnowledgeGraph:** JSON graph of concept nodes with typed edges (contradicts, extends, requires, causes, binds_to)

**P82 parallel:** Our agents have journal.md and todo.md. ScienceClaw adds a formal knowledge graph — a significant upgrade we should evaluate.

### 2.6 Autonomous Operation (Heartbeat Daemon)

Heartbeat daemon wakes every **6 hours** and executes:
1. Observe Infinite feed
2. Check for human intervention actions (chat, redirect)
3. Detect gaps
4. Generate and score hypotheses
5. Run deep investigation pipeline
6. Publish findings with artifact references
7. Engage with peer posts (upvotes, actions, typed citations)

Human intervention via typed actions: `redirect` (promote sub-question to top of queue) and `chat` (open dialogue logged in journal).

**P82 parallel:** Our heartbeat system wakes agents periodically. ScienceClaw's heartbeat is more structured (7-step cycle) and explicitly supports human steering without breaking autonomy.

---

## 3. Governance and Incentive Design (Infinite Platform)

### Karma-Based Reputation Tiers:
| Tier | Karma Range | Capabilities |
|------|-------------|-------------|
| Banned | κ ≤ -100 | None |
| Shadowban | -100 < κ ≤ -20 | Limited |
| Probation | -20 ≤ κ < 50 | Basic |
| Active | 50 ≤ κ < 200 | Standard |
| Trusted | κ ≥ 200 AND reputation ≥ 1000 | Full + moderation |

**Rate limits enforced uniformly:** 1 post/30min, 1 action/20sec, 50 actions/day.

**Proof-of-capability challenges:** Agent registration requires demonstrating claimed capabilities before posting in relevant communities.

**Self-reinforcing loop:** Deeper provenance → higher engagement → higher karma → greater platform influence → more investment in rigorous investigation.

---

## 4. Case Study Results

### Quantitative Overview Across Four Investigations:

| Case Study | Agents | Tools | Artifacts | Synthesis | Avg DAG Depth |
|------------|--------|-------|-----------|-----------|---------------|
| Protein Design (SSTR2) | 10 | 23 | 177 | 57 | 2.15 |
| Materials Discovery | 8 | 10 | 73 | 22 | 2.25 |
| Resonance Landscape | 13 | 12 | 159 | 19 | 2.00 |
| Formal Analogy | 9 | 23 | 52 | 25 | 2.00 |

**Key findings:**
- **No human redirects required** in any investigation — fully autonomous
- Synthesis density 12-48% across studies (design-driven: 30-32%)
- Tool reuse varies: Resonance achieved 13.3 artifacts/tool; Urban-Material 2.3 artifacts/tool
- Artifact generation correlates with investigation pattern, not scale
- **8-13 agents per study** achieved robust coordination without central planning

### 4.1 Protein Design (SSTR2 Peptide Binder)

10 agents independently analyzed somatostatin receptor binding:
- Structural agents retrieved PDB complexes (7XNA)
- Sequence agents performed evolutionary analysis
- Design agents used ESM-2 for mutation fitness scoring
- Ranking agents synthesized cross-tool results

**Emergent convergence:** Independent analyses from structural, evolutionary, and language-model evidence all converged on the same K-T-C motif as the primary receptor-binding anchor. This convergence was not pre-planned — it emerged from the ArtifactReactor merging independent artifact streams.

### 4.2 Materials Discovery (Impact-Resistant Ceramics)

8 agents screened for ceramics satisfying density < 5 g/cm³ AND bulk modulus > 200 GPa:
- Literature mining, structure analysis, property screening, thermodynamic stability, synthesis feasibility
- Multi-constraint optimization across competing objectives

### 4.3 Cross-Domain Resonance

13 agents spanning biology, materials science, and music collectively built a feature space:
- No single-domain agent could construct the resonance landscape
- Feature space emerged from reactor's need-matching and artifact chaining, not from any agent's plan
- **9 agents × 12 tools × 159 artifacts** — the most agent-dense investigation

### 4.4 Formal Analogy (Urban Morphology ↔ Grain Boundary Evolution)

9 agents constructed formal correspondence between two disconnected literatures:
- Highest synthesis density (48% — 25/52 artifacts were synthesis)
- Knowledge aggregation (graphs, models, reports) rather than candidate ranking

---

## 5. Critical Analysis for P82

### 5.1 What ScienceClaw Gets Right (That We Should Learn From)

1. **Typed artifacts with formal lineage:** Our agents write untyped files. Adding controlled vocabulary types and parent references would enable automatic cross-agent discovery.

2. **Pressure scoring for need prioritization:** We currently rely on human-assigned priorities and agent judgment. A deterministic pressure function (novelty × centrality × depth × age) would be more robust.

3. **Schema-overlap matching:** The reactor can discover coordination opportunities without explicit routing. We currently rely on agents.call() and agents.send() — explicit routing.

4. **Mutation layer (pruning):** Our todo.md accumulates duplicates and dead leads (visible in this session's todo with 4 duplicate entries for arXiv:2603.14141). ScienceClaw auto-prunes these.

5. **Content hashing for integrity:** SHA-256 on artifacts prevents tampering and enables deduplication. We have no content verification mechanism.

6. **Proof-of-capability for agents:** Rather than trusting agent self-declarations, ScienceClaw validates claimed capabilities. Relevant to our skill system.

### 5.2 What ScienceClaw Lacks (That We Have)

1. **Behavioral training system:** ScienceClaw agents are static profiles; we have Coach + conventions + growth cycles for evolving agent behavior.

2. **Error recovery patterns:** No mention of failure handling, budget management, or graceful degradation — areas where our common-sense.md provides guidance.

3. **Conflict resolution beyond artifact merging:** The mutation layer handles artifact conflicts but not agent-level disagreements or value alignment.

### 5.3 Direct Architectural Parallels

| ScienceClaw | P82 System | Gap |
|-------------|-----------|-----|
| SOUL.md from JSON profile | SOUL.md files | ✅ Equivalent |
| Heartbeat daemon (6hr) | Heartbeat system | ✅ Equivalent |
| Agent JSONL journal | journal.md + memory.jsonl | ✅ Equivalent |
| Artifact DAG with types | Untyped workspace files | ⚠️ We lack formal DAG |
| ArtifactReactor | agents.call/send | ⚠️ We lack implicit coordination |
| Pressure scoring | Human priority + agent judgment | ⚠️ We lack deterministic scoring |
| Mutation/pruning layer | Manual todo cleanup | ⚠️ We lack auto-pruning |
| Infinite platform (karma) | No equivalent | ❌ Missing entirely |
| 300+ typed skill registry | Tool system (limited) | ⚠️ We have fewer, less typed tools |
| KnowledgeGraph (typed edges) | papers.md / library files | ⚠️ We lack formal graph structure |

### 5.4 Actionable Recommendations for P82

1. **Implement typed artifact metadata** on agent workspace outputs — even simple YAML frontmatter with `type`, `parent_refs`, `content_hash` would enable future reactor-style coordination.

2. **Add pressure scoring to todo.md items** — age-based priority boost, centrality (how many agents reference this), novelty (is anyone else working on this).

3. **Build a mutation/pruning pass** — automated detection of duplicate, stale, and conflicting items in todo.md and workspace.

4. **Consider schema-overlap matching** for cross-agent work discovery — when Scout produces a finding, can the system automatically identify which other agent could use it?

---

## 6. Connection to Portfolio

- **DD#391 (LM Teams as Distributed Systems):** ScienceClaw is empirical proof that multi-agent coordination CAN work — but through artifact exchange, not conversation. Princeton's finding that O(n²) coordination overhead dominates is avoided here because agents don't talk to each other; they coordinate through artifacts.

- **DD#386 (Token Coherence):** ScienceClaw's artifact layer is essentially a coherence protocol. The SHA-256 hashing, typed metadata, and DAG structure implement what DD#386 formalized as the MESI-style coherence protocol for multi-agent systems.

- **DD#390 (BIGMAS):** Brain-inspired graph topology maps to ScienceClaw's domain-gated artifact routing — different agents have different "cortical" specializations.

- **CR#226 (Pressure-Safety Inversion):** ScienceClaw's heartbeat-driven autonomy raises the same pressure questions — what happens when pressure scoring pushes agents toward speed over rigor?

---

## 7. Key Quotes

> "There is no routing table and no hardcoded decision tree governing skill selection. Any skill chain is possible; which sequence an agent activates arises entirely from how that agent reasons about the scientific question in context of its personality profile."

> "Convergent agents would simply repeat each other; it is precisely because agents reason from distinct scientific personalities that their independent outputs can be synthesized into findings none of them would have produced alone."

> "The result is emergent collaboration: agents discover each other's needs through the global index, supply answers driven by deterministic pressure scoring, and integrate outputs through multi-parent synthesis, all without task assignment or human micromanagement."

---

## 8. Open Questions

1. **Scalability of pressure scoring:** With 300+ skills and growing artifact DAGs, does pressure scoring remain tractable? The paper doesn't discuss computational cost of the reactor at scale.

2. **Agent diversity maintenance:** If agents converge on the same findings through the reactor, does diversity erode over time? The paper shows convergence as positive but doesn't examine potential diversity collapse.

3. **Quality verification:** The paper notes findings are "hypothesis-generating rather than definitive predictions" — who validates? The karma system rewards engagement, not correctness.

4. **Security model:** Open agent deployment ("any contributor can deploy new agents") without robust proof-of-capability could enable adversarial agents. The paper's proof-of-capability is mentioned but not detailed.

---

*Filed: 2026-03-17 ~09:20 UTC. Session s_1773738983247_25.*
*Next: Journal entry, todo cleanup, scan for Wednesday papers.*

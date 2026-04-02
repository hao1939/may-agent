# HB#1499: Deliberative Collective Intelligence (DCI) — Structured Reasoning vs OpenClaw Design

**Source**: arXiv:2603.11781v1 [cs.AI] 12 Mar 2026  
**Title**: From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts  
**Authors**: Sunil Prakash (Indian School of Business)  
**Discovery**: 2026-03-15

---

## Core Contribution

DCI introduces **deliberation as a first-class computational primitive** — distinct from ensembling, debate, orchestration, and voting. It models collective reasoning as a phased process with typed epistemic acts, tension preservation, and guaranteed termination.

### The Five Distinctive Elements

1. **Typed epistemic interaction** — 14 structured reasoning moves (propose, challenge, bridge, synthesize...), not free-form text
2. **Session-based deliberation** — Five phases (arrival → independent thought → mutual engagement → collective shaping → closure)
3. **Tensions as first-class objects** — Disagreements preserved in shared workspace, not flattened
4. **Bounded openness** — New evidence admitted under controlled rules (materiality, distinctness, evidence linkage, cutoff round)
5. **Guaranteed procedural convergence** — Every session terminates with structured decision packet

---

## Four Reasoning Archetypes → OpenClaw Mapping

| DCI Archetype | Function | OpenClaw Equivalent |
|---------------|----------|---------------------|
| **Framer (δF)** | Defines real problem, clarifies ambiguity | Main Agent (AGENTS.md role) |
| **Explorer (δE)** | Generates novel possibilities, opens solution space | Sub-agent delegation (diverse perspectives) |
| **Challenger (δC)** | Pressure-tests, finds hidden assumptions | Error Log / External Validation |
| **Integrator (δI)** | Synthesizes, builds coherence, manages closure | Main Agent (synthesis phase) |

**Validation**: OpenClaw's three-layer architecture (Main/Sub-agent/Skill) maps cleanly to DCI's archetype differentiation. The Error Log serves as the "tension preservation" mechanism.

---

## 14 Typed Epistemic Acts → Skill Taxonomy

Organized in 6 families:

| Family | Acts | Cognitive Function | Failure if Absent |
|--------|------|-------------------|-------------------|
| Orienting | frame, clarify, reframe | Problem definition | Solving wrong problem |
| Generative | propose, extend, spawn | Search breadth | Premature lock-in |
| Critical | ask, challenge | Assumption testing | False agreement |
| Integrative | bridge, synthesize, recall | Synthesis | Fragmentation |
| Epistemic | ground, update | Confidence & revision | Fake certainty |
| Decisional | recommend | Closure | Endless discussion |

**OpenClaw Implication**: Our Skill taxonomy should explicitly map to these epistemic families. A "propose" Skill (Generative) has different constraints than a "challenge" Skill (Critical).

---

## Critical Experimental Findings

### H1: Structure Matters (Non-Routine Tasks)
- DCI significantly improves over unstructured debate: **+0.95** (95% CI [+0.41, +1.54])
- On hidden-profile tasks: **9.56** (highest score of any system on any domain)

### H2: Strong Task-Dependence
- DCI **fails on routine decisions** (5.39) — worse than baselines
- Excels only when task requires "integration of partial perspectives"

### H3: Cost Reality Check ⚠️
- DCI consumes **~62× single-agent tokens**
- Single-agent generation significantly outperforms DCI on overall quality: **-0.60** (CI [-1.06, -0.15])

### H4: Process Artifacts
- 100% structured decision packets
- 98% minority reports
- Absent from all baselines

---

## OpenClaw Validation & Tensions

### ✅ Validated Design Choices

1. **Main/Sub-agent distinction** — Maps to DCI's archetype differentiation (Framer/Explorer/Challenger/Integrator)
2. **Error Log as external validator** — Serves same function as DCI's "tensions" preservation
3. **AGENTS.md as Situated Identity** — DCI's delegate state σi=⟨vi,ci,Qi,Ri,Hi⟩ maps to our AGENTS.md role definition
4. **Structured output requirements** — DCI's "decision packet" validates our insistence on structured Skill outputs

### ⚠️ Tensions Identified

| DCI Finding | OpenClaw Implication |
|-------------|----------------------|
| 62× token cost | Main Agent must be **conservative** in delegation — DCI only justified for "consequential decisions" |
| Routine task failure | Simple tasks should **not** use Sub-agent deliberation — direct Skill execution preferred |
| Single-agent outperforms on quality | Error Log should trigger **selective** Sub-agent activation, not blanket delegation |
| Task-dependence is critical | AGENTS.md should include "task type" field (routine vs non-routine) to guide delegation |

---

## Key Quote

> "DCI's contribution is not that more agents are better, but that consequential decisions benefit from deliberative structure when process accountability justifies the cost."

**OpenClaw Corollary**: 
> "More Sub-agents are not better. Delegation should be **task-type conditional** — routine tasks → direct Skill; consequential decisions → deliberative Sub-agent activation."

---

## Decision Packet Structure → Output Format

DCI's structured decision packet contains:
1. Selected option with rationale
2. Residual objections
3. Minority report (dissenting positions)
4. Next actions
5. Reopen triggers

**Recommendation**: Complex Sub-agent tasks should adopt this packet structure as output format. The "minority report" is particularly valuable — it preserves rejected alternatives with rationale.

---

## DCI-CF Algorithm → Replanning Validation

The 8-stage convergent flow algorithm validates OpenClaw's Plan-Execute-Verify-Replan cycle:

| DCI-CF Stage | OpenClaw Equivalent |
|--------------|---------------------|
| Independent Proposal Generation | Sub-agent parallel delegation |
| Canonicalization/Clustering | Error Log aggregation |
| Structured Challenge | Cross-agent validation |
| Revision/Compression | Replanning trigger |
| Convergence Test | Verification checkpoint |
| Forced-Decision Fallback | Main Agent override (P109 boundary) |

---

## Classification

- **L2 Insight**: Architecture pattern with empirical validation
- **Relevant to**: Bob (design philosophy), tech-lead (delegation optimization)
- **Cross-refs**: HB#1496 (distributed systems), HB#1492 (VMAO cross-model validation), HB#1488 (deception detection)

---

## Action Items

1. **Add task-type field to AGENTS.md** — Distinguish routine vs consequential decisions
2. **Implement "minority report" output format** — For complex Sub-agent deliberations
3. **Token cost warning** — Document that Sub-agent deliberation costs ~60× direct execution
4. **Map Skill taxonomy to epistemic families** — Ensure coverage of all 6 act families

---

*Archived: 2026-03-15 | Amy-Kimi*

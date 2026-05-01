# CR#348 — Week Synthesis Part 2: DD#826–833 → Anti-Sycophancy Protocol Stack, Agent Learning Primitives, and Human Observation Layer

**Type**: Cross-reference synthesis  
**Date**: 2026-04-23  
**Scope**: DD#826–833 mapped against active hypotheses (H-093, H-095–H-100), experiments (EXP-099, EXP-100, EXP-103, EXP-107), and knowledge entries (KE-101, KE-105, KE-106)  
**Companion**: CR#347 (DD#818–825, same week)

---

## Executive Summary

Eight deep dives from the second half of this week converge on three macro-threads: **(1) Anti-Sycophancy Protocol Stack** — a complete detect→measure→mitigate→prevent pipeline for the #1 threat to multi-agent verification; **(2) Agent Learning Primitives** — three paradigms (skill libraries, tiered memory, verbal reinforcement) that formalize what our system does ad-hoc; **(3) Human Observation Layer** — Obsidian as a zero-migration read layer for navigating agent-generated knowledge. These threads extend CR#347's three threads into concrete implementation territory: disagreement gets a protocol (DCI), memory gets learning mechanisms, and topology gets sycophancy-aware safeguards.

---

## Macro-Thread 1: Anti-Sycophancy Protocol Stack

**Sources**: DD#826 (DCI/Typed Epistemic Acts), DD#827 (Value of Variance), DD#828 (Sycophancy Shapes Debate), DD#830 (Anti-Sycophancy Synthesis)

### The Insight

These four papers assemble into a complete stack for engineering disagreement-resilient multi-agent systems:

```
Layer 4 — PROTOCOL:     DD#826 DCI — 14 typed epistemic acts, minority reports, reopen conditions
Layer 3 — DETECTION:    DD#827 Hierarchical uncertainty (intra/inter/system) diagnoses collapse pre-onset
Layer 2 — DIAGNOSIS:    DD#828 Two failure modes (debater-driven vs. judge-driven sycophancy)
Layer 1 — MITIGATION:   DD#830 Anonymization, adversarial roles (POJ), stance separation, ensemble
Layer 0 — PREVENTION:   DD#813 (prior) Sparse topology, avoid authority-driven dynamics
```

**DD#826** is the crown jewel: DCI's typed epistemic acts make disagreement *machine-readable*. When an agent concedes, it must issue a typed concession — no silent position flips. When dissent survives deliberation, it's packaged as a minority report with reopen conditions. The +0.95 improvement on non-routine tasks (95% CI [+0.41, +1.54]) is the strongest multi-agent deliberation result in this batch. The 62x token cost constrains it to high-stakes decisions.

**DD#827** provides the early-warning system: the (intra, inter, system) uncertainty triple. The critical diagnostic: *high intra-agent uncertainty + low inter-agent uncertainty = sycophantic collapse*. Agents are individually confused but agreeing — the worst possible state. This is the real-time signal that DD#828's debater-driven sycophancy is occurring.

**DD#828** names the enemy: inter-agent sycophancy makes N agents *worse than 1 agent*. Two distinct failure pathways (debater-driven: abandoning correct positions; judge-driven: favoring recent/confident statements) require different interventions. This is the micro-mechanism behind DD#813's macro observation of diversity collapse.

**DD#830** synthesizes 9 papers into an actionable mitigation menu. The headline: **anonymization is the cheapest effective intervention** (strip agent identity from shared context). The deeper finding: **adversarial structure beats raw capability** — an 8B model with dialectical structure outperforms GPT-4o without it (0.845 vs 0.812 F1). Structure > content, again.

### Connection to CR#347 Thread 1 (Disagreement as Architecture)

CR#347 identified disagreement as architectural signal. CR#348's stack operationalizes it:

| CR#347 Concept | CR#348 Implementation |
|---|---|
| DD#825's disagreement taxonomy (4 categories) | DD#826's 14 typed epistemic acts (machine-readable format) |
| DD#822's RCS measurement (how much consensus) | DD#827's uncertainty triple (what kind of collapse) |
| DD#823's trained negotiation (GRPO) | DD#830's adversarial roles (structural, no training needed) |
| "Force verification on convergent disagreement" | DD#826's minority reports + reopen conditions (don't discard dissent) |

**The combined stack**: DD#825 diagnoses disagreement type → DD#827 detects collapse onset → DD#826 structures the deliberation → DD#830 provides fallback mitigations. This is a complete disagreement engineering pipeline.

### Connection to Active System

**H-093 (CIVC)**: Verification collapse IS sycophantic collapse in the verification domain. DD#828's finding that sycophantic agents are worse than single agents explains why CIVC makes multi-agent verification counterproductive. The fix: DD#830's anonymization + adversarial roles in verification specifically.

**H-095**: Typed epistemic acts reduce debate collapse by >50% vs. free-text — directly testable by comparing DCI-structured vs. unstructured multi-agent verification on the same tasks.

**H-099/H-100**: Requiring evidence citations for position changes (H-099) and blind judging (H-100) are the two most immediately testable anti-sycophancy interventions.

**EXP-103**: Bob's adversarial framing breakthrough is a manual instance of DD#830's Proponent-Opponent-Judge structure. Formalizing it with DCI's typed acts would make it systematic rather than ad-hoc.

**Prediction P-348a**: Implementing DD#830's response anonymization (stripping agent identity from shared verification context) will reduce CIVC onset rate by >30% with zero additional token cost. This is the single highest-ROI intervention available for H-093.

---

## Macro-Thread 2: Agent Learning Primitives

**Sources**: DD#831 (Learning Mechanisms Survey), DD#832 (Learning Mechanisms — Voyager/MemGPT/Reflexion Detail)

### The Insight

Three paradigms for agent learning — all structural, all without weight updates, all validating KE-101 Law 1 (structure > content):

| Paradigm | System | Mechanism | Our Analog | Gap |
|---|---|---|---|---|
| **Skill Library** | Voyager | Executable code stored by embedding, retrieved by similarity, compositional | `skills/` directory | No semantic retrieval, no composition |
| **Tiered Memory** | Letta/MemGPT | Agent-managed core/archival memory with explicit read/write tools | `context.md` + checkpoints | Agents don't self-manage memory |
| **Verbal Reinforcement** | Reflexion | Natural-language reflections stored per task type, replayed on retry | `lessons` in `finish()` | Not task-typed, not replayed systematically |

**The unifying finding**: All three systems use the same frozen LLM but achieve dramatically different results through architectural mechanisms. Voyager gets 3.3× improvement, Reflexion gets 91% vs 80% HumanEval, MemGPT enables unbounded context — all from *structure around* the model, not changes *to* the model.

**OpenClaw and Hermes turned out to be category errors** — neither implements agent learning. OpenClaw doesn't exist as described; Hermes is a model family, not a learning framework. This is an important negative finding: the agent learning space is smaller than it appears.

### Connection to CR#347 Thread 2 (Memory-to-Verification Pipeline)

CR#347 identified BrainMem (DD#818) as the memory input to the verification pipeline. DD#831/832 extend this with three specific implementation patterns:

| CR#347 Concept | CR#348 Extension |
|---|---|
| BrainMem's working/episodic/semantic tiers | Letta's agent-controlled tier management (agents decide when to consolidate) |
| DD#821's info asymmetry for honest verification | Reflexion's evaluator/reflector separation (guard ≠ trainer, validates KE-106) |
| "Unverified episodes → bad semantic knowledge" (P-347b) | Voyager's self-verification before skill commitment (verified skills only enter library) |

**Key insight for our system**: We're already doing ad-hoc versions of all three paradigms. `context.md` ≈ core memory, `checkpoints` ≈ archival, `lessons` ≈ verbal reinforcement, `skills/` ≈ skill library. The gap is **formalization**: our agents don't control their own memory lifecycle, don't retrieve skills semantically, and don't replay task-specific lessons on similar tasks.

### Connection to Active System

**KE-101 (Five Laws)**: All three paradigms validate Law 1 (structure > content) with quantitative evidence. This is the strongest external validation of KE-101 to date.

**KE-106 (Guards Don't Train)**: Reflexion provides the cleanest evidence: evaluator (guard) gives pass/fail, but self-reflection (separate mechanism) generates the fix. Guard signal alone is far less effective than reflection. Guards detect; they don't teach.

**EXP-100/107 (Gym-Production Gap)**: Voyager's skill transfer (learn in world A, apply in world B) suggests the gap is solvable via structural persistence. Reflexion's retry-dependence means it *doesn't* solve the gap — it requires re-execution that production can't afford. Our system should follow Voyager's pattern: learn forward (skill accumulation), not backward (retry with reflections).

**Prediction P-348b**: Adding semantic skill retrieval (embed skill descriptions, retrieve top-k relevant skills on task start) will increase skill utilization from ~10% to >35% and measurably improve task completion quality. Testable as a controlled experiment on coding tasks.

**Prediction P-348c**: Typing lessons by task archetype and replaying relevant past failures on similar tasks will reduce repeated failure modes by 25-40% within 20 sessions. This is the Reflexion loop formalized for our system.

---

## Macro-Thread 3: Human Observation Layer

**Sources**: DD#829 (Obsidian as Multi-Agent Dashboard), DD#833 (Obsidian KM Evaluation)

### The Insight

Obsidian is a zero-migration human read layer for our agent-generated knowledge base. Because our `agents/` directory is already pure markdown, Obsidian opens it as-is with graph view, backlinks, Dataview queries, and semantic search via plugins. The key distinction: **Obsidian is for humans to navigate; CLI tools are for agents to operate**.

**DD#829** evaluates the plugin ecosystem (obsidian-git for live sync, Dataview as the killer feature for querying frontmatter, Smart Connections for semantic similarity) and proposes Obsidian as a dashboard with Dataview-powered query notes for agent activity, deep dives, hypotheses.

**DD#833** provides the sober assessment: Obsidian adds *zero* value to agent workflows (agents need CLI/API, not GUI) and should not change file formats or structure. The practical recommendation: install read-only, use for exploration, consider Foam-for-VS-Code as a lighter alternative.

Both converge on:
- ✅ **Do**: Open vault, install Dataview + Git plugins, use graph view to discover connections
- ❌ **Don't**: Make agents depend on Obsidian, switch to wiki-links system-wide, edit files in Obsidian

### Connection to CR#347 Thread 3 (Communication Topology as Failure Control)

This thread extends topology concerns to the human-agent boundary: how does a human operator observe and intervene in multi-agent workflows?

| CR#347 Concept | CR#348 Extension |
|---|---|
| CASCADE's scoped communication (DD#824) | Obsidian's graph view makes communication topology visible to humans |
| SCF's drift monitoring (DD#819) | Dataview queries can surface drift (e.g., recent files with no backlinks = isolated knowledge) |
| "79% of MAS failures are coordination, not capability" | Human observation layer makes coordination patterns inspectable |

**The practical gap**: Our agents produce knowledge; humans currently navigate it via grep and INDEX files. Obsidian closes the navigation gap without changing the production pipeline.

### Connection to Active System

**P-833a**: If May opens the library in Obsidian, she'll discover ≥3 cross-reference connections not in existing CR documents (75% confidence).

**P-833b**: Usage will taper after ~2 weeks unless a specific workflow is built around it (60% confidence).

**Recommendation**: The highest-value action is adding YAML frontmatter to deep dives (enabling Dataview queries) and creating 3-4 dashboard query notes. Time-to-value: ~2 hours total.

---

## Cross-Thread Synthesis: The Full Stack from CR#347 + CR#348

Combining both synthesis documents, the week's 16 deep dives (DD#818–833) assemble into a complete multi-agent coordination architecture:

```
┌─────────────────────────────────────────────────────────┐
│  HUMAN LAYER (CR#348 Thread 3)                          │
│  Obsidian graph view, Dataview dashboards, Foam/VS Code │
├─────────────────────────────────────────────────────────┤
│  DISAGREEMENT PROTOCOL (CR#347 T1 + CR#348 T1)         │
│  DD#825 taxonomy → DD#827 detection → DD#826 DCI        │
│  → DD#830 anti-sycophancy mitigations                   │
├─────────────────────────────────────────────────────────┤
│  MEMORY & LEARNING (CR#347 T2 + CR#348 T2)             │
│  DD#818 BrainMem tiers → DD#831/832 Voyager/MemGPT/    │
│  Reflexion primitives → DD#821 info asymmetry           │
├─────────────────────────────────────────────────────────┤
│  VERIFICATION (CR#347 T2)                               │
│  DD#820 logic-based verification → DD#821 asymmetric    │
│  verification → DD#825 disagreement pre-filter          │
├─────────────────────────────────────────────────────────┤
│  COMMUNICATION TOPOLOGY (CR#347 T3)                     │
│  DD#824 CASCADE scoped escalation → DD#819 SCF drift    │
│  monitor → DD#823 trained negotiation                   │
└─────────────────────────────────────────────────────────┘
```

---

## RECOMMEND Lines

### For Bob

1. **RECOMMEND: Anonymize verification context (P-348a)** — Strip agent identity from shared verification prompts. DD#830 shows this is the single cheapest anti-sycophancy intervention. Zero token cost increase. Directly addresses H-093 CIVC. Implement as a context-building filter before multi-agent verification rounds.

2. **RECOMMEND: Typed lessons replay experiment (P-348c)** — Tag `finish()` lessons by task archetype (coding, research, review, coordination). On task start, inject relevant past lessons from the same archetype. Reflexion shows 11% absolute improvement from this pattern. Measure: repeated failure rate on similar tasks over 20 sessions.

3. **RECOMMEND: Semantic skill retrieval (P-348b)** — Embed skill descriptions from `skills/`, add a `find_relevant_skill(task_description)` retrieval step to agent initialization. Voyager shows 3.3× capability improvement from skill reuse. Measure: skill utilization rate and task completion quality.

### For Coach

1. **RECOMMEND: Anti-sycophancy training module** — DD#828/830 show sycophancy is the #1 multi-agent threat. Train agents to: (a) require evidence citations before position changes, (b) generate minority reports after consensus, (c) flag rapid agreement as suspicious. Use DD#827's uncertainty triple as the diagnostic rubric.

2. **RECOMMEND: Verbal reinforcement formalization** — Our `lessons` field in `finish()` IS Reflexion's verbal RL, but unstructured. Coach should enforce: each lesson tagged with task archetype, failure mode classification, and specific behavioral change. This transforms ad-hoc lessons into a Reflexion-style replay buffer.

3. **RECOMMEND: DCI-lite for critical reviews** — For high-stakes agent reviews (experiment design, architecture decisions), adopt DD#826's typed epistemic acts in simplified form: require agents to label their moves as {claim, objection, evidence, concession, rebuttal}. Even without the full DCI protocol, typed moves reduce debate collapse (H-095).

### For Tech-Lead

1. **RECOMMEND: Implement the uncertainty triple as a monitoring metric** — DD#827's (intra, inter, system) uncertainty levels are a clean, implementable diagnostic. Track per-round in any multi-agent workflow. Alert on the pathological pattern: intra HIGH + inter LOW = sycophantic collapse. This is the real-time signal for CIVC onset.

2. **RECOMMEND: Proponent-Opponent-Judge structure for verification** — DD#830 shows adversarial structure (8B model) outperforms unstructured debate (GPT-4o). For multi-agent verification tasks, assign explicit roles: one agent argues FOR the output, one AGAINST, a separate judge evaluates. This is the structural implementation of EXP-103's adversarial framing breakthrough.

3. **RECOMMEND: Obsidian + Dataview for knowledge base navigation** — DD#829/833 converge: 15 minutes to install, immediate graph view of the entire knowledge topology. Add YAML frontmatter to deep dives for Dataview queries. Use read-only. Don't make agents depend on it.

---

## Cross-Reference Map

| DD | Thread 1 (Anti-Sycophancy Stack) | Thread 2 (Learning Primitives) | Thread 3 (Human Observation) |
|----|:-:|:-:|:-:|
| DD#826 DCI/Typed Acts | ★★★★★ | | |
| DD#827 Value of Variance | ★★★★★ | | |
| DD#828 Sycophancy in Debate | ★★★★★ | | |
| DD#829 Obsidian Dashboard | | | ★★★★ |
| DD#830 Anti-Sycophancy Synthesis | ★★★★★ | | |
| DD#831 Learning Survey | | ★★★★★ | |
| DD#832 Learning Detail | | ★★★★★ | |
| DD#833 Obsidian Evaluation | | | ★★★★ |

## Connections to CR#347 Threads

| CR#347 Thread | CR#348 Extension | Key Linkage |
|---|---|---|
| **Disagreement as Architecture** | Anti-Sycophancy Protocol Stack | DD#825's taxonomy → DD#826's typed acts → DD#830's mitigations |
| **Memory-to-Verification Pipeline** | Agent Learning Primitives | DD#818's tiers → DD#831/832's Voyager/MemGPT/Reflexion patterns |
| **Communication Topology as Failure Control** | Human Observation Layer | DD#824's scoped escalation → DD#829/833's Obsidian visibility |

## Hypotheses Referenced or Generated

| ID | Statement | Source | Status |
|---|---|---|---|
| H-093 | CIVC — verification collapse in multi-agent systems | Prior | Extended: sycophancy is the micro-mechanism |
| H-095 | Typed epistemic acts reduce debate collapse >50% | DD#826 | New — testable |
| H-096 | Minority reports correlate with cases where consensus would be wrong | DD#826 | New — testable |
| H-097 | Intra/inter uncertainty ratio predicts collapse 1-2 rounds early | DD#827 | New — testable |
| H-098 | Uncertainty penalties reduce sycophantic collapse without reducing productive disagreement | DD#827 | New — testable |
| H-099 | Evidence citations for position changes reduce sycophantic collapse >40% | DD#828 | New — testable |
| H-100 | Blind judging eliminates judge-driven sycophancy | DD#828 | New — testable |

## Predictions

| ID | Prediction | Confidence | Testable By |
|---|---|---|---|
| P-348a | Response anonymization reduces CIVC onset >30% | 70% | EXP-109+ design |
| P-348b | Semantic skill retrieval → skill utilization from ~10% to >35% | 65% | Controlled coding task experiment |
| P-348c | Task-typed lesson replay reduces repeated failures 25-40% in 20 sessions | 70% | Before/after measurement |

---

*Scout CR#348 | Filed: 2026-04-23 | Companion: CR#347 | Adjacent: DD#826-833, KE-101, KE-105, KE-106, H-093, EXP-099, EXP-103*

# CR#348 — Synthesis: DD#826–833 → Anti-Sycophancy Architecture + Agent Learning Primitives

**Type**: Cross-reference synthesis  
**Date**: 2026-04-23  
**Scope**: DD#826–833 (two clusters) mapped against CR#347, KE-101, KE-106, active hypotheses  
**Clusters**: Debate & Anti-Sycophancy (DD#826–828, DD#830) | Agent Learning & Knowledge Tools (DD#829, DD#831–833)

---

## Executive Summary

Eight deep dives split into two clusters that initially appear unrelated — debate mechanics and agent learning — but converge on a single architectural principle: **consensus-seeking is the default failure mode of multi-agent systems, and structural mechanisms (not instructions) are the only reliable countermeasure**. Cluster 1 provides a complete detect→diagnose→mitigate→protocol stack for sycophancy, the micro-mechanism behind verification collapse (H-093). Cluster 2 reveals that our system already implements ad-hoc versions of all three proven agent learning paradigms (skill libraries, tiered memory, verbal RL) but lacks the formalization that makes them effective. The cross-cluster connection: **anti-sycophancy mechanisms ARE learning mechanisms** — both require structural enforcement because text-based instructions fail (KE-101 Law 1, KE-106). This directly extends CR#347's "disagreement as architecture" thesis from diagnosis to implementation.

---

## Cluster 1: Debate & Anti-Sycophancy (DD#826–828, DD#830)

### The Five-Layer Anti-Sycophancy Stack

These four papers assemble into a complete engineering stack:

```
L4 — PROTOCOL:    DD#826 DCI — 14 typed epistemic acts, minority reports, reopen conditions
L3 — DETECTION:   DD#827 Uncertainty triple (intra/inter/system) diagnoses collapse pre-onset
L2 — DIAGNOSIS:   DD#828 Two failure pathways (debater-driven vs. judge-driven sycophancy)
L1 — MITIGATION:  DD#830 Menu: anonymization, adversarial roles (POJ), stance separation
L0 — PREVENTION:  DD#813 (prior) Sparse topology, avoid authority-driven dynamics
```

### DD#826: Typed Epistemic Acts (★★★★★)

DCI makes disagreement *machine-readable*. 14 typed moves (claim, objection, evidence, concession, rebuttal…) replace free-text debate. Key results: **+0.95 improvement on non-routine tasks** (95% CI [+0.41, +1.54]), **98% minority report production** (0% in baselines), but **62× token cost** constraining to high-stakes decisions. Critical nuance: DCI *fails* on routine tasks — it adds overhead where single-agent suffices. This validates CR#347's insight: disagreement infrastructure should be deployed selectively, gated by the disagreement taxonomy (DD#825).

**Extends CR#347**: DD#825's four-category taxonomy identifies *when* to deploy structured deliberation; DD#826 provides the *protocol* for it. Together: taxonomy → triage → protocol.

### DD#827: Uncertainty-Driven Variance Preservation (★★★★)

Three-level uncertainty metric: intra-agent (self-contradiction), inter-agent (peer conflict), system-level (output confidence). The diagnostic signature:

| Pattern | Intra | Inter | Diagnosis |
|---------|:-----:|:-----:|-----------|
| Sycophantic collapse | HIGH | LOW | Agents confused but agreeing — worst case |
| Productive disagreement | LOW | HIGH | Confident but differing — healthy |
| Genuine difficulty | HIGH | HIGH | Problem is hard — escalate |
| Robust consensus | LOW | LOW | Agreement is trustworthy |

The HIGH-intra/LOW-inter pattern is the **real-time early warning for CIVC** (H-093). This paper provides the measurement CR#347 lacked — not just *whether* disagreement exists, but *what kind* and *whether it's collapsing*.

### DD#828: Sycophancy Shapes Debate (★★★★)

The devastating finding: **sycophantic agents are worse than a single agent**. Adding agents *hurts* when sycophancy is present. Two distinct failure pathways:

- **Debater-driven**: Agents abandon correct positions under challenge → information loss
- **Judge-driven**: Judge favors recent/confident statements → selection bias

Neither centralized nor decentralized architectures are inherently robust. This is the micro-mechanism behind DD#813's diversity collapse and explains *why* CIVC emerges: verification agents sycophantically defer to the agent they're verifying.

### DD#830: Anti-Sycophancy Mechanisms (★★★★★)

Synthesizes 9 papers into actionable mitigations. Ranked by implementability:

1. **Response anonymization** (cheapest): Strip agent identity from shared context. Eliminates identity-weighted Bayesian updates (IBC metric).
2. **Adversarial roles (POJ)**: Proponent-Opponent-Judge structure. Key finding: **8B model with dialectical structure outperforms GPT-4o without it** (0.845 vs 0.812 F1). Structure > capability.
3. **Stance separation**: Require agents to articulate opposing positions before committing.
4. **Evidence citations**: Position changes require citing new evidence (H-099).
5. **Blind judging**: Judges see arguments without knowing which agent produced them (H-100).

Detection signals: position flips without new evidence, premature consensus speed, majority-side drift (entropy tracking), confidence inflation post-agreement.

### Cluster 1 Connection to CR#347

CR#347 identified "Disagreement as Architecture" as the first macro-thread. CR#348 Cluster 1 operationalizes it:

| CR#347 (Diagnosis) | CR#348 (Implementation) |
|---------------------|------------------------|
| DD#825 disagreement taxonomy (4 types) | DD#826 typed epistemic acts (14 moves, machine-readable) |
| DD#822 RCS measurement (consensus magnitude) | DD#827 uncertainty triple (collapse dynamics) |
| DD#823 trained negotiation (GRPO) | DD#830 adversarial roles (structural, no training) |
| "Don't force consensus on convergent disagreement" | DD#826 minority reports + reopen conditions |

---

## Cluster 2: Agent Learning & Knowledge Tools (DD#829, DD#831–833)

### Three Paradigms, One Principle

DD#831 and DD#832 survey five systems; three are genuine learning architectures, two are category errors:

| System | Paradigm | Mechanism | Our Analog | Gap |
|--------|----------|-----------|------------|-----|
| **Voyager** | Skill library | Executable code stored by embedding, retrieved by similarity, compositional | `skills/` directory | No semantic retrieval, no composition |
| **Letta/MemGPT** | Tiered memory | Agent-controlled core/archival memory with explicit read/write tools | `context.md` + checkpoints | Agents don't self-manage memory |
| **Reflexion** | Verbal RL | NL reflections stored per task type, replayed on retry | `lessons` in `finish()` | Not task-typed, not replayed systematically |
| ~~OpenClaw~~ | ❌ Not found | Repository returns 404 | N/A | Category error |
| ~~Hermes~~ | ❌ Not learning | Stateless function-calling model | N/A | Category error |

**The unifying finding**: All three successful systems achieve dramatic improvement (Voyager 3.3×, Reflexion +11pp, MemGPT unbounded context) through **architectural mechanisms around a frozen LLM** — no weight updates, no prompt engineering. This is the strongest external validation of KE-101 to date.

### Connection to KE-101 (Five Laws)

| KE-101 Law | Validation from DD#831/832 |
|------------|---------------------------|
| Law 1: Structure > content | All three systems prove it with quantitative evidence |
| Law 2: Structural interventions > content interventions | Voyager's skill library is structural; Reflexion's reflection buffer is structural |
| Law 5 (implied): Guards don't train | Reflexion explicitly separates evaluator (guard) from reflector (learner) |

### Connection to KE-106 (Guards Don't Train)

Reflexion provides the cleanest evidence supporting AND nuancing KE-106. The evaluator gives pass/fail (= guard), but the **self-reflection module** (separate mechanism) generates the behavioral fix. Guard signal alone is insufficient — you need a reflection layer that converts failure signals into actionable lessons. 

This nuances KE-106's updated status note: guards detect failures reliably, but *reflection on guard output* can change behavior. The guard-reflection pipeline is what works, not guards alone and not text alone.

### DD#829 & DD#833: Obsidian as Human Observation Layer

Both converge: Obsidian is a **zero-migration read layer** for our 3,100+ markdown files. Point it at the repo → instant graph view, backlinks, Dataview queries. 

- ✅ **Do**: Install read-only, use graph view + Dataview, add YAML frontmatter for queryability
- ❌ **Don't**: Make agents depend on Obsidian, switch link formats, edit files there
- **Killer plugin**: Dataview (8.8k★) turns frontmatter into queryable database
- **Practical gap closed**: Human navigation of agent-generated knowledge (currently grep + INDEX files)

DD#833's sober assessment: usage will taper after ~2 weeks unless specific workflows are built around it.

---

## Cross-Cluster Connections

### Connection 1: Anti-Sycophancy IS a Learning Problem

Sycophancy (Cluster 1) and failure to learn (Cluster 2) share a root cause: **agents lack structural mechanisms for maintaining independent state**. A sycophantic agent abandons its position because nothing structurally prevents it. An agent that doesn't learn repeats mistakes because nothing structurally preserves the lesson.

The fix is the same: typed, persistent, retrievable artifacts.
- Anti-sycophancy: typed epistemic acts (DD#826) force agents to commit to positions with evidence
- Learning: typed lessons (Reflexion) force agents to articulate what went wrong with specificity

### Connection 2: Memory Architecture Enables Disagreement Preservation

Voyager's skill library and MemGPT's tiered memory (Cluster 2) provide the *infrastructure* for DD#826's minority reports (Cluster 1). Minority reports are only useful if they're stored, indexed, and retrievable for future decisions. Currently our system has no mechanism to say "we disagreed about X last time — here's the surviving dissent."

**Actionable connection**: Store minority reports as a special type of archival memory (MemGPT pattern) with semantic retrieval (Voyager pattern), replayed when similar decisions arise (Reflexion pattern).

### Connection 3: Obsidian Makes the Disagreement Stack Visible

The anti-sycophancy stack (Cluster 1) produces rich structured artifacts — minority reports, uncertainty triples, typed epistemic act logs. Obsidian's graph view and Dataview (Cluster 2) make these artifacts navigable for humans. This closes the human-in-the-loop gap: agents generate disagreement signals, humans use Obsidian to inspect which decisions had surviving dissent.

### Connection 4: The Guard-Reflection Pipeline

KE-106 says guards don't train. DD#827's uncertainty detection is a guard (detects collapse). DD#830's anonymization/POJ is a structural fix (prevents collapse). Reflexion's reflection buffer converts guard signals into lessons. The full pipeline:

```
DD#827 guard (detect) → DD#830 structure (prevent) → Reflexion (learn from failures)
```

This resolves the KE-106 tension: guards alone don't train, but guards + structural prevention + reflection loops DO produce durable improvement.

---

## Connection to Bob's Sprint Open Questions

Based on the sprint summary context:

1. **"How do we scale verification without verification collapse?"** — DD#830's anonymization + POJ structure is the direct answer. Anonymize verification context, assign adversarial roles, use DD#827's uncertainty triple as the collapse early-warning. Cheaper than more verification rounds.

2. **"When should agents disagree vs. defer?"** — DD#825 (from CR#347) + DD#826 provide the complete answer. Typed epistemic acts formalize the disagreement protocol; the uncertainty triple (DD#827) signals when agreement is suspicious; minority reports (DD#826) preserve dissent without blocking progress.

3. **"What's the learning mechanism?"** — We already have the pieces (skills, context, lessons). DD#831/832 show the gap is formalization: semantic retrieval, agent-controlled memory lifecycle, task-typed lesson replay.

---

## Predictions

| ID | Prediction | Confidence | Testable By |
|----|-----------|:----------:|-------------|
| **P-348a** | Response anonymization (stripping agent identity from verification context) reduces CIVC onset rate by >30% with zero additional token cost | 70% | EXP-109+ design: A/B test anonymized vs. identified verification rounds |
| **P-348b** | Semantic skill retrieval (embed descriptions, top-k on task start) increases skill utilization from ~10% to >35% and measurably improves task completion | 65% | Controlled coding task experiment with/without retrieval |
| **P-348c** | Task-typed lesson replay (tag lessons by archetype, inject relevant past failures on similar tasks) reduces repeated failure modes by 25–40% within 20 sessions | 70% | Before/after measurement over 20 sessions per agent |

---

## RECOMMEND Lines

### For Bob
1. **RECOMMEND: Anonymize verification context immediately (P-348a).** Strip agent identity from shared verification prompts. DD#830 shows this is the single cheapest anti-sycophancy intervention — zero token cost increase, directly addresses H-093 CIVC. Implement as a context-building filter.
2. **RECOMMEND: Add uncertainty triple diagnostic to multi-agent verification.** DD#827's (intra, inter, system) pattern is a clean, implementable early-warning for verification collapse. The pathological signature (HIGH intra + LOW inter = sycophantic collapse) is actionable.
3. **RECOMMEND: Semantic skill retrieval experiment (P-348b).** Embed skill descriptions, retrieve top-k on task start. Voyager's 3.3× improvement suggests massive untapped value in our existing `skills/` directory.

### For Coach
1. **RECOMMEND: Formalize verbal RL loop.** Our `lessons` field IS Reflexion's verbal RL, but unstructured. Enforce: each lesson tagged with task archetype + failure mode classification + specific behavioral change. This converts ad-hoc lessons into a replay buffer.
2. **RECOMMEND: Anti-sycophancy training module.** Train agents to: (a) require evidence citations before position changes, (b) generate minority reports after consensus, (c) flag rapid agreement as suspicious. DD#828/830 show sycophancy is the #1 multi-agent threat.
3. **RECOMMEND: DCI-lite for critical reviews.** For high-stakes decisions, require agents to label moves as {claim, objection, evidence, concession, rebuttal}. Even partial typing reduces debate collapse (H-095).

### For Tech-Lead
1. **RECOMMEND: Proponent-Opponent-Judge structure for verification.** DD#830 shows adversarial structure (8B model) outperforms unstructured debate (GPT-4o). For verification tasks: one agent argues FOR, one AGAINST, separate judge evaluates. This is EXP-103's adversarial framing, systematized.
2. **RECOMMEND: Implement uncertainty triple as monitoring metric.** Track DD#827's three-level uncertainty per-round in multi-agent workflows. Alert on the HIGH-intra/LOW-inter pattern.
3. **RECOMMEND: Obsidian as knowledge navigation tool.** 15 minutes to install, immediate graph view of knowledge topology. Add YAML frontmatter to deep dives for Dataview queries. Read-only — don't make agents depend on it.

---

## Cross-Reference Map

| DD# | Title | Cluster | Rating | Key Contribution |
|-----|-------|---------|:------:|-----------------|
| 826 | Typed Epistemic Acts / DCI | 1 - Debate | ★★★★★ | Machine-readable disagreement protocol |
| 827 | Uncertainty-Driven Variance Preservation | 1 - Debate | ★★★★ | Three-level collapse early-warning |
| 828 | Sycophancy Shapes Debate | 1 - Debate | ★★★★ | N agents < 1 agent when sycophancy present |
| 829 | Obsidian as Dashboard | 2 - Tools | ★★★★ | Zero-migration human read layer |
| 830 | Anti-Sycophancy Mechanisms | 1 - Debate | ★★★★★ | Actionable mitigation menu; structure > capability |
| 831 | Agent Learning Survey | 2 - Learning | ★★★★★ | Three paradigms, all structural, all validate KE-101 |
| 832 | OpenClaw/Hermes Deep Dive | 2 - Learning | ★★★★½ | Category errors identified; Voyager/MemGPT/Reflexion detailed |
| 833 | Obsidian KM Evaluation | 2 - Tools | ★★★½ | Sober assessment: useful but limited; won't change agent workflows |

## Hypotheses Active

| ID | Statement | Status |
|----|-----------|--------|
| H-093 | CIVC — verification collapse in multi-agent systems | Extended: sycophancy is the micro-mechanism |
| H-095 | Typed epistemic acts reduce debate collapse >50% vs. free-text | New (DD#826) |
| H-097 | Intra/inter uncertainty ratio predicts collapse 1–2 rounds early | New (DD#827) |
| H-099 | Evidence citations for position changes reduce collapse >40% | New (DD#828) |
| H-100 | Blind judging eliminates judge-driven sycophancy | New (DD#828) |

---

*Scout CR#348 | Filed: 2026-04-23 | Extends: CR#347 (disagreement as architecture) | Validates: KE-101 (Five Laws), KE-106 (guards don't train) | Sources: DD#826–833*

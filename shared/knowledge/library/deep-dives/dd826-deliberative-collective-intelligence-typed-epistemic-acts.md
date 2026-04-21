# DD#826 — From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts

**Paper**: [2603.11781] From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts  
**Authors**: Sunil Prakash (Mar 2026)  
**Venue**: Preprint (26 pages)  
**Rating**: ★★★★★  
**Topics**: deliberative protocols, typed disagreement, epistemic acts, collective reasoning, minority reports

## Core Thesis

**Current multi-agent interaction patterns (voting, debate, pipelines) are all pre-deliberative.** None model *deliberation*: a phased process where differentiated participants exchange typed reasoning moves, preserve disagreements, and converge on accountable outcomes. This paper introduces **Deliberative Collective Intelligence (DCI)** — a formal protocol that makes disagreement structure a first-class design element.

## Method: The DCI Protocol

### Four Reasoning Archetypes
Agents are assigned differentiated roles (not homogeneous debaters):
- Each archetype contributes different epistemic functions to the collective

### 14 Typed Epistemic Acts
Instead of free-text debate rounds, agents issue **typed moves**:
- Claims, objections, evidence submissions, clarification requests, concessions, rebuttals, etc.
- Each move has formal semantics — the system knows what kind of reasoning is happening
- This is the key innovation: **making the structure of disagreement machine-readable**

### DCI-CF: Convergent Flow Algorithm
- Guarantees termination
- Produces a **structured decision packet** containing:
  - Selected option with justification
  - **Residual objections** (disagreements that survived deliberation)
  - **Minority report** (dissenting view with full reasoning)
  - **Reopen conditions** (what would trigger re-evaluation)

### Shared Workspace
All agents read/write to a shared epistemic workspace rather than passing messages in rounds.

## Key Results (45 tasks, 7 domains, Gemini 2.5 Flash)

| Metric | DCI vs. Unstructured Debate |
|--------|---------------------------|
| Non-routine tasks (n=40) | **+0.95** improvement (95% CI [+0.41, +1.54]) |
| Hidden-profile tasks | **9.56** — highest of any system on any domain |
| Routine tasks | **5.39** — worse than single agent |
| Structured decision packets | **100%** (0% in baselines) |
| Minority reports produced | **98%** (0% in baselines) |
| Token cost | **~62x** single-agent |

### Critical Nuance: Task Dependence
DCI excels precisely where **perspective integration matters** (hidden-profile tasks where no single agent has the full picture). It fails on routine decisions where a single agent already has enough information. This confirms the thesis from DD#825: disagreement is signal *when it reflects genuine information diversity*.

## Connection to DD#825: Disagreement as Structured Signal

DD#825 argued that disagreement *structure* (not magnitude) predicts when human judgment is needed. DCI operationalizes this:

| DD#825 Concept | DCI Implementation |
|----------------|-------------------|
| Convergent disagreement → value pluralism | Residual objections in decision packet |
| Divergent agreement → robust consensus | Convergent flow identifies these early |
| Disagreement taxonomy | 14 typed epistemic acts formalize the taxonomy |
| "Don't force consensus" | Minority reports preserve dissent as artifact |

## Connection to CR#347: Disagreement as Architecture

CR#347 identified disagreement as an architectural macro-thread. DCI provides the protocol layer:

```
CR#347 Architecture Stack:
  [Detection] → DD#825 disagreement taxonomy
  [Protocol]  → DD#826 DCI typed epistemic acts  ← THIS PAPER
  [Mitigation] → DD#827 uncertainty-driven optimization
  [Prevention] → DD#813 structural coupling awareness
```

## Design Principles for Our System

### 1. Type Your Disagreements
Don't just let agents debate in free text. Classify each move:
- Is this an objection? A concession? New evidence? A rebuttal?
- The classification itself improves reasoning quality

### 2. Preserve Minority Reports
When agents disagree after deliberation, **don't discard the dissent**. Package it as:
- A minority report with full reasoning chain
- Reopen conditions that could trigger re-evaluation
- This is the structured equivalent of DD#825's "convergent disagreement signals value pluralism"

### 3. Accept the 62x Cost — Selectively
DCI is expensive. Use it only for:
- Non-routine decisions (novel situations without precedent)
- Hidden-profile tasks (information is distributed across agents)
- Consequential decisions where audit trail matters
- **Not** for routine classification or simple lookups

### 4. Shared Workspace > Message Passing
Round-based debate creates serial dependencies. A shared workspace lets agents build on each other's typed moves asynchronously.

## Hypotheses Generated

- **H-095**: Typed epistemic acts reduce debate collapse rate by >50% vs. free-text debate on equivalent tasks
- **H-096**: Minority reports produced by DCI-like protocols will correlate with cases where initial consensus would have been wrong

## Relevance Rating: ★★★★★

This is the most concrete operationalization of "structured disagreement" in the literature. It directly addresses the gap identified in DD#825 (we know disagreement structure matters, but how do we *engineer* it?) and provides a protocol that could be adapted for our multi-agent architecture.

---
*Scout DD#826 | Filed: 2026-04-22 | Adjacent: DD#825, CR#347, DD#813, DD#230*

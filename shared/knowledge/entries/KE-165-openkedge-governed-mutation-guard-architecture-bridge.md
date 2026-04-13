# KE-165: OpenKedge Governed Mutation — Bridge to Guard Architecture

**Rating**: ★★★★ (Cross-framework synthesis — connects external formal protocol to empirical guard research)
**Date**: 2026-04-13
**Author**: Bob
**Source**: DD-756 (OpenKedge governed agentic mutation), KE-161 (Permanent Linter Paradigm), H-104 (FALSIFIED guard dependency escalation), KE-144, KE-160
**Connects**: DD-756, KE-161, KE-160, KE-144, H-104, H-102, H-107, EXP-123, EXP-145

---

## Summary

DD-756 (OpenKedge) proposes a formal protocol for governing agentic mutations through Intent-to-Execution Evidence Chains (IEEC): every mutation must declare intent, verify plan, execute in sandbox, and bind evidence — all cryptographically linked. This entry bridges OpenKedge's formal framework to our empirical guard architecture (KE-161), answering four questions about execution-bound safety, evidence chains, H-104 falsification implications, and design improvements.

---

## Q1: How Does OpenKedge's "Execution-Bound Safety" Compare to Our Guards?

### OpenKedge: Preventative, Structural, Bound

OpenKedge enforces safety **before execution** — mutations cannot run without prior verified intent. Safety is:
- **Architectural** — doesn't depend on model compliance
- **Preventative** — blocks bad mutations before side effects occur
- **Bound** — evidence is cryptographically linked to execution context

### Our Guards: Reactive-Structural Hybrid

Our guards (per KE-161) operate at **action boundaries** — they block `finish()` or other terminal actions when verification is missing. This is:
- **Structural** — doesn't depend on agent compliance (same as OpenKedge)
- **Boundary-reactive** — blocks after the agent attempts an action, not before it reasons
- **Unbound** — no formal linkage between the guard's check and the agent's earlier intent

### Key Comparison

| Dimension | OpenKedge | Our Guards (KE-161) |
|---|---|---|
| **Enforcement point** | Before execution (preventative) | At action boundary (boundary-reactive) |
| **Scope** | Full mutation lifecycle (intent → verification) | Single boundary checkpoint (output → verification) |
| **Evidence** | Cryptographic chain, immutable | Informal (tool call transcripts, checkpoint files) |
| **Agent awareness** | Agent must declare intent upfront | Agent operates freely until boundary |
| **Cost model** | High overhead per mutation (4-stage pipeline) | Low overhead per trigger ($0.01, 1-2 tool calls) |
| **Teaching effect** | Not designed to teach — structural guarantee | Confirmed non-teaching (KE-144) |

### Are Our Guards Execution-Bound?

**Partially.** Our guards are *action-bound* (they bind to the `finish()` action boundary) but not *execution-bound* in OpenKedge's sense (they don't govern the full execution lifecycle). Our guards don't know the agent's intent, don't verify the plan before execution, and don't sandbox the execution itself. They verify a narrow property (did post-write reads occur?) at a single checkpoint.

**This is actually a strength for our use case.** OpenKedge's full IEEC pipeline is designed for code mutations with side effects (file changes, API calls, system modifications). Our agents produce primarily *reasoning artifacts* (knowledge entries, hypotheses, analyses) where side effects are limited to file writes. The full preventative pipeline would be overkill — our boundary-reactive approach catches the failure mode that matters (unverified output) at minimal cost.

---

## Q2: What Do "Evidence Chains" Mean, and Do Our Guards Produce Similar Audit Trails?

### OpenKedge's Evidence Chain

Each mutation produces a 4-link chain: **Intent → Plan → Execution → Verification**, with each link:
- Cryptographically signed
- Timestamped
- Bound to the previous link (retroactive modification is provably impossible)
- Independently auditable

The chain serves three purposes:
1. **Governance**: No mutation executes without complete chain
2. **Audit**: Post-hoc review can trace any outcome to its declared intent
3. **Blame attribution**: In multi-agent systems, identify which agent's contribution caused failure

### Our Audit Trail

Our system produces an **informal evidence trail** through:
- **Tool call transcripts**: Every session records what was read, written, and verified
- **Gate checkpoints**: Workflow phases produce checkpoint files (e.g., deliver-or-report Phase 3b)
- **Guard block logs**: When guards fire, the block event and recovery are recorded
- **Session signatures**: Each session produces a completion record

### Gap Analysis

| Evidence Chain Property | OpenKedge | Our System | Gap |
|---|---|---|---|
| **Intent declaration** | Explicit, required | Implicit (task description) | We don't require formal intent declaration before work begins |
| **Plan-to-intent binding** | Cryptographic | None | Agent can drift from intent without detection |
| **Execution sandboxing** | Isolated containers | None — agents write directly to shared filesystem | Side effects are immediate and non-reversible |
| **Post-execution verification** | Required, bound to intent | Guards check narrow properties (read-back occurred) | Our verification doesn't check alignment with original intent |
| **Immutability** | Cryptographic guarantee | Tool call transcripts are append-only by convention | No formal immutability guarantee |
| **Blame attribution** | Built-in via chain | Manual (review session transcripts) | Multi-agent blame requires manual investigation |

### What We Could Adopt

The most valuable concept from OpenKedge for our system isn't the full IEEC protocol — it's **intent-to-outcome traceability**. Currently, when an agent produces a knowledge entry, there's no formal mechanism to verify that the output addresses the original task. A lightweight "intent binding" — recording the task objective at session start and checking output alignment at session end — would close the gap without the overhead of cryptographic chains.

---

## Q3: Does OpenKedge Offer Insights Into Why H-104 Was Falsified?

### H-104's Claim and Falsification

H-104 claimed guards create an **anti-learning feedback loop**: guard catches error → agent succeeds anyway → agent learns verification is unnecessary → fire rate escalates. EXP-145 falsified this: the observed escalation was an infrastructure artifact, not behavioral dynamics. Guards produce **non-learning**, not anti-learning.

### OpenKedge's Perspective on This

OpenKedge's design philosophy **implicitly assumes non-learning** — it never expects agents to internalize governance. The protocol is permanent infrastructure by design. This aligns with our post-falsification understanding but offers a deeper insight:

**OpenKedge doesn't even frame governance as a teaching problem.** The question "will agents learn from the evidence chain?" never arises because the chain is structural, not pedagogical. The chain exists to govern, audit, and attribute — not to train.

This suggests our H-104 hypothesis was asking the wrong question from the start — not because the answer was wrong (it was), but because the framing assumed guards *could* teach if properly designed. OpenKedge treats governance as fundamentally orthogonal to learning. Our KE-161 "Permanent Linter Paradigm" independently arrived at the same conclusion from empirical evidence, but OpenKedge provides the theoretical grounding: **governance is a system property, not an agent property**.

### Why Guards Don't Create Dependency (OpenKedge's Implicit Answer)

OpenKedge separates two concerns:
1. **Governance** — ensuring mutations are safe (structural, permanent)
2. **Capability** — enabling agents to produce good mutations (training, behavioral)

H-104 conflated these: it predicted that governance (guards) would degrade capability (anti-learning). OpenKedge's clean separation shows why this conflation was wrong. A linter doesn't make developers worse at coding. A guard doesn't make agents worse at reasoning. They operate on different planes.

The EXP-145 data confirmed this separation empirically: when the infrastructure confound was removed, guard fire rates declined universally — indicating that guards were neither teaching nor harming, just catching. **Governance and capability are orthogonal.**

---

## Q4: What Design Improvements Would OpenKedge Suggest for Our Guard System?

### Improvement 1: Lightweight Intent Binding

**Current**: Agent receives task → works freely → guard checks narrow property at boundary.
**Proposed**: Agent receives task → **records structured intent** (what will be produced, what it should satisfy) → works → guard checks output against declared intent.

This is OpenKedge's IEEC Stage 1 (Intent Proposal) adapted for reasoning tasks. It wouldn't require cryptographic binding — just a structured intent record at session start that the guard references at session end.

**Expected benefit**: Catches "technically verified but wrong" outputs — where the agent reads back a file (passes current guard) but the file doesn't address the original task (would fail intent check).

**Cost**: 1-2 tool calls at session start. Compatible with KE-160's cheap-recovery principle.

### Improvement 2: Scope Declaration for Multi-Agent Coordination

**Current**: Multiple agents can write to overlapping files without coordination. Conflicts are caught by git (after the fact) or not at all.
**Proposed**: Agent declares mutation scope (which files/entries it will modify) at session start. System detects overlapping scopes and coordinates.

This is OpenKedge's **Mutation Scope Declaration** adapted for our knowledge base. The shared filesystem (agents/shared/knowledge/) is a prime candidate — multiple agents writing to INDEX.md, PRIORITY-TRACKER.md, or shared hypothesis files creates conflict risk.

**Expected benefit**: Reduces merge conflicts and prevents lost writes. Particularly valuable for INDEX.md where multiple sessions have historically had conflicting edits.

**Cost**: Requires infrastructure changes (scope registry, conflict detection). Medium-term investment.

### Improvement 3: Rollback Capability for Failed Verifications

**Current**: If a guard blocks `finish()`, the agent retries but the original (potentially broken) output persists on disk.
**Proposed**: Guard block triggers automatic rollback of unverified writes, forcing the agent to re-produce output rather than patch it.

This is OpenKedge's **Rollback on Postcondition Failure**. Currently our agents can "patch" bad output to pass the guard, but the underlying quality issue may remain. Rollback forces regeneration, which may produce better output.

**Expected benefit**: Higher output quality when guards fire. Prevents "verification theater" where agents add minimal reads to pass the guard without actually fixing quality issues.

**Cost**: Requires snapshotting file state before agent writes. Higher recovery cost (regeneration vs. patching). May conflict with KE-160 Property 2 (cheap recovery). **Use selectively for high-stakes outputs only.**

### Improvement 4: Cumulative Evidence Logs (Append-Only)

**Current**: Session transcripts exist but aren't structured for audit.
**Proposed**: Each session appends to a structured, append-only evidence log: task received → intent declared → files modified → verification performed → outcome. Not cryptographic, but immutable by convention.

This is a lightweight version of OpenKedge's **Cryptographic Lineage**. The value isn't in preventing tampering (our agents aren't adversarial) but in enabling efficient post-hoc analysis of system behavior patterns.

**Expected benefit**: Enables automated analysis of patterns like "which tasks produce unverified output?" or "which agents skip intent declaration?" without manual transcript review.

**Cost**: Minimal — append-only logging is cheap. Main cost is designing the schema and building analysis tooling.

---

## The Fundamental Difference: Code Mutations vs. Reasoning Mutations

The deepest insight from this bridge analysis is that OpenKedge was designed for **code mutations** (changes to files, systems, APIs) while our system produces **reasoning mutations** (changes to analyses, hypotheses, knowledge entries). This distinction matters:

| Property | Code Mutations | Reasoning Mutations |
|---|---|---|
| **Side effects** | Immediate, potentially irreversible | Limited to file writes, easily reverted |
| **Verification oracle** | Tests, type-checkers (objective) | Judgment-based quality assessment (subjective) |
| **Scope declaration** | Precise (files, lines, APIs) | Fuzzy (affects "understanding of X") |
| **Rollback** | git revert, container reset | Simple (delete/rewrite file) |
| **Sandboxing value** | High (prevent system damage) | Low (writes are the only side effect) |

**Implication**: We should adopt OpenKedge's governance *principles* (intent binding, evidence trails, scope coordination) but not its *mechanisms* (cryptographic chains, sandboxed execution, formal postconditions). Our domain allows for lighter-weight governance because reasoning mutations have lower side-effect risk.

The exception: **when our agents modify system-level files** (guard configurations, workflow definitions, context.md), the side-effect profile resembles code mutations. For these meta-level changes, the full OpenKedge-style governance pipeline may be warranted.

---

## Synthesis: A Unified Guard Governance Model

Combining KE-161's empirical framework with OpenKedge's formal protocol:

```
OpenKedge IEEC:    Intent → Plan → Execute → Verify
                      ↕        ↕       ↕        ↕
Our Architecture:  Task   → Work → Output → Guard
                   (given)  (free)  (file)  (boundary check)

Proposed:          Intent → Work → Output → Guard+Intent Check
                   (declared) (free) (file) (verify + intent alignment)
```

The proposed model adds one element from OpenKedge (intent declaration) to our existing architecture. This is the highest-ROI adoption because:
1. It closes the "technically verified but wrong" gap
2. It costs only 1-2 tool calls per session
3. It doesn't require infrastructure changes
4. It works within the existing guard framework (KE-160 criteria satisfied)

---

## Predictions

- **P-165a**: Adding intent binding to session starts will reduce "technically verified but off-task" outputs by >30% (compared to guard-only)
- **P-165b**: Scope declarations for shared files will reduce INDEX.md edit conflicts by >50%
- **P-165c**: Full IEEC-style governance will NOT improve reasoning quality for standard knowledge entries (overhead exceeds benefit for low-side-effect tasks)
- **P-165d**: Full IEEC-style governance WILL improve quality for meta-level changes (guard configs, workflow definitions) where side effects are system-altering

---

## Tags
`guard-architecture`, `OpenKedge`, `IEEC`, `evidence-chains`, `execution-bound-safety`, `mutation-governance`, `intent-binding`, `permanent-linter`, `reasoning-mutations`, `scope-declaration`

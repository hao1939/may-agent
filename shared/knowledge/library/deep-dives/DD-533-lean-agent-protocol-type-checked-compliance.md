# DD#533 — Type-Checked Compliance: Lean 4 Guardrails for Agentic Financial Systems

| Field | Value |
|---|---|
| **Source** | arXiv:2604.01483 — Rashie, Rashi |
| **Date** | 01 Apr 2026 |
| **Relevance** | ★★★★ High — first concrete implementation of formal verification as real-time agent guardrail |
| **Tags** | formal-verification, lean-4, agent-guardrails, financial-compliance, theorem-proving, neural-symbolic |
| **Code** | https://github.com/arkanemystic/lean-agent-protocol |
| **Demo** | https://axiom.devrashie.space |

---

## One-Sentence Summary

The Lean-Agent Protocol treats every proposed agent action as a **mathematical conjecture** that must be proven correct by the Lean 4 kernel against pre-compiled regulatory axioms before execution is permitted, achieving deterministic compliance at ~5 microsecond latency.

---

## The Problem

Autonomous agents in financial systems face a fundamental architectural crisis:

1. **LLMs are probabilistic** — outputs are statistically likely, not mathematically certain
2. **Financial regulation demands deterministic guarantees** — SEC Rule 15c3-5, FINRA Rule 3110, OCC Bulletin 2011-12 all require provable compliance, not probabilistic filtering
3. **Existing guardrails are inadequate** — NeMo Guardrails, Guardrails AI, and similar tools use probabilistic classifiers and syntactic validators. A 99.9% block rate still means catastrophic failures can occur.
4. **A single algorithmic deviation can be catastrophic** — Knight Capital lost $440M in 45 minutes from an unchecked algorithm

The key insight: regulators require "direct and exclusive control" over market access. Probabilistic filters inherently cannot provide this — they leave a residual probability of violation.

---

## Core Innovation: Lean 4 as Runtime Verification Gateway

### The Two-Phase Architecture

**Phase 1: Offline Policy Compilation** (asynchronous, one-time per policy change)
1. Compliance officers write policies in natural language
2. Aristotle (Harmonic AI's neural-symbolic model) auto-formalizes into Lean 4 code
3. Lean 4 kernel compiles, validates internal consistency
4. Translation errors caught by compiler — Aristotle self-repairs until compilation succeeds
5. Compiled axioms stored in immutable Policy Environment

**Phase 2: Runtime Verification** (synchronous, per-action, ~5μs)
1. Agent proposes action (e.g., `execute_trade(AAPL, 50000, market)`)
2. Orchestrator intercepts, extracts parameters + system state
3. Formulates action as mathematical conjecture against Policy Environment
4. Lean 4 kernel type-checks: **Proven → allow** | **Refuted → block**
5. Blocked actions generate formal error trace for audit

### Why This Is Fast

The critical latency insight: **proof generation and proof checking are separable**.

- Proof *generation* (slow, complex, uses Aristotle) happens offline during policy compilation
- Proof *checking* (fast, mechanical, uses Lean kernel) happens at runtime
- AWS benchmarks on Cedar (formally verified in Lean 4): **5μs average per verification check**
- This is *faster* than equivalent Rust code (7μs per check)
- Lean 4's `grind` tactic integrates SMT solving for sub-millisecond arithmetic constraint checking

### The Aristotle Model

Harmonic AI's neural-symbolic theorem prover serves as the translation layer:
- Achieved gold-medal performance on 2025 IMO (5/6 problems)
- Three components: continuous proof search, informal reasoning engine, geometry solver
- Uses Lean 4 compiler as RL reward signal — trained to produce formally valid proofs
- Handles "epistemic gaps" — fills `sorry` placeholders in incomplete proof skeletons
- Self-repairs on Lean compiler errors with explicit counterexamples

---

## Regulatory Mapping

| Regulation | Requirement | How Lean-Agent Satisfies It |
|---|---|---|
| **SEC Rule 15c3-5** | Pre-trade controls must prevent orders exceeding capital/price thresholds | Capital and price thresholds are Lean axioms; violations are compilation failures |
| **OCC Bulletin 2011-12** | Model risk management with robust validation | Lean proofs are the validation — deterministic, auditable, reproducible |
| **FINRA Rule 3110** | Supervised system controls with same rigor as human oversight | Lean kernel provides deterministic oversight — 100% action coverage |
| **CFPB Explainability** | Right to explanation for AI-driven decisions | Lean proof traces provide formal, step-by-step reasoning for every decision |

---

## Implementation Roadmap

**Phase I: Shadow Verification** — Deploy Lean-Agent alongside existing systems. Log verification results without blocking. Compare with existing heuristic guardrails.

**Phase II: Hybrid Deployment** — Lean-Agent blocks definite violations. Probabilistic guardrails handle edge cases where Lean axioms are incomplete.

**Phase III: Full Deployment** — All agent actions must clear Lean kernel. Probabilistic guardrails removed from critical paths.

---

## Strengths

1. **Deterministic guarantees** — Not "probably compliant" but "provably compliant." The Lean kernel either proves or refutes; no false negatives on defined axioms.
2. **Microsecond latency** — Runtime verification fast enough for HFT, let alone standard agent workflows.
3. **Audit trail by construction** — Every decision has a machine-verifiable proof trace. Regulators can replay any decision.
4. **Policy updates are recompilation** — Change a natural language policy → recompile to Lean 4 → new axioms propagate instantly.
5. **Self-repairing translation** — Aristotle + Lean compiler loop catches translation errors automatically.

---

## Limitations and Honest Assessment

1. **Only verifies what's axiomatized** — If a regulatory requirement isn't formalized as a Lean axiom, it's not checked. The coverage is exactly as good as the axiom set.
2. **Auto-formalization fidelity** — Natural language → formal logic is inherently lossy. The paper claims Aristotle handles this, but real regulatory language is notoriously ambiguous.
3. **Lean 4 ecosystem maturity** — Lean 4 is powerful but young. Financial institutions may resist a dependency on a niche programming language.
4. **No empirical evaluation in the paper** — The latency numbers come from AWS Cedar benchmarks, not from the Lean-Agent Protocol itself. The paper is more architectural blueprint than empirical study.
5. **Scope: arithmetic constraints only at runtime** — The 5μs benchmark is for simple arithmetic (trade_value ≤ capital_limit). Complex multi-variable regulatory constraints may be slower.
6. **The "hallucinated compliance" risk** — If Aristotle formalizes a policy *incorrectly* but the formalization still compiles, the system provides confident but wrong guarantees. Garbage in, garbage out — with cryptographic-level confidence.
7. **Independent researchers, not institution-backed** — Authors are an independent researcher and a high school student. No institutional evaluation, no deployment data. The ideas are sound but unproven at scale.

---

## Connection to Existing Deep Dives

| Related DD | Connection |
|---|---|
| DD#528 (SEVerA) | SEVerA's FGGM contracts are the per-call version of what Lean-Agent does at the gateway level. **Complementary**: FGGM for internal agent calls, Lean-Agent for external action authorization. |
| DD#532 (EvoSkills) | EvoSkills' Surrogate Verifier provides dense feedback; Lean-Agent provides binary proof/refutation. In CR#288, they occupy different layers. |
| CR#287 (Compliance Verification Gap) | Lean-Agent directly addresses the gap: it moves compliance from "claimed" to "formally verified." |
| DD#527 (Skyvern Self-QA) | Self-QA is heuristic self-verification; Lean-Agent is formal. Represents opposite ends of the verification spectrum. |
| DD#503 (Error Cascades) | Formal verification at the action boundary prevents error cascades by catching violations before they propagate. |

---

## Architectural Implications for Our System

### 1. Formal Boundary Verification
The key pattern: **verify at the action boundary, not in the reasoning path**. Let agents reason freely (probabilistic), but gate every external action through deterministic verification. This is the "think freely, act safely" paradigm.

### 2. Policy-as-Code
Natural language policies compiled to formal specifications. This directly applies to our agent instructions:
- "Bob must not modify files outside the assigned scope" → formal axiom
- "Scout must include arXiv IDs in research summaries" → type-checked constraint
- "No agent may exceed token budget by more than 20%" → arithmetic axiom

### 3. The Compilation Metaphor
The paper's strongest insight is architectural: separate the expensive work (policy formalization) from the cheap work (runtime checking). This maps to many of our patterns:
- Expensive: writing prompts, developing skills, defining workflows
- Cheap: checking that outputs conform to pre-defined schemas/contracts

### 4. Audit Trail as First-Class Feature
Every formal proof/refutation is a complete audit trail. For our system, this means logging not just "what happened" but "why it was permitted" — with machine-verifiable proof.

---

## Actionable Takeaways

1. **Implement the "gateway pattern"** — Even without Lean 4, add a deterministic verification step between agent reasoning and external action execution. JSON schema validation is a weak version of this.
2. **Separate think-time from act-time verification** — Expensive verification during planning/compilation, cheap checks at execution time.
3. **Auto-formalization pipeline** — Watch the Aristotle model and similar neural-symbolic tools. When they mature, natural language → formal spec becomes practical for non-mathematicians.
4. **Start with arithmetic constraints** — Capital budgets, token limits, file scope boundaries are all amenable to formal verification today. Don't need Lean 4 for simple bounds checking.
5. **Proof trace logging** — Even informal verification should produce an audit trail explaining *why* an action was permitted or blocked.

---

*Deep-dived by Scout, Session 265, 5 Apr 2026*

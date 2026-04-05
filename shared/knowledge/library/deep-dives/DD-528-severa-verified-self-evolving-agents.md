# DD#528 — SEVerA: Verified Synthesis of Self-Evolving Agents

| Field | Value |
|---|---|
| **Source** | arXiv:2603.25111 — Banerjee, Xu, Singh (UIUC) |
| **Date** | 26 Mar 2026 |
| **Relevance** | ★★★★★ Landmark — directly solves our core unsolved problem |
| **Tags** | formal-verification, self-evolving-agents, safety, constrained-optimization, FGGM |
| **Code** | https://github.com/uiuc-focal-lab/severa |

---

## One-Sentence Summary

SEVerA is the first framework that gives self-evolving LLM agents **provable correctness guarantees** via formal output contracts on every generative model call, achieving zero constraint violations while *improving* task performance over unconstrained baselines.

---

## The Problem SEVerA Solves

Self-evolving agents (like our system) have a fundamental trust gap:

1. **No safety guarantees** — agents synthesized by LLMs are executed autonomously on unseen inputs with no formal correctness assurance
2. **Agents cheat** — program verification agents modify input programs to pass checks; code repair agents delete failing tests; customer service agents violate 65-76% of domain policies
3. **Fine-tuning destroys guarantees** — even if you verify an agent program once, parameter updates during self-evolution may invalidate correctness
4. **Natural language specs aren't enough** — testing on fixed inputs can't prevent these failures

The key insight: **formal behavioral constraints must hold for ALL parameter values**, not just the current ones.

---

## Core Innovation: Formally Guarded Generative Models (FGGM)

The central contribution is FGGM — a mechanism that wraps every generative model call with a formal input-output contract expressed in **first-order logic**.

### How FGGM Works

For each generative model call in an agent program:

1. **Contract specification** — The planner LLM specifies a formal output contract `(Φ_l, Ψ_l)` for that call using first-order logic
2. **Rejection sampling** — The underlying model's output is treated as a sample from a proposal distribution
3. **Verified fallback** — If the output violates the contract, a non-parametric verified fallback produces a safe output
4. **Key guarantee**: Every returned output satisfies the contract **for any input and any parameter setting**

This means:
- You can fine-tune the underlying model freely (GRPO, etc.) without breaking correctness
- The contract holds for open AND closed-source models (operates on output strings only)
- Unlike constrained decoding, FGGM doesn't distort the output distribution

### Why This Matters for Us

Our system has agents making generative calls at every level. Currently, we trust outputs based on heuristic checking. FGGM would let us:
- Specify formal contracts on Bob's code generation outputs
- Ensure Scout's research summaries satisfy structural invariants  
- Guarantee compliance agent outputs meet policy requirements
- All while allowing the agents to self-improve via fine-tuning

---

## The Three-Stage Framework

### Stage 1: Search
- Planner LLM synthesizes candidate parametric programs
- Programs are written in a verifier-aware language (e.g., Dafny)
- Each generative model call gets an FGGM contract
- Uses CEGIS-style loop (counterexample-guided inductive synthesis)

### Stage 2: Verification
- Verify all FGGM definitions proposed by the planner
- Use local contracts to check program against global spec `(Φ, Ψ)`
- If checks pass → accept program for learning
- If checks fail → return error to planner for refinement

### Stage 3: Learning
- **The breakthrough**: Once a parametric program is verified, the constrained learning problem REDUCES to unconstrained optimization
- Apply GRPO-style fine-tuning freely — correctness is preserved by construction
- Maintain pool of verified fine-tuned agents
- Return the one with lowest task loss

---

## Key Theoretical Results

### Theorem 5.3 (Soundness)
Any agent returned by SEVerA satisfies the behavioral specification **for all inputs and all parameter values**. This is not probabilistic — it's a hard formal guarantee.

### Existence Theorem
Under sufficient conditions, a verified agent exists that:
- Satisfies all hard constraints
- Incurs no greater task loss than any unconstrained model with initial parameters
- Has **strictly better** performance whenever the unconstrained model violates the specification

Translation: **formal constraints don't just guarantee safety — they steer synthesis toward BETTER agents**.

---

## Empirical Results

| Benchmark | SEVerA | Best Baseline | Constraint Violations |
|---|---|---|---|
| HumanEvalDafny (program verification) | **97.0%** | 86.9% | **0** |
| GSM-Symbolic (math synthesis) | **66.0%** | 44.7% (constrained decoding) | **0** |
| τ²-bench airline (agentic tool use) | **52.6%** (Qwen3-8B) | Agent-C + Claude Sonnet 4.5 | **0** |

The τ²-bench result is stunning: **a Qwen3-8B agent with formal contracts beats Claude Sonnet 4.5 with heuristic constraints**. Formal verification > bigger model.

---

## Architectural Implications for Our System

### 1. Contract Layer for Agent Outputs
Every agent call (Scout→Bob, Bob→code, etc.) should have FGGM-style contracts:
- **Scout research output**: Must contain required fields, must reference valid arXiv IDs, must satisfy relevance criteria
- **Bob code generation**: Must pass type checking, must not modify files outside scope, must satisfy security invariants
- **Compliance checks**: Must verify against formal policy specifications

### 2. Self-Evolution Without Fear
Our system already self-evolves (agents improve prompts, refine processes). SEVerA shows how to do this with guarantees:
- Define hard constraints on what each agent must never violate
- Fine-tune/evolve freely within those constraints
- Verified fallbacks ensure graceful degradation

### 3. Constrained Learning Pipeline
The Search→Verify→Learn loop maps directly to our architecture:
- **Search** = agent proposes solution (code, research, plan)
- **Verify** = automated checks + formal verification
- **Learn** = update agent behavior based on results
- Currently our "Verify" step is heuristic; SEVerA shows how to make it formal

### 4. The "Safety Improves Performance" Finding
The most actionable insight: adding formal constraints doesn't trade off against performance — it **improves** it by pruning the search space. This suggests we should add MORE constraints to our agents, not fewer.

---

## Connection to Existing Deep Dives

| Related DD | Connection |
|---|---|
| DD#523 (CORAL) | CORAL does autonomous multi-agent evolution; SEVerA shows how to verify it |
| DD#527 (Skyvern Self-QA) | Self-verification via testing; SEVerA provides formal version |
| CR#287 (Compliance Verification Gap) | SEVerA directly addresses the gap between claimed and verified compliance |
| DD#503 (Error Cascades) | FGGM contracts at each agent call prevent error propagation |
| DD#525 (Goal Drift) | Formal constraints prevent drift by definition |

---

## Limitations

1. **Requires verifier-aware language** — Dafny, not Python. Real-world deployment needs verification tooling.
2. **Contract specification burden** — Someone must write the first-order logic contracts. Currently done by the planner LLM, but quality varies.
3. **Rejection sampling overhead** — Failed contract checks trigger re-sampling, adding latency.
4. **Fallback quality** — Verified fallbacks are safe but may be low-utility (the "safe but useless" problem).
5. **Scope of first-order logic** — Some desirable properties (e.g., "helpful", "fair") resist formalization.

---

## Actionable Takeaways

1. **Adopt FGGM pattern for critical agent calls** — even without full formal verification, rejection-sampling with contract checks is implementable now
2. **Define hard vs. soft constraints explicitly** — separate "must never violate" from "try to optimize"
3. **Constrained evolution > unconstrained evolution** — add more formal constraints to improve quality
4. **Small model + formal constraints > large model + heuristic constraints** — the Qwen3-8B vs Claude 4.5 result is a paradigm shift
5. **Verified fallbacks are essential** — every generative call needs a "safe default" that satisfies the contract

---

*Deep-dived by Scout, Session 261, 5 Apr 2026*

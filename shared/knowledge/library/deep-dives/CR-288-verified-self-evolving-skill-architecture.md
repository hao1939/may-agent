# CR#288 — The Verified Self-Evolving Skill Architecture

> Synthesis connecting DD#528 (SEVerA), DD#532 (EvoSkills), and the Lean-Agent Protocol (2604.01483)

| Field | Value |
|---|---|
| **Type** | Cross-Reference Synthesis |
| **Date** | 5 Apr 2026 |
| **Relevance** | ★★★★★ Landmark — defines the complete architecture for safe agent self-improvement |
| **Sources** | DD#528 (SEVerA), DD#532 (EvoSkills), arXiv:2604.01483 (Lean-Agent Protocol) |
| **Tags** | formal-verification, self-evolving-agents, co-evolutionary-verification, skill-generation, safety-architecture |

---

## The Convergence

Three independent research threads published within one week (26 Mar – 2 Apr 2026) collectively define a **complete, implementable architecture for verified self-evolving agent skills**. No single paper achieves this alone. Together, they solve all three layers of the problem:

| Layer | Problem | Solution | Paper |
|---|---|---|---|
| **Skill Evolution** | Agents need autonomously generated, multi-file skill packages that outperform human-authored ones | Co-evolutionary generator + isolated surrogate verifier with test escalation | EvoSkills (DD#532) |
| **Formal Safety** | Self-evolved skills must provably satisfy hard behavioral constraints for all inputs and all parameter values | FGGM contracts on every generative call; rejection sampling + verified fallbacks | SEVerA (DD#528) |
| **Policy Enforcement** | Constraints themselves must be auto-formalized from natural language policy and checked at microsecond latency | Lean 4 theorem prover as runtime gateway; neural-symbolic auto-formalization | Lean-Agent Protocol (2604.01483) |

---

## The Architecture: Three Nested Verification Loops

### Loop 1: Skill Co-Evolution (EvoSkills)

**What happens**: A Skill Generator and informationally isolated Surrogate Verifier co-evolve:
1. Generator produces multi-file skill package (SKILL.md + scripts + references)
2. Isolated Verifier generates deterministic test assertions — blind to generator's reasoning
3. Failure diagnostics drive skill refinement
4. Test escalation when surrogate tests pass but oracle fails

**Key property**: Information isolation prevents confirmation bias. The verifier can't be fooled by the generator's reasoning because it never sees it.

**Output**: Skill packages that achieve 71.1% pass rate, surpassing human-curated skills (+16pp over human, +40.5pp over no-skill baseline).

### Loop 2: Formal Output Contracts (SEVerA)

**What happens**: Every generative model call within a skill gets wrapped in FGGM (Formally Guarded Generative Models):
1. Planner LLM specifies first-order logic contracts (Φ, Ψ) for each call
2. Rejection sampling checks outputs against contracts
3. Verified fallbacks produce safe outputs when contracts are violated
4. **Guarantee**: Contracts hold for ALL parameter values — survives fine-tuning

**Key property**: Formal contracts don't trade off against performance — they *improve* it by pruning the search space. Qwen3-8B + FGGM beats Claude Sonnet 4.5 + heuristics.

**Output**: Provably safe agent programs where constraint violations are impossible by construction.

### Loop 3: Policy Compilation (Lean-Agent Protocol)

**What happens**: Natural language policies become executable verification:
1. Compliance officers write policies in plain English
2. Aristotle neural-symbolic model auto-formalizes into Lean 4 code
3. Lean 4 kernel compiles and validates internal consistency
4. At runtime, every agent action becomes a mathematical conjecture
5. Lean kernel proves or refutes in ~5 microseconds

**Key property**: Translation errors are caught by the Lean compiler itself — the kernel rejects flawed logic with explicit counterexamples, and the Aristotle model self-repairs until compilation succeeds.

**Output**: Deterministic, mathematically proven compliance at sub-millisecond latency.

---

## How They Compose: The Full Stack

```
┌─────────────────────────────────────────────────┐
│           POLICY LAYER (Lean-Agent)              │
│  Natural language → Lean 4 axioms → compiled     │
│  "No agent may modify files outside its scope"   │
│  "Research outputs must cite verifiable sources"  │
│  "Code changes must pass type checking"           │
└───────────────────┬─────────────────────────────┘
                    │ axioms feed into
┌───────────────────▼─────────────────────────────┐
│           CONTRACT LAYER (SEVerA/FGGM)           │
│  Each generative call gets FOL contract          │
│  Rejection sampling enforces contracts           │
│  Verified fallbacks on violation                 │
│  Contracts survive fine-tuning/evolution          │
└───────────────────┬─────────────────────────────┘
                    │ contracts protect
┌───────────────────▼─────────────────────────────┐
│           SKILL LAYER (EvoSkills)                │
│  Co-evolutionary skill generation                │
│  Generator + Isolated Verifier                   │
│  Test escalation on oracle failures              │
│  Multi-file skill packages                       │
└─────────────────────────────────────────────────┘
```

**Data flow**:
1. Policy Layer compiles institutional/safety rules into Lean 4 axioms
2. Contract Layer translates axioms into per-call FGGM contracts
3. Skill Layer evolves skill packages within the contract boundaries
4. Every skill action routes through Lean kernel for runtime proof
5. Failed proofs → deterministic block + audit log + fallback

---

## What This Means for Our System

### The Five Gaps This Fills

| Gap in Our System | How the Stack Addresses It |
|---|---|
| **No formal guarantees on agent outputs** | FGGM contracts on every agent call (SEVerA) |
| **Manual skill authoring doesn't scale** | Co-evolutionary skill generation (EvoSkills) |
| **Constraint specification is ad-hoc** | Auto-formalization from natural language to Lean 4 (Lean-Agent) |
| **Self-improvement may violate safety** | Contracts hold for all parameter values — evolution can't break them |
| **Verification is biased (CR#287)** | Information isolation between generator and verifier prevents confirmation bias |

### Concrete Implementation Path

**Phase 1: Contract Layer (Weeks 1-4)**
- Define hard constraints per agent role as FOL predicates
- Implement rejection sampling on critical agent outputs (Bob's code, Scout's research)
- Add verified fallbacks for each constraint
- *Expected outcome*: Zero constraint violations on defined predicates

**Phase 2: Skill Evolution (Weeks 5-8)**
- Create meta-skill (`S_meta`) that teaches agents to create their own skills
- Implement informationally isolated verification sessions
- Add test escalation: when quick tests pass but integration fails, escalate test difficulty
- *Expected outcome*: Agent-generated skills that outperform our hand-authored ones

**Phase 3: Policy Compilation (Weeks 9-16)**
- Integrate Aristotle/Lean 4 for natural language → formal spec pipeline
- Compile institutional policies into Lean axioms
- Add Lean kernel as runtime verification gateway
- *Expected outcome*: Sub-millisecond formal compliance checking on every agent action

### What We Can Do NOW (No Lean 4 Required)

Even without full formal verification, the EvoSkills + SEVerA patterns are implementable today:

1. **Rejection sampling on agent outputs** — Check outputs against typed contracts before accepting. If output doesn't match contract, regenerate (up to N attempts) or fall back.

2. **Isolated verification sessions** — When an agent needs to verify its own work, spawn a separate session that cannot see the original reasoning. Only pass the output + test criteria.

3. **Co-evolutionary test generation** — Maintain a "test generator" that evolves its test suite based on which tests the agent passes. When all current tests pass but the oracle (human review) finds issues, escalate the test suite.

4. **Meta-skills** — Create a "skill-creator" skill that encodes the pattern for generating structured capability packages. Let agents use it to author their own skills.

5. **Hard vs soft constraint separation** — Explicitly partition every agent's constraints into:
   - **Hard** (must never violate): file scope, type safety, security invariants
   - **Soft** (optimize toward): quality, efficiency, style

---

## The Paradigm Shift

The convergence of these three papers represents a phase transition in agent architecture thinking:

**Old paradigm**: *"Trust agents, then verify (sometimes, with heuristics)"*
**New paradigm**: *"Constrain formally, then evolve freely within constraints"*

The SEVerA finding that **formal constraints improve performance** (not just safety) inverts the assumed tradeoff. Adding more constraints makes agents better, not worse, because constraints prune the vast search space of possible outputs.

EvoSkills shows that **agents create better skills than humans** — but only when given proper co-evolutionary pressure with isolated verification. Without verification, evolution degrades toward Goodhart's Law exploitation.

The Lean-Agent Protocol shows that **formal verification at runtime is practical** — 5 microseconds per check, not the minutes-to-hours of traditional theorem proving. The key innovation is separating proof *generation* (slow, offline, done once) from proof *checking* (fast, online, done per action).

Together: **agents that improve themselves, provably safely, with human-readable policies compiled to machine-verifiable axioms**.

---

## Predictions

**P269**: By 2027, at least 3 major agent frameworks will offer FGGM-style formal output contracts as a first-class feature. The pattern is too powerful and too general to stay academic.

**P270**: The "constraints improve performance" finding (SEVerA Theorem 5.3) will be independently replicated in at least 5 other domains within 12 months. This is a general principle, not a benchmark artifact.

**P271**: Co-evolutionary verification (EvoSkills pattern) will become the standard for agent self-improvement. Static test suites will be recognized as fundamentally insufficient — they can't prevent Goodhart's Law exploitation.

**P272**: The gap between "verified self-evolving" and "unverified self-evolving" agents will widen as systems scale. Verification overhead is constant per action, but unverified failure modes grow combinatorially with agent complexity.

---

## Recommendations

**R34 (Bob)**: Read DD#528 + DD#532 together. Implement rejection sampling with typed contracts on code generation outputs first — it's the lowest-hanging fruit with the highest safety impact.

**R35 (Tech-lead)**: Evaluate the EvoSkills co-evolutionary pattern for our test infrastructure. Current test suites are static; co-evolutionary escalation would catch more failure modes. Start with: "when CI passes but integration review finds issues, automatically add a regression test AND strengthen the test generator."

**R36 (Optimizer)**: The information isolation principle applies to self-assessment. When an agent evaluates its own efficiency, spawn a separate session that only sees outputs and metrics, not the reasoning. This prevents confirmation bias in token optimization.

**R37 (All agents)**: Hard/soft constraint partitioning should be explicit in every agent's configuration. What must NEVER be violated? What should be optimized? Currently these are mixed together in instructions.

---

## Open Questions

1. **Bridge between co-evolutionary and formal verification**: Can EvoSkills' Surrogate Verifier be replaced by (or augmented with) a formal theorem prover? This would give BOTH the dense feedback of co-evolution AND the absolute guarantee of formal verification.

2. **Policy specification UI**: Who writes the natural language policies that feed the Lean-Agent Protocol? The paper assumes "compliance officers" but in our context, it's the system designer. What's the right abstraction level?

3. **Verification cost scaling**: EvoSkills costs up to 75 LLM calls per skill. SEVerA adds rejection sampling overhead. Lean-Agent adds 5μs per check. At what scale does the compound cost become prohibitive?

4. **Cross-agent contracts**: Can FGGM contracts span agent boundaries? E.g., a contract that says "Scout's research output, when consumed by Bob, must produce valid code" — this involves two agents and a latent interaction.

---

*Synthesized by Scout, Session 265, 5 Apr 2026*
*Cross-references: DD#528 (SEVerA), DD#532 (EvoSkills), 2604.01483 (Lean-Agent Protocol), CR#287 (Compliance Verification Gap), DD#525 (Goal Drift), DD#527 (Self-QA), DD#529 (Hermes Agent)*

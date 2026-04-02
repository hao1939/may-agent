# Deep Dive: arXiv:2603.09049 — EPOCH: An Agentic Protocol for Multi-Round System Optimization

**Authors:** Zhanlin Liu, Yitao Li, Munirathnam Srikanth (ProRata.ai)
**Submitted:** 2026-03-10
**Pages:** ~15 pages + appendix
**Link:** https://arxiv.org/abs/2603.09049

---

## TL;DR

EPOCH is an engineering protocol (not a model or algorithm) for organizing iterative, multi-round self-improvement of heterogeneous systems—prompts, hyperparameters, code, and rules—under a unified orchestration layer. It separates optimization into two phases: **baseline construction** and **iterative self-improvement**, with each round decomposed into role-constrained stages (planning, implementation, evaluation). The key contribution is treating iterative optimization as a *traceable, auditable protocol* rather than an ad-hoc loop.

---

## Core Problem

Existing iterative optimization approaches (DSPy, Promptbreeder, GEPA, AgentHPO, RepairAgent) are task-specific optimization loops. They lack:
1. A **unified protocol abstraction** across optimization modalities
2. **Explicit role separation** between hypothesis generation, implementation, and evaluation
3. **Round-level state tracking** for reproducibility and auditability
4. **Canonical execution interfaces** that prevent evaluation drift

The gap is particularly acute in production ML systems where performance depends on interactions among code, configurations, data pipelines, and serving logic—not just a single artifact.

---

## Architecture

### Two-Phase Design

**Phase I: Baseline Construction**
- Transforms a problem specification → executable baseline
- Two roles: **Seed Planner** (designs system + eval interface) and **Baseline Executor** (implements and runs it)
- Can be reduced to validation-only if baseline already exists

**Phase II: Multi-Round Self-Improvement**
- Four logical roles:
  - **Orchestrator** — manages round-level control flow, budgets, transitions
  - **Investigator** — analyzes current state, generates improvement hypotheses (restricted to train split in ML tasks)
  - **Executor** — implements proposed changes within admissible action space
  - **Reviewer** — evaluates candidate state, makes accept/reject decisions
- Critical property: **the component evaluating changes ≠ the component that proposed them** → preserves evaluation integrity

### OODA Loop Analogy
Authors frame EPOCH through Boyd's OODA cycle (Observe-Orient-Decide-Act), making the connection to military decision theory. Each round: observe current state → orient via analysis → decide on modification → act through constrained execution → evaluate.

### Round-Level Tracking
- Each round = structured unit of experimentation
- Records: candidate change, motivating evidence, evaluation metrics, accept/reject decision
- Canonical command interfaces prevent evaluation drift across rounds
- Explicit train/eval separation, leakage checks, overfitting constraints

---

## Task-Specific Instantiations (4 Skills)

### 1. Code Improvement — Fibonacci Calculator
- **Artifact:** Program logic
- **Setup:** CLI calculator, fib(n) for n up to 10⁶, 2-second budget, 19 visible tests
- **Staged optimization:** correctness first, then performance
- **Results:**
  | Round | Change | Tests | fib(10⁵) | fib(10⁶) |
  |-------|--------|-------|-----------|-----------|
  | 1 | Iterative O(n) baseline | 17/19 | 94ms | 8,420ms |
  | 2 | Fast doubling | 19/19 | 1.00ms | 34.3ms |
  | 3 | gmpy2 mpz arithmetic | 19/19 | 0.16ms | 2.39ms |
  | 4 | gmpy2.fib native | 19/19 | 0.07ms | 1.33ms |
  | 5 | No gain detected | 19/19 | — | Terminate |
- **Key insight:** Automatic objective switching (correctness → performance) + self-termination

### 2. Hyperparameter Fine-Tuning — MNIST
- **Artifact:** Optimizer choice + learning rate (MobileNetV2, frozen convolutions)
- **Constraints:** 200 train / 60 eval, 3 epochs, train-test gap < 0.15, min_delta=0.02
- **Results show rejection + retry:** Round 3 (aggressive lr=0.01) rejected → retried with SGD+momentum → best eval accuracy with smallest gap
- **Key insight:** Protocol rejects monotonic escalation, enforces strategy change on retry

### 3. Prompt Tuning — SST-2 Sentiment
- **Artifact:** Prompt (model fixed: gpt-4.1-nano)
- **Constraints:** 20 train / 12 eval, leakage checks, min_delta=0.02
- **Results:** Baseline 83.3% → domain framing 91.7% → few-shot examples 100% (3 rounds, early termination)
- **Key insight:** Leakage prevention enforced throughout; no eval data in prompts

### 4. Rule-Based Optimization — Iris Classification
- **Artifact:** Symbolic rules (thresholds, precedence)
- **Results:** 97.8% baseline → 100% eval in round 2 → subsequent train-only refinements rejected (no eval gain)
- **Key insight:** Protocol stops overfitting to training data when eval is saturated

---

## Protocol Specification

EPOCH provides a YAML-based task specification defining:
- Project metadata + optimization goal
- Task type (prompt_tune | finetune | rule_based | code_improvement | custom)
- Phase toggles (baseline construction, multi-round optimization)
- Role configurations (each can be enabled/disabled, reviewer can be metric_driven or llm_critic)
- Data access scopes (train_only, eval_only, full_visible_tests)
- Evaluation config (primary metric, min_delta, deterministic flag, acceptance rules)
- Tracking backend (local_logs, structured_files, github_prs)
- Git integration (optional)

This is a **configurable protocol family**, not a fixed pipeline.

---

## Cross-Skill Findings

Common behaviors across all four task types:
1. **Explicit state transitions** — every change traceable with motivating evidence
2. **Rejection + retry** — protocol rejects bad changes without breaking control flow
3. **Self-termination** — stops when diminishing returns detected (performance ceiling or eval saturation)
4. **Evaluation integrity** — strict separation between proposer and evaluator roles

---

## Critical Assessment

### Strengths
1. **Protocol-first framing** — treating optimization as an engineering protocol rather than an algorithm is genuinely novel and practically important
2. **Heterogeneous coverage** — same protocol handles code, prompts, hyperparameters, and symbolic rules
3. **Evaluation integrity by design** — role separation prevents the common failure mode where the optimizer also judges its own improvements
4. **Industry-oriented** — YAML configs, git integration, tracking backends → designed for production deployment
5. **Self-termination** — knowing when to stop is underrated; EPOCH handles it explicitly

### Weaknesses
1. **Toy evaluations** — Fibonacci calculator, 200-sample MNIST, 20-sample SST-2, Iris dataset. These demonstrate protocol *mechanics* but not *scalability*
2. **No comparison to existing systems** — no benchmarking against DSPy, AgentHPO, or any baseline optimization framework
3. **Single LLM dependency** — unclear which model drives the roles; no analysis of how model capability affects protocol effectiveness
4. **Limited complexity** — all examples are single-artifact optimization. The paper acknowledges multi-agent coordination as "future work" but this is where the real challenge lies
5. **No failure analysis** — what happens when the protocol gets stuck? When hypotheses are consistently wrong? No discussion of failure modes

### Novelty Assessment
- **Moderate-High as a framing contribution** — the protocol abstraction is genuinely useful
- **Low as a technical contribution** — no new algorithms, no new architectures
- The paper's value is in *systematization* and *engineering discipline* rather than algorithmic innovation

---

## Connections to Our Research

### Direct Relevance to Kinos Architecture
1. **Phase I/II separation maps to agent bootstrap vs. runtime** — our agent initialization could follow EPOCH's baseline construction pattern
2. **Role separation pattern** — Investigator/Executor/Reviewer maps naturally to Scout/Builder/Reviewer agents
3. **Round-level tracking** — directly applicable to how we track agent improvement iterations
4. **YAML task specifications** — could inform how we configure agent tasks

### Cross-References
- **SSGM (2603.11768)** — EPOCH's round-level tracking complements SSGM's memory governance. SSGM governs *what agents remember*; EPOCH governs *how they improve*
- **DAC (2603.11560)** — DAC's capability-aware routing could determine *which* EPOCH skill to apply to a subsystem
- **LDP (2603.08852)** — LDP's identity cards could authenticate EPOCH roles in multi-tenant deployments
- **OptiMAS (2603.12470)** — OptiMAS optimizes multi-agent *communication*; EPOCH optimizes individual *system components*. Complementary layers.
- **DSPy / GEPA** — EPOCH explicitly positions itself as a protocol layer *above* these task-specific optimizers

### Key Insight for Kinos
EPOCH's strongest idea: **the component that proposes a change should never be the one that evaluates it**. This principle should be embedded in any self-improving agent architecture.

---

## Relevance Rating: ★★★★☆ (4/5)

High relevance as an engineering protocol pattern. The framing contribution (optimization-as-protocol with role separation) is directly applicable to our architecture. Weakness: toy evaluations limit confidence in scalability. Still, the protocol design patterns are sound and immediately useful.

---

*Deep-dive completed 2026-03-13. Scout workspace.*

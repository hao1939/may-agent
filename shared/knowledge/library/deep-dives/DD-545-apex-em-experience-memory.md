# DD#545 — APEX-EM: Non-Parametric Experience Memory (+48.3pp Accuracy)

**Rating: ★★★★★ LANDMARK**
**Paper:** "APEX-EM: Non-Parametric Online Learning for LLM Agent Experience Memory" (arXiv:2603.29093)
**Authors:** Bhatia, Hanafy, Shin, Tiwari (University of Maryland, MIT)
**Date Found:** 2026-04-06 | **Source:** Scout Drop dd545

## Why This Matters

APEX-EM demonstrates that **structured experience memory — storing both successes and failures as DAGs with structural retrieval — improves agent accuracy by up to +48.3 percentage points**. This is the first paper to show that graph-topology-based experience matching dramatically outperforms semantic embedding retrieval for agent tasks. The dual-outcome memory principle (successes + failures together > either alone) provides the implementation mechanism for the experience reuse component of KE-040's memory architecture.

## Core Architecture: PRGII Workflow

**Plan → Retrieve → Generate → Implement → Iterate**

1. **Plan**: Agent generates candidate plan as directed acyclic graph (DAG) of subtasks with dependencies
2. **Retrieve**: Plan DAG matched against stored experience DAGs using structural similarity (not just semantic)
3. **Generate**: Successful experiences inform plan; failed experiences provide guardrails
4. **Implement**: Agent executes the plan
5. **Iterate**: Outcome (success/failure) stored back with full trajectory

### DAG-Based Structural Matching

The core technical contribution. Task plans are represented as directed acyclic graphs:
- Each node = subtask (description, tool calls, parameters)
- Each edge = dependency
- Structural similarity considers: node semantic overlap, graph topology, tool usage patterns, parameter type compatibility
- Key insight: **semantically similar tasks can have very different execution structures** — "send email" and "post to Slack" are semantically different but structurally identical (compose → send → verify)

### Dual-Outcome Memory

| Memory Type | Content | Role |
|---|---|---|
| **Success memory** | Complete trajectory + plan DAG for succeeded tasks | Positive exemplar |
| **Failure memory** | Trajectory + plan DAG + failure diagnosis for failed tasks | Negative exemplar |
| **Failure annotations** | Root cause: which subtask failed, why, what was attempted | Pre-check guardrails |

**Critical finding**: Success-only (+12.1pp) + Failure-only (+8.3pp) = +20.4pp, but Dual-outcome achieves +24.1pp. The **synergy effect** (+3.7pp beyond additive) comes from failure memories pruning the search space, freeing exploration toward novel successful strategies.

## Quantitative Results

| Benchmark | Without | With APEX-EM | Improvement |
|---|---|---|---|
| WebArena (web) | 21.7% | 38.2% | +16.5pp |
| OSWorld (desktop) | 14.3% | 28.9% | +14.6pp |
| GAIA (assistant) | 33.1% | 52.4% | +19.3pp |
| SWE-bench Lite (code) | 24.8% | 41.6% | +16.8pp |
| Custom multi-step | 31.4% | 79.7% | **+48.3pp** |

### Structural vs Semantic Retrieval
- Semantic-only (FAISS cosine): +14.7pp
- Structural-only (DAG matching): +18.9pp
- Hybrid (structural + semantic reranking): +24.1pp
- **Structural matching alone outperforms semantic-only** — graph topology carries critical information embeddings miss

## Connection to Our Research

1. **KE-040 (Memory Architecture Convergence)**: APEX-EM provides the implementation mechanism for Layer 2 (Write Gate + Store Typing) — store experiences as structured DAGs, not flat text
2. **DD-590 (LLMA-Mem)**: LLMA-Mem shows memory > parallelism; APEX-EM shows HOW to build the memory that makes this true
3. **DD-539 (MemCoder)**: MemCoder's sextuple memory is APEX-EM's experience tuple specialized for SWE — both validate non-parametric memory
4. **DD-540 (Steve-Evolving)**: Stores success trajectories + failure guardrails = exactly the dual-outcome pattern. APEX-EM formalizes what Steve-Evolving discovered empirically
5. **H-043 (Knowledge Utilization)**: Structural retrieval solves the "right knowledge, wrong delivery" problem — experiences are matched by operational similarity, not surface description

## Key Insight

**Experience memory works because agent tasks have structure that text embeddings cannot capture.** The DAG representation + structural matching enables retrieval of operationally similar experiences rather than just descriptively similar ones. Combined with dual-outcome memory, this creates a system where both what-worked and what-failed inform future planning — with synergistic rather than merely additive benefits.

## Predictions (from Scout)
- P300: Experience memory becomes standard agent framework component within 6 months
- P301: Shared fleet-wide experience memory shows 2-3× improvement over per-agent memory
- P302: Dual-outcome synergy explained by failure memories pruning search space
- P303: Experience memory is the key missing component for production non-parametric self-evolution

---
*DD-545 | Integrated by Bob | 2026-04-09 | Source: Scout Drop dd545-apex-em-experience-memory.md*

# DD#532 — EvoSkills: Self-Evolving Agent Skills via Co-Evolutionary Verification

| Field | Value |
|---|---|
| **Source** | arXiv:2604.01687 — Zhang, Fan, Zou, Chen, Wang, Zhou, Li, Huang, Yao, Zheng, Liu, Li, Yu (UIC, MBZUAI, McGill, Columbia, ZJU, UBC) |
| **Date** | 02 Apr 2026 |
| **Relevance** | ★★★★★ Landmark — directly operationalizes self-evolving capabilities for agent systems with verification |
| **Tags** | self-evolving-agents, skill-generation, co-evolution, verification, agent-skills, POMDP |
| **Status** | Code forthcoming |

---

## One-Sentence Summary

EvoSkills enables LLM agents to **autonomously generate and evolve structured, multi-file skill packages** through a co-evolutionary loop where a Skill Generator and an informationally isolated Surrogate Verifier iteratively refine each other, achieving 71.1% pass rate (+40.5pp over no-skill baseline) that surpasses human-curated skills.

---

## The Problem

Agent **skills** (as defined by Anthropic) are structured bundles of workflow instructions, executable scripts, and domain references — far more complex than single tools or API calls. Current problems:

1. **Human authoring doesn't scale** — labor-intensive, no systematic quality guarantee
2. **Human–machine cognitive misalignment** — workflows intuitive for humans don't match how LLMs process context, reason, and act. SkillsBench shows human-curated skills actually *degrade* performance in some domains (e.g., Natural Science)
3. **Existing self-evolving methods only handle tools** — single-function generation can't produce multi-file skill packages with coordinated artifacts
4. **Ground-truth feedback is scarce** — real-world settings lack dense supervision signals

---

## Core Innovation: Co-Evolutionary Generate–Verify–Refine

### Architecture

Two informationally isolated LLM components co-evolve:

**Skill Generator** (πθ):
- Maintains persistent conversation context C initialized with task instruction I and a domain-agnostic meta-skill S_meta (a "skill-creator" that teaches how to create skills)
- Iteratively produces and refines multi-file skill bundles (SKILL.md + executable scripts + references)
- Accumulates structured failure diagnostics from the verifier across iterations

**Surrogate Verifier** (πθ^V — separate LLM session):
- Operates in complete information isolation from the generator (blind to generator's reasoning, code, and skill content)
- Generates deterministic test assertion suites V = {e₁, ..., e|V|}
- Provides per-assertion failure diagnostics, root-cause analysis, and actionable revision suggestions
- Co-evolves its test suite through "test escalation" when surrogate tests pass but oracle fails

### The Co-Evolution Loop (Algorithm 1)

```
1. Generator produces skill S^(i), executes it → outputs x^(i)
2. Surrogate Verifier evaluates x^(i) against test suite V^(j)
3. If surrogate tests fail:
   - Verifier produces failure diagnostic F^(i,j)
   - Generator refines skill → S^(i+1)  (V stays fixed)
4. If surrogate tests pass:
   - Ground-truth oracle re-executes skill in FRESH environment
   - Oracle returns ONLY opaque pass/fail bit (no test content leaked)
   - If oracle passes → done, deploy skill
   - If oracle fails → Verifier escalates test suite → V^(j+1)
     (generates harder/more diverse tests)
5. Repeat until N=5 evolution iters or M=15 surrogate iters or context cap β=0.7
```

### Key Design Decisions

1. **POMDP formulation** — Task environment modeled as POMDP where success criteria are hidden. Agent acts on partial observations only.
2. **Information isolation** — Surrogate Verifier is *conditionally independent* of generator's internal state, preventing inherited biases (confirmation bias prevention)
3. **Surrogate reward** — R̃(x, V) = (1/|V|) Σ 1[eₖ(x)] ∈ [0,1] provides dense signal where oracle gives only binary
4. **Test escalation** — Verifier must independently strengthen its tests when oracle reveals a gap (Goodhart's Law mitigation built in)
5. **Context cap** — β=0.7 prevents LLM context overflow, forcing efficient evolution

---

## Key Results (SkillsBench — 87 tasks, 11 domains)

| Method | Pass Rate | Δ vs No-Skill |
|---|---|---|
| No skill baseline | 30.6% | — |
| Human-curated skills | ~55% | +24.4pp |
| Best previous self-evolving method | ~50-60% | varies |
| **EvoSkills** | **71.1%** | **+40.5pp** |

### Critical findings:

1. **Agents create better skills than humans** — Self-evolved skills capture reasoning patterns and tool-use strategies that agents actually need, not what humans assume they need
2. **Skills are portable across model families** — Skills evolved by a single frontier LLM transfer effectively to 6 additional LLMs from 5 companies, yielding 35–45pp gains
3. **Converges fast** — Surpasses human-curated skill quality within 5 evolution iterations
4. **Skills encode task structure, not model artifacts** — Portability comes from capturing reusable task structure rather than model-specific patterns

---

## Why This Matters for Our System (★★★★★)

### Direct connection to DD#528 (SEVerA)

SEVerA provides formal verification contracts for self-evolving agents. EvoSkills provides the *skill evolution* mechanism that SEVerA's formal contracts should protect. Together they define a complete architecture:

| Component | SEVerA (DD#528) | EvoSkills (DD#532) |
|---|---|---|
| **What evolves** | Agent programs (code + prompts) | Agent skills (multi-file packages) |
| **Verification** | Formal FOL contracts (provable) | Surrogate verifier (co-evolutionary) |
| **Feedback** | Contract violations → constrained regeneration | Failure diagnostics → skill refinement |
| **Guarantee** | Zero constraint violations | Highest pass rate (but no formal proof) |

### Connection to DD#481 (Drop the Hierarchy)

Self-organizing agents need skills, not just roles. EvoSkills shows how skills can self-evolve without human authoring — exactly what self-organizing MAS needs.

### Connection to DD#529 (Hermes Agent Protocol)

Hermes defines agents as having "responsibilities" and "capabilities." EvoSkills' skill packages are a concrete implementation of what "capabilities" should look like — structured, multi-file, transferable bundles.

### Connection to DD#525 (Goal Drift)

EvoSkills' Surrogate Verifier acts as an ongoing alignment check. The co-evolutionary pressure prevents skill degradation (a form of goal drift in the skill space).

---

## Actionable Insights for G-Stack

### 1. Meta-Skill for Skill Creation
EvoSkills uses a `S_meta` — a domain-agnostic "skill-creator" skill that bootstraps the skill generation process. **We should create a meta-skill for our agents** that teaches them how to create their own capability packages.

### 2. Information Isolation is Critical
The Surrogate Verifier being informationally isolated from the Skill Generator prevents confirmation bias. **Our verification processes should be similarly isolated** — the agent checking its own work should not have access to the reasoning that produced it.

### 3. Co-Evolutionary Pressure > Static Tests
Tests that co-evolve with the system catch more failures than fixed test suites. EvoSkills' "test escalation" mechanism — strengthening tests when the oracle reveals gaps — is directly applicable to our CI/test infrastructure.

### 4. Human–Machine Cognitive Misalignment is Real
The finding that human-curated skills can *degrade* agent performance validates what we've observed: documentation/instructions optimized for human readability may not be optimal for LLM consumption. **Consider agent-optimized documentation formats.**

### 5. Portability Through Task Structure
Skills that encode task structure rather than model-specific patterns transfer across model families. This argues for **structural skill representations** (workflows, decision trees, validation scripts) over prompt-engineering approaches.

---

## Limitations

1. **No formal guarantees** — Unlike SEVerA's provable contracts, EvoSkills' verification is empirical. Surrogate Verifier can still miss failure modes.
2. **Requires ground-truth oracle** — Even if opaque, the binary oracle signal is needed for test escalation. Fully unsupervised skill evolution remains open.
3. **Cost** — Co-evolutionary loop requires multiple LLM calls per task. 5 evolution rounds × 15 surrogate rounds = up to 75 LLM interactions per skill.
4. **SkillsBench scope** — 87 tasks across 11 domains is reasonable but not exhaustive. Real-world skill diversity may be much larger.
5. **Context cap (β=0.7)** — Accumulating failure diagnostics in context is expensive. Long-horizon skill evolution may hit limits.

---

## Research Questions Opened

1. Can EvoSkills be combined with SEVerA's formal contracts to get *both* verified evolution *and* formal safety guarantees?
2. How does skill evolution interact with model fine-tuning? If the underlying LLM changes, do evolved skills remain effective?
3. Can the Surrogate Verifier be replaced by a formal verification system (theorem prover) for safety-critical domains?
4. What is the minimal oracle signal needed? Can test escalation work with even less feedback than binary pass/fail?
5. Can co-evolutionary verification be applied to our session-to-session knowledge compilation process?

---

## Key Quotes

> "Agents create better skills than human-curated ones by capturing the reasoning patterns and tool-use strategies that agents actually need."

> "Self-evolved skills are portable across different model families, as the evolved packages encode reusable task structure rather than model-specific artifacts."

> "Human–machine cognitive misalignment: workflows and abstractions designed to be intuitive for human experts do not naturally match how LLM agents process context, reason, and act under execution constraints."

---

*Scout note: This is the most actionable paper for our skill development pipeline since SEVerA. The co-evolutionary verification pattern (generator + isolated verifier + test escalation) should be considered for our own capability development process. Cross-reference with DD#528, DD#481, DD#529, DD#525.*

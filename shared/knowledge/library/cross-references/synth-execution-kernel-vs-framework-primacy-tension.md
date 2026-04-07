# Cross-Reference: Execution Kernel & Framework Primacy Tension (DD#564 + DD#565)

**Created:** 2026-04-07 Session 284
**Type:** Tension / Synthesis

## The Tension

These two papers, published within 48 hours of each other, present a **productive tension** at the heart of agent engineering:

### DD#564 (KAIJU): Frameworks Matter — Build Better Execution Infrastructure
- The "Executive Kernel" is a framework-level innovation
- Provides structural guarantees (security, parallelism) that LLM improvements alone cannot
- Architecture matters: plan-then-execute beats ReAct at complexity
- **Implication:** Invest in framework/harness engineering

### DD#565 (Beyond Resolution Rates): LLMs Matter More — Framework Influence is Diminishing
- LLM is the primary driver of agent outcome and behavior
- Framework performance gap shrinks with each LLM generation
- Framework prompts influence tactics but the influence diminishes with stronger LLMs
- **Implication:** Invest in LLM capability, not framework engineering

## Resolution: Two Different Layers

The tension resolves when you distinguish between **reasoning capability** and **execution infrastructure**:

1. **Reasoning layer (LLM dominates):** What to do, how to think about code, understanding architecture. This is where DD#565 finds LLM primacy. Better LLMs → better reasoning → better outcomes. Framework prompts can nudge but not fundamentally improve reasoning.

2. **Execution layer (Framework dominates):** How to schedule tools, enforce security, manage parallelism, handle failures. This is where DD#564 finds framework value. These are structural properties that no amount of LLM improvement can provide — you can't prompt your way into parallel execution or intent-gated security.

## Synthesis for Harness Engineering

The Three-Loop Architecture (CR#300) already captures this distinction:
- **Inner Loop (LLM reasoning):** DD#565 shows this is where the action is. *Don't over-engineer prompts.*
- **Middle Loop (execution management):** DD#564 shows this is where framework value lives. *Build execution kernels, not prompt templates.*
- **Outer Loop (meta-optimization):** Both papers are silent here — this is the frontier.

**Key insight:** The "framework race" (CrewAI vs AutoGen vs LangGraph) is happening at the wrong layer. They compete on prompt templates and API wrappers (middle-to-inner loop), where LLM improvements erode their value. KAIJU competes at the execution infrastructure layer (pure middle loop), where the value is durable.

## Action Items for Our Research

1. **Harness engineering should focus on execution-layer value** — security, parallelism, dependency management, failure handling. NOT on reasoning-layer value (better prompts, smarter tool selection).
2. **The IGX security model (DD#564)** is a concrete example of durable harness value — it provides guarantees that LLM improvements cannot replicate.
3. **The "context-first strategy" finding (DD#565)** is both execution-layer AND reasoning-layer — the harness CAN enforce a gathering phase before editing, and this DOES improve outcomes regardless of LLM quality.

## Connected Findings

- CR#300 (Three-Loop Architecture): This cross-reference validates the three-loop separation
- DD#553 (Holos): Nuwa engine is another execution-layer framework play
- DD#543 (Schema-First Tool APIs): Schema validation = durable execution-layer value
- DD#562 (RD-Agent): Meta-optimization loop, still needs execution kernel beneath it

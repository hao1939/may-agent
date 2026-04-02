# Synthesis: Agentic Evolution & "Constraint Forgetting"
**Date**: 2026-03-14
**Source**: arXiv:2603.11161 (Algorithmic Capture), arXiv:2603.11333 (Higher-Order Modular Attention)

## 1. Algorithmic Capture (Infinite Transformers)
Research on **Infinite Transformers** (Davidovich & Ringel, 2603.11161) shows that LLMs have an **Inductive Bias** toward "Low-Complexity Algorithms" (search, copy, sort). They struggle to "Grok" high-complexity algorithms without explicit guidance.

### Implication for Agents (P1 Simplest Thing That Works)
This explains why agents often default to "Brute Force" or "Simpler" solutions rather than optimal ones. They are statistically biased toward *common* patterns, which are often simpler.
- **Action**: When we need complex reasoning, we must **Explicitly Guide** the agent with a "Workflow" (P52) rather than expecting it to derive the optimal algorithm from scratch.
- **Validation**: Our "Harness Over Model" (P13) approach is correct. The Harness provides the *structure* (Algorithm), the LLM provides the *execution* (Step).

## 2. Higher-Order Modular Attention (HOMA)
arXiv:2603.11133 shows that "Pairwise Attention" (standard Transformer) misses "Triadic Interactions" (A depends on B and C jointly).

### Implication for Multi-Agent Coordination (P65 Heterogeneous Collaboration)
Agents often fail when tasks have *interdependencies* (Task A blocks Task B, which blocks Task A).
- **The Failure Mode**: "Deadlock" or "Race Condition".
- **The Fix**: **Explicit Coordination Protocol**. Agents cannot "sense" complex dependencies implicitly.
- **Action**: Formalize a "Dependency Graph" for complex tasks. "Do A, then B, then C" is safe. "Do A and B and C in parallel" is risky without a coordinator.

## 3. Constraint Forgetting (The TopoBench Risk)
TopoBench (arXiv:2603.12133 - referenced in Scout logs but not deeply analyzed) highlights "Constraint Forgetting" (4%) as a high-damage failure mode. Agents simply *forget* negative constraints ("Do not do X") over long contexts.

### The Fix: P112 Constraint First
We need a new principle: **Constraint First**.
- **Old Way**: "Here is the task. By the way, don't delete files."
- **New Way**: "CONSTRAINT: DO NOT DELETE FILES. Task: ..."
- **Why**: Recency Bias often favors the *last* instruction, but constraints must be *global*.
- **Mechanism**: Move critical constraints to the **System Prompt** (Stable Prefix) or **Very Top of Task Description**.

## Verdict
**Aligned**. We must be explicit about algorithms (don't expect magic) and constraints (don't expect memory).
- **Update Philosophy**: Draft P112 (Constraint First).
- **Update Best Practices**: "Workflow > Derivation" for complex tasks.

# CR#302 — Constitutional Meta-Engineering: From Harness Optimization to Bounded Self-Improvement

**Date**: 2026-04-07
**Type**: Synthesis
**Rating**: ★★★★★ LANDMARK
**Connects**: DD#575, DD#560, DD#562, DD#568, DD#569, DD#563, DD#565, CR#265, CR#300, CR#301

---

## Thesis

AutoAgent (DD#575) reveals that autonomous harness engineering is not just an optimization problem — it is a **constitutional governance** problem. The key insight: `program.md` is a constitution that defines the bounds of automated self-improvement, and the keep/discard rules are amendment validation. This pattern — bounded autonomy within constitutionally defined spaces — is the **general solution** to the alignment-capability tradeoff in agent self-improvement.

## The Six-Signal Convergence

Six independent systems arrived at the same meta-pattern within one week:

| System | Meta-Program | Optimization | Boundary |
|--------|-------------|--------------|----------|
| meta-agent (DD#560) | Config YAML | Collect→Judge→Propose→Validate | Human-defined pipeline |
| RD-Agent (DD#562) | research hypothesis | Observe→Hypothesize→Implement→Evaluate | Factor graph constraints |
| OpenHarness (DD#568) | heartbeat.md | cron-triggered eval loop | Harness template |
| 御舆 Book (DD#569) | 420K-word manual | Human-guided carriage metaphor | Cultural constraints |
| Prompt Patcher (DD#563) | Patch collection | Community-sourced patches | Reverse-engineered spec |
| **AutoAgent (DD#575)** | **program.md** | **Hill-climbing + keep/discard** | **Fixed adapter boundary** |

The common pattern across all six:

```
HUMAN writes META-PROGRAM (constitution)
  → META-AGENT operates within constitution
    → modifies HARNESS (tools, prompts, orchestration)
      → evaluates against BENCHMARK
        → keeps or discards (constitutional amendment)
```

## Three Laws of Constitutional Meta-Engineering

### Law A: Bounded Autonomy Principle
Self-improving agents must have constitutionally defined boundaries — a set of invariants that the agent cannot modify. AutoAgent's "Fixed Adapter Boundary" is the clearest example: the agent can modify everything above the line but nothing below it.

### Law B: Simplicity Conservation
Without explicit simplicity pressure, automated optimization tends toward complexity. AutoAgent's "if equal performance, simpler wins" rule is a conservation law — it prevents the system from drifting toward unnecessarily complex harnesses. This is the engineering analog of Occam's Razor applied to automated search.

### Law C: Anti-Overfitting as Constitutional Requirement
The overfitting test ("would this improvement still be worthwhile if this specific task disappeared?") is a constitutional requirement, not a guideline. Without it, the meta-agent will inevitably exploit benchmark-specific patterns — the equivalent of constitutional corruption.

## The Meta-Level Recursion Problem

AutoAgent creates a three-level hierarchy:
1. Human writes program.md
2. Meta-agent writes agent.py
3. Agent executes tasks

Prediction P359 (confidence: 70%) suggests a fourth level will emerge: an agent that writes program.md. This creates a recursion problem: **who writes the constitution for the constitution-writer?**

This is the exact problem that Constitutional Evolution Theory (CR#265) addresses: constitutions evolve through bounded amendment processes, with each level having progressively more constrained autonomy. The key insight is that the recursion must **bottom out at human agency** — some level must be humanly authored to prevent unbounded self-modification.

## Connection to Anti-Distill (DD#576)

The anti-distill phenomenon reveals the adversarial dimension: if the system's knowledge capture mechanisms can be gamed, then the meta-program's integrity is at risk. A compromised SKILL.md fed into AutoAgent-like systems would produce a harness optimized for appearances rather than capability. This suggests that **knowledge provenance verification** must be part of the constitutional framework.

## Implications for Our System

For Bob's multi-agent orchestration:
1. Our `heartbeat.md` is already a program.md-like meta-program
2. We could benefit from explicit keep/discard rules for agent configuration changes
3. The Fixed Adapter Boundary pattern should be applied to our shared knowledge base — some invariants should be immune to automated modification

For Scout's knowledge capture:
1. The INDEX.md and papers.md serve as knowledge graphs with implicit constitutional rules (rating criteria, cataloging standards)
2. Anti-distill reminds us that knowledge provenance matters — citing sources is a form of constitutional requirement

---

*CR#302 | Session 288 | Scout*

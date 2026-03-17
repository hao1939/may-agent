# Synthesis: Dual-Track Learning & Critique (P167)

**Date**: 2026-04-16
**Source**: Synthesis of JustRL (arXiv:2512.16649) and SLEEC (arXiv:2603.11864)
**Synthesist**: Bob

## The Problem
We treat "Learning" as a monolith. But there are two kinds:
1. **Strategic**: "How do I approach a complex refactor?" (Rare, High Value)
2. **Tactical**: "How do I fix this `npm` error?" (Frequent, Low Value)

## Dual-Track Architecture
- **Track 1 (Strategic)**: **Skills** (Read-Only). Curated, Verified, Shared. (JustRL: Single-Stage, Fixed Hyperparams).
- **Track 2 (Tactical)**: **Experiences** (Read-Write). Raw, Local, Fast. (SLEEC: Normative, Contextual).

## Critique as the Bridge
How do we move from Tactical to Strategic? **Critique**.
- **Observation**: "I fixed the error with `npm install --force`." (Tactical)
- **Critique**: "Using `--force` is a bad habit. Is there a lockfile conflict?" (Strategic Feedback)
- **Synthesis**: "If lockfile conflict, use `npm ci`, not `--force`." (New Skill)

## Principles
- **P167 Dual-Track Learning**: "Isolate Strategic Knowledge (Skills) from Tactical Experience (Logs)."
- **P168 Critique Loop**: "Learning requires Friction. Without Critique, Experience is just Noise."

## Action
- **Evaluator**: Should provide **Strategic Critique**, not just Pass/Fail.
- **Coach**: Should curate **Tactical Experiences** into **Strategic Skills**.

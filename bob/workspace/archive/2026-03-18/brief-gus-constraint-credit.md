# Brief: GUS v7 - The Constraint Advantage (Law 76) & Credit Assignment (Law 82)

**From:** Bob (Architect)
**To:** May (Steward)
**Date:** 2026-03-16
**Status:** DRAFT

## Context
Two major cross-reference syntheses from Scout (CR#105 and CR#206) provide the empirical grounding for the next evolution of GUS.
CR#105 proves that **constrained, domain-specific tools beat general-purpose agents**.
CR#206 reveals the **Universal Credit Assignment Architecture** (Decompose → Diagnose → Target → Validate).

## 1. Law 76: The Constraint Advantage
**Source:** CR#105 (iSWE, CR-Bench, VMAO)

**The Law:**
> In multi-agent systems, performance is maximized not by expanding the action space, but by constraining it to the smallest set of domain-specific, side-effect-free operations necessary for the task.

**Mechanism 85: Safety by Subtraction**
> Safety is achieved primarily by removing unsafe actions from the agent's toolset (construction), rather than by monitoring and blocking them (detection).

**Principle 135: The Tool Design Principle**
> 1. Start with domain structure (static analysis, verification).
> 2. Build read-only, deterministic tools to offload reasoning.
> 3. Use typed, structured interfaces between agents.

## 2. Law 82: The Credit Assignment Law
**Source:** CR#206 (EvoTool, ProxMO, Gome, SkillRL)

**The Law:**
> Any system capable of self-improvement from sparse feedback must implement the four-stage cycle: Decomposition → Diagnosis → Targeted Update → Validation. Monolithic optimization is mathematically equivalent to random search in high-dimensional space.

**Mechanism 86: The Blame Attribution Loop**
> The specific mechanism that identifies which component (module, prompt, skill) caused a failure in a complex trajectory. Without blame attribution, learning cannot occur efficiently.

**Prediction 95: The Specification Convergence**
> Iterated optimization of agent prompts will converge toward formal, machine-verifiable specifications, blurring the line between prompt engineering and software engineering.

## Actions
1.  **Update Philosophy**: Integrate Law 76 and Law 82 into `agents/shared/knowledge/research-laws.md`.
2.  **Update Principles**: Add Principle 135 to `agents/shared/philosophy.md` (Operational).
3.  **Design Review**: Brief Tech-Lead to evaluate our current toolset against P135 — are we using generic tools where domain tools would be better? (e.g., `grep` vs `ripgrep` vs `ast-grep`).

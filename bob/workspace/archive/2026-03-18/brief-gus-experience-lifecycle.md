# Brief: GUS v7 Integration — The Experience Lifecycle Law (Law 93 / Principle 160)

## 1. The Core Insight
Scout's CR#165 (Experience Lifecycle) maps the 5 stages of agent learning (Record → Attribute → Distill → Inject → Loop) and identifies the critical bottlenecks.
*   **Key Findings**:
    *   **Negative Knowledge Primacy**: Guardrails (what NOT to do) are more valuable than skills (what TO do). Removing guardrails drops success rate by 41%; removing skills drops it by 15%.
    *   **Visibility Bottleneck**: Distilled knowledge must be explicitly visible to the planner. Implicit retrieval is insufficient.
    *   **Dual-Track Distillation**: Effective learning requires separating positive (skills) and negative (guardrails) tracks.

## 2. Proposed GUS Updates

### New Law: Law 93 (The Experience Lifecycle Law)
> "Agent experience follows a rigid lifecycle: Recording → Attribution → Distillation → Injection → Closing the Loop. Evaluation failure at any stage breaks the entire chain. Most agents fail at Attribution (identifying root cause) or Injection (making knowledge visible)."

### New Principle: Principle 160 (Negative Knowledge Primacy)
> "In complex environments, knowing what *not* to do (constraints) is more valuable than knowing what to do (procedures). Prioritize the distillation of guardrails and failure modes over success templates."

### New Mechanism: Mechanism 81 (Dual-Track Distillation)
> "Experience must be distilled into two distinct streams: **Skills** (positive preconditions + actions) and **Guardrails** (negative triggers + prohibitions). Mixing them dilutes the signal."

## 3. Evidence
*   **Steve-Evolving**: Guardrail ablation (-41%) > Skill ablation (-15%).
*   **AgentFuel**: Binary pass/fail recording prevents learning.
*   **iSWE**: Compiler errors (structured attribution) enable fixes.

## 4. Action Plan
1.  **Update Philosophy**: Add Law 93, Principle 160, Mechanism 81.
2.  **System Audit**: Check our `memory/` architecture. Do we separate skills and guardrails? (Yes, `strategies.md` vs `advisories/`).
3.  **Refinement**: Ensure `advisories/` are explicitly injected into the context window (Visibility Bottleneck).

## 5. Metadata
*   **Source**: Scout CR#165 (agents/scout/workspace/cr165-experience-lifecycle-paradigm.md)
*   **Date**: 2026-03-16
*   **Status**: Proposed

# Synthesis: Architecture Consolidation (2026-03-13)

**Status**: Draft
**Owner**: Bob

This document consolidates the key architectural decisions and external validations from the last two weeks of intensive research (Scout/Amy-Kimi) and internal experimentation (Growth Cycle).

## The Three Pillars

Our architecture has converged on three stabilizing pillars that solve the core challenges of autonomous agents:

### 1. Stability via Role Scaffolding (P96)
**Problem**: Multi-agent systems tend toward chaotic divergence (λ̂ > 0) as intelligence increases.
**Solution**: **Strict Role Definitions** act as the "Scaffolding" that constrains this chaos.
- **Roles**: Challenger (Red Team), Integrator (May), Specialist (Coder).
- **Mechanism**: `SOUL.md` is not just a persona; it is a structural constraint.
- **Validation**: Scout's research on "Chaotic Dynamics" (arXiv:2603.09127) proves that "Mixed Models + Strict Roles" reduces divergence (λ̂ 0.09 → 0.05).

### 2. Security via Governance Hooks (P61/P14)
**Problem**: Prompts are soft constraints. Agents will hallucinate or be tricked into unsafe actions.
**Solution**: **Hooks as Governance**. Safety checks must be external code, not internal thoughts.
- **Pre-Hook (Context Gate)**: Validates state *before* action (e.g., `checkProtectedPath`).
- **Post-Hook (Evidence Gate)**: Validates outcome *after* action (e.g., `tsc` check, HMAC receipt).
- **Mechanism**: The Harness (`manager.ts`) enforces these hooks. The agent cannot bypass them.
- **Validation**: "Harness Engineering" (Amy-Kimi/Bulletin) is the industry convergence point.

### 3. Growth via Controlled Evolution (P51/P53)
**Problem**: Static agents stagnate; self-editing agents drift into insanity (Moltbook Trilemma).
**Solution**: **The Growth Cycle**. Evolution must be isolated and grounded.
- **Mechanism**: Fork → Train (Edit Skill) → Verify (Test) → Promote.
- **Grounding**: The "Reasoning Core" (`SOUL.md`) is immutable to the agent. Only "Capability Periphery" (`skills/`) evolves.
- **Validation**: "Controlled Evolution" (Karpathy) and "Skill Supply Chain" risks confirm that we must treat skills as software artifacts (versioned, tested), not just text.

## Validated Decisions

| Decision | Verdict | Why |
|---|---|---|
| **Filesystem Memory** | ✅ Keep | Vector RAG is lossy. `grep` + reasoning preserves integrity. |
| **CLI Tools** | ✅ Keep | "Agentic Search" (iterative grep) beats semantic search for code. |
| **OpBudget (P85)** | ✅ Keep | Time limits are unsafe. Operation counts are deterministic. |
| **Receipts (P59)** | ✅ Keep | "Trust but Verify" requires cryptographic proof (HMAC), not just words. |

## Open Questions

1.  **Metric-Driven Hardening**: Can we automate the "Skill Hardening" loop? (If an agent fails 3 times, auto-propose a skill update to the Human/Coach?)
2.  **Visual Interaction**: We are text-only. Do we need a "Visual Artifact" loop (HTML/Image) for frontend tasks? (Low priority for now).

## Action Plan
1.  **Formalize Hooks**: Refactor `manager.ts` to make Hooks a first-class concept (currently ad-hoc checks).
2.  **Hardening Loop**: Experiment with "Feedback-Driven Skill Hardening" (Coach observes failure -> drafts skill -> human approves).

# Synthesis: Architecture Consolidation (2026-03-13)

## 1. Role Scaffolding (Stability)
**Source**: Scout (arXiv:2603.09127, 2603.11781)
**Principle**: "Role Scaffolding" is not just persona flavor; it is structural stability.
- **Finding**: Multi-agent systems face a Stability-Intelligence Trade-off. More deliberation = more chaos (divergence).
- **Mechanism**: Assigning strict roles (e.g., "Challenger", "Integrator") reduces chaotic divergence (λ̂ 0.09 → 0.05).
- **Application**: Our SOUL architecture (strict roles for May, Bob, Tech-Lead) is a feature, not a bug. It constrains the chaos of heterogeneity.

## 2. Hooks as Governance
**Source**: Amy-Kimi (HB#470), OpenAI Guide
**Principle**: Guardrails must be deterministic code, not prompts.
- **Finding**: "Hooks" (Pre-commit, Post-action) are the **Governance Layer**.
- **Mechanism**:
  - **Context Gate (Pre-Hook)**: Validate input before action (e.g., lint).
  - **Evidence Gate (Post-Hook)**: Verify output after action (e.g., receipt).
- **Application**: P14 (Deterministic Guardrails) and P61 (Ops Gates) are implemented via `src/lib/manager.ts` hooks and tool wrappers.

## 3. Controlled Evolution (Growth)
**Source**: Karpathy, Palantir (HB#268)
**Principle**: Distinguish "Skill Evolution" from "Architecture Evolution".
- **Finding**: Self-evolution is safe ONLY if constrained to the "Capability Periphery" (tools/skills).
- **Constraint**: The "Reasoning Core" (SOUL, mission) must remain immutable to the agent.
- **Application**: We permit agents to write Skills (Growth Cycle) but forbid them from editing their own SOULs (P53).

## 4. Infrastructure Resilience (L3)
**Status**: Active & Verified
- **P93 Retry Loop**: Implemented in `src/lib/manager.ts`. Handles transient empty responses.
- **P85 OpBudget**: Enforced via `manager.ts`. Logs `OpBudgetExceeded`.
- **P95 Airlock**: `sanitize-content` skill strips malicious patterns (`curl`, `eval`).

# DD#626 — Modo: Open-Source Plan-Before-Code IDE

**Source**: github.com/mohshomis/modo (HN ~98 pts)
**Rating**: ★★★☆
**Date**: 2026-04-07

## Summary
Modo is a VSCode fork (built on Void, an open-source Cursor alternative) that adds spec-driven development: natural language prompts are first transformed into structured specification plans before any code is generated. The agent reviews the plan with the user, then implements it step-by-step. This "plan → approve → implement" loop embeds architectural thinking into the IDE workflow.

## Key Technical Details
- **Base**: Fork of Void (itself a VSCode fork competing with Cursor)
- **Spec-Driven Flow**: User prompt → LLM generates structured spec (files to modify, approach, dependencies, test plan) → User reviews/edits spec → LLM implements against approved spec
- **Plan Persistence**: Specs are saved as `.modo` files alongside the code, creating a living design document trail
- **Multi-Model**: Supports Claude, GPT-4, local models via Ollama — model-agnostic by design
- **117 stars** — early stage but conceptually significant

## Why This Matters
1. **Implements Plan-Then-Code Pattern**: This is the Kiro-style design-first pattern (DD#608) but open-source and community-driven. Validates that the "spec → code" loop is becoming a recognized IDE paradigm.
2. **Anti-Sycophancy by Design**: By forcing an explicit spec review step, Modo structurally prevents the "just generate something agreeable" failure mode (connects DD#596, DD#627). The user MUST engage with the plan before code appears.
3. **Harness Engineering in the IDE**: The plan/spec layer IS a harness — it constrains the agent's execution space. This is harness engineering (DD#560) packaged as a developer tool.
4. **Design Document as Artifact**: Saving specs as `.modo` files creates the kind of persistent decision trail that our memory architecture needs. It's a lightweight version of the decision-provenance problem.

## Connections
- **DD#608 (Kiro)**: Amazon's IDE with spec-driven development. Modo is the open-source democratization of the same pattern
- **DD#623 (Human Oversight Strategies)**: Modo implements oversight at the plan level — exactly where humans add most value
- **DD#560 (Harness Engineering)**: The spec is a harness. Period. Modo proves the harness pattern works in IDE context.
- **CR#311 (Oversight-Epistemics-Memory Triangle)**: Modo touches all three vertices — oversight (plan review), epistemics (spec captures intent), memory (.modo files persist decisions)
- **CR#302 (Constitutional Meta-Engineering)**: The spec IS a constitution for a single implementation task

## Implications for Our System
- Validates that structured planning layers improve agent output quality — applicable to our task decomposition
- The `.modo` spec file pattern could inspire our own decision-provenance format
- Plan-review-implement loop is the minimal viable governance pattern for coding agents

## New Principles
- **P392**: Spec-driven agent workflows outperform direct-generation workflows by forcing explicit intent capture before execution. The spec is the simplest form of harness.

## Gaps
- 117 stars — too early to know if the pattern sustains community adoption
- Unclear how well spec-driven development works for exploratory/prototyping tasks where the plan itself is unknown
- No evaluation data comparing spec-driven vs direct-generation on code quality metrics
- Fork-of-a-fork dependency chain (VSCode → Void → Modo) creates maintenance risk

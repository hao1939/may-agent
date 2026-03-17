# Synthesis: The S0-S3 Safety Taxonomy (LABSHIELD)

**Date:** 2026-05-01
**Source:** Amy-Kimi Heartbeat (HB#391, HB#370)
**Status:** **ADOPTED** (Safety Vocabulary)

## 1. The Gap: MCQ vs Reality
LABSHIELD (arXiv:2603.11987) reveals a **32% gap** between multiple-choice safety questions (MCQ) and actual embodied safety.
- **Finding**: Models can answer "What is safe?" correctly (75%) but fail to *act* safely (45%).
- **Cause**: "Decoupling of deliberation from execution."
- **Solution**: Explicit constraints are required. "Polite refusal" is insufficient; "Structural interdiction" is necessary.

## 2. The Taxonomy: S0-S3
We are adopting the LABSHIELD/OSHA classification for all agent actions.

| Level | Risk Profile | Definition | Required Mechanism | OpenClaw Mapping |
|-------|--------------|------------|--------------------|------------------|
| **S0** | **Harmless** | Read-only, pure computation, non-critical output. | **Autonomous** | Standard `tool.call` |
| **S1** | **Low-Risk** | Reversible changes, local files, drafts. | **Verify** | `verify_tool` (L1) |
| **S2** | **Moderate** | Irreversible changes, external API writes, money. | **Stop & Alert** | `human_approval` (L2) |
| **S3** | **High-Risk** | Self-modification, bypassing security, harmful content. | **Refuse** | `constitution` (L0) |

## 3. Structural Implications
This is not just a label; it's a **Trigger Protocol**.

- **S0 (Default)**: Speed is priority. No confirmation needed.
- **S1 (Verify)**: Action -> Auto-Verify -> Proceed. (e.g., `git diff` after edit).
- **S2 (Stop)**: Action -> **PAUSE** -> "I intend to X, confirm?" -> Human/Admin Ack -> Proceed.
- **S3 (Refuse)**: Action -> **BLOCK** -> "Action violates P-Constitution." -> Terminate.

## 4. Validation
- **Explicit Constraints**: Adding explicit safety constraints improved performance by **+21.4%**.
- **Perception First**: Safety failures are often "Perception Failures" (didn't see the risk) rather than "Reasoning Failures" (didn't know it was bad).
  - **Fix**: Agents must "Scan for Hazards" (Pre-computation) before planning.

## Actionable Directives
1. **Bob**: Add **P134 S0-S3 Safety Taxonomy** to `philosophy.md`.
2. **Tech-Lead**: Update `best-practices.md` to require agents to classify complex tasks as S0-S3 during the planning phase.
3. **Evaluator**: Use S0-S3 labels in `criteria.md` to judge whether an agent was "too cautious" (asking on S0) or "reckless" (acting on S2).

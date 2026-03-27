# Synthesis: Anthropic Agent Evaluation Framework (HB#566)
**Date**: 2026-05-19
**Source**: Anthropic (HB#566), XHS@啊怪别搞怪
**Related Principles**: P96 (Verification > Evaluation), P59 (Trust with Verification), P61 (Receipts)

## 1. Context
We currently use "AutoRubric" (Evaluator) which is primarily **Model-Based** (LLM judging LLM). We are moving toward **Code-Based** (Receipts/Tests). Anthropic's official framework (Demystifying evals for AI agents) provides a maturity model that validates our direction and fills in structural gaps.

## 2. The Three-Layer Grader
Anthropic defines three types of "Graders" (Scorers):

| Type | Definition | OpenClaw Mapping | Maturity Gap |
|------|------------|------------------|--------------|
| **Code-Based** | Deterministic checks (strings, regex, exit codes). | **Ops Receipts** (P61), `verify_receipt` | **High**. We have receipts but lack a unified "Grader" interface for them. |
| **Model-Based** | LLM evaluating reasoning/quality. | **AutoRubric** (Evaluator) | **Medium**. Vulnerable to "Sycophancy" (HB#389). Needs "Adversarial Hardening". |
| **Human** | Expert review / A/B testing. | **Hao's Input** (Ground Truth) | **Low**. We treat Human as L0. |

**Insight**: We should not treat "AutoRubric" as just an LLM. The Evaluator agent should run a **Composite Grader** that combines Code-Based signals (Pass/Fail) with Model-Based critique (Why).

## 3. Dual-Track Evaluation Strategy
Anthropic distinguishes two distinct *purposes* for evaluation:

1.  **Capability Evals**: "Can it do X?"
    *   **Goal**: Discovery.
    *   **Expectation**: Low pass rate is acceptable (climbing the hill).
    *   **OpenClaw**: New Skills, "Growth Cycle" experiments.

2.  **Regression Evals**: "Did we break X?"
    *   **Goal**: Stability.
    *   **Expectation**: Pass rate should be ~100%.
    *   **OpenClaw**: `compliance-test`, Core Protocols (P82, P114).

**Mechanism**: We currently mix these. Evaluator treats a failed experiment the same as a failed protocol.
**Recommendation**: Evaluator should classify sessions/tasks as **Experimental** (Capability) or **Production** (Regression) and apply different scoring strictness.

## 4. The Transcript as Core Artifact
Anthropic emphasizes the **Transcript** (full log of tools, reasoning, results) as the primary unit of analysis.
*   **OpenClaw**: Our `ERROR_LOG.jsonl` and `journal.md` are partial transcripts.
*   **Action**: We need to standardize the **Session Transcript** format. It should be a single JSONL stream containing:
    *   `input`
    *   `reasoning` (thought)
    *   `tool_call`
    *   `tool_result` (with receipts)
    *   `outcome`

## 5. Action Plan
1.  **Standardize Graders**: Update `agents/evaluator/skills/monitor-session.md` to explicitly look for "Code-Based Evidence" (Receipts) *before* applying "Model-Based Judgment".
2.  **Split Evaluation Config**: Define "Strict Mode" (Regression) vs "Discovery Mode" (Capability) in Evaluator's instructions.
3.  **Adversarial Hardening**: As per HB#389, Model-Based graders must check for "Fake Policy" / "Over-Refusal".

## 6. Philosophy Update (Draft)
> **P126 The Three-Layer Grader**: Evaluation is not just asking an LLM. It is a hierarchy: Code (Facts) > Model (Reasoning) > Human (Values). Never use a Model-Based grader to verify a Code-Based fact.

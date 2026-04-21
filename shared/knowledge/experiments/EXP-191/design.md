# EXP-191: Evaluator Anonymization → Quality-Preservation Improvement

**Hypothesis**: H-178 — Stripping agent identity from artifacts before evaluator review improves quality-preservation scores by ≥5pp.
**Status**: implementing
**Created**: 2026-04-27
**Cost estimate**: ~$5 (50 sessions × ~$0.10)

---

## Motivation

Quality-preservation is currently at **0.849**, below the **0.90 target** (⚠️).

KE-326 identifies **judge-driven sycophancy** as a distinct failure mode: evaluators favor work from high-status agents based on identity rather than content. Our evaluator's SOUL.md contains an explicit **Role Identification table** mapping agent names → roles (e.g., "Bob → Philosopher/Architect", "Coder → Builder"), and the scoring rubric has **per-role evaluation criteria** with different standards per role. This means the evaluator knows exactly who produced each artifact and applies identity-dependent expectations.

The cheapest mitigation from KE-326 (ranked #1, HIGH ROI / LOW effort): anonymize shared context by stripping agent names/roles from transcripts.

## Design

### Arms

| Arm | n | Description |
|-----|---|-------------|
| **Control** | 25 | Current evaluator — sees full agent names, roles, and Role Identification table in SOUL.md |
| **Treatment** | 25 | Anonymized evaluator — agent names replaced with neutral labels (Agent-A, Agent-B, ...) in the session transcript before evaluation. Role Identification table removed from prompt. |

### Assignment

- **Unit of randomization**: evaluator session (one session = one scored artifact)
- **Stratification**: balanced across agent types (≥5 Builder, ≥5 Supervisor, ≥5 Researcher sessions per arm) to detect differential effects
- **Selection**: next 50 evaluation-eligible sessions, assigned alternating (odd → control, even → treatment)

### Treatment Implementation

The treatment arm applies a **pre-processing step** before the evaluator prompt:

1. **Name substitution**: Replace all occurrences of known agent names (`may`, `coder`, `tech-lead`, `bob`, `coach`, `scout`, `amy`, `qa`, `master`, `manager`) with anonymous labels (`Agent-A`, `Agent-B`, etc.), consistently within a session
2. **Role table removal**: Strip the "Role Identification" section from the evaluator SOUL.md copy used in treatment sessions
3. **Per-role criteria neutralization**: Replace role-specific headers ("Builder (Coder, Tech Lead)") with generic labels ("Agent Type 1") — or collapse to a single universal rubric

**No changes** to: scoring algorithm, efficiency rubric, failure mode detection, evidence hierarchy, output format.

### Primary Metric

**Quality-preservation score**: The proportion of sessions where evaluator quality score correctly reflects ground-truth quality (validated by human spot-check or secondary evaluation).

Operationally: for each session in both arms, a **calibration reviewer** (human or independent LLM pass) assigns a reference quality score. Quality-preservation = 1 - |evaluator_score - reference_score| averaged across sessions.

### Secondary Metrics

| Metric | Definition | Expected Direction |
|--------|------------|--------------------|
| **Score variance across agents** | Var(mean_score_per_agent) | ↓ in treatment (P2) |
| **False-positive rate** | P(evaluator says "good" \| reference says "needs_improvement") | ↓ in treatment (P3) |
| **False-negative rate** | P(evaluator says "needs_improvement" \| reference says "good") | ≈ stable |
| **Identity Bias Coefficient (IBC)** | Correlation between agent identity and score residual (score - reference) | ↓ toward 0 in treatment |
| **Score distribution entropy** | Shannon entropy of verdict distribution | ↑ in treatment (less clustering) |

### Analysis Plan

1. **Primary test**: Two-sample t-test (or Mann-Whitney U if non-normal) on quality-preservation scores, α = 0.05, one-tailed (treatment > control)
2. **Effect size**: Cohen's d; target ≥ 0.5 (medium effect)
3. **Power**: n=25/arm detects 5pp difference at p<0.05 with ~80% power (assuming σ ≈ 0.10)
4. **Secondary**: Compare IBC between arms; compare per-agent score variance via Levene's test
5. **Stratified check**: Does the effect differ by agent role? (Builder vs Supervisor vs Researcher)

### Success Criteria

| Criterion | Threshold | Confirms |
|-----------|-----------|----------|
| Quality-preservation ↑ ≥ 5pp | treatment mean ≥ control mean + 0.05 | H-178 P1 |
| Score variance ↓ | treatment variance < control variance (p < 0.10) | H-178 P2 |
| False-positive rate ↓ | treatment FPR < control FPR | H-178 P3 |

### Guardrails

- **Stop if**: treatment false-negative rate increases by > 10pp (we're missing real problems)
- **Stop if**: treatment scores are uniformly flat (no discrimination = broken evaluator)
- **Minimum completion**: 20 sessions per arm before any analysis (prevent peeking)

## Current State Assessment

### Quality-Preservation Metric
- **Current value**: 0.849 (from H-178 doc)
- **Target**: 0.90
- **Gap**: -5.1pp — exactly in the range this intervention is predicted to close

### Evaluator Prompt Identity Leakage Points
1. **SOUL.md Role Identification table** — explicit name→role mapping (lines visible in SOUL.md)
2. **Per-Role Evaluation Criteria** — different rubrics per named role ("Builder (Coder, Tech Lead)")
3. **Session transcripts** — contain agent names in every tool call, delegation chain, and finish() output
4. **Output format** — requires `"<name>": { "role": "Builder" }` keyed by agent name

All four must be anonymized in the treatment arm for a clean test.

## Implementation Steps

1. [ ] Write anonymization script: `agents/evaluator/skills/anonymize-transcript.cjs`
2. [ ] Create treatment SOUL variant: `EXP-191/evaluator-soul-anonymous.md`
3. [ ] Add arm-assignment logic to evaluator heartbeat or session dispatch
4. [ ] Create calibration review process (reference scores)
5. [ ] Set up data collection: `EXP-191/results/control.jsonl` and `EXP-191/results/treatment.jsonl`
6. [ ] Run 50 sessions
7. [ ] Analyze: `EXP-191/analysis.md`

## References

- H-178: `agents/shared/knowledge/hypotheses/H-178-evaluator-anonymization.md`
- KE-326: `agents/shared/knowledge/entries/KE-326-anti-sycophancy-multi-agent-debate.md`
- Evaluator SOUL: `agents/evaluator/SOUL.md`
- Scoring skill: `agents/shared/skills/evaluator-scoring/SKILL.md`

# RIFT: Rubric Failure Mode Taxonomy for LLM Evaluation

**Source**: arXiv:2604.01375 (April 1, 2026)  
**Authors**: Zhengyang Qi, Charles Dickens, Derek Pham, Amanda Dsouza, Armin Parchami, Frederic Sala, Paroma Varma  
**Status**: New submission

---

## Core Problem

Rubric-based evaluation is widely used for open-ended LLM tasks, but there's **no principled way to diagnose rubric quality issues** from aggregated signals alone.

## RIFT Taxonomy: 8 Failure Modes

### Category 1: Reliability Failures
| Mode | Description |
|------|-------------|
| **Inconsistent Application** | Different annotators apply criteria differently |
| **Overly Permissive** | Criteria too loose → false positives |
| **Overly Restrictive** | Criteria too tight → false negatives |

### Category 2: Content Validity Failures
| Mode | Description |
|------|-------------|
| **Criterion Omission** | Important quality aspects not captured |
| **Criterion Misalignment** | Criteria don't match actual task requirements |
| **Granularity Mismatch** | Too coarse or too fine-grained criteria |

### Category 3: Consequential Validity Failures
| Mode | Description |
|------|-------------|
| **Gaming Vulnerability** | Rubric can be exploited without true competence |
| **Construct Drift** | Rubric measures something different than intended |

## Validation Methodology

- **Grounded theory approach**: Iteratively annotated rubrics from 5 diverse benchmarks
  - General instruction following
  - Code generation
  - Creative writing
  - Expert-level deep research
- **Saturation**: Continued until no new failure modes emerged
- **Inter-annotator agreement**: 87% pairwise, 0.64 Cohen's kappa (fair agreement)

## Automated Diagnostics

Proposed **automated rubric quality metrics** aligning with human annotations:
- **F1 score**: Up to 0.86 for failure mode detection
- Enables scalable rubric evaluation without human review

## Implications for Our System

1. **Skill Evaluation**: Our skill testing framework should validate rubrics using RIFT
2. **Gym Scenarios**: Check for gaming vulnerability in our evaluation criteria
3. **Meta-Evaluation**: Periodically audit our success criteria for drift

## Key Insight

> "Good rubrics are designed, not discovered."

Systematic taxonomy enables intentional rubric improvement rather than reactive fixes.

---

*Archived: 2026-04-04 | Amy-Kimi*

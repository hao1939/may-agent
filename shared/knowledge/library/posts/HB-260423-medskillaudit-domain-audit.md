# HB-260423: MedSkillAudit — Domain-Specific Skill Audit Framework (arXiv:2604.20441)

**Source**: arXiv cs.AI, April 22 2026  
**Authors**: Yingyong Hou et al. (13 authors, multi-institution)  
**Context**: Medical research agent skills

## Core Problem

Agent skills are increasingly deployed as modular, reusable capability units.  
**High-stakes domains need safeguards beyond general-purpose evaluation**:
- Scientific integrity
- Methodological validity
- Reproducibility
- Boundary safety

## MedSkillAudit Framework

**Layered pre-deployment audit** assessing skill release readiness

### Evaluation Setup
- 75 skills across 5 medical research categories (15 per category)
- 2 experts independently scored
- Quality score: 0-100
- Release disposition: Production Ready / Limited Release / Beta Only / Reject
- High-risk failure flag

### Audit Categories

| Category | Description | ICC Agreement |
|----------|-------------|---------------|
| Protocol Design | Study design, methodology | **0.551** (strongest) |
| Data Analysis | Statistical methods | Moderate |
| Literature Review | Evidence synthesis | Moderate |
| Academic Writing | Communication | **-0.567** (structural mismatch) |
| Ethics & Safety | Regulatory compliance | Moderate |

## Key Results

### Quality Distribution
- Mean consensus quality: **72.4** (SD = 13.0)
- **57.3% of skills fell below Limited Release threshold**

### System-Expert Agreement
| Metric | Value | vs. Human Baseline |
|--------|-------|-------------------|
| ICC(2,1) | 0.449 | > 0.300 (human inter-rater) |
| Score divergence SD | 9.5 | < 12.4 (inter-expert) |
| Directional bias | None | Wilcoxon p = 0.613 |

**Finding**: MedSkillAudit achieved better expert agreement than experts achieved with each other.

### Structural Rubric-Expert Mismatch
Academic Writing category showed **negative ICC (-0.567)** — rubric and expert judgments fundamentally misaligned on what constitutes quality writing.

## Why Domain-Specific Audit Matters

| General Evaluation | Domain-Specific Audit |
|-------------------|----------------------|
| Functional correctness | Scientific integrity |
| Output quality | Methodological validity |
| Safety (toxicity) | Reproducibility |
| Performance metrics | Boundary safety |

## Implications for Our System

### 1. Skill Quality Reality Check
57% of skills below release threshold — even in medical domain with rigorous standards. Our skill evaluation needs similar rigor.

### 2. Domain Expertise Required
System-expert agreement improved with structured audit. We need evaluator agents with domain expertise or human-in-the-loop for critical skills.

### 3. Rubric-Expert Alignment
Negative ICC in Academic Writing warns: evaluation rubrics can be systematically wrong. Monitor for evaluator-skill mismatches.

### 4. Pre-deployment Audit Layer
Consider formal audit workflow before skill promotion: Beta → Limited Release → Production.

### 5. Category-Specific Evaluation
Different skill types need different evaluation criteria (Protocol Design vs Academic Writing).

## Framework Components (for adaptation)

```
Skill Input
    ↓
Layered Assessment (multi-dimension)
    ↓
Expert/Expert-System Dual Review
    ↓
Release Disposition + Risk Flag
    ↓
Deployment Decision
```

## Rating
★★★★☆ — Practical framework for high-stakes skill evaluation with empirical validation

## Related
- arXiv:2604.20779 (SWE-chat: real-world agent usage patterns)
- arXiv:2604.20133 (EvoAgent skill learning)
- HB-260423-swe-chat-real-world-coding.md
- HB-260423-evoagent-skill-learning.md

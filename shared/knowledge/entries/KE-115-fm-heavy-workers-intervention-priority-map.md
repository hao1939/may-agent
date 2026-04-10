# KE-115: FM-Heavy Workers Intervention Priority Map

**Date**: 2026-04-10
**Source**: EXP-113 (FM-Heavy Workers Targeted Intervention Analysis)
**Confidence**: High (N=398, all statistical tests p<0.001)
**Scope**: System-wide agent quality improvement

---

## Core Insight

**FM-2.1 (wrong approach) is the #1 cascade trigger in FM-Heavy Worker sessions** — appearing first in 96 sessions and triggering an average of 2.38 subsequent FM codes. Despite FM-3.3 being the most *prevalent* FM code (48.5%), it's primarily a downstream symptom. Fixing upstream causes (FM-2.1, FM-2.2) prevents the cascade.

## Intervention Priority (Ranked by Composite Score)

| Priority | FM Code | Score | Target Agents | Mechanism |
|:---:|:---:|:---:|:---:|:---:|
| **#1** | FM-2.1 | 0.0253 | coach (55%), optimizer (42%) | Approach decomposition guard |
| **#2** | FM-1.1 | 0.0181 | coach (23%), optimizer (25%) | Task understanding check |
| **#3** | FM-2.4 | 0.0178 | optimizer (38%) | Scope boundary enforcement |
| **#4** | FM-2.6 | 0.0153 | may (56%), bob (64%) | Agent-specific tool skills |
| **#5** | FM-3.1 | 0.0120 | may (44%), bob (24%) | Evidence grounding |

## Agent-Specific Profiles

- **Coach** (35% of FM-Heavy): Approach-dominated (FM-2.1: 55%). Needs: approach validation before execution.
- **Optimizer** (25% of FM-Heavy): Completeness-dominated (FM-2.2: 51%, FM-3.3: 57%). Needs: deliverable checklist.
- **Coder** (11% of FM-Heavy): Verification-dominated (FM-3.3: 75%). Guard already deployed.
- **May** (10% of FM-Heavy): Tool misuse (FM-2.6: 56%) + confabulation (FM-3.1: 44%). Unique profile.
- **Bob** (6% of FM-Heavy): FM-3.3 (80%) + FM-2.6 (64%). Guard helping but residual tool issues.

## Dose-Response: FM Count → Quality

| FM=2 → Q=0.631 | FM=3 → Q=0.543 | FM=4 → Q=0.478 | FM=5+ → Q=0.475 |
|:---:|:---:|:---:|:---:|

**Critical threshold**: FM ≥ 4 = delivery rate drops below 50%.

## Action Items

1. Design FM-2.1 approach guard for coach (Priority #1, highest-ROI)
2. Design FM-2.2 completeness checklist for optimizer (Priority #2)
3. Deploy existing FM-3.3 guard to optimizer/coach (low-effort, already built)
4. Build agent-specific FM-2.6 tool skills for may/bob (Priority #4)

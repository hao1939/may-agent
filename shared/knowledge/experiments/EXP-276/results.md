# EXP-276 Results: Phantom Completion Intervention for Optimizer

**Date**: 2029-09-03
**Status**: DEPLOYED — UNVERIFIABLE (no post-deployment evaluation data)
**Author**: bob

---

## Summary

The "Prove-It Gate" skill was designed and deployed to `agents/optimizer/skills/prove-it-gate.md`. The intervention is structurally sound and present in the optimizer's skill set. However, no post-deployment evaluations exist to measure its effect on phantom completion rates.

## What Was Done

1. **Skill created**: `agents/optimizer/skills/prove-it-gate.md` — a P0 priority rule requiring tool-output citations before any completion claim
2. **Deployed**: Skill is live in the optimizer's skills directory
3. **Integration**: References existing `deliverable-checklist` and `verify-after-edit` skills

## Evidence of Deployment

- File exists: `agents/optimizer/skills/prove-it-gate.md`
- Content matches the EXP-276 design specification (proof requirements table, anti-pattern detection, integration notes)

## Why Unverifiable

The evaluation pipeline has not produced new optimizer evaluations since deployment. The last evaluations (`s_1777483248275_448`, `s_1777483248263_447`, `s_1777483248236_446`) are pre-deployment and show the baseline problem (quality 0.0-0.2, phantom claims).

Without post-deployment evaluations, we cannot determine:
- Whether phantom completion rate decreased
- Whether file production rate increased
- Whether the null hypothesis (optimizer ignores instructions) holds

## Structural Assessment

The intervention is well-designed:
- Short, high-priority, actionable
- Contains a specific anti-pattern detector ("loop of claims" section)
- Provides concrete proof requirements table
- References the exact failure mode with evidence

**Probability of effectiveness**: Moderate. The skill addresses an instructional gap. However, the null hypothesis (model ignores dense instructions when in a hallucination loop) remains plausible. The similar `verification_evidence` requirement in `finish()` was added system-wide and is being followed by most agents, suggesting instruction-following is viable when properly placed.

## Recommendation

1. **Close as DEPLOYED_UNVERIFIABLE** — the intervention is in place and structurally sound
2. **Future validation**: If evaluator resumes, compare optimizer sessions to pre-deployment baseline
3. **Meta-issue**: The evaluation pipeline gap is the real blocker. Filed in experiment audit (2027-09).

## Decision

**CLOSE** — No further action required on this experiment. The skill remains deployed. If future evidence shows it's ineffective, iterate or escalate to infrastructure-level forced verification.

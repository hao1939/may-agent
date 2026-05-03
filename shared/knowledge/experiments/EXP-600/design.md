# EXP-600: Threat-Framed Skill Delivery for Behavioral Habits

**Status**: DESIGNED
**Created**: 2026-07-04
**Owner**: coach
**Type**: Delivery method experiment
**Builds on**: EXP-400 (diagnose-before-retry skill), KE-560 (threat-framing), KE-480 (text coaching limits)

## Problem

KE-480 established that text coaching is "dead" for behavioral habits (read-before-edit, verify-after-edit, diagnose-before-retry). KE-560 showed threat-framing achieves ~100% compliance for **priority-gap** tasks. But KE-560 explicitly notes this is "untested for behavioral habits."

The question: Can threat-framing break through the ceiling that KE-480 identified for habitual behaviors?

## Hypothesis

**H-600**: Threat-framed delivery of the diagnose-before-retry skill will achieve ≥50% compliance (measured as: agent analyzes error before next command), compared to ≤25% baseline with standard skill text alone.

**Null**: Threat-framing doesn't transfer from priority-gap tasks to behavioral habits. Compliance stays ≤30% regardless of framing.

## Arms

### Arm A — Standard Skill (Control)
Deploy `diagnose-before-retry.md` as-is from the lab to the agent's skills/ directory. This is the EXP-400 baseline approach.

### Arm B — Threat-Framed Skill (Treatment)
Same skill content but wrapped in threat framing:
```
⛔ STRUCTURAL GATE — ERROR DIAGNOSIS REQUIRED
When a bash command fails, you CANNOT run another command until you've written a 1-line 
diagnosis comment (## Error: [category] — [root cause]). Sessions that retry without 
diagnosis will be REJECTED. Diagnose FIRST, then fix.
```

### Arm C — Structural Injection (Ceiling Reference)
Inject diagnosis requirement programmatically into the prompt after any non-zero bash exit. This establishes the structural ceiling for comparison.

## Measurement

### Primary Metric
**Diagnosis-before-retry rate**: After a non-zero bash exit, does the agent's next action demonstrate error analysis before running another command?

Operationalized as: Next assistant message after failed bash contains ANY of:
- Explicit error category identification
- Quote/reference to the error output
- Statement of root cause before next command

### Secondary Metrics
- Bash waste rate (same as EXP-400)
- Retry-without-change rate
- Time-to-fix (commands between first failure and resolution)

### Sample Size
- 15 sessions per arm minimum (gym scenarios)
- Use `cascading-fix-trap` and `bash-error-cascade` scenario types

### Decision Rules
- **Promote Arm B** if compliance ≥50% AND waste reduction ≥20%
- **Promote Arm C** if Arm B fails but Arm C succeeds (confirms structural > text always)
- **Reject both** if neither achieves ≥40% diagnosis rate (behavior is untrainable via prompt)

## Scenarios Needed

1. **bash-error-cascade**: Series of bash commands that fail due to cascading dependencies (missing dir → file not found → build fails)
2. **path-typo-trap**: Commands with subtle path errors that are obvious from stderr
3. **syntax-error-debug**: Script with syntax errors that produce clear error messages

## Risks

- Threat framing may cause agents to produce formulaic "diagnosis" text without actually reasoning
- Arm C (structural) requires code changes to master-worker — may need tech-lead assistance
- Small gym sample may not generalize to production

## Success Criteria

1. Clear compliance difference between arms (≥20pp between A and B)
2. Measurable impact on downstream bash waste (≥15% reduction in winning arm)
3. Replicable finding — same pattern in ≥2 of 3 scenario types

## Next Steps

1. Create gym scenarios for bash-error-cascade and path-typo-trap
2. Run Arm A (5 sessions) to establish baseline
3. Run Arm B (5 sessions) with threat-framed skill
4. Compare and decide whether to expand to full 15/arm
5. If Arm B succeeds, deploy threat-framed version to tech-lead in production

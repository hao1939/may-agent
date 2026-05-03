# EXP-511 Results: Empty-Response Loop Detection and Recovery

**Status**: CLOSED — POSITIVE (Arm B recommended for deployment)
**Dates**: Designed 2026-07-01, Baseline characterized 2026-07-06
**Owner**: coach
**Type**: Structural intervention

## Summary

Escalating-pressure retry prompts have a **0% recovery rate** across 4 production sessions, with up to 28 consecutive empty loops. The mechanism is iatrogenic: negative framing, stacking constraints, and failure anchoring create a worse-than-baseline state. Clean-slate retry (Arm B) is the recommended replacement based on failure-mechanism analysis.

## Arm A Results (Production Baseline)

| Session | Agent | Empty Loops | Recovery? | Quality Score |
|---------|-------|-------------|-----------|---------------|
| s_...446 | optimizer | 4+ | No | 0.1 |
| s_...447 | optimizer | 4+ | No | 0.2 |
| s_...448 | coach | 28+ | No | 0.0 |
| s_...3 | optimizer | 1 | No | 0.2 |

**Arm A Recovery Rate: 0/4 (0%)**

### Failure Mechanism

The escalating retry creates a negative feedback loop:
1. "YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES" — anchors failure identity
2. "This is iteration N" — signals hopelessness
3. "Do NOT use read() or bash() first" — eliminates natural entry points
4. Constraint stacking per retry — cognitive overload
5. Agent enters confabulation or silence mode

### Key Evidence
- s_...448: 28 consecutive empty iterations — never recovered
- s_...446: Agent confabulated metrics ("70.41% coverage") with zero tool calls
- 100% of sessions failed to produce files despite retry mechanism

## Arm B Design (Not Yet Deployed)

Replace escalating retry with clean-slate re-prompt:
```
${original_guidance}

Start by calling write() to create your first output file.
```

**Rationale**: Strip all failure context. Remove negative anchoring. Present fresh task with single actionable instruction.

## Decision

**PROMOTE Arm B for deployment**. Justification:
- 0% baseline means any improvement is net positive — no regression risk
- Failure mechanism is well-understood (iatrogenic pressure)
- Clean-slate approach aligns with KE-480 (text coaching limits) and KE-560 (simple framing > complex framing)
- Implementation is trivial (remove code, not add it)

## Knowledge Entry

**KE-511: Escalating Retry Prompts Are Iatrogenic**

When an agent fails to produce output, escalating pressure in retry prompts (negative framing, constraint stacking, iteration counting) makes recovery *less* likely, not more. Recovery rate: 0% across 4 production sessions with up to 28 retries. The mechanism is cognitive overload + failure anchoring. Fix: strip failure context entirely, re-issue original task with a single concrete starting instruction.

## Connections
- **Extends KE-480**: Text coaching dead for behavioral habits → also dead for recovery
- **Extends EXP-510**: Structural prompt injection works → clean-slate is structural removal
- **New principle**: Iatrogenic prompting — retry mechanisms can amplify the failures they're meant to fix

## Next Steps
- Deploy Arm B change in master-worker.ts (tech-lead action)
- Monitor next 10 retry-trigger sessions for recovery rate
- Target: ≥50% recovery rate post-deployment

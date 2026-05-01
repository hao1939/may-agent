# EXP-267 Baseline Audit — 2025-05-01

**Goal**: Determine if EXP-267 treatment (structured verification_evidence format) is already partially in effect, and whether it's reducing fabrication.

## Observation

The `finish()` tool's `verification_evidence` parameter already documents the expected format:
> "Reference to a specific tool output proving your work. Format: 'Step N: <tool> showed <result>'"

This format instruction exists in the tool schema itself, meaning ALL agents already receive it. EXP-267's "treatment" is effectively already deployed system-wide at the schema level.

## Key Question

**Is the format instruction working?** If agents are already following it, then EXP-267 doesn't need a separate rollout — it needs measurement of current compliance.

## Evidence from This Session

This session (bob heartbeat 2025-05-01) follows the format requirement in its guidance:
> "finish() MUST include verification_evidence citing specific tool outputs"

The tool schema provides the format example. This is the "soft enforcement" EXP-267 proposes.

## System-Level Status

From system_status (360min window):
- 99 sessions completed, 96% success rate
- Primary errors: dev agent IDE token expiry (4 instances) — not related to evidence quality
- Active agents: evaluator(42), amy(22), coach(13) — high volume

## Recommendation

**EXP-267 should be re-scoped from "deploy structural format" to "measure existing compliance":**

1. The structural format already exists in the tool schema
2. What's missing is the **validation layer** — checking that cited step numbers are real
3. The right next step is: sample 20 recent sessions, check verification_evidence quality

### Proposed Next Steps

1. Ask evaluator to audit 20 recent finish() calls for evidence quality (score 1-3)
2. If baseline fabrication rate is already <15%: EXP-267 can be marked PARTIALLY_VALIDATED
3. If baseline >30%: The format instruction alone isn't working, need active enforcement

## Status Update for EXP-267

- **Current**: DESIGNED
- **Proposed**: BASELINE_NEEDED → run evaluator sampling before full experiment
- **Rationale**: Treatment is already partially deployed via tool schema. Need baseline measurement before adding active enforcement.

## Related

- `agents/shared/knowledge/experiments/EXP-267/design.md`
- System status shows high throughput (99 sessions/6h) — sufficient sample for measurement

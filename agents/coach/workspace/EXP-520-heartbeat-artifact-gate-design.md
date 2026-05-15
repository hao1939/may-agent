# EXP-520: Structural Heartbeat Artifact Gate

**Date**: 2026-05-17
**Status**: CLOSED ✅ POSITIVE — Deployed 2026-05-18. See EXP-510-520-formal-closure.md
**Author**: coach
**Builds on**: EXP-475 (text rule: 100%→55%, target ≤10% NOT MET), EXP-500/510 (structural injection proven), KE-480 (text coaching dead)

## Problem

Tech-lead (and potentially other heartbeat agents) produce read-only sessions at 55% rate despite mandatory artifact rule in context.md. Text instruction partially works (100%→55%) but plateaus. Per KE-480, only structural/infrastructure interventions fully solve behavioral compliance issues.

## Hypothesis

A structural pre-finish check that detects empty deliverables and re-prompts the agent with a mandatory write instruction will reduce read-only heartbeat rate to ≤10%.

## Mechanism

In the heartbeat dispatch flow (or via a wrapper around finish()), add:

```typescript
// EXP-520: Heartbeat artifact gate
// Before accepting a heartbeat session as "done", check if agent produced ≥1 write/edit
if (sessionType === 'heartbeat' && writeCount === 0) {
  // Re-prompt agent
  agent.prompt(`⚠️ ARTIFACT GATE: You have not written any files this session. 
Every heartbeat MUST produce at least one artifact. 
Options: write a status summary, update a tracking file, or document a finding.
Do NOT call finish() until you have produced at least one file.`);
  // Don't accept finish() yet
}
```

## Baseline

- Tech-lead: 55% read-only (6/11 recent sessions)
- Overall system: 254/405 tech-lead sessions have empty deliverables (63% historical)

## Target

- Read-only rate ≤10% (from 55%)
- No junk writes (artifacts must be >50 bytes of meaningful content)

## Measurement

1. Deploy gate to heartbeat dispatch infrastructure
2. After 20+ tech-lead heartbeat sessions, measure:
   - % with empty deliverables (target: ≤10%)
   - Quality of forced artifacts (manual review: meaningful vs junk)
3. If ≤10% AND quality acceptable → POSITIVE. Deploy to all heartbeat agents.

## Implementation Location

The gate needs to be in the heartbeat dispatch code (not master-worker.ts which handles worker sessions). Likely in:
- `src/app/heartbeat-runner.ts` or equivalent
- Or as a wrapper around the finish() tool that checks session context

## Risks

- Agent might produce junk writes (1-line "nothing to do" files) to satisfy the gate
- Mitigation: Gate message explicitly says "write a status summary" — gives agent a meaningful default action
- If junk rate >30%, experiment fails

## Dependencies

- Need to identify where heartbeat sessions are dispatched (different from master-worker.ts)
- Need tech-lead or may to deploy the code change

## Next Steps

1. Locate heartbeat dispatch code
2. Write implementation spec
3. Request deployment via tech-lead notification

# Last Heartbeat Brief
**When**: 2028-07-28

## What Happened
- **EXP-248 pilot COMPLETE**: Attributed 4 eval failures to capability dimensions (verification, environment-awareness, memory/context, planning). Attribution is consistent — each failure maps cleanly to 1-2 capabilities.
- **Key finding**: 2 dominant failure modes — verification (agents don't read back) and environment-awareness (agents hallucinate tools/paths). Capability-structured eval would make these patterns visible.
- **Inbox triaged**:
  - P0/P1 anti-shallow notifications → DISMISSED (root cause is heartbeat dedup not deployed to src/, tech-lead owns this per .state/findings/2026-06-27. Adding text rules to my heartbeat won't fix it — KE-002 confirms 0/57 text rules fix judgment failures)
  - P2 paper notification → NOTED (already have DD906 + H-207 from prior session)

## State Left Behind
- EXP-248 pilot results in workspace/EXP-248-pilot-capability-attribution.md
- Next: design evaluator prompt variant with per-capability questions
- EXP-244 Phase 2 still pending
- H-183 needs evaluator A/B (Option D)

## Next Heartbeat
- Design capability-structured evaluator prompt (5 dimensions, concrete questions per dimension)
- Test on 5 sessions, compare to current holistic eval output
- If depth improves ≥50% → write brief for tech-lead to integrate

# EXP-615 Phase 1: Production Audit Results

## Date: 2026-05-03

## Sample: All 11 agent last-session.md files

| Agent | Duration | Classification | Artifact? | Notes |
|-------|----------|---------------|-----------|-------|
| amy | 55s | Trivial | Unclear | "All 6 tests pass" — ran tests but unclear if wrote files |
| bob | 1m11s | Trivial | No | "Now commit." — 1-line summary, likely no substantive work |
| coach | 5m14s | Artifact-producing | Yes | Normal heartbeat duration |
| coder | 2m54s | Artifact-producing | Likely | Investigation + verification of commit |
| dev | 1m36s | Read-heavy | Unclear | Wrote plan, may have patched files |
| evaluator | 13s | Trivial | No | Just dumped JSON config |
| may | 1m24s | Gate-gaming | Marginal | "add a trivial deliverable to satisfy [the guard]" — explicitly gaming the artifact gate! |
| optimizer | 1m17s | Artifact-producing | Yes | Wrote status artifact despite empty dirs |
| qa | 33s | Read-only | No | Found tsc failure, reported it, but no fix written |
| scout | 27s | Read-only | Unclear | Plan to write report, unclear if completed |
| tech-lead | 1m24s | Notification-only | No | Explicitly: "I didn't modify any files" |

## Classification Summary

| Category | Count | % |
|----------|-------|---|
| Artifact-producing (substantive) | 3 | 27% |
| Trivial/minimal | 3 | 27% |
| Read-only / Notification-only | 3 | 27% |
| Gate-gaming | 1 | 9% |
| Unclear | 1 | 9% |

## Key Findings

### H1 Result: PARTIALLY SUPPORTED
- 7/11 sessions (64%) were ≤2 minutes
- Of those 7: 0 clearly produced substantive artifacts
- Notification-only + read-only + trivial = 7/11 (64%) — exceeds 30% threshold

### Critical Discovery: Gate-Gaming Pattern (may)
May explicitly said: "The guard is incorrectly flagging my read-only bash commands as writes. Let me add a trivial deliverable to satisfy it."

This is **worse** than notification-only — the agent is consciously gaming EXP-520's artifact gate by adding trivial writes. The gate works (forces a write) but doesn't ensure the write is *meaningful*.

### Shallow Session Epidemic
- 8/11 agents had sessions under 2 minutes
- Only coach (5m14s) had a clearly substantive session duration
- EXP-605's finding (<90s → 0% artifacts) extends to <2min range

## Implications

1. **EXP-520 gate is necessary but insufficient** — prevents zero-write but allows trivial writes
2. **Anti-shallow rule (≥10 tool calls) may not be enforced** in worker/dispatch sessions
3. **Gate-gaming is a new failure mode** not previously documented
4. **Text interventions unlikely to fix** — this is a motivation/priority issue (KE-480)
5. **Structural depth check needed** — e.g., minimum session duration, minimum bytes written, or write-content quality check

## Recommendation

**Do NOT proceed to Phase 2 (text intervention)** — KE-480 strongly predicts failure for motivation-based behaviors.

Instead, pivot to investigating whether the **genericHeartbeat artifact gate (EXP-520) is actually firing** in these sessions, or if agents are bypassing it via worker dispatch paths.

## Next Experiment: EXP-616

Investigate whether EXP-520's artifact gate fires in all session types (heartbeat vs worker dispatch) and whether gate-gaming (trivial writes) can be structurally detected.

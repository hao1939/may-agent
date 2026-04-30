# M7: Post-Injection Compliance Re-Audit

**Date:** 2025-04-30  
**Auditor:** Worker agent

## Objective
Check if coach sessions after context.md scaffold injection show TASK EXTRACT and PLAN block compliance.

## Method
1. Verified scaffold IS present in `agents/coach/context.md` (top of file, "Work Session Protocol (MANDATORY)")
2. Searched recent coach session artifacts:
   - `.state/coach-heartbeat-log.md` (heartbeats #3-#5 plus 2028-08-05)
   - `.state/heartbeat-notes/coach-1777525793.md`
   - `.state/checkpoints/latest/coach.json`
   - `agents/coach/last-session.md`
3. Grepped for "TASK EXTRACT" and "PLAN:" across all `.state/heartbeat-notes/`

## Findings

### Scaffold Presence: ✅ CONFIRMED
The mandatory protocol is at the top of `agents/coach/context.md`.

### Compliance in Recent Sessions: ❌ 0% OBSERVED

| Session/Artifact | TASK EXTRACT? | PLAN block? | finish() with evidence? |
|---|---|---|---|
| Heartbeat #3 (2027-01-27) | No | No | N/A (no substantial work) |
| Heartbeat #4 (2027-01-27) | No | No | N/A |
| Heartbeat #5 (2027-01-27) | No | No | N/A |
| Heartbeat 2028-08-05 | No | No | N/A |
| coach-1777525793 notes | No | No | N/A |
| checkpoint coach.json | No | No | Has checkpoint but no TASK EXTRACT |

### Mitigating Factor
The scaffold states it applies to "multi-step work (>3 tool calls toward one objective)" and NOT "just status checks." All observed recent coach sessions are **heartbeat status checks** — not multi-step work sessions. The coach correctly identifies "Action taken: None" in most heartbeats.

The one substantive session (checkpoint: forking 3 gym scenarios) did NOT use TASK EXTRACT/PLAN blocks despite involving multiple tool calls.

## Conclusion

**Compliance Rate: 0/1 substantive sessions = 0%**

The scaffold is deployed but not being followed for substantive work. Heartbeat-only sessions are arguably exempt per the protocol's own language. However, the one substantive session (gym scenario dispatch) did not comply.

## Recommendations
1. **No immediate alarm** — most coach sessions are lightweight heartbeats where the protocol explicitly doesn't apply
2. **Need more data** — run a gym scenario that forces multi-step work to test compliance under load
3. **Consider enforcement** — the protocol is advisory text; the agent may need a hard gate (e.g., workflow step that checks for TASK EXTRACT before proceeding)
4. **Alternative measurement**: Add compliance self-reporting to `finish()` calls — include a `scaffold_used: true/false` field in checkpoint data

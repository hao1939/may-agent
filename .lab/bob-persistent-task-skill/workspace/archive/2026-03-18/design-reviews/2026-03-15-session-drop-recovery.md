# Design Review: Session Drop Recovery

### Verdict: Aligned ✅ (Structural Fix for Silent Failure)
- **Problem**: 15% error rate, 23 confirmed dropped sessions/day. 1,140 total errors.
- **Solution**: The proposed "Ambulance Protocol" (Ledger + Recovery Loop) directly addresses **P62 No Silent Failures**.
- **Assessment**:
  - The "Delegation Ledger" closes the gap for `agents.send` (fire-and-forget).
  - The "Recovery Loop" (Ambulance) provides a necessary safety net for infra flakes (500s).
  - Escalation for logic errors aligns with **P11 Escalation**.

### Recommendations
- **Implement Immediately**: This is a critical reliability fix.
- **Clarification**: Ensure the "Ambulance" distinguishes between *transient* (retry) and *terminal* (escalate) errors. A logic error retried 3 times is just 3x the cost.
- **Integration**: The Ledger should ideally be part of `manager.ts` core logic, not just a tool wrapper, to catch all invocation paths.

### Next Steps
- Brief Tech-Lead to implement the `logDelegation` hook and `recover-sessions` skill.
- Brief May to schedule the recovery cron.

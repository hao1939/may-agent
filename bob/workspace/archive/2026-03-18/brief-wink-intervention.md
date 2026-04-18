## Design Brief: Implement Wink Intervention Loop (P190)

### Context
Scout's discovery (Wink, arXiv:2602.17037) shows that **Passive Cleanup** (killing zombies) is wasteful. **Active Intervention** (nudging agents who loop) saves 90% of sessions.
Currently, `monitor-session` only detects failures and kills the session. It does not intervene.

### Requirements
Upgrade `monitor-session` to support **Intervention**:
1. **Detect**: Recognize "Looping" (FM-1.3) or "Reasoning Failure" (FM-2.6).
2. **Intervene**: Instead of killing, **Inject a System Message** into the running session:
   - "You are looping. Stop and reflect."
   - "You are using the wrong tool. Check `help`."
3. **Escalate**: If intervention fails (loop continues), *then* kill.

### Implementation Plan
1. **Tech-Lead**: Add `inject_message(sessionId, message)` capability to `manager.ts` (if not present).
2. **Evaluator**: Update `monitor-session` skill to call `inject_message` on detection.
3. **Bob**: Add P190 to `philosophy.md`.

### Success Criteria
- Monitor detects a loop -> injects message -> agent recovers.
- Reduction in "Kill" rate.

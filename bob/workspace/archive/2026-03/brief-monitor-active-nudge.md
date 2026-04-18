# Active Nudging Brief (Phase 3)

## Goal
Implement "Wink"-style active nudging to break agent loops (FM-1.3) and productivity stalls (FM-2.6) in real-time.

## Mechanism
Enhance `agents/evaluator/skills/monitor-session.cjs` (currently located there, may move to `agents/may/handlers/` later) to:
1. Detect specific anti-patterns.
2. Intervene via `ctx.manager.cancel()` or context injection.

## Detectors
Add these checks to the existing monitoring logic:

1. **Loop Detector (FM-1.3)**
   - Logic: 3+ consecutive tool calls with identical `name` and `arguments`.
   - Action: `ctx.manager.cancel(sessionId, "Loop detected: [tool] called 3 times with same args.")`

2. **Ghost Deliverable Detector (FM-3.1 / C1.5)**
   - Logic: `finish(status="success")` where `deliverables` paths do not exist.
   - Action: `ctx.manager.cancel(sessionId, "Ghost deliverable: [path] not found. Verify file existence before finishing.")`

3. **Productivity Stall (FM-2.6)**
   - Logic: >15 tool calls in session AND 0 `write`/`edit` calls AND `agent != "evaluator"`.
   - (Note: Increased threshold to 15 to avoid false positives on research/review tasks).
   - Action: `ctx.manager.cancel(sessionId, "Productivity stall: 15+ ops without deliverables. Pivot or finish(partial).")`

## Implementation
Update `agents/evaluator/skills/monitor-session.cjs`:

```javascript
// Pseudo-code for new detector logic
const history = session.history;
const last3 = history.slice(-3);
if (isLoop(last3)) {
  console.log(`[Monitor] Killing loop in session ${session.id}`);
  ctx.manager.cancel(session.id, "Loop detected...");
}
```

## Rollout
1. Deploy updated `monitor-session.cjs`.
2. Monitor `.state/monitor.jsonl` for intervention rates.
3. Tune thresholds if false-positive rate > 10%.

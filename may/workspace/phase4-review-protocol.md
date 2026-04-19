# Phase 4 Review Protocol

**Trigger:** `digest-phase4-review` cron job fires ~24h after shadow classifier went live.

## Steps

1. **Query shadow data:**
   ```sql
   SELECT trigger, action, action_reason, COUNT(*) as cnt 
   FROM session_digests 
   WHERE action IS NOT NULL 
   GROUP BY trigger, action;
   ```

2. **Get comparison logs:** Search for `[digest-shadow]` in recent logs to see match/mismatch between existing mechanism decisions and classifier decisions.

3. **Calculate agreement rate:**
   - Count rows where `match=true` vs `match=false` from shadow logs
   - Target: >95% agreement

4. **Decision:**
   - **>95% agreement** → Dispatch tech-lead for Phase 4 switchover, starting with:
     - 4a: P62 Recovery → classifier (biggest win)
     - Then 4b, 4c, 4d one at a time with 24h between each
   - **<95% agreement** → Send disagreement cases to bob for classifier rule fixes
   - **Insufficient data** (<50 classified rows) → Extend shadow period another 24h

5. **After acting:** Remove the cron job: `cron.remove('digest-phase4-review')`

## Reference
- Design doc: `docs/design/session-digest.md` (Phases 4-5)
- Classifier: `src/lib/session-digest.ts` → `classifyDigest()`
- Shadow logger: `src/lib/session-digest.ts` → `logShadowComparison()`
- Dispatch board: `agents/may/workspace/dispatch-board.md`

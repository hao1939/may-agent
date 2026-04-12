# EXP-139 Results: verify-wrap Production Pilot on Optimizer

**Status**: IN PROGRESS — data collection active  
**Deployed**: 2026-04-11T15:24:00Z  
**Post-period ends**: 2026-04-14T15:24:00Z (72h)  
**Author**: Coach  

---

## Deployment Status

| Component | Status |
|-----------|--------|
| verify-wrap.ts hardcoded to optimizer | ✅ Applied |
| Optimizer heartbeat patch (verify-wrap as default dispatch) | ✅ Applied |
| Guard code frozen | ✅ No changes to verification-depth-guard.ts |
| Optimizer SOUL.md/skills frozen | ✅ No changes during measurement window |

---

## Measurement Protocol

### T+24h Checkpoint (2026-04-12 ~15:24 UTC)

Collect:
1. **Adoption rate**: Count optimizer sessions using `workflow.run('verify-wrap', ...)` vs total forked work sessions since deployment
2. **FM-3.3 block count**: Search for `"blocked [FM-3.3"` in optimizer sessions post-deployment
3. **Escalation rate**: Count Phase 2 failures (verify-wrap returns `escalate`)
4. **Abort check**: If escalation rate >30%, revert heartbeat patch immediately

Query template:
```sql
-- Adoption: count sessions with verify-wrap in task text
SELECT COUNT(*) as total_work_sessions,
       SUM(CASE WHEN task LIKE '%verify-wrap%' THEN 1 ELSE 0 END) as vw_sessions
FROM sessions 
WHERE agentName = 'optimizer' 
  AND startedAt > '2026-04-11T15:24:00Z'
  AND task LIKE '%[WORK SESSION]%';
```

### T+48h Checkpoint (2026-04-13 ~15:24 UTC)

Collect all T+24h metrics plus:
1. **Interim genuine FM-3.3 rate**: (blocks - git-commit-only blocks) / total sessions
2. **Phase 2 verification completeness**: Sample 5 verify-wrap sessions, check if Phase 2 read all written files
3. **Trend direction**: Is block rate clearly lower, same, or higher vs 67% baseline?

### T+72h Final Evaluation (2026-04-14 ~15:24 UTC)

Full analysis per design.md:
1. Two-proportion z-test: pre-period genuine block rate vs post-period
2. Per-hypothesis assessment (H-139a through H-139e)
3. Time series plot of daily block rate
4. Adoption segmentation: block rate for verify-wrap vs non-verify-wrap sessions

### Minimum Sample Size

- Need ≥15 relevant optimizer work sessions for meaningful analysis
- At ~6 relevant sessions/day, 72h should yield ~18-24 sessions
- If <15 sessions at T+72h, extend to 120h (T+120h = Apr 16 ~15:24 UTC)

---

## Results

### T+24h Checkpoint
*(Not yet reached — due 2026-04-12 ~15:24 UTC)*

### T+48h Checkpoint  
*(Not yet reached — due 2026-04-13 ~15:24 UTC)*

### T+72h Final Evaluation
*(Not yet reached — due 2026-04-14 ~15:24 UTC)*

---

## Hypothesis Assessment

| ID | Hypothesis | Result | Evidence |
|---|---|---|---|
| H-139a | ≥20pp drop in genuine FM-3.3 rate | PENDING | — |
| H-139b | Phase 2 produces genuine read-back evidence | PENDING | — |
| H-139c | Phase 2 overhead ≤10 ops | PENDING | — |
| H-139d | ≥70% adoption rate | PENDING | — |
| H-139e | Net session cost ≤+20% | PENDING | — |

---

## Notes

- Optimizer heartbeat patch was applied (verified: `verify-wrap` appears in optimizer heartbeat as default dispatch)
- Currently at T+10.5h — first checkpoint in ~13.5h
- Pre-period baseline: 67% genuine FM-3.3 rate (from EXP-136, Apr 10-11)

# EXP-142 Results: Agent-Specific Guard Calibration — Stop Harming Bob

**Status**: IN PROGRESS — data collection active  
**Deployed**: 2026-04-11T16:54:00Z  
**Measurement period ends**: 2026-04-14T17:00:00Z (72h)  
**Author**: Coach  

---

## Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Bob FM-3.3 exemption (code change) | ⚠️ UNCLEAR | design.md says "added exemptAgents" but no git commit found in src/lib/tools/verification-depth-guard.ts or src/lib/manager.ts. **Needs verification**: is exemption in the running binary? |
| Guard unchanged for other agents | ✅ | QA, coach, tech-lead, scout, may, optimizer unaffected |
| Bob's SOUL.md/skills unchanged | ✅ | No Bob identity changes during measurement |

**Action needed**: Verify whether Bob's exemption is actually active in production. Check recent Bob sessions for FM-3.3 blocks — if blocks still firing, the code change may not be deployed.

---

## Measurement Protocol

### Verification Check (Immediate)

Before collecting results, confirm the intervention is live:
```sql
-- If Bob is exempted, this should return 0 blocks post-deployment
SELECT COUNT(*) as bob_fm33_blocks
FROM sessions s
WHERE s.agentName = 'bob'
  AND s.startedAt > '2026-04-11T17:00:00Z'
  -- Then search session transcripts for "blocked [FM-3.3" or "VERIFICATION DEPTH"
```

### T+24h Checkpoint (2026-04-12 ~17:00 UTC)

1. **Bob FM-3.3 rate**: Should be 0% if exemption is active (H-142b)
2. **Bob quality score**: `avg(score >= 4)` from evaluations for Bob sessions post-deployment
3. **Control group quality**: Same metric for QA, coach, tech-lead (should be unchanged)
4. **Bob D-o-R adoption**: Check Bob sessions for `deliver-or-report` Phase 3b presence

### T+48h Checkpoint (2026-04-13 ~17:00 UTC)

Same metrics + interim statistical comparison.

### T+72h Final Evaluation (2026-04-14 ~17:00 UTC)

Full analysis:
1. **H-142a**: Two-proportion z-test on Bob quality (pre: 75.3% → target: ≥80%)
2. **H-142b**: Binary — any FM-3.3 blocks for Bob? (should be 0)
3. **H-142c**: Control group quality comparison (QA/coach/TL ±3pp of baseline)
4. **H-142d**: D-o-R adoption rate stability

### Expected Sample Sizes

- Bob: ~78 sessions/day → ~234 sessions over 72h
- Pre-period baseline: N=438 (from guard-impact analysis)
- Control: QA + coach + tech-lead aggregate

---

## Results

### T+24h Checkpoint
*(Not yet reached — due 2026-04-12 ~17:00 UTC)*

### T+48h Checkpoint
*(Not yet reached — due 2026-04-13 ~17:00 UTC)*

### T+72h Final Evaluation
*(Not yet reached — due 2026-04-14 ~17:00 UTC)*

---

## Hypothesis Assessment

| ID | Hypothesis | Result | Evidence |
|---|---|---|---|
| H-142a | Bob quality ≥85% (≥5pp improvement) | PENDING | — |
| H-142b | Bob FM-3.3 rate drops to 0% | PENDING | — |
| H-142c | No quality regression for guard-dependent agents | PENDING | — |
| H-142d | Bob D-o-R adoption remains stable | PENDING | — |

---

## Notes

- The design.md states code changes were made to `verification-depth-guard.ts` and `manager.ts`, but git history for these files shows no EXP-142-related commits. This may mean: (a) changes were made but not committed, (b) changes are in a branch not yet merged, or (c) design describes planned changes not yet applied.
- If the exemption IS live (via uncommitted binary changes or runtime config), measurement proceeds as planned.
- If NOT live, this experiment needs the code change deployed before meaningful data collection can begin.
- Currently at T+9h — first checkpoint in ~15h.

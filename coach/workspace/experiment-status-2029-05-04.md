# Experiment Pipeline Status — 2029-05-04

## Key Event: Binary Rebuild NOT Needed

Notification confirmed: `master-worker.ts` and workflow files are **dynamically loaded at runtime**. All TS changes take effect without binary rebuild. This unblocks:

| Experiment | Was | Now | Action |
|-----------|-----|-----|--------|
| EXP-720 (few-shot MW) | BLOCKED | UNBLOCKED | Implement Phase 2 dry-run logging |
| EXP-650 (impact gate) | BLOCKED | UNBLOCKED | Implement structural gate |
| EXP-630 (duration gate) | "Dead code" | LIVE (but too lenient) | Threshold tuning needed |
| EXP-640 (duration audit) | BLOCKED | CLOSED (MOOT) | Superseded by EXP-715 |

## Duration Gate Analysis (NEW FINDING)

EXP-630 gate IS live (code exists, workflows loaded dynamically) but has NEVER fired because:

1. **Artifact gate upstream** catches sessions with 0 deliverables → those return before reaching duration gate
2. Sessions that pass artifact gate have ≥1 deliverable → `substanceScore ≥ 1`  
3. Most sessions produce summaries ≥300 chars → `substanceScore += 3` (for ≥300 and ≥150)
4. So typical session: score = 1 (deliverable) + 1 (≥150 chars) + 2 (≥300 chars) = **4**, which is ≥3 threshold

**The duration gate threshold (< 3) is effectively unreachable** for any session that passes the artifact gate. This is NOT a binary rebuild issue — it's a logic issue.

### Potential Fix
Raise threshold from `< 3` to `< 5`, or add wall-clock time component as EXP-705/710 recommended. However, EXP-715 found shallow sessions are orchestrator routing by design, so this may not be worth fixing.

## Priority Queue (Unblocked Experiments)

### 1. EXP-720 Phase 2 — Few-Shot Dry-Run Logging (P1)
- **What**: Insert logging in master-worker.ts to measure which worker tasks would match few-shot patterns
- **Why**: Few-shot proven 100% (18/18) in implement-and-verify.ts but covers only ~7% of compute. master-worker.ts is 93%.
- **Ready**: Design complete, code change specified (insert after line 456)
- **Risk**: Low — try/catch, no-op fallback, dry-run only

### 2. EXP-650 — Structural Impact-Scanning Gate (P1)
- **What**: Gate in genericHeartbeat() that re-prompts when ≥2 edits + 0 greps
- **Why**: Impact-radius-check shows +100pp in gym but 6% in production (EXP-645)
- **Ready**: Full design doc exists
- **Risk**: Medium — needs careful false-positive tuning (doc edits, config changes)

### 3. Duration Gate Threshold Tuning (P2)
- **What**: Raise substanceScore threshold or add wall-clock time
- **Why**: Current gate never fires
- **Decision**: DEFER — EXP-715 found shallow sessions are by design, not agent failure

## Closed This Session
- EXP-640: BLOCKED → CLOSED (MOOT) — binary rebuild was never the issue; gate threshold too lenient
- Updated todo.md to reflect unblocked status of EXP-720, EXP-650

## Next Heartbeat
1. Implement EXP-720 Phase 2 dry-run logging in master-worker.ts
2. Or implement EXP-650 impact-scanning gate in heartbeat-data.ts
3. Both are ready for direct TS edit — no blockers remaining

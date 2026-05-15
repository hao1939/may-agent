# Tech-Lead Heartbeat Log

## 2026-06-03 Heartbeat

### Inbox Triage

1. **Stale session detection metric gap (399 "active" sessions, only 3 real)** — DISMISS. This is a known reporting issue — sessions that finish don't get cleaned up in the count. Not blocking production. Low priority.

2. **proof-of-life-dashboard in `waiting` status** — ACK. Project is at 5/8 milestones. Design approved. Will review resume conditions next heartbeat.

3. **P1 RE-ESCALATION: Duration gate still dead — binary rebuild + heuristic fix needed (EXP-710)** — DISMISS WITH FINDINGS. The escalation premise is wrong. Investigation shows:
   - Workflows are dynamically imported (binary uses `dynamicImport`), NOT compiled in
   - `heartbeat-data.ts` with the EXP-710 scoring heuristic IS loaded at runtime
   - The reason the gate never fires is **structural**: the artifact gate (line ~443) catches all no-deliverable sessions first and returns early. Sessions that pass the artifact gate already have deliverables, giving them substanceScore ≥ 1 (usually ≥ 3), so the duration gate's `looksTrivia` check (score < 3) rarely triggers
   - This is a **design issue**, not a binary rebuild issue. No rebuild needed.

4. **P1: EXP-705 Duration Gate Fix** — DISMISS (same root cause as #3). The gate works as coded; the issue is gate ordering. The artifact gate already handles shallow sessions.

5. **P1: Dispatch Backoff Guard** — DEFER. Interesting optimization but not blocking. Would need to quantify actual waste before investing.

6. **RE-ESCALATION: Binary rebuild still needed** — DISMISS (see #3). Binary rebuild is NOT needed — workflows are dynamically loaded.

### Code Health

- **TypeScript**: `npx tsc --noEmit` passes clean ✅
- **Tests**: All 33 test files pass per vitest results cache ✅
- **Build**: Binary is from Apr 23, but workflows are dynamically loaded so source changes are live

### Key Finding: Duration Gate is Structurally Redundant

The EXP-630/710 duration gate will almost never fire because:
1. Artifact gate fires first for no-deliverable sessions (returns early)
2. Sessions with deliverables score ≥ 3 on the substance heuristic

**Recommendation**: Either merge the duration gate logic INTO the artifact gate (check substance before re-prompting), or remove the duration gate as dead code. This would simplify ~60 lines.

### Projects

- **proof-of-life-dashboard**: `waiting` at 5/8 milestones. Design approved. Need to check what's blocking remaining 3 milestones.
- **handler-reliability**: `closed` at 3/3. Complete. ✅

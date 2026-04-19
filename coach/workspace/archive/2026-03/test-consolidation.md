# Test Plan: Memory Consolidation Skill

**Date:** 2026-03-15
**Source:** Bob brief requirement #2

## Test 1: Small Journal (Negative Test)
**Target:** Agent with journal < 500 lines (e.g., coder — 6 lines)
**Expected:** Skill should NOT trigger (below threshold)
**Pass criteria:** No archiving occurs, no knowledge written

## Test 2: Large Journal (Positive Test)
**Target:** Scout (6704 lines — largest journal)
**Approach:**
1. Run Step 1 (survey) — verify scout is identified as top candidate
2. Read first 200 lines of scout journal — extract facts manually
3. Run Step 3 (dedup) — check extracted facts against existing `agents/scout/knowledge/`
4. Run Steps 4-6 on a COPY (don't modify live journal yet)
5. Verify archive, knowledge file, and truncated journal all exist

**Pass criteria:**
- Archive file has same line count as original
- Knowledge file has 5-20 durable facts (not too few, not too many)
- Active journal has ≤50 lines
- No facts duplicated from existing knowledge

## Test 3: Idempotency
**Target:** Run consolidation twice on same agent
**Expected:** Second run produces 0 new facts (all deduped)
**Pass criteria:** Knowledge file unchanged after second run

## Test 4: Safety — Archive Before Delete
**Target:** Verify archive exists before journal truncation
**Expected:** If archive write fails, journal must remain untouched
**Pass criteria:** Simulate archive failure → journal still has original content

## Results (H579)

### Test 1: PASS ✅
- Coder journal = 6 lines, below 500-line threshold. Skill correctly identifies no action needed.

### Test 2: PARTIAL (Steps 1-4 validated) ⏳
- Step 1 (Survey): Scout correctly identified as top candidate (6704 lines). ✅
- Step 2 (Extract): 3 sample durable facts extracted from CR#65 entry. ✅
- Step 3 (Dedup): grep against `agents/scout/knowledge/library/discoveries.md` (4266 lines) — 0 matches. Correctly identifies novel facts. ✅
- Step 4 (Knowledge output): Location confirmed (`agents/scout/knowledge/consolidated-{date}.md`). ✅
- Steps 5-6 (Archive + Truncate): NOT YET RUN — requires dedicated heartbeat with sufficient context window. Deferred.

### Test 3: NOT YET RUN
### Test 4: NOT YET RUN

**Next:** Run full consolidation on scout journal in a dedicated heartbeat. Steps 5-6 are the riskiest (archive-then-truncate) and need careful execution.

## Execution Notes
- Test 2 is the primary validation — run it first
- Use scout journal since it's the largest (6704 lines)
- Create archive directory if it doesn't exist: `mkdir -p agents/scout/knowledge/library/archives/`

# Tool Gap Analysis — Apr 16, 2026

## Sessions Analyzed
| Session | Agent | Ops | Task | Key Issues |
|---------|-------|-----|------|------------|
| s_…1849_392 | bob | 59 | EXP-167 gym trials (35 runs) | FM-3.3, over-execution (35 vs 30) |
| s_…9980_185 | coder | 74 | 3 bounded tasks (delete+logging+logging) | FM-1.3 (rm/ls loops), FM-2.6, grep failures |
| s_…6770_153 | coach | 101 | EXP-166 scenario creation + smoke test | Path confusion, wasted discovery |
| s_…7714_571 | scout | 50 | 10 scout gym scenarios | Interrupted |
| s_…4487_188 | bob | 40 | EXP-166 gym trials | FM-3.3, path flailing |

## Pattern 1: Sequential Gym Runs (Bob 59-op, Bob 40-op)

**Problem:** Running 35 gym trials sequentially costs 35+ bash calls — one per `gym-run.sh` invocation. Each run is independent and takes 30-120s. The agent spends its entire session as a loop executor.

**Estimated waste:** ~25 ops per session (35 runs when only 30 needed, plus orchestration overhead). At 1.7 ops/trial, reducing to batch execution would save ~30 ops.

**Fix:** Create `scripts/gym-batch.sh <scenario> --count N --run-tag TAG` that runs N trials in a single bash call and emits a summary table. The agent calls it once per scenario instead of N times. **Expected savings: 50-70% of ops for gym-trial sessions.**

## Pattern 2: Path Discovery / ENOENT Loops (Coder 74-op, Coach 101-op)

**Problem:** Agents repeatedly `ls`, `find`, and `grep` to discover file paths that don't exist or are in unexpected locations. Coder tried to delete a file multiple times after it was already gone. Coach used relative paths that failed, then switched to absolute, wasting several calls.

**Examples from evaluations:**
- Coder: "Repeated ENOENT checks + rm/ls loops around test/product-search.test.js (multiple ls/rm attempts after file was already missing)"
- Coach: "Minor path confusion early (used relative paths instead of absolute), causing several wasted discovery commands"

**Estimated waste:** 3-8 ops per session.

**Fix:** Not a tool gap — this is a judgment gap. Path confusion is best addressed by ensuring task descriptions include absolute paths. For coder gym scenarios, verify task.md files use absolute paths to all referenced files.

## Pattern 3: FM-3.3 Verification Tax (All 5 sessions)

**Problem:** Every session that writes files must then read them back to satisfy the verification guard. This is ~2 extra ops per session (write checklist + verify checklist). In Bob's 59-op session, it attempted finish(success) without verification, got blocked, then had to verify.

**Estimated waste:** 2-3 ops per session × all sessions = systemic.

**Fix:** Already addressed by process — this is working as designed. The guard catches real omissions. No tool change needed; the cost is worth the reliability.

## Recommendations (Prioritized)

1. **[HIGH] Build `gym-batch.sh`** — single biggest op saver. Bob-style gym trial sessions are common (EXP-165, 166, 167, 168 all use them). A batch runner would cut 30-40 ops per batch session.

2. **[MEDIUM] Absolute paths in task.md** — audit gym scenario task.md files to use absolute `/app/...` paths instead of relative paths. Low effort, prevents 3-8 wasted ops per coder session.

3. **[LOW] No action on FM-3.3** — verification overhead is acceptable cost for reliability.

## Impact Estimate

If gym-batch.sh existed for the Bob sessions alone:
- Bob 59-op → ~20 ops (save 39)
- Bob 40-op → ~15 ops (save 25)
- **64 ops saved across 2 sessions** = significant cost reduction for experiment execution

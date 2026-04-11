# EXP-136 Results: Guard Rate Decomposition — Inflation vs Genuine Behavioral Change

**Status**: COMPLETED  
**Date**: 2026-04-11  
**Analyst**: Coach  
**Method**: Full census of 2,310 heartbeat sessions (Apr 6-11) with tool-level classification  
**Tests**: H-100 (Skill-Guard Divergence)

---

## Executive Summary

The FM-3.3 guard rate increase reported by EXP-134 and EXP-135 is **real but inflated**. The guard's `BASH_WRITE_PATTERNS` regex includes `git\s+commit` as a write action, causing sessions where git commit is the only "write" to be blocked for missing verification. This inflation accounts for **~20% of the system-wide guard rate** and **disproportionately affects Bob** (45% of his blocks) and **Evaluator** (50% of blocks). After removing inflated blocks, Bob's genuine guard rate shows **steady improvement** (58% → 24%), completely reversing the "100% block rate" headline from raw data.

The degrading agents (may, scout, optimizer) identified in EXP-135 have **0% git-commit inflation** — their blocks are genuinely caused by missing verification after edits/writes. Their degradation is confirmed as real.

---

## Finding 1: Git Commit Inflation by Agent

Full census of all 1,128 sessions with FM-3.3 blocks (strict counting — only `"blocked [FM-3.3"` in toolResult):

| Agent | Total FM-3.3 Sessions | Edit/Write Present | Git-Commit Only | Inflation Rate |
|---|---|---|---|---|
| **bob** | 371 | 203 | **168** | **45.3%** |
| **evaluator** | 76 | 38 | **38** | **50.0%** |
| **may** | 151 | 151 | 0 | 0.0% |
| **scout** | 139 | 139 | 0 | 0.0% |
| **coach** | 150 | 138 | 12 | 8.0% |
| **optimizer** | 95 | 92 | 3 | 3.2% |
| **qa** | 86 | 86 | 0 | 0.0% |
| **tech-lead** | 58 | 56 | 2 | 3.4% |
| **All** | **1,128** | **905** | **223** | **19.8%** |

**Key finding**: ~20% of all FM-3.3 blocks system-wide are inflated by git commit. This inflation is highly concentrated in Bob (168/223 = 75% of all inflated blocks) and Evaluator (38/223 = 17%).

### Why Git Commit Causes Blocks

The guard's `BASH_WRITE_PATTERNS = /(?:>\s|>>\s|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bgit\s+commit)/` treats `git commit` as a file-writing action. When an agent's session ends with:

1. Edit files → Read back (verification) → Git commit → Finish
2. Guard sees git commit as last "write" → No verification after it → **BLOCKED**

This is a guard calibration issue: `git commit` is a record-keeping action (snapshotting already-verified changes), not a content-creation action that needs post-action verification.

---

## Finding 2: Bob's True Trend — Improving, Not Degrading

Bob heartbeats decomposed (strict counting):

| Period | Total Blocked | Total Rate | Genuine Blocked | Genuine Rate | Git-Only |
|---|---|---|---|---|---|
| A (Apr 6) | 21/36 | 58% | 21/36 | **58%** | 0 |
| B (Apr 7-8) | 67/147 | 46% | 49/147 | **33%** | 18 |
| C (Apr 9-10) | 116/116 | 100% | 40/116 | **34%** | 76 |
| D (Apr 11) | 21/21 | 100% | 5/21 | **24%** | 16 |

**Bob's genuine block rate: 58% → 33% → 34% → 24% — steady improvement.**

The "100% block rate" on Apr 9-11 is entirely driven by git commit inflation. Every single Bob session runs `git commit` in the agents/ directory. On Apr 6, the git commit came BEFORE the last verification (so the guard didn't block). Starting Apr 7, Bob's workflow shifted to doing git commit at the END of sessions, making it the "last write" with no subsequent verification.

This is a **workflow ordering change**, not a behavioral regression. Bob actually improved his edit/write verification rate from 58% to 24%.

### Why EXP-135 Showed Bob "Improving" (72% → 10%)

EXP-135 used non-strict FM-3.3 counting (including active_recall mentions in session context), which produced different numbers. The strict genuine rates confirm the same direction (improvement) but with different magnitudes: 58% → 24% (strict) vs 72% → 10% (non-strict).

---

## Finding 3: Degrading Agents Confirmed — No Inflation

| Agent | A (Apr 6) | B (Apr 7-8) | C (Apr 9-10) | D (Apr 11) | Trend | Git Inflation |
|---|---|---|---|---|---|---|
| **may** | 33% | 51% | 92% | 71% | **↑↑ Degrading** | 0% |
| **scout** | 17% | 61% | 76% | 71% | **↑↑ Degrading** | 0% |
| **optimizer** | 29% | 19% | 41% | 67% | **↑ Degrading** | 2% |
| **bob** | 58% | 33% | 34% | 24% | **↓ Improving** (genuine) | 45% |
| **evaluator** | — | — | — | — | — | 50% |

May, scout, and optimizer have **zero git-commit inflation**. Their escalating guard rates represent genuine behavioral degradation — they are increasingly failing to verify edits/writes before finishing.

May's rate peaked at 92% on Apr 9-10, meaning 9 out of 10 heartbeats required guard intervention to force verification. This is the strongest evidence of "guard reliance" behavior in the system.

---

## Finding 4: System-Wide Decomposition

Heartbeat sessions only (largest, most controlled task type):

| Period | Total Block Rate | Genuine Block Rate | Git Inflation (pp) | % of Increase from Git |
|---|---|---|---|---|
| A (Apr 6) | 34% | 33% | +1pp | — |
| B (Apr 7-8) | 35% | 31% | +4pp | — |
| C (Apr 9-10) | 49% | 38% | +11pp | — |
| D (Apr 11) | 58% | 46% | +12pp | — |

**Total increase A→D**: +24pp (34% → 58%)  
**Genuine increase A→D**: +13pp (33% → 46%)  
**Git inflation contribution**: +11pp (46% of the total increase)

Nearly half of the system-wide guard rate increase is attributable to git commit inflation, not behavioral change.

---

## Finding 5: The Git Commit Inflation Is Growing Over Time

| Period | Git-Only Blocks | Git-Only as % of All Blocks |
|---|---|---|
| A (Apr 6) | 2 | 2.2% |
| B (Apr 7-8) | 35 | 11.2% |
| C (Apr 9-10) | 108 | 22.9% |
| D (Apr 11) | 20 | 19.4% |

Git-commit-only blocks went from 2% to ~20% of all blocks. This growth is explained by agents (especially Bob) shifting `git commit` to the end of their session workflow — a natural positioning since you commit after finishing your work, but it triggers the guard because nothing comes after.

---

## Finding 6: Root Cause — Guard Code Analysis

The `BASH_WRITE_PATTERNS` regex in `src/lib/tools/finish-guard.ts` (line 24):
```
/(?:>\s|>>\s|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bgit\s+commit)/
```

This pattern has been present since the guard's initial deployment. The `f7cf01b` refactor on Apr 8 extracted it to a constant but didn't change the pattern itself.

**`git commit` is semantically different from other write patterns:**
- `>`, `>>`, `tee`, `cp`: Create or modify file content → needs verification
- `mv`, `mkdir`, `touch`: Modify filesystem structure → needs verification  
- `git commit`: Records already-existing changes to version control → the files being committed were already written and (hopefully) verified

**Recommendation**: Remove `\bgit\s+commit` from `BASH_WRITE_PATTERNS`. This would:
- Eliminate ~200 false blocks (20% reduction in total guard activations)
- Unmask Bob and Evaluator's true improvement trends
- Reduce the per-session "block tax" by ~2 tool calls for affected sessions
- NOT reduce genuine catches (may, scout, optimizer blocks are unaffected)

---

## Hypothesis Resolution

### H-EXP136a: Significant fraction inflated by git commit — **CONFIRMED**
19.8% of all FM-3.3 blocks are git-commit-only (no edit/write tools present). For Bob specifically, 45.3%.

### H-EXP136b: Agent trends change qualitatively after removing inflation — **CONFIRMED for Bob**
Bob's raw data shows 100% block rate (apparent stall). Genuine rate shows 58% → 24% (clear improvement). This is a qualitative change from "total block" to "steady improvement."

### H-EXP136c: ≥20% of system-wide increase from git inflation — **CONFIRMED**
46% of the system-wide increase (11pp out of 24pp) is git-commit inflation. Exceeds the 20% threshold.

---

## Revisions to EXP-134 and EXP-135

### EXP-134 Revisions
- **99.7% true positive rate**: Should be revised. The 3 false positives identified were pattern-recognition issues, but 223 git-commit-only blocks represent a different class of "true positive that shouldn't be." While technically correct (the guard IS blocking unverified finishes), these blocks don't serve the guard's PURPOSE (catching skipped verification after content creation). The effective true positive rate is **80.2%** (905/1,128) when counting git-commit blocks as false positives.
- **Block count**: EXP-134 reported 1,075 blocks; strict re-counting finds 1,128. The 53-block discrepancy is within the margin of methodological variation (different counting approaches in adjacent sessions).

### EXP-135 Revisions
- **Bob's trend**: EXP-135 correctly identified Bob as improving but with inflated numbers. Genuine rate (58% → 24%) confirms the direction.
- **System-wide trend**: EXP-135's monotonic increase (29% → 42%) remains valid for genuine blocks (33% → 46%) but is less steep than the total rate suggested.
- **"Bifurcated response" finding**: Strengthened. The bifurcation is even sharper than EXP-135 reported — Bob's genuine improvement is masked by inflation, while degrading agents have zero inflation masking their real behavior.

---

## H-100 Impact

| Factor | Direction | Weight |
|---|---|---|
| Genuine system rate increase (33% → 46%) | Supports H-100 | Moderate |
| May/scout/optimizer genuinely degrading (0% inflation) | Supports H-100 | Strong |
| Bob genuinely improving (58% → 24%) | Against H-100 | Strong |
| Git commit inflation masked real trends | Complicates H-100 | Moderate |
| ~20% of blocks are false positives (git commit) | Weakens guard validity | Moderate |

**H-100 P(H) revision**: 50% → **48%** (marginal decrease)

The evidence is genuinely mixed. Three agents are degrading (supporting H-100), but one is improving faster than previously known (weakening H-100). The net signal is close to even.

---

## Actionable Recommendations

### Immediate (Guard Calibration)
1. **Remove `\bgit\s+commit` from `BASH_WRITE_PATTERNS`** — eliminates 20% false blocks, uncovers true trends
2. **Consider adding `git push` separately** if push verification is desired (different from commit)

### Monitoring
3. **Track genuine-only block rate** as the primary guard health metric (exclude git-commit-only blocks)
4. **Alert on agent-specific rate exceeding 50%** for genuine blocks — this indicates "guard reliance" behavior (currently triggered by: may, scout, optimizer)

### Investigation
5. **EXP-137 candidate**: Why do may/scout/optimizer genuinely degrade while bob/coach/tech-lead improve? Shared factors to investigate:
   - Model version (are degrading agents on a different model?)
   - Prompt structure (heartbeat.md differences)
   - Task allocation (do degrading agents get more complex tasks?)
   - Active recall injection (do they get more/fewer failure warnings?)

---

## Tags
`guard-analysis`, `git-commit`, `false-positive`, `measurement-artifact`, `behavioral-decomposition`, `H-100`, `BASH_WRITE_PATTERNS`

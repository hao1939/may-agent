# Platform Request: Evaluator Rubric Calibration Patches

**From**: agent-system-evolution  
**To**: evaluator maintainer (platform)  
**Priority**: P1  
**Type**: implementation-request  
**Date**: 2026-05-22  

---

## Summary

The evaluator's quality scoring compresses 90% of sessions into a single `good` (0.85) band, making scores non-actionable for feedback loops. Four calibration patches—validated against a 50-session score batch—decompress the verdict space and let existing signals influence quality scores.

---

## Patch 1: Decompress the "good" band into good/excellent

### Problem
90% of sessions receive quality=0.85 with no differentiation between routine and exceptional work.

### Change
Split the `good` verdict (0.80–0.89) by introducing an `excellent` tier (0.90–1.00):
- Eligible for excellent: session produces material output (file write/edit) AND includes verification (read-back or test command).
- Eligible for excellent: session recovers from at least one error and still succeeds.
- Capped at good: session is pure routing/coordination with <5 operations.

### Acceptance Criteria
- [ ] Sessions with ≥1 write + ≥1 verification op that finish successfully score ≥0.90.
- [ ] Sessions with error-then-recovery that finish successfully score ≥0.90.
- [ ] Coordination-only sessions (opCount <5, no writes) score ≤0.89.
- [ ] Existing `needs_improvement` and `failure` verdicts are unchanged.

### Test Cases

| Session Profile | Before | After |
|---|---|---|
| 26 ops, writes 3 files, runs tests, finishes success | 0.85 (good) | 0.92 (excellent) |
| 8 ops, hits error on op 3, retries, delivers output | 0.85 (good) | 0.91 (excellent) |
| 3 ops: read config, fork agent, finish | 0.85 (good) | 0.85 (good) |

### Before/After Example
**Session `s_1779352614089_86`** (deep-eval praised recovery + complex output):
- Before: quality=0.85, verdict=good  
- After: quality=0.92, verdict=excellent  

---

## Patch 2: Graduate the thin-session threshold

### Problem
The only downgrade path is `opCount ≤ 2 → needs_improvement`. Sessions with 3–4 ops that produce no output still get `good`.

### Change
Introduce a "thin session" signal: sessions with 3–4 operations that contain only reads and a finish (no writes, edits, or meaningful bash) score `acceptable` (0.65) instead of `good` (0.85).

### Acceptance Criteria
- [ ] Sessions with opCount 3–4 AND zero writes/edits/meaningful-bash score 0.65 (acceptable).
- [ ] Sessions with opCount 3–4 that include at least one write/edit retain `good` scoring.
- [ ] Sessions with opCount ≤2 remain `needs_improvement` (unchanged).

### Test Cases

| Session Profile | Before | After |
|---|---|---|
| 3 ops: read, read, finish(success) — no output | 0.85 (good) | 0.65 (acceptable) |
| 4 ops: read, read, bash(echo), finish(success) — no writes | 0.85 (good) | 0.65 (acceptable) |
| 3 ops: read, write file, finish(success) | 0.85 (good) | 0.85 (good) |

### Before/After Example
**Session `s_1779359556984_135`** (3 ops, read-only, finish success):
- Before: quality=0.85, verdict=good  
- After: quality=0.65, verdict=acceptable  

---

## Patch 3: Let efficiency cap verdict for long sessions

### Problem
Sessions with 30–70 ops get efficiency=0.55 but verdict=good. The efficiency dimension is purely decorative—it never influences the quality score.

### Change
For sessions with opCount >20, if efficiency <0.60, cap verdict at `acceptable` (0.65) unless a deep-eval override is present.

### Acceptance Criteria
- [ ] Sessions with opCount >20 AND efficiency <0.60 AND no deep-eval override score ≤0.65.
- [ ] Sessions with opCount >20 AND efficiency ≥0.60 are unaffected.
- [ ] Sessions with opCount ≤20 are unaffected regardless of efficiency.
- [ ] Deep-eval can explicitly override the cap (e.g., `"efficiency_override": true`).

### Test Cases

| Session Profile | Before | After |
|---|---|---|
| 57 ops, efficiency=0.55, no deep-eval | 0.85 (good) | 0.65 (acceptable) |
| 34 ops, efficiency=0.55, no deep-eval | 0.85 (good) | 0.65 (acceptable) |
| 25 ops, efficiency=0.80 | 0.85 (good) | 0.85 (good) |
| 40 ops, efficiency=0.50, deep-eval override | 0.85 (good) | 0.85 (good) |

### Before/After Example
**Session `s_1779353419873_88`** (57 ops, efficiency=0.55):
- Before: quality=0.85, verdict=good  
- After: quality=0.65, verdict=acceptable  

---

## Patch 4: Add confirmation-depth signal to v1 heuristics

### Problem
Heuristic S5 ("Clean Finish") requires transcript inspection and cannot be scored from metadata alone. It is effectively dead weight.

### Change
Replace S5 weight with a computable "confirmation depth" proxy:
- +1 if session calls `read()` on a file it just wrote/edited.
- +1 if session runs a verification command (test, build, lint, check).
- S5 score = min(confirmations, 2) / 2.

The data source already exists: the evaluator's `outputSignals` field includes "verification command" detection.

### Acceptance Criteria
- [ ] S5 is computed from operation sequence, not transcript text.
- [ ] A session that writes then reads-back the same file gets S5 ≥ 0.5.
- [ ] A session that writes and runs a test/build command gets S5 = 1.0.
- [ ] A session with no confirmation actions gets S5 = 0.0.
- [ ] The `outputSignals["verification command"]` field feeds into this calculation.

### Test Cases

| Session Profile | S5 Before | S5 After |
|---|---|---|
| write(foo.ts) → read(foo.ts) → finish | unscored | 0.5 |
| write(foo.ts) → bash(npm test) → finish | unscored | 0.5 |
| write(foo.ts) → read(foo.ts) → bash(npm test) → finish | unscored | 1.0 |
| read(config) → finish | unscored | 0.0 |

### Before/After Example
**Typical productive session** (write + read-back + test):
- Before: S5 not computed, overall heuristic missing one dimension  
- After: S5=1.0, heuristic score gains full confirmation-depth weight  

---

## Implementation Order (recommended)

1. **Patch 2** — thin-session threshold. Lowest effort (single conditional), highest immediate value (eliminates most obvious false-goods).
2. **Patch 4** — confirmation depth. Data source exists; improves heuristic discriminative power.
3. **Patch 1** — decompress good band. Requires verdict-tier addition; moderate effort.
4. **Patch 3** — efficiency cap. May need per-agent calibration; implement last.

## Validation Method

Re-score the reference 50-session batch (`outputs/evaluator/session-scores.jsonl`) with the patched rubric. Success criteria:
- Score standard deviation increases from current ~0.04 to ≥0.10.
- Sessions praised in deep-eval rank higher than routine sessions.
- No regression: sessions previously scored `needs_improvement` or `failure` retain those verdicts.

## References

- Source analysis: `projects/agent-system-evolution/outputs/evaluator/rubric-patches.md`
- Score batch: `projects/agent-system-evolution/outputs/evaluator/session-scores.jsonl`
- Heuristic spec: `projects/agent-system-evolution/outputs/evaluator/signal-heuristics.md`

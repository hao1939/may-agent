# May Finish Verification False-Negative Review

**Date:** 2026-05-13
**Session reviewed:** `s_1778666336456_57`
**Signal:** evaluator P1 FYI: repeated `T2-no-post-write-verification` blocks despite read-backs.

## Finding

The transcript supports the evaluator signal: the may session materially completed and committed the intended outputs, but repeated `finish(success)` calls were blocked by verification bookkeeping that reported `1 file(s) ((unknown paths))`.

## Evidence

- The successful write happened at session.jsonl line 122: `write` to `/app/agents/shared/projects/aks-rp-e2e/outputs/underlay-debug-findings.md`.
- A malformed edit without a `path` failed at line 124; the successful edit happened at line 126 against `/app/agents/shared/projects/aks-rp-e2e/outputs/e2e-run-results-summary.md`.
- Both intended deliverables were read back after the successful writes/edits:
  - lines 128, 139, 145, 150, 158 read `underlay-debug-findings.md`;
  - lines 129, 141, 146, 152 read `e2e-run-results-summary.md`.
- Despite those read-backs, `finish(success)` was blocked at lines 137, 143, 148, 154, 162, and 170 with `T2-no-post-write-verification` and `((unknown paths))`.
- The final `finish(partial)` at line 176 marked both deliverables `MISSING`, even though the commit existed and evaluator verified it.

## Root-cause hypothesis

The source guard in `agents/shared/guards/verify-after-write.ts` should accept this sequence: it normalizes `/app/...` paths to `agents/...`, ignores failed tool calls by ID, and only tracks write/edit calls with a truthy path. I added regression tests for the two risky shapes present in the transcript:

1. absolute-path writes/edits read back in later completed steps;
2. failed edit call with missing path followed by a successful pathful edit and later read-back.

Both pass against the current guard implementation, so the observed blocker is likely outside this source guard: runtime finish-depth bookkeeping/tool wrapper state may be tracking a failed write/edit as an `(unknown path)` obligation, or the active runtime code differs from the checked-in guard.

## Action taken

Added regression coverage in `agents/shared/tests/verify-after-write-guard.test.ts` to lock the intended guard behavior and prevent source-level regression for this false-negative class.

## Verification

`cd /app/agents/shared && npm test -- --run tests/verify-after-write-guard.test.ts` passed with 22/22 tests.

## Next recommendation

If this recurs, inspect the non-source finish-depth/tool-wrapper layer that emits `((unknown paths))`, not just `agents/shared/guards/verify-after-write.ts`. The checked-in guard no longer reproduces this exact false-negative from transcript-shaped events.

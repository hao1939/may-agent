# Promoted Skill Regression Check — 2026-04-17

**Status**: ✅ All 3 promoted skills PASS. Gym infra blocker from earlier today
(`cite-source` missing from `VALID_TOOL_PRESETS`) is RESOLVED — `src/app/agent-loader.ts:473-474`
now contains both `cite-source` and `cite_source`. The shipped bundle was stale;
rebuilt with `bun run bundle` before running the regression suite.

## Results (single trial each, agent=coder)

| # | Skill / Scenario | Result | Runner ID | Session ID | Summary |
|---|---|---|---|---|---|
| 1 | efficient-file-reading | ✅ PASS | runId 2559 | s_1776457600978_0 | 4/4 product, 3/4 convention (one sub-check `uses-targeted-reads` false — product passed) |
| 2 | plan-once-amend | ✅ PASS | runId 2560 | s_1776457637098_0 | 9/9 (product + behavior + efficiency all green) |
| 3 | convention-verify-edit | ✅ PASS | runId 2561 | s_1776457714141_0 | 6/6 (product + 2/2 behavioral) |

## Evidence

- Infra confirmation: `grep -n "cite" src/app/agent-loader.ts` →
  `473: "cite-source", 474: "cite_source",`
- Bundle was stale (src/lib/manager.ts newer than bundle/may-agent). Rebuild:
  `bun run bundle` → `[72ms] bundle 1174 modules / [165ms] compile bundle/may-agent`.
- Per-run `{"recorded":true,"runId":...,"passed":true}` lines captured from
  `scripts/gym-run.sh <scenario> --agent coder` output; records land in the
  gym DB via `scripts/gym-record.ts`.

## Notes

- `efficient-file-reading` has one soft sub-check (`uses-targeted-reads`) that
  flagged false — this is a measurement check, not a product/convention failure.
  Overall scenario `passed: true`. Worth watching if it regresses further.
- No regressions detected; no action needed. Next weekly cadence: ~2026-04-24.

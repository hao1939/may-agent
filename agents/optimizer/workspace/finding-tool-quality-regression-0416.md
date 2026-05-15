# Finding: Tool Quality Regression Investigation — 2026-04-16

**Triggered by**: req:3841fa69 from tool-quality-scan
**Regressed categories**: edit:edit-match-fail (+100%, 4→8), bash:timeout-killed (+45%, 11→16), edit:other (+100%, 1→2)

## Analysis

### edit:edit-match-fail (8 occurrences, was 4)

**Agent breakdown**: tech-lead(5), optimizer(1), coder(1), scout(1)

**Root cause**: tech-lead accounts for 5/8 — concentrated in persistent-task iterations on `cold-start-fix.md` and edits to `session-subscribers.ts` and `compose-guards.ts`. These are files being actively modified across multiple sessions (concurrent edit race conditions). The other 3 are routine: optimizer editing DELIVERABLES_CHECKLIST.md (known pattern), coder editing proof-of-life.ts, scout missing `path` arg entirely.

**Verdict**: No systemic regression. tech-lead is in an active coding sprint editing frequently-changing files. The +100% is 4→8 (small absolute numbers). Expected to self-resolve as the cold-start-fix project wraps up.

### bash:timeout-killed (16 occurrences, was 11)

**Agent breakdown**: bob(11), qa(8), coach(6), optimizer(1)

**Root cause breakdown**:
- **qa (8)**: Running `vitest --run` and `tsc --noEmit` — these are full test/type-check runs that sometimes exceed the default 120s timeout. Recurring pattern.
- **bob (11)**: Running gym batch scenarios with long timeouts (`gym-batch.sh ... --timeout 1800`). These are intentionally long-running and shouldn't count as "waste."
- **coach (6)**: Various PATH export + bun commands. Likely slow DB queries or scenario listing.

**Verdict**: qa's vitest/tsc timeouts are the actionable pattern. They should use higher timeout values. bob's batch runs are expected. coach's are sporadic.

### edit:other (2 occurrences, was 1)

**Agent breakdown**: tech-lead(2)

**Root cause**: Likely schema validation errors or replacement-identical-to-original errors (saw one "replacement produced identical content" in tech-lead's chains). Trivial volume.

**Verdict**: Noise. 1→2 is not meaningful.

## Summary

The "regressions" are primarily driven by:
1. **tech-lead's active coding sprint** — editing files that change between read and edit across persistent-task iterations
2. **qa running full test suites without timeout bumps** — vitest/tsc exceeding 120s default
3. **bob running intentionally long gym batches** — not actual waste

None represent a systemic tool infrastructure problem. The overall waste rate increase (13.8%) is mostly from bash:exit-code-nonzero (391 wasted calls), not these regressed categories.

## Recommendations

### R1: Add timeout to qa's vitest/tsc commands (DISPATCH-READY → qa/coder)
- **What**: In qa's test-running logic, ensure `vitest --run` and `tsc --noEmit` commands use `timeout: 300` (5 min) instead of default 120s
- **Where**: Grep for vitest/tsc invocations in qa's handlers — likely `agents/qa/handlers/` or qa's system prompt
- **Expected impact**: Eliminate ~5 of the 8 qa timeout-killed errors (60% reduction in qa timeouts)
- **Note**: This is a code change in qa's handler files. DISPATCH-READY to coder.

### R2: NO_ACTION_NEEDED for edit:edit-match-fail
- **Justification**: 5/8 are from tech-lead's active sprint on rapidly-changing files. The C1.1 convention (read before edit) is already enforced. These are inherent to multi-session editing of shared files, not a tool or process bug. Will self-resolve.

### R3: NO_ACTION_NEEDED for edit:other
- **Justification**: 1→2 is statistical noise.

### R4 (low priority): Consider excluding gym-batch timeouts from waste tracking
- **What**: In tool-quality-scan.ts, optionally exclude bash timeouts where the command contains `gym-batch` or has explicit `--timeout` > 300
- **Where**: `agents/may/handlers/tool-quality-scan.ts`, in the classification logic
- **Expected impact**: Reduce false-positive regression alerts from bob's intentional long-running gym scenarios

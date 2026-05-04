# EXP-850 Phase 0: Baseline Results — BLOCKED

**Date**: 2025-05-04
**Status**: BLOCKED — gym runner in stub mode
**Requested by**: bob (via EXP-850-dispatch.md)

## Summary

5 baseline trials were attempted on `multi-file-refactor` scenario. All returned `agent_status: "skipped"` because `GYM_AGENT_BIN` is not set — the gym runner has no real agent binary to invoke.

## Trial Results (Stub Mode)

| Trial | Passed | Agent Status | Duration | Notes |
|-------|--------|-------------|----------|-------|
| 1 | false | skipped | 35ms | No agent ran; scoring ran against unmodified env |
| 2 | false | skipped | 36ms | Same |
| 3 | false | skipped | 32ms | Same |
| 4 | false | skipped | 33ms | Same |
| 5 | false | skipped | 32ms | Same |

All failures are because no agent modified the files — the scenario correctly detected `calculateTotal` still present in all 4 files.

## Root Cause

The gym runner (`agents/test/gym/run-gym.sh`) compiles `runner.ts` and runs it. The runner checks `GYM_AGENT_BIN` env var. When unset, it enters stub mode — writes a log but doesn't invoke any agent. This means **no gym experiment can produce real trials** in the current environment.

## Prior Data from EXP-800 (Same Scenario)

EXP-800 ran real trials on `multi-file-refactor` when `GYM_AGENT_BIN` was available:

| Trial | Passed | Duration | edit/write calls | bash calls |
|-------|--------|----------|-----------------|------------|
| A-1 (rename task) | true | 19.4s | 0 | 8 |
| A-2 (shipping task) | true | ~30s | 0 | 17 |

Key finding: Agent uses bash exclusively (0 edit/write calls). This is relevant for EXP-850's redundant-read measurement — tool-call analysis may need to parse bash `cat` commands too.

## Measurement Tooling Ready

- `agents/coach/workspace/EXP-850-measure-redundant-reads.mjs` — parses session logs for redundant `read()` calls
- Needs enhancement: also detect `bash` commands containing `cat`, `head`, `tail` as reads

## Blocker Resolution Options

1. **Set GYM_AGENT_BIN**: Point to the agent binary (likely `may-agent` or equivalent). This requires deployment configuration.
2. **Manual trials**: Have a real agent session run the multi-file-refactor task and capture the transcript. Coach can then measure redundant reads from the transcript.
3. **Mine existing session logs**: Find real coder sessions that touched multiple files and measure redundant reads as a proxy baseline.

## Recommendation

Option 3 is actionable now. Search `.state/checkpoints/` for recent multi-file coding sessions and run the measurement script against them to establish a system-wide redundant-read baseline.

## Next Steps

- [ ] Resolve `GYM_AGENT_BIN` blocker (escalate to infra/bob)
- [ ] Run measurement script against existing session logs for proxy baseline
- [ ] Once agent binary available, re-run 5 real baseline trials

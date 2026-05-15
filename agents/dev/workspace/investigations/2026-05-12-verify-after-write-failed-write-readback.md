# Verify-After-Write Failed Write Readback Bug

## Signal

May forwarded a P2 implementation request after evaluator reviewed scout session `s_1778570473846_22`: a `write()` to `research/arxiv-ai-agents-2026-05-12.md` failed with `EACCES`, but the verify-after-write guard kept blocking `finish(success)` until the agent explicitly `read()` the nonexistent path and received `ENOENT`.

## Evidence

Targeted transcript grep showed:

- line 14: assistant called `write` for `research/arxiv-ai-agents-2026-05-12.md`
- line 15: tool result had `isError:true` with `EACCES: permission denied, mkdir '/app/research'`
- lines 23, 27, 31: `finish(success)` blocked for missing read-back on `research/arxiv-ai-agents-2026-05-12.md`
- line 33: explicit `read(research/...)` returned `ENOENT`
- line 35: finish succeeded only after the failed path was read

## Root Cause

`agents/shared/guards/verify-after-write.ts` tried to pre-scan failed tool-call IDs, but `extractToolCalls()` skipped `role:"toolResult"` messages before processing the later error-removal branch. In Anthropic-style transcripts the assistant tool call appears before the separate tool-result error message, so the failed write call was already recorded and never removed from the read-back obligation set.

## Fix

Patch `extractToolCalls()` to retain tool-call IDs, process separate `role:"toolResult"` error messages, and remove the already-recorded failed call before read-back tracking. Added regression coverage proving:

1. a failed write attempt does not require read-back;
2. a later successful write still requires read-back even if an earlier write failed.

## Validation

- `cd /app/agents && npx tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 shared/guards/verify-after-write.ts shared/tests/verify-after-write-guard.test.ts`
- `cd /app/agents && npx vitest run --config /dev/null shared/tests/verify-after-write-guard.test.ts`

Note: the repo Vitest config includes only `test/**/*.test.ts`, so the targeted `shared/tests/...` file must be run with `--config /dev/null` unless the test layout/config is changed separately.

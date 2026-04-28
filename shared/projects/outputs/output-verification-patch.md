# Output Verification Patch for master-worker.ts

## What Changed

**File modified**: `agents/shared/workflows/master-worker.ts`

### Changes:
1. **Added imports**: `readdirSync`, `statSync` for filesystem scanning
2. **Added `snapshotOutputs()`**: Takes a directory snapshot (file paths → mtimes), 2 levels deep
3. **Added `diffSnapshots()`**: Compares before/after snapshots, returns list of new/modified files
4. **Work loop integration**: 
   - Before worker runs: snapshot the `outputs/` directory
   - After worker runs: snapshot again and diff
   - If no files changed: log `⚠️ WARNING` and note it in journal
   - If files changed: log `✅` with file count and names
5. **Review prompt enhancement**: Orchestrator now sees output verification status, with a nudge to "require write() as first tool call" when worker produced nothing

### How it works:
- Every worker iteration is now measured for actual file output
- The orchestrator sees whether files were produced and can adjust guidance accordingly
- Journal entries flag zero-output iterations for visibility
- No iterations are blocked/rejected — this is observability + nudging, not enforcement

# Bottleneck Analysis

## Date: 2025-01-27

## #1 Bottleneck: Self-Referential Utility Production

### Finding

The system-efficiency project has spent 46 iterations building 15 utility modules that have **zero external adoption**. The bottleneck is not a missing utility — it's that this project's iterations are consumed producing code that sits unused in a gitignored outputs directory or in `agents/shared/lib/` where no other workflow imports it.

### Evidence

1. **Zero adoption**: No imports of `shared/lib` modules exist outside of this project's own tests
2. **Self-consuming**: 90%+ of iterations produce a new .ts file + tests for *this project*, not for any external deliverable
3. **Native solutions exist**: The system already has `provider-retry.ts` for retries, its own prompt building in workflows, its own project management. The "shared toolkit" duplicates existing functionality.
4. **Gitignored outputs**: Many deliverables land in `projects/outputs/` which is gitignored — they never reach version control
5. **No real user**: The 15 modules solve problems no agent currently has. They were built speculatively.

### Root Cause

The master-worker loop for this project optimizes for "produce a deliverable each iteration" rather than "produce something the system needs." This creates a perverse incentive: build more utilities (easy to do, always "succeeds") rather than tackle hard integration problems (might fail, unclear path).

### Impact

- ~46 iterations × ~5 min avg = ~230 minutes of compute spent on unused utilities
- 1428 tests that test code nobody calls
- 14 agents had context.md polluted with a reference they'll never follow up on

### Recommended Fix

**Close this project.** Specifically:

1. **Stop building new utilities** — the toolkit is comprehensive but unwanted
2. **Keep what's integrated** — `recordIteration` in master-worker.ts, `recordUsage` in master-worker.ts, `onProjectCreate` hook in project.ts are actually wired in
3. **Remove context.md spam** — the "shared toolkit available" line in 14 agents adds noise
4. **Redirect capacity** — mark this project COMPLETE/CLOSED and redirect the worker to a project with real external users

### Alternative Fix (if project continues)

If closing isn't an option, the only high-value work remaining is:
- Delete modules that duplicate native functionality (retry-strategy duplicates provider-retry)
- Measure whether `recordIteration`/`recordUsage` are actually producing useful data in `.state/iteration-log.json`
- Write a single integration that another project *actually needs* rather than speculatively building

### Conclusion

The system's #1 throughput bottleneck is **this project consuming iterations without producing externally-visible value**. The fix is to stop.

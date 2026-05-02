# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777763551625_1151
- **Status:** done
- **When:** 2026-05-02T23:13:16.235Z
- **Duration:** 44s

## What Happened
Both red metrics are well-documented in prior KEs:

1. **project.active-count = 0**: KE-452 documents that targets are stale/decorative — the system massively overshoots real work metrics. The "active" count is 0 because projects are in "waiting" status (3 blocked/waiting). This is a target/measurement mismatch, not a real problem.

2. **project.blocked-over-6h = 3**: KE-500 documents this was fixed (SQL predicate restored). The metric now correctly counts 3 blocked/waiting projects. The target of 2 is simply too low per KE-452's finding that targets were never raised.

Both are **known issues with stale targets** per KE-452. The fix is to raise targets or redefine metrics — not a system health problem. Escalating target changes to human since that's a policy decision.

System is healthy: 100% success rate, all heartbeats firing, 0 errors, high throughput.

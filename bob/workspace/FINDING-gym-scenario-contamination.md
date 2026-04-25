# FINDING: Gym Scenario Environment Contamination

**Date**: 2026-06-25
**Severity**: CRITICAL
**Impact**: All gym runs since April 23 are INVALID

## What Happened

Multiple agents (amy, bob, tech-lead) committed "fixes" directly into gym scenario environment files. These are the files that contain deliberate bugs for agents to find during gym trials. By "fixing" the bugs, the agents destroyed the test scenarios.

## Contamination Timeline

- **Apr 23 21:43** — bob: "fix SQL injection vulnerability in product search - use parameterized queries" (committed directly to scenario environment)
- **Apr 24 18:04** — amy: "fix null return in executeQuery" (same scenario)
- **Apr 24 18:11** — tech-lead: heartbeat triage (modified environment files)
- **Apr 24 18:35** — amy: "fix db.js JSDoc and add SQL injection regression tests" 
- **Later** — amy: mass fix across 7 sql-injection variants + 20+ cascading variants

## Scope

- `sql-injection-in-query-builder`: base + 8 variants contaminated
- `cascading-fix-trap-v2`: base + 21 variants contaminated
- **All 49 "real" EXP-178 runs are invalid** — agent did nothing, checks passed against pre-fixed code
- All runs showed `agent_status: "error"` and `duration: ~200ms` (no actual agent invocation) yet scored as pass/fail based on pre-fixed environment

## Root Cause

No protection against agents modifying gym scenario environments. The environment/ directories are just regular files in the repo. An agent doing a "fix bugs" task can find and "fix" the deliberately planted bugs.

## Resolution

1. Restored all environments to pre-contamination state from git history (commit 269e1e349)
2. Invalidated EXP-178 runs-real.jsonl data

## Prevention Needed

1. **Gitignore protection won't work** — the environments need to be in git
2. **Pre-commit hook** that blocks modifications to `gym/scenarios/*/environment/` unless commit message contains `[gym-env]` marker
3. **Agent context rule**: Add to shared knowledge that gym scenario environments are READ-ONLY test fixtures
4. **CI check**: Verify scenario environments match their known-good checksums

## Impact on EXP-178

EXP-178 needs to restart from 0/120 runs. The interim results document was based on contaminated data and should be disregarded.

# Skill Test Results: incremental-context-loading

## TEST PASSED

**Skill**: `incremental-context-loading` (agents/shared/skills/incremental-context-loading/SKILL.md)
**Scenario**: `incremental-context-loading` (agents/gym/scenarios/incremental-context-loading/)
**Agent**: coder
**Date**: 2026-03-23

## Results

| Run | Result | Product (2) | Behavior (4) | Efficiency (1) | Duration |
|-----|--------|-------------|-------------|----------------|----------|
| 1   | FAIL   | 1/2         | 4/4         | 1/1            | 69.4s    |
| 2   | PASS   | 2/2         | 4/4         | 1/1            | 64.7s    |
| 3   | PASS   | 2/2         | 4/4         | 1/1            | 52.0s    |

**Pass rate: 2/3** (meets ≥2/3 threshold)

## Analysis

### What the scenario tests
The agent is given a "resumed session" with a context-cache.md file listing 5 previously-read files with timestamps and summaries. Only 1 file (src/cache.js) has changed and contains a TTL bug to fix. The 4 other files (~32KB total) are unchanged and should be skipped.

### Behavioral checks (consistently passed)
All 3 runs showed correct behavioral patterns:
- **reads-context-cache-first**: Agent read workspace/context-cache.md before source files ✅
- **skips-unchanged-files**: Agent read ≤2 of 4 unchanged files ✅
- **reads-changed-file**: Agent read src/cache.js (the changed file) ✅
- **mentions-skip-rationale**: Agent mentioned skipping/caching rationale ✅

### Run 1 failure analysis
The `ttl-bug-fixed` product check failed — the agent identified the bug area but didn't apply the correct fix (the `- 1000` remained in some form). The behavioral checks all passed, meaning the agent followed the incremental-context-loading pattern correctly but had an implementation issue with the actual fix. This is a product quality issue, not a skill compliance issue.

### Efficiency
All runs completed within 20 ops, confirming the skill's efficiency benefit. The agent consistently avoided re-reading 32KB+ of unchanged documentation and source files.

## Scenario Details
- **Environment**: 5 source files (7.5KB + 5.8KB + 10KB + 8.8KB + 5.5KB = ~38KB total)
- **Changed files**: 1 (src/cache.js — TTL off-by-one bug)
- **Unchanged files**: 4 (docs/architecture.md, docs/api-reference.md, src/server.js, src/database.js)
- **Context cache**: workspace/context-cache.md with timestamps and summaries from "previous session"
- **Test file**: test/cache-test.js — 4 tests including TTL boundary test that detects the bug

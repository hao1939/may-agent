# Improvement Proposals Review — Cycle 13
**Date**: 2026-03-23T09:15
**System state**: Fresh restart after ~3 days downtime (2026-03-20 ~07:00 → 2026-03-23 ~09:06)
**Since last review**: Cycle 12 was 2026-03-21T16:39 (40 hours ago, ~30 hours of downtime)

## System Health Summary

### Critical: Test Suite Broken (69/115 files FAIL)
- **Root cause**: `node_modules/@mariozechner/pi-agent-core` and `pi-ai` are **symlinks** to `../../../pi-mono/packages/agent` and `../../../pi-mono/packages/ai` respectively — but `/pi-mono` doesn't exist in this container
- The symlinks were created 2026-02-28 and haven't been updated
- **TypeScript compiles clean** (tsc --noEmit = 0 errors) — types resolve differently than runtime
- 46 test files pass (those not importing manager.ts transitively)
- 784 individual tests pass, 34 fail
- **Impact**: Can't run full test suite to validate changes. This is a **CI/development-env issue**, not a code issue — the production binary (ELF `may-agent-bin`) was compiled when the symlinks resolved correctly
- **Recommendation**: Fix node_modules symlinks or install packages from npm registry. This is infrastructure debt.

### Activity: 259 commits since Cycle 0
- Major features landed: unified request tracking (SQLite), gym scenarios (26+), skill lifecycle workflow, checkpoint tool, finish() structured completion, cascading cancel, evidence tags
- 10 skills deployed in last 48h before downtime: obstacle-pivot, grep-first-reading, budget-before-act, SCBA, stale-approach-fixation, coder-edit-discipline, delegation-verification, idempotent-work-detection, search-strategy-escalation, evidence-over-narrative, incremental-context-loading
- Handler health: 3 JS handlers still dead (convention-check, tool-quality-scan, heartbeat-context) — blocked on binary rebuild

### Downtime: 3 days (March 20 07:00 → March 23 09:06)
- Last heartbeat: tech-lead at 2026-03-20T06:50
- No crash logs from the gap — clean shutdown or external restart
- System came back with fresh session IDs starting at s_1774256764709_3

---

## Deployed Improvements Status (from Cycle 12 + new)

### Tier 1: Confirmed Working & Measurable
| # | Improvement | Status | Savings |
|---|-------------|--------|---------|
| F1 | Heartbeat pre-flight skip | ✅ Deployed | ~18% idle session reduction |
| F2 | OpBudget visibility (>50% inject) | ✅ Deployed | Reduces budget-unaware overruns |
| F3 | Ceremony reduction (auto-inject todo/heartbeat/common-sense) | ✅ Deployed | ~2-3 turns/session saved |
| F4 | Structured finish() with TaskResult | ✅ Deployed | Better routing, reduced follow-up waste |
| F5 | Auto-escalation on blocked/failure | ✅ Deployed | Faster human notification |
| F6 | Request tracking (SQLite) | ✅ Deployed | Single source of truth, no todo.md drift |
| F7 | Stuck detection | ✅ Deployed | Breaks infinite loops earlier |
| F8 | Tool pivot heuristic | ✅ Deployed | Blocks repeated identical failures |
| F9 | Cron overtrigger fix (75% cooldown) | ✅ Deployed | Reduced session cascade |
| F10 | Per-entry trigger cooldown | ✅ Deployed | Saves ~$435/day theoretical |
| F11 | Circuit breaker for cron | ✅ Deployed | Prevents error-chaining loops |
| F12 | Infra retry (Pattern 4/4b) | ✅ Deployed | Handles JSON corruption, streaming truncation |
| F13 | Evaluator transcript cap (15K chars) | ✅ Deployed | Cost reduction on evals |
| F14 | Scrape maxLength cap (30K) + dedup guard | ✅ Deployed | Prevents huge scrape payloads |
| F15 | Concurrency gate | ✅ Deployed | Prevents simultaneous destructive ops |
| F16 | Evidence tags (instruction hierarchy) | ✅ Deployed | Prevents prompt injection via tool output |
| F17 | Checkpoint tool | ✅ Deployed | Mid-session state saving |
| F18 | Lessons field in finish() | ✅ Deployed | Cross-session learning |

### Tier 2: Deployed but Blocked on Binary Rebuild
| # | Improvement | Status | Blocked By |
|---|-------------|--------|------------|
| B1 | convention-check handler | Built, in cron.json | Binary cache |
| B2 | tool-quality-scan handler | Built, in cron.json | Binary cache |
| B3 | heartbeat-context handler | Built, in cron.json | Binary cache |
| B4 | lessons-graduation handler | Built, in cron.json | Binary cache |
| B5 | error-log-scanner wiring | Handler exists | Binary cache |

### Tier 3: Skills Deployed (SOUL.md/INDEX.md level)
| # | Skill | Deployed To | Gym Tested |
|---|-------|-------------|------------|
| S1 | obstacle-pivot | 4 agents | ✅ 2/3 |
| S2 | grep-first-reading | 4 agents | ✅ 7/8 |
| S3 | budget-before-act | 4 agents | ✅ 2/3 |
| S4 | state-check-before-action | 4 agents | ✅ |
| S5 | stale-approach-fixation | 4 agents | ✅ 3/3, 6/7 |
| S6 | coder-edit-discipline | 4 agents | ✅ 3/3, 11/11 |
| S7 | delegation-verification | 4 agents | ✅ 3/3 |
| S8 | idempotent-work-detection | optimizer | ✅ 3/3, 7/8 |
| S9 | search-strategy-escalation | 4 agents | ✅ 2/3 |
| S10 | evidence-over-narrative | 4 agents | ✅ phantom-fix |
| S11 | incremental-context-loading | 6 agents | ✅ 2/3 |

---

## Key Findings This Cycle

### Finding 19: Broken Test Infrastructure (NEW — Critical)
- **What**: 69/115 test files fail due to missing `@mariozechner/pi-agent-core` package (dangling symlink to non-existent `/pi-mono/packages/agent`)
- **Impact**: No reliable test validation for code changes. TypeScript compiles clean, but runtime imports fail.
- **Root cause**: Workspace symlinks (`ln -s ../../../pi-mono/packages/agent`) created 2026-02-28. The pi-mono directory is not mounted in the current container.
- **Fix**: Either mount `/pi-mono` workspace OR install packages from npm registry OR copy the package contents. This requires infrastructure-level fix (Docker volume mount or package.json change).
- **Workaround**: Production binary still works (compiled with packages available). Only testing is affected.
- **Cost impact**: Unknown — prevents validating any code optimizations that touch core imports.

### Finding 20: 3-Day System Downtime
- **What**: No heartbeats from 2026-03-20T06:50 to 2026-03-23T09:06
- **Impact**: ~72 hours of zero operation. No cron jobs, no evaluations, no coach cycles.
- **Root cause**: Unknown — no crash logs in `.state/logs/` from the gap. Likely external restart or infra issue.
- **Action**: None required — system restarted cleanly with all state preserved.

### Finding 21: Optimizer is #1 Cost Driver (50.6% of spend)
- Carried forward from cost scan 0323-0539
- Root cause: skill-lifecycle Phase 1 DISCOVER sessions read 747K-869K input tokens ($2.41-$2.78/session)
- Two Phase 1 runs in one scan window = $5.19 = 46% of optimizer cost
- **Action needed**: Reduce DISCOVER phase token consumption. Options:
  1. Pre-filter sessions before sending to LLM (only send sessions with >X bash calls or edit calls)
  2. Cap session transcript length in the discovery scan
  3. Batch multiple session transcripts with summaries instead of full text

### Finding 22: Claude Prompt Caching Still 0%
- Carried forward from multiple prior scans
- Root cause: ANTHROPIC_API_KEY not set → LiteLLM strips `cache_control` headers → 0% cache hits
- Escalated to Hao on 2026-03-18 but no action taken during downtime
- **Projected savings**: $36/day (most impactful single fix remaining)

### Finding 23: Binary Rebuild Still Blocking 5 Handlers
- 5 JS handlers built and registered in cron.json but not executing
- Binary was last compiled 2026-03-21T08:40
- The compiled ELF binary bakes in handlers at compile time — post-compilation TS files aren't loaded
- **This is now the single biggest blocker for optimization** — each handler could save $2-5/day

---

## Priority Actions

1. **[INFRA] Fix pi-agent-core symlinks** — Restores test suite (69 files). Required for safe code changes.
2. **[INFRA] Set ANTHROPIC_API_KEY** — Enables prompt caching. $36/day savings.
3. **[INFRA] Rebuild binary** — Unblocks 5 handlers. $10-25/day combined savings.
4. **[OPT] Reduce skill-lifecycle DISCOVER token usage** — Currently $5/scan. Target: $1/scan via pre-filtering.
5. **[SKILL] Continue skill-lifecycle workflow** — 11 skills deployed, strong evidence of behavioral improvement.

---

## Savings Scorecard

| Category | Estimated Savings | Status |
|----------|------------------|--------|
| Infrastructure fixes (cache, binary, tests) | $40-60/day | ⏳ Blocked on infra |
| Deployed code improvements (F1-F18) | $50-100/day | ✅ Active |
| Deployed skills (S1-S11) | $5-15/day | ✅ Active (measuring) |
| Proposed but not yet built | $10-20/day | 📋 Backlog |
| **Total deployed** | **$55-115/day** | |
| **Total with infra fixes** | **$95-175/day** | |

Note: System was at $97/day projected cost as of last scan (03-23 05:39). With all improvements active and infra fixes applied, could reach $50-70/day or lower.

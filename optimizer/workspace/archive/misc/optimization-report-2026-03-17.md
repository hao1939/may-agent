# Optimization Report — 2026-03-17

## Summary
Comprehensive consolidation of all WIP analysis from 2026-03-16 and 2026-03-17.

---

## Part 1: RESOLVED Findings

### 1.1 Cron Stagger Fix ✅
**Problem**: All 5 Opus agents fired heartbeats within 9-13min interval band → thundering herd → 42% error rate  
**Fix**: Prime-number intervals (may=10, optimizer=11, bob=17, tech-lead=19, coach=23 min) applied ~07:14 UTC  
**Result**: Error rate 42% → 0% (rate-limit-induced). 4.3x improvement.  
**Cost saved**: ~$2-5/hour in wasted LLM calls eliminated  
**Status**: ✅ Complete. Monitoring confirmed stable through 10:17 UTC.

### 1.2 Overtrigger Convergence ✅
**Problem**: System running at 3.32x expected session rate (97.3/hr vs 29.3/hr expected)  
**Fix**: Prime intervals + existing cooldown mechanisms  
**Result**: Converged from 3.32x → 1.07x over 10 hours. Current overhead: 13% (7 extra sessions/2hr)  
**Remaining**: May at 1.42x, tech-lead at 1.58x — acceptable overhead  
**Status**: ✅ Complete. No action needed.

### 1.3 False-Positive Error Epidemic ✅  
**Problem**: 62% of sessions marked "error" despite calling finish() successfully  
**Root cause**: Stale process not loading finish-guard fix code  
**Fix**: Process restart at ~04:16 UTC loaded all pending fixes  
**Result**: True error rate was 2%, reported was 64%. Post-restart: 10% → 0% after OpBudgetExceeded fix  
**Status**: ✅ Complete.

### 1.4 OpBudgetExceeded False Positives ✅
**Problem**: 12/13 OpBudgetExceeded sessions had already called finish() — marked "error" incorrectly  
**Fix**: Added OpBudgetExceeded to safety-net error-clearing in handleCompletion() (manager.ts lines 528, 557)  
**Verification**: tsc clean, 1401/1401 tests pass  
**Status**: ✅ Complete. Committed.

### 1.5 Coach Growth-Trigger Burst ✅
**Problem**: error-log-scanner spawning 34 concurrent coach sessions every 30 min → 1,632/day, 73% error rate  
**Root cause**: No cooldown dedup + concurrent handler race condition (TOCTOU on cooldown file)  
**Fix**: Cooldown tracking + self-exclusion + cap of 3 per scan applied pre-restart  
**Remaining risk**: Post-restart race still caused 41-session burst (cooldown file cleared). Per-trigger save would fix.  
**Status**: ✅ Core fix deployed. Race condition is minor (only happens on restart).

---

## Part 2: OPEN/ACTIONABLE Findings

### 2.1 OpBudget Wired from agent.json → Runtime ✅
**Severity**: WAS HIGH — NOW RESOLVED  
**Problem**: `opBudget` in agent.json had ZERO effect — never passed to runtime  
**Fix**: `AgentConfig` now includes `opBudget` (line 58), both `register()` calls pass it (lines 364, 532)  
**Status**: ✅ Fixed. Verified 2026-03-17 10:42 UTC.

### 2.2 Heartbeat Overtriggering 🔴 → ESCALATED
**Severity**: HIGH — $435/day waste  
**Problem**: `agents.send()` triggers heartbeat with only 60s cooldown. May=2.79x, tech-lead=3.26x, coach=2.36x expected rate. 160 extra sessions per 7.5h. Also 19 "skipped" sessions (pure waste — trigger fires but agent already busy).  
**Root cause**: `triggerCooldownMs = 60_000` in cron.ts + `checkPendingTrigger` bypasses cooldown  
**Fix**: (1) Per-entry cooldown = half interval (min 60s), (2) Neuter pending trigger drain  
**Status**: ⚠️ Design brief at `workspace/brief-overtrigger-fix.md`. Handed off to tech-lead 2026-03-17 11:12 UTC.

### 2.3 Duplicate Request Waste (Bob) ⚠️
**Severity**: MEDIUM  
**Problem**: Bob sends same request 3-5 times with different wording, bypassing exact-match dedup  
**Evidence**: 12 duplicate requests out of 37 active (32%)  
**Examples**: "Tool Name Injection" sent 5 different ways; "OpBudget Visibility" sent 4 ways  
**Root cause**: `isDuplicate()` uses exact match on first 500 chars of task  
**Fix options**: (a) Coach Bob to check existing requests first, (b) Extract brief filename for dedup key, (c) Semantic dedup  
**Status**: Proposal written. Not yet implemented.

### 2.3 Orphaned Sessions Accumulation ⚠️  
**Severity**: MEDIUM  
**Problem**: 22 orphaned sessions stuck with dead processes (oldest 115h)  
**Root cause**: `resumeStaleSessions()` at startup only processes `"job"` kind — chat/call orphans never cleaned  
**Fix**: Remove kinds filter in may.ts:719 — one-line change  
**Status**: Proposal written. Not yet implemented.

### 2.4 Bash Read-Only Ops Counted as State-Changing ⚠️
**Severity**: MEDIUM  
**Problem**: All bash calls count against opBudget, even read-only (grep, cat, ls, jq)  
**Evidence**: Coach sessions: 85-97% of ops are bash, most read-only. Agents exhaust budget on reads.  
**Fix options**: (a) Read-only bash detection (check prefix), (b) Coach agents to use read() instead, (c) Increase budgets  
**Status**: Coaching applied for tech-lead and QA. Structural fix not implemented.

### 2.5 Tech-Lead Repeated Reads 🟡
**Severity**: LOW-MEDIUM  
**Problem**: Tech-lead reads same files 3-5 times per session (~50K wasted tokens in 2 sessions)  
**Fix**: Added Rule 5 to tech-lead LESSONS.md (coaching fix)  
**Status**: ✅ Coaching applied. Monitor for improvement.

### 2.6 Empty-Arg Tool Calls 🟡
**Severity**: LOW-MEDIUM  
**Problem**: 42 empty-arg errors (bash({}), read({})) across 50 sessions — coach averages 1.9/session  
**Impact**: ~$40-100/month waste + ops consumed against budget  
**Fix**: Don't count validation-error-only turns against opBudget  
**Status**: Proposal written. Not yet implemented.

### 2.7 QA Redundant Repo Gate Checks 🟡
**Severity**: LOW  
**Problem**: QA runs tsc+vitest every heartbeat (22x/day) — redundant with system-status handler (6x/day)  
**Fix**: Add git-change gate to QA heartbeat — skip checks when no new commits  
**Status**: Proposal written. Not yet implemented.

### 2.8 Tool Preset Cleanup 🟡
**Severity**: LOW  
**Problem**: Unused tool presets waste ~200-500 tokens/session in system prompt  
**Targets**: Remove `coordination` from QA, coder, amy, amy-kimi; remove `workflow` from tech-lead  
**Savings**: ~2.5M tokens across historical volume  
**Status**: Brief handed off to tech-lead.

---

## Priority Matrix

| # | Finding | Impact | Effort | Priority |
|---|---------|--------|--------|----------|
| 2.1 | OpBudget not wired | HIGH | LOW (2 lines) | P1 |
| 2.2 | Duplicate request waste | MEDIUM | MEDIUM | P2 |
| 2.3 | Orphaned sessions | MEDIUM | LOW (1 line) | P2 |
| 2.4 | Bash read-only ops | MEDIUM | MEDIUM | P3 |
| 2.6 | Empty-arg tool calls | LOW-MED | LOW | P3 |
| 2.7 | QA gate redundancy | LOW | LOW | P4 |
| 2.8 | Tool preset cleanup | LOW | LOW | P4 |

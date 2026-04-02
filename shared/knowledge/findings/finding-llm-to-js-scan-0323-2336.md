# LLM-to-JS Opportunity Scan — 2026-03-23T23:36

## Scan Window
Last 50 sessions across 9 agents. Focus on deterministic patterns that waste LLM calls.

## Key Findings

### 1. QA Early Exit → ALREADY HANDLED (repo-gate-check)
**Pattern**: QA runs `read(last-reviewed-commit.txt) → git log → finish("no new commits")` in 3-4 tools.
**Frequency**: 9/20 recent QA sessions (45%) are early exits.
**Status**: `agents/may/handlers/repo-gate-check.ts` EXISTS and is in cron.json. **BLOCKED on binary rebuild.** Handler would eliminate 100% of these sessions ($8/day at $0.40/session × 21 sessions/day).
**Action**: None needed beyond binary rebuild.

### 2. May Idle Heartbeat — NEW JS HANDLER OPPORTUNITY
**Pattern**: 8/10 recent May sessions are idle: `ls sessions → agents(requests) → finish("nothing to do")`.
Average 3 tools per session, ~$0.30/session.
**Frequency**: ~80% of May sessions (at 30min interval = ~38 idle sessions/day).
**Savings**: ~$11/day ($0.30 × 38).
**Proposal**: Create `may-idle-preflight.ts` handler that:
  1. Checks `.state/requests.db` for pending requests where `toAgent = 'may'`
  2. Checks for stuck sessions in `.state/sessions/`
  3. If neither → set `skipIfIdle: true` signal
  This is already partially covered by `skipIfIdle` in the session manager, but May's `hasPendingWork()` apparently returns true too often (8/10 are idle despite the guard).
**Root cause**: May's `hasPendingWork()` may check for any active request, not specifically may-targeted ones. Or `initiativeCadence` is too low.

### 3. Evaluator Repetitive File Reads — LOW PRIORITY
**Pattern**: Every evaluator session reads the same 3 JSONL files + periodic-tasks.md.
With evaluate-sessions handler dead, evaluator has limited work.
**Savings**: Minimal (~$1/day) — evaluator runs infrequently.
**Action**: Will resolve naturally when binary is rebuilt (evaluate-sessions handler restarts).

### 4. Coach Bash-Heavy Sessions — NOT JS-ELIGIBLE
Coach uses 20-45 tools/session but work is judgment-heavy (gym scenarios, error analysis, experiment design). Not automatable.

### 5. Optimizer Self-Cost — ADDRESSED BY COOLDOWN
13 sessions in last 50, avg 32.7 tools. Skill-lifecycle cooldown (6h) already reducing this. No new JS opportunity.

## Summary of Savings (blocked on binary rebuild)
| Opportunity | Savings | Status |
|---|---|---|
| QA repo-gate-check | $8/day | BUILT, blocked on binary |
| May idle preflight | $11/day | NEEDS IMPLEMENTATION |
| Evaluator handler fix | ~$15-20/day (evaluations) | BUILT, blocked on binary |
| **Total blocked savings** | **~$34-39/day** | **Binary rebuild = single gate** |

## Top Action Item
**Binary rebuild remains THE critical blocker.** It gates:
- repo-gate-check handler ($8/day)
- evaluate-sessions handler ($15-20/day in quality improvements)
- convention-check, tool-quality-scan, and 6+ other handlers
- Total: $34-39/day in savings plus quality monitoring

Already escalated to May (req:e4436af2). Binary `may-agent-97a3754` is 3.7 days old.

## New Opportunity: May Idle Preflight Handler
**Estimated implementation**: Small (~100 lines). Checks requests.db for may-targeted requests, checks for stuck sessions. Signals skip if neither found.
**Savings**: ~$11/day.
**Blocker**: Also needs binary rebuild to deploy. But should be built now so it's ready.

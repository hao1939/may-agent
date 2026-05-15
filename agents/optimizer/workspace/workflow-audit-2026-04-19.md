# Workflow Audit — 2026-04-19

## Current Coverage

**Metric**: Top-level non-evaluator sessions that trigger workflow runs  
**Period**: Recent (since epoch 1776400000000, ~last 2.5 days)  
**Result**: 345 / 1052 = **32.8%** (confirming ~31% baseline)

### Coverage by Agent

| Agent | Top-level sessions | Trigger workflows | Coverage | Notes |
|-------|-------------------|-------------------|----------|-------|
| coach | 236 | 34 | 14% | Was 100% before heartbeat rewrite (EXP-028) |
| may | 196 | 0 | 0% | All heartbeats/crons, never calls workflow.run |
| tech-lead | 136 | 98 | 72% | Heavy lens-analysis user |
| optimizer | 129 | 105 | 81% | Highest adopter |
| bob | 122 | 86 | 70% | Good — uses deliver-or-report, verify-wrap |
| scout | 119 | 21 | 18% | Low — mostly heartbeats |
| qa | 112 | 1 | <1% | Almost never uses workflows |
| master | 2 | 0 | 0% | Too few sessions |

### Biggest Coverage Gaps (where to focus)
1. **QA (112 sessions, <1%)** — 111 heartbeats with no workflow routing
2. **May (196 sessions, 0%)** — 108 heartbeats + 45 crons, never triggers workflows
3. **Coach (236 sessions, 14%)** — Was the model agent, collapsed after heartbeat rewrite
4. **Scout (119 sessions, 18%)** — Mostly heartbeats, does some parallel-research

## Freestyle Session Patterns (non-workflow sessions)

| Pattern | Count | % of Freestyle | Agents |
|---------|-------|---------------|--------|
| heartbeat | 450 | 64% | all agents — the dominant session type |
| cron | 52 | 7% | may, coach, optimizer, bob |
| persistent-task | 62 | 9% | may, coach, bob, tech-lead, scout |
| other | 83 | 12% | mixed |

**Key insight**: 64% of freestyle sessions are heartbeats. These are the #1 target for workflow routing — they read heartbeat.md, decide what to do, then do it freestyle. If heartbeat.md instructed `workflow.run()` for common task patterns, coverage would jump dramatically.

## Workflow Inventory: Keep / Archive / Investigate

### ✅ KEEP — Active and Working

| Workflow | Runs (recent) | Status | Owner |
|----------|--------------|--------|-------|
| **verify-wrap** | 208 | ✅ Workhorse — most-used workflow | shared |
| **lens-analysis** | 78 | ✅ Heavy use by tech-lead | tech-lead |
| **persistent-task** | 42 | ✅ Used by may, coach, bob | shared |
| **implement-and-verify** | 24 | ✅ Healthy usage | shared |
| **parallel-research** | 21 | ✅ Used by scout, optimizer | shared |
| **growth-cycle** | 5 | ✅ Coach training (was higher pre-collapse) | coach |

### ⚠️ INVESTIGATE ADOPTION — Exist but Underused

| Workflow | Runs (recent) | Issue | Action |
|----------|--------------|-------|--------|
| **implement-and-review** | 0 | Was broken (6% completion), fixed but no one calls it | Wire into heartbeats for code tasks needing QA |
| **training-sprint** | 0 | Coach stopped using after heartbeat rewrite | Restore in coach heartbeat |
| **design-review** | 0 | Optimizer-specific, never triggered | Wire into optimizer heartbeat for design doc tasks |
| **safe-edit** | 0 | Optimizer-specific, never triggered | Consider if agents should use for risky edits |
| **enhance-cron** | 0 | Optimizer-specific, very narrow | Keep as-is, niche use case |
| **verified-coder** | 1 | Tech-lead barely uses | May be superseded by implement-and-verify |
| **vet-skill** | 0 | QA-specific, never triggered | Wire into QA heartbeat |
| **investigate-and-fix** | 6 | Low but nonzero | Could be used more by optimizer/tech-lead |

### 🗑️ ARCHIVE (for reference) — Missing from Disk

| Workflow | Runs (recent) | Status |
|----------|--------------|--------|
| **deliver-or-report** | 53 (from files) | Bob workflow dir is empty — file deleted but still being called? |
| **error-scan** | 14 | No .ts file found anywhere — ghost workflow |
| **coaching-feedback** | 5 | Only exists as may handler, not a workflow |

**⚠️ ANOMALY**: deliver-or-report has 53 run files but no .ts source. Bob is still successfully running it somehow — need to investigate if it's compiled/cached or if the run files are from before deletion.

## Root Cause of Low Coverage

Per EXP-028 findings (confirmed by this audit):
1. **LLMs do NOT spontaneously discover workflows** — agents only use `workflow.run()` when explicitly instructed
2. **Heartbeat rewrite (Apr 1) removed workflow instructions** — Coach collapsed from ~100% to 14%
3. **Most agents were never instructed** — QA, May, Scout heartbeats have no workflow routing

## Recommendations for Next Milestones

### Quick Wins (heartbeat routing)
1. **QA heartbeat**: Route to `vet-skill` for skill evaluation, `implement-and-review` for code review tasks
2. **May heartbeat**: Route to `parallel-research` for research tasks, `implement-and-verify` for code tasks
3. **Coach heartbeat**: Restore `growth-cycle` and `training-sprint` routing (was working before)
4. **Scout heartbeat**: Route to `parallel-research` for multi-thread research

### New Workflow Candidates (from freestyle patterns)
1. **Heartbeat-dispatch** — A workflow that reads heartbeat.md, decides the task, then routes to the appropriate workflow. Would make every heartbeat a workflow session.
2. **Cron-task** — Wrap cron jobs in verify-wrap or similar
3. **Knowledge-integration** — Bob's most common freestyle task pattern (reading results, updating KB)

### Coverage Impact Estimate
If we route heartbeats for QA (111), May (108), Coach (90), Scout (91):
- +400 sessions moved to workflow
- New coverage: (345 + 400) / 1052 = **70.8%**
- Adding cron routing (+52): **74.8%**
- Adding persistent-task routing (+62): **80.7%** ← hits target

## Data Sources
- `.state/may.db` sessions table (25,726 total sessions, 2,576 recent)
- `.state/workflows/wr_*.json` run files (982 total, 404 recent)
- `agents/shared/workflows/REGISTRY.md` (last audit 2026-04-11)

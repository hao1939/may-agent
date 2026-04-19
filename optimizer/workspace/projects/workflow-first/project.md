# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0
**Iteration**: 5

## Goal
Make workflows the default way agents work. Increase workflow coverage from 31% to 80%.

## Milestones
- [ ] Audit existing workflows — categorize keep/archive/investigate adoption
- [ ] Identify top 3 freestyle patterns from session archaeology
- [ ] Build one new workflow for the top freestyle pattern
- [ ] Update agent heartbeats with workflow-routed framing for top patterns
- [ ] Measure coverage improvement

## Current State
Iteration 5 complete. **Status:** done (2m23s)

**Files modified:**
- agents/optimizer/workspace/coverage-measurement.md
- DELIVERABLES_CHECKLIST.md

**Files read (not modified):**
- agents/may/cron.json

**Errors encounte

**Files modified:**
- agents/optimizer/workspace/heartbeat-workflow-wiring.md
- DELIVERABLES_CHECKLIST.md

**Files read (not modified):**
- agents/may/cron.json
- agents/may/

**Files modified:**
- agents/shared/workflows/heartbeat.ts
- DELIVERABLES_CHECKLIST.md

**Files read (not modified):**
- agents/shared/workflows/persistent-task.ts
- agents/s

**Files modified:**
- agents/optimizer/workspace/freestyle-patterns-2026-04-19.md
- DELIVERABLES_CHECKLIST.md

**Errors encountered:**
- [bash] (no output)

Command exited wi

**Files modified:**
- agents/optimizer/workspace/workflow-audit-2026-04-19.md
- DELIVERABLES_CHECKLIST.md

**Errors encountered:**
- [bash] (no output)

Command exited with c

## Iteration Summary
- **Iter 1**: **Status:** done (3m52s)

**Files modified:**
- agents/optimizer/workspace/workflow-audit-2026-04-19

- **Iter 2**: **Status:** done (3m25s)

**Files modified:**
- agents/optimizer/workspace/freestyle-patterns-2026-0

- **Iter 3**: **Status:** done (2m45s)

**Files modified:**
- agents/shared/workflows/heartbeat.ts
- DELIVERABLES_

- **Iter 4**: **Status:** done (4m13s)

**Files modified:**
- agents/optimizer/workspace/heartbeat-workflow-wiring


## Comments
- [2026-04-19 hao] Don't delete dead workflows. Some are dead because agents don't use them properly. Either fix adoption or archive for reference.
- [2026-04-19 hao] Close the loop — measure, identify gap, fix the caller framing or build workflow, measure again. Reporting without action is the anti-pattern.
- [2026-04-19 hao] Adoption is controlled by task framing (KE-214: verb determines tool). "Run workflow X for this" = 100%. "Do this work" = 0%. Fix the callers, not the agents.
- [2026-04-19 hao] persistent-task is the orchestration workflow. It uses inner workflows per iteration. Don't route at the resume handler level.
- [2026-04-19 hao] common-sense.md is human-controlled. You can suggest changes but NOT edit it directly.

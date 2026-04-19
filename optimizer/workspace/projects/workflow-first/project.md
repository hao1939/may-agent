# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0
**Iteration**: 2

## Goal
Make workflows the default way agents work. Increase workflow coverage from 31% to 80%.

## Milestones
- [ ] Audit existing workflows — categorize keep/archive/investigate adoption
- [ ] Identify top 3 freestyle patterns from session archaeology
- [ ] Build one new workflow for the top freestyle pattern
- [ ] Update agent heartbeats with workflow-routed framing for top patterns
- [ ] Measure coverage improvement

## Current State
Iteration 2 complete. **Status:** done (5m7s)

**Files modified:**
- agents/optimizer/workspace/freestyle-patterns-2026-04-19.md
- DELIVERABLES_CHECKLIST.md

**Errors encountered:**
- [bash] (no output)

Command exited wit

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


## Comments
- [2026-04-19 hao] Don't delete dead workflows. Some are dead because agents don't use them properly. Either fix adoption or archive for reference.
- [2026-04-19 hao] Close the loop — measure, identify gap, fix the caller framing or build workflow, measure again. Reporting without action is the anti-pattern.
- [2026-04-19 hao] Adoption is controlled by task framing (KE-214: verb determines tool). "Run workflow X for this" = 100%. "Do this work" = 0%. Fix the callers, not the agents.
- [2026-04-19 hao] persistent-task is the orchestration workflow. It uses inner workflows per iteration. Don't route at the resume handler level.
- [2026-04-19 hao] common-sense.md is human-controlled. You can suggest changes but NOT edit it directly.
- [2026-04-19 hao] Don't build a shared heartbeat workflow. Each agent has different interests and concerns — their heartbeat is their autonomy. A shared workflow would force the same structure on all agents. Instead, focus on the inner workflows agents use WITHIN heartbeats (e.g., when a heartbeat decides to investigate something, THAT investigation could use a workflow).

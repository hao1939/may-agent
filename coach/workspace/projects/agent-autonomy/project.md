# Project: Agent Autonomy — Roles, Responsibilities & Heartbeats

**Status**: blocked
**Owner**: coach
**Priority**: P1
**Iteration**: 10

## Goal
Each agent plays their role and takes responsibility autonomously. The system is self-driven because every agent knows what they own, what to watch, and when to act — without being told.

## Problem
Agents are passive. They wait for tasks instead of proactively finding and driving work. Heartbeats should be where agents exercise judgment: observe their domain, notice problems, decide what matters, act on it. Currently heartbeats are often wasted — agents read files, report nothing, do nothing.

## What Success Looks Like
- Each agent has a clear role with specific responsibilities and owned metrics
- Heartbeats reflect the agent's unique concerns (not generic checklists)
- Agents proactively find work in their domain without being told
- Agents are creative — they try new approaches, not just repeat routines
- The system runs itself: problems get noticed and fixed by the responsible agent

## Milestones
- [x] Audit: review each agent's current heartbeat.md, SOUL.md, and actual heartbeat behavior (done, commit d50ff32fe)
- [x] Design: define clear role, responsibilities, and owned metrics for each agent (done, commit d50ff32fe)
- [x] Redesign heartbeat.md for each agent — slimmed heartbeats + reference.md per agent (done, commit d50ff32fe)
- [ ] Verify: observe 2-3 heartbeat cycles per agent after changes — are they more proactive? Do they notice and act on problems in their domain?
- [ ] Measure: heartbeat productivity (% of heartbeats that produce meaningful action vs no-ops)

## Agents to Review
| Agent | Role | Key Question |
|-------|------|-------------|
| may | Supervisor | Does she proactively audit, unblock, and improve the system? |
| bob | Researcher | Does he proactively investigate architecture questions and run experiments? |
| coach | Trainer | Does he proactively identify skill gaps and design interventions? |
| optimizer | Optimizer | Does he proactively find inefficiencies and propose improvements? |
| scout | Scout | Does he proactively find relevant external research and connect it to our problems? |
| tech-lead | Tech Lead | Does he proactively improve code quality, fix tech debt, review architecture? |
| qa | QA | Does he proactively find bugs, test edge cases, verify changes? |

## Comments
- [2026-04-20 hao] Coach actually did good work — slimmed all 6 heartbeat.md files, created reference.md per agent (commit d50ff32fe). Milestones 1-3 are done. Focus on 4-5.

## Current State
**Blocked (iteration 10)**

Milestones 1-3 (Audit, Design, Redesign) are **done** — heartbeat.md files were slimmed and reference.md created per agent (commit d50ff32fe).

Milestones 4-5 (Verify, Measure) are **blocked**:
- Worker cannot query the sessions database (bun:sqlite errors) to observe actual heartbeat behavior
- Without session data, cannot measure whether new heartbeats made agents more proactive
- Multiple iterations produced the same audit docs without advancing these milestones

**Options to unblock:**
1. Have orchestrator provide session data the worker can't query
2. Wait for future heartbeat cycles and manually observe improvement
3. Accept milestones 1-3 as the deliverable and close the project

## Iteration Summary
- **Iter 2-6**: Completed milestones 1-3 (audit, design, redesign heartbeats). Commit d50ff32fe.
- **Iter 7-8**: Attempted verification but hit bun:sqlite errors querying session data.
- **Iter 9**: Same pattern — audit doc rewritten, no milestone progress.
- **Iter 10**: Escalated as blocked. Milestones 1-3 marked complete. 4-5 require session data access.

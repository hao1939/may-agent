# Project: Agent Autonomy — Roles, Responsibilities & Heartbeats

**Status**: blocked
**Owner**: coach
**Priority**: P1
**Iteration**: 8

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
- [ ] Audit: review each agent's current heartbeat.md, SOUL.md, and actual heartbeat behavior (what do they actually do vs what they should do?)
- [ ] Design: define clear role, responsibilities, and owned metrics for each agent. What should each agent proactively watch? What should trigger action?
- [ ] Redesign heartbeat.md for each agent — specific to their role, encouraging initiative and creativity, not generic task lists
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


## Current State
Blocked: The task has been spinning for 4+ iterations writing files to `/tmp/` (heartbeat-status.md, heartbeat-verification.md, etc.) without actually modifying any agent heartbeat.md files in the repository. The worker is producing auxiliary documents but not advancing any of the 5 milestones. The core issue: the worker needs to edit actual agent configuration files (heartbeat.md, SOUL.md) in the codebase, not create temp files. Without clarity on where these agent files live and permission to edit them, this will continue looping.

**Files modified:**
- /tmp/heartbeat-verification.md

**Agent response:**
Now I have all the data. Let me create the verification document.

**Files modified:**
- docs/journal/2025-04-19-heartbeat-audit.md

**Files read (not modified):**
- /tmp/heartbeat-drafts.md
- /tmp/heartbeat-references.md

**Errors encounter

**Files modified:**
- /tmp/heartbeat-status.md

**Agent response:**
Everything already exists! All 6 heartbeats and all 6 reference files were already applied. The status fil

**Files modified:**
- /tmp/heartbeat-references.md

**Files read (not modified):**
- /tmp/heartbeat-drafts.md
- /tmp/heartbeat-design.md

**Errors encountered:**
- [edit] Cou

**Files modified:**
- /tmp/heartbeat-drafts.md

**Agent response:**
Now I have all three. Let me write the drafts.

**Files modified:**
- /tmp/heartbeat-design.md

**Agent response:**
Now let me start the design doc (milestone 2):

**Files modified:**
- /tmp/heartbeat-audit.md

**Errors encountered:**
- [bash] 
=== scout recent sessions (all) ===
1 | 
2 | import{Database}from'bun:sqlite';
3 | const db=ne

## Iteration Summary
- **Iter 2**: **Status:** done (2m1s)

**Files modified:**
- /tmp/heartbeat-audit.md

**Errors encountered:**
- [b

- **Iter 3**: **Status:** done (2m13s)

**Files modified:**
- /tmp/heartbeat-design.md

**Agent response:**
Now le

- **Iter 4**: **Status:** done (1m20s)

**Files modified:**
- /tmp/heartbeat-drafts.md

**Agent response:**
Now I 

- **Iter 5**: **Status:** done (3m10s)

**Files modified:**
- /tmp/heartbeat-references.md

**Files read (not modi

- **Iter 6**: **Status:** done (4m23s)

**Files modified:**
- /tmp/heartbeat-status.md

**Agent response:**
Everyt

- **Iter 7**: **Status:** done (2m58s)

**Files modified:**
- docs/journal/2025-04-19-heartbeat-audit.md

**Files 


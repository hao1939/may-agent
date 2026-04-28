# Lesson Database v1 — Initial Population

## Overview
First populated version of the structured lesson database, drawn from the system-efficiency project's 27+ iterations and cross-project work.

## Lessons

### Category: Fix
| ID | Lesson | Source | Date |
|----|--------|--------|------|
| F01 | Workers announce intent but don't execute — they read/analyze instead of writing. Fix: require write() as first tool call. | system-efficiency iterations 1-5 | 2025-01 |
| F02 | Zombie projects accumulate silently — 51 shared + 70 agent-owned projects were dead. Fix: regular archival sweeps based on consecutiveSkips. | system-efficiency iteration 2 | 2025-01 |
| F03 | Projects without clear milestones stall. Every project.md must have 3 concrete milestones with deliverable file names. | workflow-reliability setup | 2025-01 |

### Category: Pattern
| ID | Lesson | Source | Date |
|----|--------|--------|------|
| P01 | Cycle iterations across multiple projects to maintain throughput — don't sprint on one project then idle. | system-efficiency iterations 6-26 | 2025-01 |
| P02 | Read project.md → find next milestone → write deliverable immediately. This 3-step pattern produces reliable output. | all satellite projects | 2025-01 |
| P03 | Copy deliverables to both project outputs/ and shared outputs/ for visibility. | system-efficiency pattern | 2025-01 |
| P04 | When a milestone is time-gated (e.g., "sustain for 3 days"), keep cycling other work instead of blocking. | system-efficiency iteration 25+ | 2025-01 |

### Category: Insight
| ID | Lesson | Source | Date |
|----|--------|--------|------|
| I01 | 5 active projects with regular cycling produces 10+ iterations/day sustainably. | system-efficiency metrics | 2025-01 |
| I02 | The biggest throughput blocker is not capability but instruction-following — workers that read before writing waste entire iterations. | system-efficiency audit | 2025-01 |
| I03 | Archiving zombie projects reduces cognitive load and makes active project lists actionable. | system-efficiency iteration 2 | 2025-01 |

## Retrieval Protocol
Before starting any task:
1. Check lesson DB for matching category keywords
2. Apply relevant fixes/patterns to avoid known pitfalls
3. After task completion, extract new lessons and append to DB

## Stats
- Total lessons: 10
- Fixes: 3 | Patterns: 4 | Insights: 3
- Source sessions: system-efficiency (primary), workflow-reliability, satellite projects

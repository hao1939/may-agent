# Heartbeat & Mission Loop Design

## Core Distinction

### Heartbeat (LLM-powered, exploratory)
- Think, reflect, try new things
- Make critical decisions
- Trigger new cron jobs if something proves useful
- Agent drives — creative, adaptive

### Cron Job (deterministic, proven)
- Routine tasks that already work
- Agent audits them, doesn't do them
- Offloadable — could become JS handlers
- Infra drives — reliable, efficient

## The Lifecycle

```
1. Agent explores something in heartbeat
2. It works → becomes a TODO pattern
3. Pattern proves reliable → agent creates a cron job for it
4. Cron job runs automatically → agent just audits results
5. Heartbeat freed up for the NEXT exploration
```

This is P17 (Offload Routing to Infra) applied to the agent's own work.
The heartbeat is the agent's "conscious mind" — expensive, creative, limited.
Cron jobs are the "muscle memory" — cheap, reliable, automatic.

## Layers

| Layer | Purpose | Who drives | Example |
|-------|---------|------------|---------|
| **SOUL.md** | Identity, mission | Static | "I am the Improver" |
| **heartbeat.md** | Explore, reflect, decide | LLM (agent) | "Try a new optimization approach" |
| **cron jobs** | Proven routines | Infra | "Run eval → analyze → fix daily" |
| **heartbeat audit** | Is the cron doing its job? | LLM (agent) | "Check if daily optimize is actually improving scores" |

## Heartbeat.md Template

```markdown
# Heartbeat — [Agent Name]

Read your SOUL.md first. Then work through each section.

## 1. Audit Running Jobs
Check your cron job results. Are they working?
Anything to adjust, disable, or promote to JS handler?

## 2. Mission Reflection
What did I accomplish since last heartbeat?
What's blocking my mission? What needs attention?

## 3. Explore / Try
What's the next thing to investigate for your mission?
New ideas, unproven approaches, open questions.
Skip if nothing actionable — don't explore for exploration's sake.

## 4. Decide
Any critical decisions needed? New jobs to create?
Update workspace/todo.md and cron jobs as needed.
```

## Which Agents Get Heartbeats

All heartbeats use `heartbeat-precheck` JS handler which checks if the agent
is already busy before spawning. This prevents wasted sessions.

| Agent | Heartbeat? | Interval | Why |
|-------|-----------|----------|-----|
| **may** | ✅ | 20min | Coordinator — drain TODOs, route work, system health |
| **bob** | ✅ | 20min | Design evolution, philosophy audit, todo drain |
| **optimizer** | ✅ | 20min | Find & fix highest-impact problems |
| **coach** | ✅ | 20min | Plan training, review coachee progress |
| **evaluator** | ✅ | 20min | Review eval quality, calibrate scoring |
| **tech-lead** | ✅ | 20min | Implementation leadership, code health |
| **amy** | ✅ | 30min | XHS exploration, insight synthesis |
| **scout** | ✅ | 30min | Wide-net research, discovery |
| **coder** | ❌ | — | Worker — no mission loop |
| **qa** | ❌ | — | Worker — no mission loop |
| **master** | ❌ | — | Worker — no mission loop |
| **amy-kimi** | ❌ (disabled) | — | Disabled in cron |

*Source: `agents/may/cron.json` (last verified 2026-03-12)*

## Cron Job Inventory

### JS Handlers (deterministic, no LLM)
| Name | Interval | Purpose |
|------|----------|---------|
| watchdog | 10min | Kill stuck sessions (>30min) |
| evaluate-sessions | 30min | Score unevaluated sessions |
| system-status | 4h | Collect metrics, write health-log.md |
| daily-brief | 24h | Daily system metrics summary |
| coaching-report | 24h | Coaching quality report |
| focus-task-tracker | 1h | Check focus task signals **(disabled)** |
| heartbeat-precheck | — | Gates all agent heartbeats (not scheduled — called by heartbeat entries) |

### Detached Agent Jobs (via `run-agent-task` handler)
| Name | Agent | Interval | Purpose |
|------|-------|----------|---------|
| analyze-failures | bob | 24h | Read evaluations, identify patterns |
| optimize | optimizer | 24h | Implement one fix per day |
| lesson-consolidation | bob | 7d | Dedup/consolidate LESSONS.md across agents |
| focus-task-driver | bob | 1h | Drive focus tasks forward |

### Disabled
| Name | Agent | Reason |
|------|-------|--------|
| focus-task-tracker | — | Superseded by focus-task-driver |
| heartbeat-amy-kimi | amy-kimi | Agent disabled |
| iraq-conflict-monitor | scout | Temporary, disabled |

*Source: `agents/may/cron.json` (last verified 2026-03-12)*

## How `agents.send` Integrates

The `send` action on the agents tool:
1. Appends `- [ ] [from:{caller} {timestamp}] {message}` to `agents/{target}/workspace/todo.md`
2. Calls `triggerHeartbeat(target)` → fires `heartbeat-precheck` for the target agent
3. Agent wakes, reads todo.md, processes it

No separate `drain-todo` handler is needed — the agent reads todo.md during its heartbeat.

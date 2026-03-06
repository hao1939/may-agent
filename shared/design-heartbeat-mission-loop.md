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

| Agent | Heartbeat? | Why |
|-------|-----------|-----|
| **may** | ✅ Already has one | Coordinator — drain TODOs, route work |
| **bob** | ✅ Yes | Design evolution, philosophy audit |
| **optimizer** | ✅ Yes | Find & fix highest-impact problems |
| **coach** | ✅ Yes | Plan training, review coachee progress |
| **evaluator** | ✅ Yes | Review eval quality, calibrate scoring |
| **amy** | ✅ Yes | XHS exploration, insight synthesis |
| **scout** | ✅ Yes | Wide-net research, discovery |
| **coder** | ❌ No | Skill-composed, no mission |
| **qa** | ❌ No | Skill-composed, no mission |
| **amy-kimi** | ❌ No | Skill-composed, no mission |

## Existing Cron Jobs (proven routines — keep as-is)

These are already offloaded. Heartbeats should audit them, not replace them:
- `evaluate-sessions` (4h, JS handler)
- `system-status` (4h, JS handler)
- `analyze-failures` (24h, bob)
- `optimize` (24h, optimizer)
- `health-check` (24h, may)
- `coaching` (48h, coach)
- `lesson-consolidation` (weekly, bob)

## Implementation Steps

1. Create heartbeat.md for each evolving agent (bob, optimizer, coach, evaluator, amy, scout)
2. Update May's heartbeat.md to follow the new template (add audit + reflection sections)
3. Add cron entries to fire heartbeats for each agent at appropriate intervals
4. Update cron messages to reference SOUL.md
5. Bob: add this design as a new philosophy principle (heartbeat vs cron distinction)

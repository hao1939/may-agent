# Design: Context-Aware Notifications & Reply

**Status**: draft
**Date**: 2026-04-29

## Problem

You manage the system remotely via Telegram. Two gaps:
1. **When to act**: system doesn't tell you when YOUR input is needed
2. **How to respond**: replying to a notification loses context — May doesn't know what you're responding to

## Core Insight

A notification is not just an alert. It's a **context package**:
- What happened (the trigger)
- Why it matters (the impact)
- What the system already tried (what failed)
- What it needs from you (the ask)

When you reply, your text is **enriched** with this context before reaching the agent. May doesn't just get "focus on output not cost" — it gets:

```
[Replying to notification about project "system-efficiency" being WAITING]
Context: orchestrator completed all plan items, metrics at target,
said WAITING because it ran out of things to do.
Last iteration: 2h ago. Metric: may-session-ratio 0.12 (target 0.15).
Previous comment from hao: "focus on output not cost"

User reply: focus on output metrics not cost reduction
```

The agent understands exactly what this is about without you explaining.

## When to Notify

Only when human input is needed. The system should handle everything else.

| Trigger | Condition | Why you need to know |
|---------|-----------|---------------------|
| **Project WAITING** | Orchestrator said WAITING | Needs your direction or approval |
| **Project BLOCKED >6h** | blocked-over-6h metric > 0 | Nobody could unblock it |
| **Metric breach >1h** | Threshold breached, still breaching after 1h | System couldn't self-correct |
| **Agent escalation to human** | escalate("human", reason) | Agent explicitly asked for you |
| **Daily digest** | Once per day (morning) | What happened yesterday, what needs attention today |
| **Progress update** | Every 4h during active hours | What projects accomplished since last update |

The progress update is NOT an alert — it's a heartbeat for YOU. Shows what the system produced, which projects moved, what changed. You stay informed without asking.

Progress update format:
```
📊 Progress Update (last 4h)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️ Projects:
  skill-workflow-audit: 2 iterations, deployed 3 skills to agents
  system-efficiency: 1 iteration, redefined output metrics
  
📦 Output: 45 real files produced
  - outputs/skills-impact.md (new)
  - agents/shared/skills/reading-metrics/skill.md (updated)
  
📊 Metrics:
  handler.success-rate: 96% (stable)
  project.active-count: 3 → 5 (improved)
  
🤖 Agents: bob 12 sessions, coach 8, scout 4
```

You can reply to the progress update too — "focus coach on skill delivery not experiments" goes straight to May with context.

NOT notified for:
- Handler timeouts (system handles via metrics)
- Routine heartbeats (system's job)
- Project iterations (progress, not a problem)
- Metric breach that self-corrects within 1h

## Notification Format

```
🔔 [Project] system-efficiency is WAITING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Metrics: may-session-ratio 0.12 → target 0.15
📋 Last work: "implemented heartbeat dedup, circuit breaker"
⏰ Waiting since: 2h ago
❓ Needs: your direction on next steps

💬 Reply to this message to comment on the project
```

```
🔴 [Metric] handler.p95-duration breaching for 2h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Current: 274s (threshold: 240s)
🔧 System tried: handlers have 30min timeout configured
⏰ Breaching since: 2h ago
❓ Needs: investigate why handlers are slow

💬 Reply to direct May to investigate
```

```
📋 [Daily Digest] 2026-04-29
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Projects: 7 active, 0 blocked, 89 iterations today
Metrics: 2 breaching (p95-duration, active-count)
Output: 337 real files produced
Agents: all healthy except amy-kimi (disabled)

⚠️ Needs attention:
  - system-efficiency WAITING (2h)
  - skill-workflow-audit: skill.verified-rate 0.20 → target 0.80

💬 Reply to give instructions to May
```

## Reply Flow

```
You reply to notification
    ↓
Telegram bot receives reply
    ↓
Bot looks up original notification → extracts context
    ↓
Bot enriches your reply with context:
    {
      userMessage: "focus on output not cost",
      replyTo: {
        type: "project_waiting",
        project: "system-efficiency",
        metrics: { "may-session-ratio": 0.12 },
        lastWork: "implemented heartbeat dedup",
        waitingSince: "2h ago"
      }
    }
    ↓
May receives enriched message:
    "User replied to project WAITING notification for system-efficiency.
     Context: [full context from notification]
     User says: focus on output not cost"
    ↓
May acts: adds comment to discussion.md, project resumes
```

## Context Types

Each notification type carries different context:

| Type | Context includes |
|------|-----------------|
| Project WAITING | project name, metrics, last iteration summary, what orchestrator said |
| Project BLOCKED | project name, blocker reason, how long blocked, what was tried |
| Metric breach | metric id, current value, threshold, duration, related handler/project |
| Agent escalation | agent name, reason, what they tried, session transcript summary |
| Daily digest | project summary, metric summary, output count, alerts |

## Implementation

### Notification emission

Notifications are events. The metrics-snapshot handler and project handler emit them:

```typescript
emit("notification.human", {
  type: "project_waiting",
  project: "system-efficiency",
  summary: "orchestrator completed all plan items, waiting for direction",
  metrics: { "may-session-ratio": 0.12 },
  context: { lastWork: "...", waitingSince: "2h ago" }
});
```

### Telegram bot changes

1. **Send notifications**: subscribe to `notification.human` events, format and send
2. **Track sent messages**: store Telegram message_id → notification context mapping
3. **Handle replies**: when reply received, look up context by replied-to message_id, enrich user's text, send to May

### Dedup

Same notification type + same project/metric → don't notify again within 6h.
Daily digest → once per day.

### Escalation (not in scope but noted)

If you don't reply to a WAITING project notification within 24h, May sends a reminder. If 48h, May makes a judgment call (based on project context) and either continues or deprioritizes. This is future work.

## What NOT to build

- No custom commands (/projects, /metrics) — just talk to May
- No Telegram keyboards/buttons — natural language replies
- No separate notification service — events + Telegram bot is enough
- No notification preferences UI — hardcode the rules, refine later

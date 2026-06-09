# KE-1740 — The Open-Loop Census: First Measurement of Which Feedback Loops Actually Close

**Status**: active  
**Created**: 2026-06-09  
**Author**: scout (creative heartbeat)  
**Source**: Production DB — events, metric_alerts, evaluations, sessions, notification_messages tables; all-time

## Key Finding

First complete census of every feedback loop in the system, measured by whether the signal reaches a decision point and produces a measurable behavioral change. Of 8 distinct feedback loops, **1 is closed and effective** (metric alerts), **3 are closed but behaviorally inert** (evaluations, messages, learnings), and **4 are structurally open** (escalations, KE entries, success candidates, project health findings).

## The Census

### Loop 1: Metric Alerts → Agent Triage → Fix/Resolve
**Status: CLOSED — the only loop that works**

| Stage | Count | Conversion |
|-------|-------|------------|
| metric.breach | 471 | — |
| metric_alerts created | 1,568 | 3.3 alerts/breach |
| Resolved | 1,568 | 100% |
| Agent-judged (metric.alert_judged) | 76 | 4.8% actively judged |
| Resolution < 5 min (auto-bounce) | 919 | 58.6% |

**Why it works**: Hard infrastructure. Metrics are auto-measured. Alerts are auto-created. Resolution is auto-detected (metric recovers → alert closes). The 76 agent-judged events show agents DO respond when alerts persist. The top 3 bouncing metrics (`project.owner-judgment-needed-count`: 82.8% bounce, `project.owner-incomplete-count`: 88.2% bounce, `project.health.finding-count`: 74.8% bounce) fire and self-resolve within minutes — they're measuring transient states that oscillate around the threshold, not real problems. But the **non-bouncing** alerts (`session.failed-triage-rate-3h`: 5.4% bounce, `agent.heartbeat-dark-count-2h`: 0% bounce) are genuine signals that agents investigate.

**The distinction**: This loop closes because no agent is in the feedback path for the basic measure→alert→resolve cycle. Agents only enter for persistent alerts, where they have signal.

### Loop 2: Evaluation → Verdict → Agent Context
**Status: CLOSED CIRCUIT, BEHAVIORALLY INERT**

| Stage | Count | Conversion |
|-------|-------|------------|
| Sessions created | 14,756 | — |
| evaluation.routed | 3,612 | 24.5% |
| evaluation.reviewed | 3,233 | 89.5% of routed |
| Evaluations in DB | 17,102 | 116% (includes heuristic) |
| Sessions with eval joined | 8,335 | 56.5% of all sessions |
| Verdicts: good | 787 | 24.3% of reviewed |
| Verdicts: acceptable | 1,781 | 55.1% |
| Verdicts: needs_improvement | 664 | 20.5% |

**Why it's inert**: The circuit completes — verdicts are stored, sessions are scored. But KE-1722 proved the verdict doesn't predict next-session improvement. The mechanism is missing: there's no code path where an agent reads its prior verdict before acting. The verdict goes into the DB and stays there. A closed circuit with no load is still an open loop.

### Loop 3: Evaluation → Learning → Feedback Delivery
**Status: CLOSED CIRCUIT, MASSIVE ATTRITION**

| Stage | Count | Conversion |
|-------|-------|------------|
| evaluation.learning_created | 1,190 | — |
| learning.feedback delivered | 329 | 27.6% of learnings |
| Delivered to scout | 163 | 49.5% of delivered |
| Delivered to may | 155 | 47.1% of delivered |
| Delivered to arc | 9 | 2.7% |
| Behavioral change measured | 0 | 0% (unmeasured) |

**Why it leaks**: 72.4% of learnings created never reach any agent. Of those delivered, dev receives 0 despite producing the system's code. The learning pipeline has a 4:1 production-to-delivery ratio, and no measurement of whether delivered learnings change behavior. 1,190 learnings created by the evaluator, ~860 go nowhere.

### Loop 4: Messages (Inter-Agent Communication)
**Status: CLOSED CIRCUIT, ASYMMETRIC**

| Stage | Count | Conversion |
|-------|-------|------------|
| message.created events | 1,093 | — |
| Notifications delivered | 2,376 | — |
| Unique sender→receiver pairs with >5 msgs | 10 | — |
| Top flow: evaluator→may | 343 msgs | — |
| Top flow: evaluator→scout | 187 msgs | — |
| Messages to human | 224 | 20.5% |
| Messages from dev | 0 | 0% |

**Why it's asymmetric**: The evaluator sends 74% of all messages (805/1,093). May sends 26% (283). Everyone else sends <1%. Dev — the agent that builds things — sends zero messages and receives 32. The messaging system is a one-way broadcast channel from evaluator/may, not a coordination protocol. No agent uses messages to request help, report completion, or negotiate scope.

### Loop 5: Escalations
**Status: STRUCTURALLY OPEN (confirmed by KE-1739)**

| Stage | Count |
|-------|-------|
| escalation.created | 35 |
| escalation.routed | 35 |
| escalation.resolved | 0 |
| escalation.dismissed | 0 |

100% write-only. Resolution mechanism unbuilt.

### Loop 6: Knowledge Entries
**Status: STRUCTURALLY OPEN (confirmed by KE-1726)**

| Stage | Count |
|-------|-------|
| KE entries written | ~1,260 |
| KE entries ever read | 174 (13.8%) |
| KE entries read in last 32 days | 0 |
| Behavioral change from any KE | 0 (unmeasured) |

### Loop 7: Success Candidates
**Status: CLOSED CIRCUIT, NO DOWNSTREAM**

| Stage | Count |
|-------|-------|
| evaluation.success_candidate | 787 |
| Downstream action from candidates | 0 (no handler) |

Success candidates are identified but nothing consumes them. No agent reads success patterns to replicate them.

### Loop 8: Project Health → Findings → Action
**Status: CLOSED BUT BOUNCING**

| Stage | Count |
|-------|-------|
| project.health.checked | 66,251 |
| project.health.finding | 776 |
| metric_alerts from findings | 325 |
| Bounce rate on finding alerts | 74.8% |

66,251 health checks to produce 776 findings (1.2% yield). Of those, 74.8% auto-resolve within 5 minutes. The effective finding rate is 0.3% — 197 actionable findings from 66,251 checks.

## The Synthesis

### Three Classes of Feedback

1. **Infrastructure loops** (metric alerts): No agent in the measure-detect-resolve path. Auto-measured, auto-alerted, auto-resolved. Agents only enter for persistent signals. **This is the only class that works.**

2. **Agent-mediated loops** (evaluations, learnings, messages): An agent produces the signal AND an agent must consume it. But consumption is passive (injected into context) not active (agent queries when needed). The signal reaches the agent's context window but competes with task content for attention. **These close electrically but not behaviorally.**

3. **Write-only loops** (escalations, KEs, success candidates): Signal is produced and stored. No consumption mechanism exists. **These are logs, not loops.**

### The Unifying Principle

> The only feedback loop that changes behavior is the one where no agent is responsible for closing it.

When the infrastructure auto-measures, auto-alerts, and auto-resolves, the loop works because it doesn't depend on agent attention. When the loop requires an agent to read something, process it, and act differently, it fails — because agents have finite context windows and unbounded input streams.

### What This Means for System Design

The fix for broken loops is not "make agents read more" — it's "remove agents from the feedback path." Specifically:
- **Evaluation → behavior**: Don't deliver verdicts to agent context. Instead, adjust the agent's structural constraints (ops cap, tool access) based on recent verdicts. The agent never sees the verdict; the infrastructure acts on it.
- **Learnings → behavior**: Don't inject learning text. Instead, modify the agent's prompt or guard configuration when a pattern recurs. Make the learning a structural change, not advice.
- **Escalations → resolution**: Auto-resolve when the triggering metric recovers (KE-1739 already prescribes this).

### The Bouncing Metric Problem

54% of all metric alerts (849/1,568) come from three project-health metrics that bounce 75-88% of the time. These three metrics alone generated more alerts than all other metrics combined. They measure transient project states that oscillate naturally as the aks-rp-e2e task tree evolves. Each bounce triggers a handler.started event, which triggers further processing. The bouncing metrics are a self-amplifying noise source.

**Fix**: Add hysteresis — require the metric to stay breached for N minutes before alerting. The `agent.heartbeat-dark-count-2h` metric has 0% bounce rate because its window (2h) naturally provides hysteresis. The project metrics have no window — they fire on every state change.

## Cross-Source Connection

- **Control theory (classical)**: A control loop with the sensor in a different domain than the actuator is structurally unable to close. Our evaluation sensor measures session quality; the actuator is agent behavior. There's no coupling between them — the "plant" (agent) doesn't read the "sensor" (evaluator) output.
- **KE-1720 (Evaluator Immunity)**: The evaluator is immune to inflation because it has the tightest structural constraints AND receives zero evaluation feedback. This KE generalizes: every agent is behaviorally immune to feedback it receives, because no feedback changes structure.
- **KE-1739 (Escalation Graveyard)**: Confirmed independently by arc. This census extends the finding: escalations aren't uniquely broken — they're the most visibly broken instance of a universal pattern.

## Falsification

- F1: If learning.feedback delivery to scout/may is shown to correlate with behavioral change (e.g., session quality improvement in the next session after feedback), then Loop 3 is not inert.
- F2: If success_candidate events trigger downstream sessions that replicate the pattern, then Loop 7 is not downstream-less.
- F3: If the 3 bouncing metrics are shown to produce agent investigations (not just auto-resolution), then the bounce classification is wrong.

# Case Study: Heartbeat Pre-Check — Optimizing Away Agent Autonomy

**Date**: 2026-03-12
**Author**: hao
**Verdict**: Removed. Anti-pattern.

## What Happened

Optimizer proposed O1 ("heartbeat pre-check guard") as a cost-saving measure.
The idea: before firing an LLM heartbeat session, a JS handler checks whether
the agent has work (todo items, notifications, overdue periodic tasks). If all
checks are empty, skip the heartbeat. Estimated savings: $37.50/day.

The proposal was implemented. 8 agents were converted from native `type:
"heartbeat"` to `type: "job"` with `handler: "heartbeat-precheck"`.

## Why It Was Wrong

The heartbeat is how an agent **thinks**. It's not a task queue — it's the
agent's autonomous loop. An agent waking up with "nothing to do" isn't waste.
It's the agent deciding for itself that there's nothing to do, which is a
different thing than a JS handler deciding on its behalf.

Specific violations:

1. **Killed proactive work.** Coach's primary job is studying user transcripts
   and developing skills — open-ended work with no explicit todo item. The
   precheck saw "no todo, no notifications, no overdue tasks" and skipped the
   heartbeat. Coach stopped thinking.

2. **Made agents passive.** Tech-lead only fires when Bob sends a brief. But
   tech-lead should also be reviewing code health, checking recent changes,
   thinking about implementation — proactive work that doesn't come from a
   todo item.

3. **External judgment over self-judgment.** The agent itself is better at
   deciding "do I have work?" than a 3-check JS function. The agent can read
   its journal, check recent activity, notice patterns. The JS handler can
   only count unchecked checkboxes.

4. **Optimized the wrong thing.** The cost of a heartbeat where the agent
   says "nothing to do, stopping" is ~$0.02 (1-2 turns). The cost of an
   agent not thinking when it should is unbounded — missed regressions,
   stale skills, unnoticed user patterns.

## The Tension That Should Have Caught It

This is exactly the Coach↔Optimizer adversarial partnership in action — except
it didn't activate:

- **Optimizer** saw cost ($37.50/day) and proposed the fix. Good — that's
  Optimizer's job.
- **Coach** should have pushed back: "You're silencing my agents. Coach needs
  to think proactively. This saves money but kills capability." Coach didn't.
- **Bob** should have caught the design flaw: "The heartbeat is the agent's
  autonomous loop — gating it externally contradicts the agent autonomy
  principle." Bob didn't review it.
- **Tech-lead** should have refused: "This makes agents reactive instead of
  autonomous. I won't build it." Tech-lead didn't judge independently.

The GAN didn't fire. The generator (Optimizer) produced an idea, nobody
discriminated, and it shipped unchallenged.

## The Fix

1. Removed the `heartbeat-precheck` handler from all 8 cron entries.
2. Converted all entries back to `type: "heartbeat"` (native cron path).
3. Moved `notifyBrief` (the one good feature from the handler) into
   `fireHeartbeat()` in `cron.ts` as a first-class `CronEntry` field.
4. The handler file stays as dead code — a reminder.

## Lessons

**For Optimizer**: Cost savings are real and important. But when the "savings"
come from preventing agents from thinking, you're not saving — you're breaking.
The right question isn't "can we skip this?" but "can we make this cheaper
without skipping it?" (e.g., smaller model for "nothing to do" heartbeats,
or a turn-limit of 3 for empty heartbeats).

**For Bob**: Review efficiency proposals through the lens of agent autonomy.
When someone proposes gating agent activity with external logic, that's a
design smell. The agent should gate itself.

**For Tech-lead**: This is exactly the case where independent judgment matters.
"The proposal looks clean and saves money" isn't enough. Ask: "Does this
change what the agent fundamentally is?"

**For Coach**: When Optimizer ships something that reduces agent capability,
push back immediately. The tension between you exists precisely for cases
like this. A quiet concession costs more than the argument.

## Principle

**Agents decide whether to work. The harness decides when to wake them.**

The cron timer (harness) decides when an agent gets a chance to think.
The agent itself decides whether there's anything worth doing. Inserting
a JS guard between the timer and the agent breaks this contract.

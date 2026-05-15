# Skill: Closing the Loop

## When to Use
When you've fixed a problem and need to decide: should I also **extend the system** to prevent it from recurring?

## The Decision Framework

Ask yourself: **Will this happen again?**

| Answer | Action |
|--------|--------|
| No — one-off issue | Just fix it, move on |
| Maybe — seen it twice | Write a **skill** to teach other agents |
| Yes — it's a pattern | Write a **guard** to catch it automatically |
| Yes — and the check is mechanical | Write a **handler** to automate it entirely |

## The Evolution Ladder

### Level 1: Skill (advisory, cheapest to write)
**What**: A markdown document agents read for guidance.
**When**: You've learned something others should know. The judgment call is nuanced.
**Where**: `agents/shared/skills/<name>/skill.md`
**Cost**: Zero runtime cost. Agents read it when relevant.
**Example**: You noticed agents keep forgetting to verify after writing files → write `verification` skill.

### Level 2: Guard (enforced during workflows)
**What**: TypeScript implementing `WorkflowGuard` interface. Runs during workflow execution.
**When**: A skill exists but agents aren't following it. The check can be codified.
**Where**: `agents/shared/guards/<name>.ts`
**Cost**: Runs every workflow execution. Keep it fast.
**Example**: Agents skip verification despite the skill → write `verify-after-write.ts` guard that blocks completion without evidence.

### Level 3: Handler (fully automated)
**What**: TypeScript implementing `HandlerModule`. Runs on a cron schedule.
**When**: The check is purely mechanical — no LLM judgment needed.
**Where**: `agents/may/handlers/<name>.ts`, registered in `agents/may/cron.json`
**Cost**: Runs on timer, zero LLM cost.
**Example**: Check if metrics are stale → write `watchdog.ts` handler that alerts when data is old.

## How to Write Each Type

### Writing a Skill
1. Create `agents/shared/skills/<name>/skill.md`
2. Include: When to Use, Steps, Common Mistakes
3. Reference it from relevant agent heartbeat docs or common-sense.md
4. Test: run a gym scenario to verify agents can follow it

### Writing a Guard
1. Read `agents/shared/guards/verify-after-write.ts` for the interface
2. Create your guard implementing `WorkflowGuard`
3. Export: `name`, `description`, `shouldRun(context)`, `execute(context)`
4. Guard is auto-discovered from the guards directory

### Writing a Handler
1. Read `agents/may/handlers/watchdog.ts` for the interface
2. Create your handler implementing `HandlerModule`
3. Register in `agents/may/cron.json` with schedule
4. Handler runs automatically on the cron schedule

## Real Patterns from This System

| Problem observed | Extension written | Type |
|-----------------|-------------------|------|
| Agents don't verify file writes | `verify-after-write.ts` | Guard |
| Metrics go stale unnoticed | `watchdog.ts` | Handler |
| Agents don't know how to read metrics | `reading-metrics` skill | Skill |
| Session outcomes not tracked | *Needs fixing — see baseline-report.md* | TBD |

## Common Mistakes

- **Writing a guard before a skill**: Start advisory. Only enforce when advice is ignored.
- **Writing a handler for a judgment call**: If it needs LLM reasoning, it's a guard, not a handler.
- **Not testing**: Run gym scenarios after writing any extension.
- **Over-engineering**: If it happened once, just fix it. Don't build infrastructure for one-offs.
- **Forgetting to reference it**: A skill nobody reads is useless. Link it from heartbeat docs or common-sense.md.

## The Litmus Test

Before writing an extension, ask:
1. **Has this happened 2+ times?** If no, just fix it.
2. **Can I describe the fix as rules?** If yes → guard or handler. If no → skill.
3. **Does it need LLM judgment?** If yes → skill or guard. If no → handler.
4. **Is there already a skill for this?** If yes and it's not working → escalate to guard.

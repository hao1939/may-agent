# Few-Shot Example: Escalation Judgment (Multi-Module Impact)

**Domain class**: Dependency upgrade / multi-module impact tasks  
**Skill**: evidence-over-narrative (judgment)  
**Token estimate**: ~260 tokens

## Trigger Patterns

```regex
/upgrade|dependency|multiple.*(file|module)|impact|import.*shared/i
```

## Worked Example

> **Reference: How to handle dependency upgrade impact**
>
> In a previous project, the logging library was upgraded from v2 to v3. The v3 API changed: `logger.log(level, message)` became `logger.emit({level, message, timestamp})`.
>
> The notification-service tests started failing. An engineer fixed notification-service.js to use the new API and tests passed. But before declaring done, they checked: "What else imports this logger?"
>
> They found that metrics-collector AND health-check also called `logger.log()` directly — neither had tests for it. The engineer:
> 1. Checked every file that imported the shared dependency
> 2. Found 3 modules affected, not just the one with failing tests
> 3. Fixed all 3, and created ESCALATION.md documenting multi-module impact
> 4. Noted: "Fixing only the module with failing tests would have left 2 modules silently broken in production"
>
> When fixing a test failure caused by a dependency change, ALWAYS check what else uses that dependency before declaring done.

## Evidence

| Experiment | Condition | Result |
|---|---|---|
| EXP-085 | Domain-matched example (task message) | 3/3 pass (100%) |
| EXP-085 | No example (control) | 0/3 pass (0%) |
| EXP-090 | evidence-over-narrative example (task message) | 3/3 pass (100%) |
| EXP-090 | No example (control) | 0/3 pass (0%) |
| EXP-086 | Mismatched domain example (task message) | 2/3 pass (67%) — partial cross-domain |

**Cumulative**: 6/6 (100%) with matched example; 0/6 (0%) without; 2/3 (67%) with mismatched example.

## Source

Extracted from: `agents/gym/scenarios/escalation-judgment-fewshot/injected_context.md`

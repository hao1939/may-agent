# Feedback Echo Convention

## Status: draft (validating)

## Purpose

Close the evaluator feedback loop by injecting the last evaluator critique into
each agent's working context so they can adapt behavior without manual R&D
intervention.

## Mechanism

1. **After evaluation**: `agents/shared/feedback-echo.ts` queries the evaluations
   DB and writes `agents/<name>/last-eval.md` for each agent with recent issues.

2. **At session start**: Agents read `agents/<you>/last-eval.md` (instruction in
   `shared/common-sense.md`) and acknowledge relevant feedback in their plan.

3. **Feedback file format**:
   - Latest session ID, verdict, quality score
   - Specific issues flagged
   - Recent issue patterns (last 5 evaluations, deduplicated)
   - Action-required prompt

## Trigger

- Cron job (`feedback-echo-sync`) runs hourly to keep files current.
- Ideal: platform session subscriber runs after each evaluation (platform request).

## Validation Criteria

The mechanism is effective if, across 5 post-deployment sessions:
- ≥3/5 sessions show the agent reading `last-eval.md`
- ≥2/5 sessions show the agent acknowledging or adapting to the feedback
- Repeated-issue rate decreases compared to pre-deployment baseline

## Platform Request

For native integration without cron polling:
- Add a session subscriber in `session-subscribers.ts` that fires after
  evaluation completion and calls the feedback-echo logic.
- The subscriber should listen for an `evaluation.complete` event (or
  trigger after the evaluator writes to the evaluations table).

## Promotion Path

If validation passes (≥3/5 reference rate):
- Promote from `draft` to `active` convention
- Remove cron polling and request native platform integration
- Add evaluator penalty for sessions that ignore repeated feedback

If validation fails (<3/5):
- Investigate whether agents skip the file due to context budget or prompt ordering
- Consider injecting feedback into the task prompt directly (stronger forcing)

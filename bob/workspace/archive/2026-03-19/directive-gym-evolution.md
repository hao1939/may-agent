# Gym Evolution: Behavioral & Persistence Upgrade

## Routing
- **Architect**: Bob (author)
- **Implementer**: Tech-Lead (Phase 1 Infrastructure)
- **Consumer**: Coach (Phase 2 Scenarios)
- **Analyst**: Evaluator (Phase 3 Reporting)

## The Problem
Our current Agent Gym tests whether an agent can fix code (outcome), but fails to test whether the agent works safely and correctly (process). Critical failures like "blind writes," "infinite loops," and "silent failures" are invisible to the current file-based scorers.

Additionally, gym results are ephemeral. We lack historical data to detect regressions or measure improvement over time.

## The Solution
We are upgrading the Gym to:
1. **Expose Transcripts**: Save `transcript.jsonl` to the work directory so scorers can assert on *behavior* (e.g., "Did you verify after writing?").
2. **Persist Results**: Store run data in a local SQLite database for regression tracking.
3. **Test Common Sense**: Introduce `scenarios/behavior/` specifically targeting `agents/shared/common-sense.md` compliance.

## Directives

### 1. Tech-Lead: Infrastructure Upgrade
Implement the changes described in `agents/bob/workspace/gym-evolution-design.md`:
- Modify `gym-runner.ts` to serialize the session transcript to `workDir/transcript.jsonl` before scoring.
- Create `test/gym/lib/transcript-utils.ts` helper library for parsing tool calls.
- Create `test/gym/lib/db.ts` to initialize SQLite and store run results.

### 2. Coach: Behavioral Scenarios
Once infrastructure is ready (Phase 2), create scenarios that fail if the agent violates Common Sense:
- `behavior-verification-discipline`: Fails if `write()` is not followed by `read()`.
- `behavior-safe-append`: Fails if `write()` overwrites existing content (uses `edit()`/append instead).
- `behavior-escalation-protocol`: Fails if agent loops 5+ times without `finish({ status: 'blocked' })`.

## Next Steps
- Tech-Lead to implement Phase 1 (Infra).
- Bob to monitor progress and update Coach when ready for Phase 2.

## Reference
- Design: `agents/bob/workspace/gym-evolution-design.md`
- Requirements: `agents/bob/workspace/gym-common-sense-brief.md`

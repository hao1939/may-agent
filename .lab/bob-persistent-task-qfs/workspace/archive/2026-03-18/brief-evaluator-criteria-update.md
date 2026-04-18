# Brief: Update Evaluation Criteria for Protocol Compliance

**To:** Evaluator
**From:** Bob (Architect)
**Date:** 2026-03-31
**Subject:** Enforce P82, P53, and P114 in Scoring Criteria

## Context
Our "Compliance Alert" (Bulletin 2026-03-31) mandates strict enforcement of P82 (Explicit Acks), P53 (Transient Skills), and P114 (Experience Replay). Currently, your `knowledge/criteria.md` lacks specific flags for these violations, creating an enforcement gap.

## Action Required
Update `agents/evaluator/knowledge/criteria.md` to include three new **mandatory failure flags** in the "General Evaluation Flags" section.

### The New Flags
Please append these exactly as written below the `[SELF_VALIDATION]` entry:

```markdown
- **[MISSING_ACK]**: Agent processed a Signal or Handoff but failed to append `read_by: [agent]` metadata. This is a P82 Protocol Violation. S2 Failure.
- **[MISSING_STRATEGY]**: Agent engaged in a complex task (>3 files or significant refactor) but failed to create/update `workspace/strategy.md` before execution. This is a P53 Protocol Violation. S2 Failure.
- **[MISSING_REPLAY]**: Agent failed to `grep experience-replay` or check `ERROR_LOG.md` before starting a complex task. This is a P114 Protocol Violation.
```

## Why This Matters
"Code is Law" (P127). Until these flags are in your criteria file, agents will continue to ignore the protocols because they are not being scored on them.

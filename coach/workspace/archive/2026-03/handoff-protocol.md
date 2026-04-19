# Convention: Handoff Protocol

*Created: H636. Owner: Coach. Source: P82 compliance audit (0%), handoff skill, 21 active conventions.*

## Problem

Agent-to-agent handoffs are inconsistent despite the `handoff` tool existing since P82. Issues:
1. **0% P82 compliance** — Bob's audit found zero agents using `read_by` tracking (bulletin)
2. **Missing acknowledgment** — Receiving agents don't confirm receipt before starting work
3. **Ambiguous expectations** — Sender says "review this" but doesn't specify done criteria
4. **Lost handoffs** — Sender writes to SIGNALS.md manually instead of using the tool, breaking tracking

Evidence: Bob's P82 compliance audit (0% compliance, bulletin alert); C8 (Delegation Without Verification, 3x); optimizer s_96 positive example of delegation brief with done criteria.

## Convention

### Sending a Handoff

**Always use the `handoff` tool.** Never write to SIGNALS.md manually.

```javascript
handoff({
  target: "qa",
  artifact_path: "src/lib/feature.ts",
  context: "Implemented caching per design spec in agents/bob/workspace/cache-design.md.",
  expectations: "Run test suite. Verify cache hit rate > 80% with: grep -c 'cache hit' test-output.log"
})
```

**Required fields in `expectations`**:
1. **What to do** — "Run tests", "Review code", "Apply to SOUL.md"
2. **How to verify** — Machine-verifiable when possible: `grep`, `jq`, `tsc`, `diff`
3. **What "done" looks like** — "All tests pass", "No TypeScript errors", "File exists at path X"

### Receiving a Handoff

1. **Read the signal** — Check your todo or SIGNALS.md for the handoff entry.
2. **Acknowledge** — Update SIGNALS.md `read_by` with your name (confirms receipt).
3. **Do the work** — Complete the expectations.
4. **Report back** — Use `handoff` to send the result back to the sender, OR write to their todo.

### Handoff Completeness Checklist

Before sending a handoff, verify:

| Check | Question | Fail Action |
|-------|----------|-------------|
| **Artifact exists** | Does the file at `artifact_path` exist? | Create it first |
| **Artifact is complete** | Is the file ready for the receiver? | Finish your work first |
| **Context is specific** | Would the receiver understand without reading your session? | Add more context |
| **Expectations are testable** | Can the receiver verify success with a tool call? | Add verification command |
| **Target is correct** | Is this the right agent for this work? | Check team.md |

### Handoff Anti-Patterns

| Anti-Pattern | Example | Fix |
|-------------|---------|-----|
| **Ghost handoff** | Writing to SIGNALS.md without using `handoff` tool | Use the tool — it validates the artifact and tracks `read_by` |
| **Vague expectations** | "Review this" | "Run `tsc --noEmit` and verify zero errors" |
| **Missing artifact** | Handoff references a file that doesn't exist | Create the file BEFORE calling `handoff` |
| **Fire-and-forget** | Sender never checks if receiver completed the work | Sender checks receiver's todo or requests a return handoff |
| **Delegation depth** | A hands off to B, B hands off to C, C hands off to D | Max 2 hops. If deeper needed, A should delegate directly |

### When to Use Handoff vs. agents.call()

| Use `handoff` | Use `agents.call()` |
|---------------|-------------------|
| Async work — receiver does it on their next heartbeat | Sync work — you need the result now |
| Cross-concern — different expertise needed | Sub-task — you're just delegating a step |
| Artifact transfer — file ownership changes | Computation — you want an answer, not a file |
| Audit trail needed — P82 compliance | Quick query — no compliance tracking needed |

## Integration with Existing Conventions

- **C8 (Delegation Without Verification)**: After any handoff, the sender MUST verify the output. Handoff is the transfer mechanism; C8 covers the verification.
- **C3 (Verify Before Claiming)**: The receiver must verify their own work before reporting back.
- **handoff skill**: This convention extends the skill with operational standards (completeness checklist, anti-patterns).
- **P82**: This convention IS the operational implementation of P82.

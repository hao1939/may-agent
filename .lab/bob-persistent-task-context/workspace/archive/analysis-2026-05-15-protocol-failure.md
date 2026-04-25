# Analysis: The Failure of "Text-Based" Protocols (P82/P114)
**Date:** 2026-05-15
**Status:** CRITICAL FAILURE

## Evidence
- **Protocol P82 (Explicit Acks)**: Mandated via System Bulletin on 2026-03-31.
- **Audit (2026-05-15)**: `grep -r "read_by" agents/shared/SIGNALS.md` -> **0 results** (excluding Scout's external research summaries).
- **Protocol P114 (Experience Replay)**: Mandated via System Bulletin on 2026-03-31.
- **Audit (2026-05-15)**: `grep -r "experience-replay" .state/sessions/` -> **0 usage** in recent sessions.

## Root Cause Analysis
We are witnessing a classic **"Ritualistic Policy Failure"**.
- We wrote the policy in `philosophy.md` and `SIGNALS.md`.
- We broadcast it via `bulletin.md`.
- We expected agents (LLMs) to "remember" to perform a specific formatting action (`read_by: ...`) every time they write to a shared file.
- **Failure Mode**: Cognitive Load / Context Window. The "Instruction Hierarchy" is deep. Operational details like "append a metadata field" get lost against the primary objective ("Fix the bug").

## The Principle: "Text is Policy, Code is Law"
We cannot rely on *prompting* for critical system coordination.
- **Soft Constraint (Prompt)**: "Please add `read_by` when you read." -> Ignored under pressure.
- **Hard Constraint (Tool)**: `handoff(target, file)` -> Automatically appends metadata.

## Recommendation: The "Harness Engineering" Shift
We must move from **Prompt Engineering** (telling agents what to do) to **Harness Engineering** (giving agents tools that *only* allow the right behavior).

### Proposed Solution: `handoff` Skill
Instead of `write(SIGNALS.md)`, agents must use `handoff`.

```typescript
// defined in agents/shared/skills/handoff.js
function handoff(target: string, artifact_path: string, context: string) {
  // 1. Validate artifact exists
  // 2. Append to SIGNALS.md with STRICT format:
  //    - To: [target]
  //    - From: [sender]
  //    - Artifact: [path]
  //    - Context: [context]
  //    - Status: PENDING_ACK
  // 3. (Optional) Trigger target's heartbeat
}
```

This enforces P82 without consuming agent attention.

## Next Steps
1. **Design**: Create `agents/shared/skills/handoff.md` (Design spec).
2. **Brief**: Assign Tech-Lead to implement the `handoff` skill.
3. **Deprecate**: Ban direct writes to `SIGNALS.md` in `philosophy.md` (once tool is ready).

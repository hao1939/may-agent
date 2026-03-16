# Work Maturity Ladder

## Purpose

Agent work matures through four stages. Each stage makes the work more
reliable, cheaper, and less dependent on LLM judgment. This document
defines the stages, when to graduate work between them, and how to do it
mechanically.

**Owner**: Optimizer (identifies graduation candidates and executes them).
All agents should understand the ladder so they can flag their own work
for graduation.

## The Four Stages

```
Stage 1: Heartbeat (ad-hoc, creative)
  ↓ pattern stabilizes
Stage 2: Cron Job with LLM (scheduled, focused prompt)
  ↓ logic becomes deterministic
Stage 3: JS Handler (no LLM, pure code)
  ↓ never changes
Stage 4: Built-in (part of the core system)
```

### Stage 1: Heartbeat

The agent tries something during a heartbeat — a new check, a new scan,
a new review pattern. It's exploratory. The agent decides whether to do
it based on context. The output varies.

**Example**: Coach starts checking common-sense items against session
transcripts. Some heartbeats it works well, others the agent gets
distracted or picks poor examples.

**Characteristics**: Unstructured, variable quality, mixed with other
heartbeat work, depends on agent judgment about what to prioritize.

### Stage 2: Cron Job with LLM (`run-agent-task`)

The pattern has proven valuable. It runs on a fixed schedule with a
focused prompt that tells the agent exactly what to do. The agent still
uses LLM judgment (reading transcripts, scoring, writing findings), but
the *what* and *when* are fixed.

**Example**: "Every 4 hours, pick one behavioral item from common-sense.md,
find a relevant session, verify whether the agent followed it, write the
result to a tracker file."

**Characteristics**: Scheduled, repeatable, focused prompt, consistent
structure, still needs LLM for judgment/reading/writing.

**How to create**: Add an entry to `agents/may/cron.json`:
```json
{
  "name": "descriptive-name",
  "type": "job",
  "handler": "run-agent-task",
  "agent": "agent-name",
  "intervalMs": 14400000,
  "message": "[cron:descriptive-name] Exact instructions for what to do.",
  "enabled": true,
  "description": "Human-readable description (interval)"
}
```

The `message` field is critical — it should be a complete, self-contained
instruction. The agent receives this message cold (no heartbeat context),
so it must include: what to read, what to do, where to write the output.

### Stage 3: JS Handler

The job's logic has become fully deterministic — no LLM judgment needed.
File scanning, pattern matching, metric computation, report generation
from structured data. A TypeScript handler replaces the LLM call.

**Example**: `evaluate-sessions` handler — finds unevaluated sessions,
writes skip evaluations for trivial cases, triggers evaluator for complex
ones. Pure filesystem operations, no LLM.

**Characteristics**: Deterministic, zero token cost, runs in milliseconds,
testable with unit tests.

**How to create**: Write a handler in `agents/may/handlers/`, export
`create()` conforming to `HandlerModule`. Reference it in `cron.json` with
`"handler": "your-handler-name"` (no `.ts` extension).

### Stage 4: Built-in

The handler's logic is so fundamental it belongs in the core system — not
in a cron job but in the agent lifecycle itself. Session cleanup,
context assembly, tool validation.

**Example**: Memory injection into session context, opBudget enforcement.

**Characteristics**: Runs every session, zero configuration, invisible to
agents.

This stage is rare. Most work stabilizes at Stage 2 or 3.

## When to Graduate

### Stage 1 → Stage 2 (Heartbeat → Cron Job)

Graduate when ALL of these are true:
- **Proven valuable**: The heartbeat step has produced useful output for
  1+ weeks. Not just "ran without errors" — actually changed behavior,
  found issues, or produced actionable data.
- **Stable pattern**: The agent does roughly the same thing each time.
  The inputs, process, and output format are consistent.
- **Self-contained**: The step doesn't depend on context from other
  heartbeat steps in the same session. It could run alone.
- **Repeatable prompt**: You can write a focused message that captures
  what the agent does, without relying on heartbeat.md context.

**How to execute**:
1. Write the cron entry with a focused `message` prompt.
2. Remove or simplify the corresponding heartbeat step — it no longer
   needs to do this work. Replace with creative/directional guidance.
3. Test: let the cron job run 2-3 cycles. Verify output quality matches
   what the heartbeat was producing.
4. Commit the cron.json change and heartbeat.md update together.

### Stage 2 → Stage 3 (Cron Job → JS Handler)

Graduate when ALL of these are true:
- **Deterministic**: The job does the same logic every time. No judgment,
  no interpretation, no "read this and decide."
- **Expressible in code**: The entire process can be written as a
  TypeScript function with clear inputs and outputs.
- **Cost-justified**: The LLM cost of the job is significant enough that
  replacing it with JS saves meaningful money.

**How to execute**:
1. Write the handler in `agents/may/handlers/`.
2. Add tests in `test/`.
3. Update cron.json: change `"handler"` from `"run-agent-task"` to your
   new handler name. Remove the `"agent"` and `"message"` fields.
4. Monitor: verify the handler produces equivalent output.

### Stage 3 → Stage 4 (JS Handler → Built-in)

This is a code architecture decision, not a process. Discuss with Bob
(design) and tech-lead (implementation). Only graduate to built-in when
the logic is truly universal and session-lifecycle-critical.

## Optimizer's Role

Optimizer owns the graduation process. Every two weeks, review:

1. All agents' `heartbeat.md` files — any step that's been stable for 1+
   weeks with a consistent pattern?
2. All `run-agent-task` cron entries — any job whose logic has become
   fully deterministic?
3. `workspace/graduation-log.md` — track what was graduated, when, and
   whether the graduated version maintained quality.

When you identify a candidate, propose the graduation to May. Include:
- Which step/job you're graduating
- The new cron entry or handler code
- What the heartbeat step gets replaced with
- Expected cost/reliability improvement

## Anti-Patterns

- **Premature graduation**: Moving a heartbeat step to cron before the
  pattern is stable. The focused prompt won't capture the judgment the
  agent was applying. Result: low-quality mechanical output.
- **Graduation without replacement**: Removing a heartbeat step without
  replacing it with creative/directional guidance. The heartbeat gets
  shorter but the agent doesn't gain new creative work.
- **Skipping stages**: Going directly from heartbeat to JS handler. The
  cron-with-LLM stage is where you discover whether the pattern is truly
  deterministic. Skip it and you'll build a handler that misses edge cases.
- **Graduating everything**: Some work is inherently creative — synthesis,
  design, user study, coaching decisions. These belong in heartbeats
  permanently. Only graduate the *repeatable* parts.

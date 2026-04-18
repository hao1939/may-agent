# Knowledge Entry: How to Investigate Agent Behavior (Method)

## The Method: Bottom-Up Isolation

When agents don't behave as expected, investigate from the simplest case up:

### Level 1: Raw LLM API
Strip everything away. One tool, one message. Does the model use the tool?
- If NO at this level → the model can't do it. Change the approach.
- If YES → the capability exists. Something in the stack breaks it.

### Level 2: Add variables one at a time
- Add more tools (does competition between tools change the choice?)
- Add system prompt (does agent identity change behavior?)
- Add session context (does context length matter?)
- Add the full agent setup (SOUL.md, skills, guards)

Each step: measure. When the behavior breaks, you found the layer.

### Level 3: Fix at the right layer
Don't fix at the agent instruction level if the problem is at the prompt framing level.

## Key Principle
**Change one variable, measure, repeat.** Fast iterations with the simplest possible setup. Don't debug a 55K-token context when you can test with a 50-token message first.

---

# Knowledge Entry: Verb Choice Determines Tool Choice

## Finding (verified 2026-04-18)

The verb in the task message determines which tool the LLM calls. This is NOT about instructions, context, or system prompts — it's about the action word.

| Framing | First tool | Rate |
|---------|-----------|------|
| "Resume the project at X. Read it and continue." | read() | 100% (0/25 workflow) |
| "Read X, then run it with workflow" | read() | 100% (0/10 workflow) |
| "Run the persistent-task workflow for X" | workflow() | 100% (25/25 workflow) |
| "Run the workflow. Goal: reduce overhead." | workflow() | 100% (15/15 workflow) |

### What doesn't matter
- System prompt (none/short/medium/long): zero effect
- Session context (0K/5K chars before task): zero effect
- Explicit instruction "Use workflow.run()": zero effect if verb is "resume/read"
- Position in message (top/bottom): zero effect

### What matters
The VERB at the start of the task: "Run workflow" vs "Resume project" vs "Read file"

### Application
When dispatching work to agents:
- **Want them to use workflow?** Say "Run the persistent-task workflow for..."
- **Want them to read a file?** Say "Read X and..."
- **Don't mix:** "Read X then run workflow" → they read and never get to the workflow

The project-resume handler was updated to use "Run the persistent-task workflow" framing based on this finding.

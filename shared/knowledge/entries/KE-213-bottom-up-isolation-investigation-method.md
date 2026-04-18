# KE-213: Bottom-Up Isolation Method for Investigating Agent Behavior

**Date**: 2026-04-18
**Source**: Hao's investigation (verified via systematic API testing)
**Confidence**: High
**Tags**: methodology, investigation, behavior-debugging

## Finding

When agents don't behave as expected, use bottom-up isolation to find the breaking layer.

### Level 1: Raw LLM API
Strip everything away. One tool, one message. Does the model use the tool?
- If NO → the model can't do it. Change the approach entirely.
- If YES → the capability exists. Something in the stack breaks it.

### Level 2: Add Variables One at a Time
- Add more tools (does competition between tools change the choice?)
- Add system prompt (does agent identity change behavior?)
- Add session context (does context length matter?)
- Add the full agent setup (SOUL.md, skills, guards)

Each step: measure. When the behavior breaks, you found the layer.

### Level 3: Fix at the Right Layer
Don't fix at the agent instruction level if the problem is at the prompt framing level.

## Key Principle

**Change one variable, measure, repeat.** Fast iterations with the simplest possible setup. Don't debug a 55K-token context when you can test with a 50-token message first.

## Application

Before adding instructions, guards, or context to fix agent behavior — first verify the model CAN do the task at the raw API level. If it can, bisect the stack to find what breaks it. Most fixes belong at a lower layer than where you first notice the problem.

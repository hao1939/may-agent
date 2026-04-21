# How to Investigate Agent Behavior — Bottom-Up Isolation Method

**ID:** KE-310
**Source:** Hao (2026-04-20, via May P0 directive)
**Category:** methodology
**Tags:** debugging, agent-behavior, investigation, LLM-API

## The Method

When agents don't behave as expected, isolate the problem bottom-up through three levels:

### Level 1 — Raw LLM API
Strip everything. One tool, one message. Does the model do what you expect in the simplest possible setup? If it fails here, the problem is the model or the prompt framing, not your infrastructure.

### Level 2 — Add Variables One at a Time
More tools, system prompt, context. Add each variable individually and test after each addition. Find the exact variable that breaks the behavior.

### Level 3 — Full Stack
Session infrastructure, all injections (heartbeat context, knowledge, directives, memory). Test in the real environment. If Level 1-2 worked but Level 3 fails, the problem is in what your infrastructure injects.

## Key Insight

The goal is to find **where** behavior breaks. Most debugging time is wasted because people test at Level 3 and can't isolate the cause. Starting at Level 1 gives you a clean baseline.

## Related
- [KE-context-discovery-chain.md](./KE-context-discovery-chain.md) — Discovery made using this exact method

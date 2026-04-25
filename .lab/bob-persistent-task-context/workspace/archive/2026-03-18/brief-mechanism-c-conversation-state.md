# Brief: Mechanism C — conversation-state.md Design

## From: May (on behalf of Hao)
## For: Bob (design review) → then Coach + Tech Lead (implementation)
## Date: 2026-03-15

## Problem
Every May session starts cold. Hao has to re-explain context, priorities, and recent decisions. The system has no memory of what was discussed with the human — only what agents did internally.

## Goal
Design a conversation-state.md file that persists the human-facing conversation state across May sessions. When May wakes up, it reads this file and knows: what Hao last talked about, what was decided, what's pending Hao's input, and what Hao's current mood/priorities are.

## Questions for Bob
1. **Scope**: Should this be May-only or should every agent with human interaction have one?
2. **Content**: What sections should it have? Proposed:
   - Current Focus — What Hao is working on right now
   - Recent Decisions — Last 5 decisions Hao made (with dates)
   - Pending Hao Input — Things blocked on Hao's response
   - Communication Preferences — Current tone/verbosity preferences
   - Session History — Last 3 session summaries (1-2 lines each)
3. **Update mechanism**: Who writes it? Options:
   - (a) May writes it at end of each human session
   - (b) Post-session hook extracts it automatically (like Mechanism A)
   - (c) Both — May writes a draft, hook validates/supplements
4. **Staleness**: How do we handle entries that age out? Time-decay? Max entries?
5. **Integration with directives.md**: conversation-state.md tracks transient context (what we're doing now). directives.md tracks persistent rules (how to behave always). Clear boundary?

## Constraints
- This is a design-first task. Bob reviews the design, then we implement.
- Keep it under 2KB. It's read every session — bloat = cost.
- Must not duplicate what's already in todo.md or strategic-direction.md.

## Expected Output from Bob
- A design doc with answers to the questions above
- Proposed format/template for conversation-state.md
- Recommendation on update mechanism
- Any principles this connects to (P-numbers)

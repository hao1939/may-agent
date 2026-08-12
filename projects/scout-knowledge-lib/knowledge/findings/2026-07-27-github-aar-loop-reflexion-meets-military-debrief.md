<ai_context>
topic: after-action review loops for AI agents
source: github
date: 2026-07-27
</ai_context>

# AAR Loop — Manual Reflexion via Military After-Action Review

Repo: https://github.com/coopersimson96/aar-loop
Stars: 24 (created 2026-07-25)
License: MIT

## What It Is

A prompt-driven workflow that runs the US Army's 4-question After Action Review
(AAR) after every AI coding session, then writes concrete lessons into
persistent files (LESSONS.md, skills, rules) so the agent compounds across
sessions instead of restarting from zero.

The four AAR questions (US Army TC 25-20, 1993):

1. What was supposed to happen?
2. What actually happened?
3. Why was there a difference?
4. What do we do the same or differently next time?

## Why It Matters for Agent Engineering

- **Manual Reflexion**: The author explicitly frames this as a human-operated
  version of Reflexion (Shinn et al., 2023, arXiv:2303.11366) — verbal
  self-reflection stored in episodic memory for the next attempt.
- **Persistent skill patching**: Unlike in-context reflection that evaporates
  at session end, the AAR output is written directly into configuration files
  the agent loads on next start. This is the same pattern as self-editing
  system prompts but with a structured human gate.
- **Compounding over sessions**: Addresses the "goldfish problem" where
  stateless agents repeat the same mistakes. The fix is mechanical — append
  structured lessons to a file the agent always reads.

## Signal Assessment

Small repo (24★) but the pattern is noteworthy: bridging a 50-year military
methodology with modern agent memory architectures. The real insight is that
Reflexion doesn't require autonomous self-evaluation — a structured human
debrief produces the same episodic memory artifact and may be more reliable
for high-stakes workflows.

## Connections

- Reflexion (arXiv:2303.11366) — automated verbal self-reflection
- Constitutional AI — using explicit rules to shape behavior over time
- Agent memory systems (MemGPT, OptMem) — persistent cross-session state

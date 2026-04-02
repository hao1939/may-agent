# Synthesis: Critical Gap - Experience Replay & Habit Formation
**Date:** 2026-03-14
**Author:** Bob
**Related:** P114, Experience Replay

## 1. The Observation
The "Experience Replay" skill (P114) was deployed 24 hours ago.
* **Audit**: `grep` shows **0 usages** across all agent journals.
* **Status**: The skill file exists (`agents/shared/skills/experience-replay.md`), but agents are ignoring it.

## 2. The Diagnosis: Passive Skill Fallacy
We fell into the "Passive Skill Fallacy": assuming that writing a Markdown file is enough to change behavior.
* **Problem**: Agents don't "decide" to look for a skill unless prompted. They follow their System Prompt (SOUL) and current context.
* **Missing Link**: The *trigger*. There is no instruction in `SOUL.md` that says "Check Experience Replay before complex tasks."

## 3. The Fix: Active Injection
We must move from "Pull" (Agent decides to check) to "Push" (System enforces check).
* **Mechanism**: Add a `P114 Experience Replay` instruction to the `SOUL.md` of high-risk agents (Tech-Lead, Coder, Coach).
* **Instruction**: "Before starting any complex task (coding, shell scripts), you MUST run `grep` on your `ERROR_LOG.md` for relevant keywords. If you find past errors, state how you will avoid them."

## 4. Action Plan
1.  **Update SOULs**: Add P114 instruction to Tech-Lead and Coach.
2.  **Verify**: Monitor next session. If usage > 0, the injection worked.

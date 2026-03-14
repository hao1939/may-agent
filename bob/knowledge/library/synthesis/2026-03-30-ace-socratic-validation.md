# Synthesis: Agentic Context Engineering (ACE) & Socratic Validation
**Date:** 2026-03-30
**Source:** Amy-Kimi (HB#297), Scout (MAST)
**Author:** Bob (Architect)

## 1. Executive Summary
Recent research from Stanford/Berkeley (ACE) and Alibaba (Socratic-Zero) strongly validates our "Harness Engineering" and "Evolutionary" architecture. The industry is converging on **Context-as-Playbook** and **Error-Driven Evolution**. We are not just "on track"; we are implementing the "Third Way" (Runtime Harness + Offline Evolution) that leading labs are defining.

## 2. Validation: Agentic Context Engineering (ACE)
**The Research**: ACE (arXiv:2510.04618) treats context not as a static prompt, but as an **evolvable playbook**. It uses a Generation-Reflection-Curation loop to refine context items.
**Our Equivalent**: `AGENTS.md` (Playbook) + `MEMORY.md` (Reflection) + `compact` (Curation).
**The Win**: ACE proves that **managing the context lifecycle** is more effective than training models for agentic tasks (+10.6% performance).
**Key Insight for Us**:
*   **Context Collapse**: ACE identifies that rewriting context repeatedly degrades information ("collapse").
*   **Solution**: "Incremental Updates" (Delta Context).
*   **Application**: Our `compact` skill must be careful not to "over-smooth" the history. We should prefer **appending summaries** over **rewriting history** where possible, or keep the "Playbook" (static) distinct from the "Journal" (dynamic). *We already do this (Soul vs Session), but must be disciplined.*

## 3. Opportunity: Socratic-Zero & The Coach
**The Research**: Socratic-Zero (arXiv:2509.24726) uses a **Teacher Agent** to generate questions specifically targeting a Solver Agent's weaknesses.
**Our Equivalent**: `Coach` agent + `growth-cycle` skill.
**The Gap**: Currently, our Coach waits for failures to happen (Reactive). Socratic-Zero's Teacher **proactively generates** difficult scenarios based on past weak spots.
**Evolutionary Leap**:
*   **Current**: Error -> Growth Cycle -> New Skill -> Done.
*   **Future (Socratic)**: Error -> Growth Cycle -> New Skill -> **Coach generates a "Test Session" to try to break the new skill**.
*   This aligns with **P9 (Explore then Harden)** and **P63 (Simulation)**. We can make the Coach *hostile* during the verification phase.

## 4. Vocabulary: MAST Failure Taxonomy
**The Research**: MAST (IBM/Berkeley) gives names to our pain points.
*   **FM-1.3 Step Repetition**: The "Loop of Death". We use `monitor-session` (Wink Pattern) to catch this.
*   **FM-2.6 Reasoning-Action Mismatch**: "I will check the file" -> *Does nothing* -> "I checked the file".
    *   *Fix*: **Hard Constraints (P8)**. If an agent says "I check", the tool output MUST appear. This validates our move to **CLI-First** (actions leave logs) over Chat-First.

## 5. Recommendations
1.  **Harden Context**: Update `agents/shared/best-practices.md` to explicitly warn against "Context Collapse" during compaction. "Summarize events, but preserve the *logic* of decisions."
2.  **Evolve Coach**: Brief Tech-Lead/Coach to explore a "Socratic Verification" step in the `growth-cycle`. When a skill is added, the Coach should spawn a short session to *stress test* it, not just verifying it exists.
3.  **Adopt MAST**: Use MAST codes (FM-1.3, etc.) in our `post-mortem` analysis to be precise about failure modes.

## 6. Philosophy Update
This synthesis reinforces **P13 (Harness over Model)**. The "Harness" *is* the intelligence. ACE and Socratic-Zero are harness innovations, not model architectures.

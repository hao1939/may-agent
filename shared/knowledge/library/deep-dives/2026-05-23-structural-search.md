# Synthesis: Structured Search (P144)
**Source**: Amy-Kimi HB#1315 (Navigation Paradox) + HB#1318 (Search Governance)
**Target**: `agents/shared/philosophy.md`

## The Problem: The Navigation Paradox
*   **The Paradox**: Agents are *great* at answering questions (Search) but *terrible* at navigating structures (Browsing).
*   **The Symptom**: Scout gets lost in "Overthinking Loops" (19% of failures). It keeps searching for "X" when X is a dependency of Y, but doesn't realize Y is the root cause.
*   **The Data**: MADQA shows agents prefer brute-force search loops (Tools) because they feel like progress.

## The Solution: Search as a Loop, Not a Tool
**P144 Structured Search**:
Search is not a primitive tool call (`search(query)`). It is a **process**.
1.  **Plan**: Define the Information Goal (What do I need?) and the Search Strategy (Where will I look? How will I verify?).
2.  **Execute**: Run the search tools (Web, Code, Files).
3.  **Refine**: Evaluate the results against the Goal. Did I find it? If not, **change the strategy**, don't just retry the query.

## Implications for Our Architecture
1.  **Search Plan Skill**: A meta-skill that forces the agent to write a plan *before* calling `search_web`.
    *   Input: Goal.
    *   Output: Strategy (Keywords, Sites, Stop Condition).
2.  **Loop Detection**: The Harness must detect "Same Query, Same Result" loops and **block** them (Harness Primacy P155).
3.  **Dependency Awareness**: Agents must understand file dependencies (via `grep` or `ls -R`) before searching content.

## Action
1.  **Brief Tech-Lead**: Implement `search_plan` skill.
2.  **Update Philosophy**: Formalize P144.
3.  **Harness Check**: Add loop detection to `search` tools.

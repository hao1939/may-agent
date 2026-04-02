# Synthesis: Agentic Task Synthesis (DIVE & CuES)

**Date**: 2026-04-17
**Source**: Amy-Kimi HB#336 (DIVE), HB#331 (CuES)

## 1. The Paradigm Shift: Evidence-First Synthesis
- **Old Way (Query-First)**: Generate a user query -> Try to solve it. (Bottleneck: Validation is hard).
- **New Way (Evidence-First)**:
    1.  **Explore**: Agent executes random tools in the environment.
    2.  **Trace**: Record the execution trace (Action -> Output).
    3.  **Synthesize**: Use LLM to "back-calculate" the user query that *would have produced* this trace.
    4.  **Validate**: The trace *is* the proof. Zero validation cost.
- **Validation**: DIVE (arXiv:2603.11076) proves Diversity > Quantity. CuES (arXiv:2512.01311) proves Synthetic Tasks > Real Tasks for RL.

## 2. Our Application: The "Skill Gym"
- **Problem**: We lack diverse test cases for our Skills.
- **Solution**: Use the Evidence-First approach to build a **Synthetic Skill Gym**.
    - *Agent runs `ls -R` and `grep`*.
    - *Trace captured*.
    - *LLM generates*: "Find all markdown files containing 'P53'".
    - *Result*: A valid test case for the "File Search" skill.

## 3. The Architecture: Channel Standardization
- **DIVE Insight**: Diverse tools (373+) require standardized interfaces (Retrieval + Processing).
- **Our Advantage**: Our **Channel** abstraction (P105 Typed Coordination) is exactly this standardization.
- **Action**: Ensure all new tools follow the Channel pattern to support automated exploration and task synthesis.

## Recommendations
1.  **Tooling**: Brief Tech-Lead to build a **"Trace-to-Task" Generator**. (Input: Session Log -> Output: Synthetic Task Description).
2.  **Gym**: Populate our `test/gym/` with these synthetic tasks.
3.  **Philosophy**: Add **"Evidence-First Synthesis"** to P53 (Evolution). Evolution is driven by *successful exploration*, not just failure correction.

## References
- **DIVE**: arXiv:2603.11076
- **CuES**: arXiv:2512.01311

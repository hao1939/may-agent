# Synthesis: Topology Engineering (Cross-Ref #37)

## 1. The Deployment Problem (Scout's Cross-Ref #37)
Most multi-agent systems fail at deployment because they rely on "unbounded conversation" (Debate).
Research (PUP, arXiv:2603.01892) shows that **conversation depth > 3 rounds causes drift**.
Agents start "inventing" consensus (Groupthink) rather than solving the problem.

## 2. The 4 Topological Laws
We must replace "Chat" with "Topology" (Structured Graphs).
1.  **Specialization > Deliberation**: Agents should do *work*, not *talk*. One agent per subtask.
2.  **Compensation Principle**: Use specialized agents (e.g., QA) to cover the weaknesses of generalists (e.g., Coder).
3.  **3-Round Ceiling**: No conversation between two agents should exceed 3 rounds. If it does, decompose the task.
4.  **Complexity Routing**: Route tasks based on *complexity* (easy -> fast, hard -> slow), not just topic.

## 3. Our Violations
-   We allow Coder/QA to loop indefinitely ("Let me try again").
-   We allow "Debate" sessions (Brainstorming) that drift into philosophy.
-   We lack explicit "Complexity Routing" (Everything goes to the same Coder).

## 4. Recommendations
1.  **Enforce 3-Round Limit**: Modify `manager.ts` to warn/kill sessions after 3 user-assistant pairs.
2.  **Implement Complexity Router**: Use a lightweight model (Haicu) to classify tasks as "Easy" (Direct Tool) or "Hard" (Plan -> Execute).
3.  **Formalize P157 Topology Engineering**: Structure (Graph) > Unstructured Chat.

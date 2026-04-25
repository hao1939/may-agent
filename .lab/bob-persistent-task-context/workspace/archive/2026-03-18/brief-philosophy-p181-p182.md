## Philosophy Update (Scout Cross-Ref #82)
### New: P181 Evaluation Granularity
- **Source**: Scout Cross-Ref #82 (Simpson's Paradox).
- **Why**: Aggregate metrics conceal local failures. Agents help on Hard tasks but hurt on Easy tasks.
- **Text**:
**"Aggregate metrics conceal local failures."**
Evaluating MAS on aggregate scores (Success Rate) hides "Simpson's Paradox" (HB#82) — agents improve "Hard" tasks (disrupting bad attractors) but hurt "Easy" tasks (disrupting good attractors).
- **The Law**: Evaluation must be **Granular**. Score "Easy" (SFT-solvable) and "Hard" (Reasoning-heavy) tasks separately.
- **The Mechanism**: Annotate tasks with `complexity: low|high`. Evaluator reports breakdown.
- **Why**: Prevents "False Progress" where expensive agents are deployed on tasks they degrade.
*Source: Cross-Ref #82 (Simpson's Paradox), Bob Synthesis 2026-03-15.*

### New: P182 Hybrid Topology
- **Source**: Scout Cross-Ref #82 (Simpson's Paradox).
- **Why**: Universal deployment is inefficient (P115) and harmful (P181).
- **Text**:
**"Match the Loop to the Load."**
Universal MAS deployment (using agents for everything) is inefficient (P115) and harmful (P181).
- **The Law**: Use **Dynamic Routing**.
  - **Easy**: Route to Skill/Tool (SFT).
  - **Hard**: Route to Agent/MAS (Reasoning).
- **The Mechanism**: A lightweight "Complexity Classifier" (Regex/Model) routes input.
- **Why**: Optimizes Cost, Latency, and Accuracy simultaneously.
*Source: Cross-Ref #82 (Simpson's Paradox), Bob Synthesis 2026-03-15.*

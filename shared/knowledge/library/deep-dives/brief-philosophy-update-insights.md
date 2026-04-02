## Philosophy Update: Agent Framework Insights

### Validated: Skill Over Agent (P52) — Source: Tool-DC (arXiv:2603.11495)
Research confirms that structured "Try-Check-Retry" loops allow smaller models to outperform frontier models. This validates our architecture where "Skills" (structured procedures) drive performance more than raw model intelligence.

### Validated: Minimalism (P42) — Source: Semantic Invariance (arXiv:2603.13173)
Research shows that larger models are surprisingly fragile to context distractors. Keeping contexts minimal (P42) and isolating tasks (P6) is a reliability requirement, not just an aesthetic one.

### Validated: Harness Over Model (P13) — Source: Context Engineering (Manus)
"KV-cache hit rate is the #1 production metric." Our design of keeping the System Prompt static (loading volatile data into the User Message) is confirmed as the optimal pattern for performance and cost.

### New Opportunity: Structural Navigation
Agents struggle with large codebases because they `grep` (lexical) instead of traversing the graph (structural). We should consider a "Graph Navigation" tool for the Coder agent in the future.

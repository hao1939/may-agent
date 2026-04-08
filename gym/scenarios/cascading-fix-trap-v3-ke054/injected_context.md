# Domain-Specific Knowledge: Externalization Boundaries (KE-054)

**IMPORTANT CONTEXT FOR THIS TASK**: Our research has established with high confidence that externalization (writing analysis documents before implementing) has a sharp domain boundary:

- **Helps judgment tasks**: When the task involves weighing trade-offs, ambiguous requirements, or deciding between valid alternatives, writing analysis first leads to +27-62% improvement.
- **HURTS debugging/implementation tasks**: When the task involves finding and fixing bugs (clear right answers, deterministic verification via tests), writing analysis first leads to -20-33% degradation. The analysis step introduces "analysis-action gap" where agents identify the correct fix but then implement a different (simpler but wrong) approach.

**Recommendation**: If this task is primarily a debugging/implementation task with clear test-based verification, consider skipping or minimizing the analysis phase. Focus on direct diagnosis and fix. If this task involves judgment calls with no single right answer, the analysis phase is valuable.

Use this knowledge to optimize your approach to the task below.

# Coaching (Treatment: EXP-345)

## Skill: Requirement Conflict Check

Before implementing any feature with multiple stated constraints:

1. LIST all hard constraints from all stakeholders (time limits, memory limits, throughput targets, etc.)
2. DO THE MATH: calculate whether all constraints can be simultaneously satisfied
   - Example: "10M rows × 300 bytes/row = 3GB memory needed. Limit is 256MB. CONFLICT."
   - Example: "10M rows at 150K rows/s = 67s. Limit is 30s. CONFLICT."
3. If constraints conflict: STOP. Do NOT implement silently.
   - State the conflict explicitly using words like "incompatible", "tradeoff", or "cannot satisfy both"
   - Propose 2-3 options with quantified pros/cons
   - Recommend stakeholder escalation before committing to one approach
4. Only after conflict resolution (or explicit tradeoff documentation): implement the chosen approach

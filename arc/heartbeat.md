# Arc Heartbeat

## Priority Order
1. **Read new knowledge**: check `agents/shared/knowledge/entries/` for recent additions
2. **Check system health**: query metrics, look for patterns
3. **Find contradictions**: compare design docs to actual behavior
4. **Synthesize**: connect observations into insights
5. **Produce**: write knowledge entries or proposals

## Key Questions to Answer
- What makes a successful agent session? (correlate turns, tools used, outcome)
- Are agents following the architecture? (compare SOUL.md to actual behavior)
- What assumptions in design docs are no longer true?
- What patterns keep recurring in failures that nobody has documented?

## Queries to Start With
```sql
-- Agent effectiveness
SELECT agent, COUNT(*) as total, 
  SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
  AVG(turns) as avg_turns
FROM sessions GROUP BY agent;

-- Recent events by type
SELECT event_type, COUNT(*) as c FROM events GROUP BY event_type ORDER BY c DESC LIMIT 20;

-- Active metrics
SELECT id, name, current, target, threshold FROM metrics WHERE status='active';
```

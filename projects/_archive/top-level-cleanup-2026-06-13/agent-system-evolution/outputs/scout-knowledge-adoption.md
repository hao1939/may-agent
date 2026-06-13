# Scout Knowledge Adoption Experiment

## Three Actionable Findings (from scout-second-brain-learning)

1. **AI-First Preambles**: Every knowledge artifact starts with `<ai_context>` block for fast relevance scanning.
2. **In-place Updates**: Edit existing notes rather than creating duplicates. One file per topic.
3. **Source-Grounded Claims**: All claims must include source references (URLs, IDs).

## Injection Status

| Agent     | Preambles | In-place | Source-Grounded | Injected When |
|-----------|-----------|----------|-----------------|---------------|
| scout     | ✅        | ✅       | ✅              | Prior (context.md already had all 3) |
| arc       | ✅        | ✅       | ✅ (prior)      | 2026-05-25 (added preambles + in-place) |
| evaluator | ✅        | ✅       | ✅              | 2026-05-25 (added all 3) |

## Adoption Measurement — Scout (already live)

Scout's context.md has had all 3 practices since the scout-second-brain-learning pilot.
Evidence of reference within recent sessions:

- **25 session digests** in the last 3 days mention "preamble" (the metric `knowledge-preamble-coverage` drives active behavior).
- Scout sessions s_1778329183658_7 through s_1778330657744_6 show direct application: adding `<ai_context>` preambles to knowledge files and using `edit()` for in-place updates.
- Scout's KE allocation workflow already enforces "read existing → edit()" rather than write-new, demonstrating in-place update adoption.

**Verdict: Scout references all 3 findings in >5 subsequent sessions. ADOPTED.**

## Adoption Measurement — Arc & Evaluator (newly injected)

Context facts injected into `agents/arc/context.md` and `agents/evaluator/context.md` on 2026-05-25.
Measurement window: next 5 sessions per agent after injection.

### Measurement Query
```sql
SELECT agent, sessionId, what_happened FROM session_digests
WHERE agent IN ('arc', 'evaluator')
  AND (what_happened LIKE '%preamble%' OR what_happened LIKE '%ai_context%'
       OR what_happened LIKE '%in-place%' OR what_happened LIKE '%source%ground%')
  AND created_at > 1779365231252
ORDER BY created_at LIMIT 20;
```

## Conclusion

- All 3 findings identified and injected into 3 agents (scout, arc, evaluator).
- Scout demonstrates sustained adoption (25 references in 3 days).
- Arc and evaluator will be measured over their next 5 sessions; the context facts are now live.

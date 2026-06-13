# Scout Knowledge Adoption Tracker

## Experiment
Injected 3 actionable findings from `projects/scout-second-brain-learning` as context facts into agent context files, then measure whether agents reference/apply the knowledge in subsequent sessions.

## Injected Facts

| # | Finding | Target Agent | Context File | Date Injected |
|---|---------|-------------|--------------|---------------|
| 1 | AI-First Preambles (`<ai_context>` blocks) | scout | agents/scout/context.md | 2025-01-27 |
| 2 | In-place Updates (edit existing, no dupes) | scout | agents/scout/context.md | 2025-01-27 |
| 3 | Source-Grounded Claims (include URLs/refs) | arc | agents/arc/context.md | 2025-01-27 |

## Measurement Plan

Track the next 5 sessions per agent after injection. For each session, check:
- Did the agent's output show evidence of applying the injected practice?
- Specifically: does scout use `<ai_context>` preambles? Does scout edit existing files instead of creating new ones? Does arc include source references in knowledge entries?

### Measurement Query
```sql
-- Scout sessions after injection
SELECT id, startedAt, summary FROM sessions
WHERE agent = 'scout' AND startedAt > '2025-01-27'
ORDER BY startedAt ASC LIMIT 5;

-- Arc sessions after injection  
SELECT id, startedAt, summary FROM sessions
WHERE agent = 'arc' AND startedAt > '2025-01-27'
ORDER BY startedAt ASC LIMIT 5;
```

## Results

| Session | Agent | Applied Practice? | Evidence |
|---------|-------|------------------|----------|
| 1 (s_211) | scout | ❌ No `<ai_context>` | arXiv fetch — produced digest without ai_context preambles |
| 2 (s_221) | scout | ❌ No `<ai_context>` | Creative heartbeat — KE-1363/1364 have no `<ai_context>` block |
| 3 (s_273) | scout | ❌ No `<ai_context>` | Creative heartbeat — KE entries lack preambles |
| 4 (s_301) | scout | ❌ No `<ai_context>` | HN fetch — standard digest format |
| 5 (s_330) | scout | ❌ No `<ai_context>` | Creative heartbeat — KE-1365 has no preamble |
| 1 (s_217) | arc | ✅ Source-grounded | Routine heartbeat — references specific file paths and KE cross-links |
| 2 (s_270) | arc | ✅ Source-grounded | KE-1248 includes Refutes/Extends/Cross-references with specific paths |
| 3 (s_304) | arc | ✅ Source-grounded | Routine heartbeat — cites metrics by name, file paths as evidence |
| 4 (s_327) | arc | ✅ Source-grounded | KE-1250 has 4+ internal source references |
| 5 | arc | — | Only 4 arc sessions available post-injection |

**Scout in-place updates (practice #2):** ⚠️ Partial — scout edits `knowledge-index.md` in place but creates new KE files (correct behavior for new findings). No evidence of unnecessary file duplication.

## Summary

| Practice | Agent | Adoption Rate | Notes |
|----------|-------|---------------|-------|
| `<ai_context>` preambles | scout | **0/5 (0%)** | Context fact loaded but not applied in any KE output |
| In-place updates | scout | **~partial** | Already was editing index; no change in behavior |
| Source-grounded claims | arc | **4/4 (100%)** | Arc already practiced this — likely pre-existing behavior, not caused by injection |

## Conclusion

**The experiment shows context-fact injection did NOT change agent behavior:**
- Scout's `<ai_context>` preamble practice was never adopted despite being in context.md
- Arc's source-grounding was already its default style before injection
- The `scout.knowledge-practice-loaded` metric reads 1 (fact is loaded) but `scout.knowledge-preamble-coverage` is 0.2153 — confirming the gap between "knowledge loaded" and "knowledge applied"

**Root cause hypothesis:** Context facts are passive — agents read them but don't change output format unless the practice is also enforced by guards or task templates. The finding validates the need for active enforcement (guards, templates) over passive context injection.

## Status
- [x] Identified 3 actionable findings from scout-second-brain-learning
- [x] Injected into agent context files
- [x] Measured 5 scout + 4 arc sessions (sufficient for conclusion)
- [x] **EXPERIMENT COMPLETE** — passive context injection insufficient for behavior change

# Self-Improvement Mechanics — Ongoing Agent-Driven Loops

**Status**: Active protocol  
**Owners**: Coach (skill refinement), Optimizer (memory & search infrastructure)  
**Inspired by**: DD#529 (Hermes Agent framework)

## Purpose

Our system generates enormous amounts of session data (5,774+ digests, 19K+ evaluations) but doesn't systematically learn from it. This protocol establishes **ongoing mechanics** — not one-off projects — that run continuously through coach and optimizer heartbeats.

## Three Self-Improvement Loops

### Loop 1: Skill Self-Improvement (Owner: Coach)

**What**: Skills that refine themselves based on production evidence.

**Mechanic**: During every Nth heartbeat (weekly cadence), coach:
1. Queries session digests for sessions where a specific skill was active
2. Compares quality scores of skill-on vs skill-off sessions for same agent+task-type
3. If a skill shows no benefit or negative effect → demote or revise it
4. If a skill shows benefit → document the evidence, consider expanding to more agents
5. If sessions reveal a new failure pattern without a matching skill → design one

**Data source**: `session_digests` (what_happened, outcome) + `evaluations` (quality scores) + agent skill configs

**Output**: Updated skill files, experiment results, skill effectiveness dashboard in coach workspace

### Loop 2: Cross-Session Knowledge Mining (Owner: Optimizer)

**What**: Turning session trajectories into searchable, reusable knowledge.

**Mechanic**: During optimization sweeps, optimizer:
1. Queries recent session digests for sessions with interesting outcomes (novel solutions, creative workarounds, recovered failures)
2. Extracts reusable patterns from these sessions using context-learn.ts
3. Persists patterns to the knowledge library (agents/shared/knowledge/entries/)
4. Maintains a "lessons learned" index that agents can reference

**Key gap to close**: We have `context-learn.ts` (extraction) and `session_digests` (data) but no automated bridge between them. The optimizer builds and maintains this bridge.

**Data source**: `session_digests` (what_happened, outcome, files_modified) + session transcripts
**Output**: New knowledge entries, updated context.md files, pattern library

### Loop 3: Cross-Session Search (Owner: Optimizer)

**What**: FTS5 full-text search over session digests so agents can find past solutions.

**Mechanic**: Optimizer builds and maintains:
1. An FTS5 virtual table over `session_digests` (what_happened, task, outcome columns)
2. A simple search tool or protocol agents can invoke to find "has anyone solved X before?"
3. Integration with active-recall.ts so pre-task checks include relevant past successes (not just failures)

**Current state**: We have `active-recall.ts` (checks ERROR_LOG.jsonl for failures) but nothing for successes. Session digests exist (5,774 rows) but aren't searchable.

**Data source**: `session_digests` table → FTS5 index
**Output**: FTS5 table, search utility, enhanced active-recall that includes past solutions

## Implementation Phases

### Phase 1: Foundation (Optimizer)
- [ ] Add FTS5 virtual table over session_digests 
- [ ] Build search utility function (query → ranked results)
- [ ] Add "past solutions" section to active-recall pre-check

### Phase 2: Skill Effectiveness Dashboard (Coach)
- [ ] Build skill-session correlation query (which skills were active per session)
- [ ] Compare quality metrics: skill-on vs skill-off per agent
- [ ] Produce weekly skill effectiveness report in coach workspace

### Phase 3: Automated Knowledge Mining (Optimizer)  
- [ ] Periodic sweep: find high-quality sessions with novel patterns
- [ ] Extract facts via context-learn.ts
- [ ] Deduplicate against existing knowledge entries
- [ ] Persist new entries with source attribution

### Phase 4: Skill Self-Improvement (Coach)
- [ ] Use effectiveness dashboard to identify underperforming skills
- [ ] Redesign skills that show no benefit
- [ ] Create new skills for uncovered failure patterns
- [ ] Track skill version history and effectiveness over time

## Cadence

- **Coach**: Check skill effectiveness metrics every 3rd heartbeat. Run full skill audit weekly.
- **Optimizer**: Run knowledge mining sweep every 5th heartbeat. Maintain FTS5 index on schema changes.

## Success Metrics

1. **Skill hit rate**: % of installed skills that show measurable quality improvement (target: >50%)
2. **Knowledge reuse**: # of times past session knowledge prevents a repeated failure (target: measurable within 30 days)
3. **Search utility**: # of cross-session searches per day once available (target: >0 within 1 week of deployment)

## Relationship to Workflow Enforcement

This protocol works hand-in-hand with the **Workflow Enforcement Principle** (see `workflow-first.md`):

> When agents repeatedly fail at something, the fix is never "remind them harder." It's a workflow.

The self-improvement loops **detect** the problems; workflows **enforce** the solutions:

```
Loop 1 detects: "Agent X keeps forgetting step Y"
  → Check: Does a workflow already prevent this? → Wire it into heartbeat
  → No workflow? → Build one (reasonable effort) → Wire it in
  → Can't be a workflow? → Make it a skill with pre/post checks
```

This is the system's quality ratchet: detect → codify → enforce → measure → improve.

## Relationship to Existing Systems

| Existing System | How It Connects |
|---|---|
| `context-learn.ts` | Loop 2 uses this for extraction |
| `active-recall.ts` | Loop 3 enhances this with past successes |
| `session_digests` table | Primary data source for all 3 loops |
| Skills library (44 skills) | Loop 1 evaluates and refines these |
| Knowledge base (entries/) | Loop 2 adds to this |
| Evaluations table | Loop 1 uses quality scores from this |

# Agent Maintenance Design

Status: **Unimplemented proposal**. The `maintainAgent()` function and periodic
maintenance trigger described below were never built. The evaluator currently
handles post-session scoring only. Lesson consolidation is done via Bob's
weekly cron job (`lesson-consolidation` in `agents/may/cron.json`).

## Problem

Agents accumulate raw lessons from sessions (appended to `lessons.md`).
Over time this file grows unbounded, contains redundant entries, and may
contradict the agent's `domain.md`. Nobody updates `domain.md` — it rots.

## Solution: Evaluator Does Maintenance

The evaluator agent already reviews sessions. It expands to also maintain
agent knowledge. Same agent, different tasks triggered at different times.

### Two modes

**Post-session evaluation** (after every session):
- Score efficiency and quality
- Detect user corrections in transcript → write as high-priority lessons
- Detect repeatable patterns → suggest workflows
- Called via `evaluateSession()`

**Periodic maintenance** (every N sessions, or on request):
- Read accumulated lessons.md for an agent
- Consolidate: deduplicate, remove obsolete, merge similar lessons
- Suggest changes for domain.md (human reviews — domain.md is NOT auto-modified)
- Check for stale knowledge (references to files/APIs that changed)
- Verify tool health (do scripts exist? do they run?)
- Review performance trends from evaluation scores
- Called via `maintainAgent()`

### Knowledge consolidation protocol

Input: `agents/<name>/knowledge/lessons.md` + `agents/<name>/knowledge/domain.md`

Steps:
1. Read all lessons
2. Group by theme (corrections, workflow feedback, preferences, facts)
3. For each group:
   - If redundant with domain.md → discard from lessons.md
   - If it contradicts domain.md → keep in lessons (lesson wins, it's newer)
   - If it's new knowledge → keep in lessons, suggest promotion to domain.md
   - If it's obsolete → discard
4. Write updated (pruned) lessons.md
5. Return suggestions for domain.md changes (human reviews and applies)

**Note:** `domain.md` is NOT auto-modified. The original design proposed
auto-editing domain.md, but the implementation deliberately changed this
to a safer approach: return suggestions for human review. Domain.md is
human-authored and should remain stable.

### Three-layer learning

```
conversation → (learn tool) → lessons.md → (evaluator) → domain.md
     hot                         warm                        cold
  overflows naturally       pruned periodically         stable, compact
```

Layer 1: Agent calls `learn` tool during session (fast capture)
Layer 2: Evaluator detects corrections agent missed (post-session)
Layer 3: Evaluator suggests lessons for promotion to domain.md (periodic, human reviews)

### Performance tracking

Read from `.state/evaluations/*.json`. Compute per-agent:
- Success rate (verdict = "good" / total)
- Efficiency trend (rolling average)
- Workflow reliability (per workflow success/failure)
- Common failure patterns

Write summary to `agents/<name>/knowledge/performance.md`.

## API

```typescript
// Post-session (existing)
evaluateSession(opts: EvaluateSessionOptions): Promise<EvaluationResult>

// Periodic maintenance
maintainAgent(opts: MaintainAgentOptions): Promise<MaintenanceResult>
```

### MaintainAgentOptions
```typescript
interface MaintainAgentOptions {
  manager: SubagentManager;
  agentName: string;        // which agent to maintain
  knowledgeDir: string;     // path to agent's knowledge/
  persistDir: string;       // path to .state/
  workflowDir?: string;     // path to agent's workflows/
}
```

### MaintenanceResult
```typescript
interface MaintenanceResult {
  lessonsPruned: number;    // how many lessons were consolidated/removed
  suggestions: string[];    // suggested changes for domain.md (human reviews)
  staleItems: string[];     // stale knowledge detected
  toolIssues: string[];     // broken/missing tools detected
}
```

## Trigger

In `run/may.ts`:
```typescript
// Count evaluations since last maintenance
let evalsSinceMaintenance = 0;

async function runEvaluation(sessionId: string) {
  // ... existing evaluation ...
  evalsSinceMaintenance++;

  if (evalsSinceMaintenance >= 5) {
    await maintainAgent({ ... });
    evalsSinceMaintenance = 0;
  }
}
```

## File changes

- `src/evaluator.ts` — `maintainAgent()` function
- `src/index.ts` — export new types
- `agents/evaluator/knowledge/domain.md` — maintenance procedures
- `run/may.ts` — maintenance trigger
- `docs/maintenance-design.md` — this file

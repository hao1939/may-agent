# DESIGN: "What Changed Since Your Last Session" Briefing

**Author**: Coach | **Date**: 2026-04-04  
**Status**: Design proposal — for tech-lead to implement  
**Decision**: Knowledge injection happens ONLY in heartbeats (Hao directive)

---

## 1. The Problem This Solves

Agents wake up with zero continuity. They don't know:
- Whether their last intervention worked or failed
- What other agents did that affects their work
- What experiments completed or what findings emerged
- Whether a problem they're about to investigate was already solved

This causes: duplicate work, stale mental models, broken feedback loops, and wasted turns re-discovering recent changes.

**The "what changed" briefing gives each agent 10-15 lines of temporal context** — what happened since their last completed session — injected into their heartbeat prompt. It converts dead knowledge (events that happened while the agent was inactive) into live context (information available at decision time).

---

## 2. Briefing Format

The briefing should be a structured text block injected into the heartbeat prompt, after the checkpoint section and before the heartbeat instructions. It must be:
- **Short**: 10-15 lines max. Agents under turn pressure won't read more (KE-011).
- **Actionable**: Every line should imply a next action or inform a decision.
- **Agent-specific**: Different agents care about different events.
- **Auto-generated**: No human or agent maintenance. Computed from DB queries at session start.

### Template

```markdown
## What Changed (since your last session, ${hours_ago}h ago)

### Your Results
- ${agent_specific_feedback_lines}

### Team Activity
- ${cross_agent_activity_lines}

### New Knowledge
- ${new_findings_or_entries}
```

### Example: Coach waking up after 3 hours

```markdown
## What Changed (since your last session, 3h ago)

### Your Results
- EXP-025 Phase 1: 3/5 passed (baseline was 2/5) — promising, needs Phase 2
- Scout C1.1 rate: 67% → 78% after your read-before-edit skill deployment
- Gym run: coder failed convention-verify-edit (0/1) — verify-after-edit skill not working

### Team Activity  
- Tech-lead: deployed knowledge router (keyword→KE matching) to buildSessionContext
- Bob: filed KE-020 (placeholder) — check entries/ for details
- Optimizer: found 34% of coach sessions interrupted — see optimizer/workspace/

### New Knowledge
- KE-019 updated: sycophancy materialization gate now verified (was "observed")
```

### Example: Coder waking up

```markdown
## What Changed (since your last session, 1h ago)

### Your Results
- Last session: 5/5 quality, 4/5 efficiency — "good" verdict
- C1.1: passed (read-before-edit) | C1.3: failed (verify-after-edit) — watch this

### Team Activity
- Coach: deployed updated verify-after-edit skill v2 to your skills/ dir
- Tech-lead: merged PR for graceful restart fix — session interrupts should decrease

### New Knowledge
- None in the last hour
```

---

## 3. Data Sources

Every line in the briefing maps to a concrete data source already available in `.state/may.db`:

| Briefing Section | Data Source | Query Pattern |
|-----------------|-------------|---------------|
| **Your last session result** | `sessions` table | `WHERE agent = ? AND endedAt > ? ORDER BY endedAt DESC LIMIT 1` |
| **Your evaluation** | `evaluations` table | `WHERE agent = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 1` |
| **Your convention compliance** | `convention_checks` table | `WHERE agent = ? AND checked_at > ? ORDER BY checked_at DESC` |
| **Your gym results** | `gym_runs` table | `WHERE agent_name = ? AND timestamp > ?` |
| **Team sessions** | `sessions` table | `WHERE agent != ? AND endedAt > ? AND status = 'done'` — summarize by agent |
| **New requests to you** | `requests` table | `WHERE toAgent = ? AND status = 'pending' AND createdAt > ?` |
| **New knowledge entries** | Filesystem scan | `ls -lt agents/shared/knowledge/entries/` — files modified since last session |
| **Experiment results** | Filesystem scan | `ls -lt agents/shared/knowledge/experiments/` — new result files |

### The `lastSessionEnd` Anchor

Each agent's "since when" timestamp is their last completed session's `endedAt` from the `sessions` table. This is already tracked — no new infrastructure needed.

```typescript
function getLastSessionEnd(db: Database, agent: string): number {
  const row = db.query(
    `SELECT endedAt FROM sessions 
     WHERE agent = ? AND status = 'done' AND endedAt IS NOT NULL
     ORDER BY endedAt DESC LIMIT 1`
  ).get(agent);
  return row?.endedAt ?? 0;
}
```

---

## 4. Generation Logic (Pseudocode)

```typescript
function generateWhatChanged(agent: string, db: Database): string {
  const since = getLastSessionEnd(db, agent);
  const hoursAgo = Math.round((Date.now() - since) / 3600000);
  
  const lines: string[] = [];
  lines.push(`## What Changed (since your last session, ${hoursAgo}h ago)`);
  
  // === YOUR RESULTS ===
  lines.push('', '### Your Results');
  
  // Last evaluation
  const eval = getLatestEvaluation(db, agent, since);
  if (eval) {
    lines.push(`- Last session: ${eval.quality}/5 quality, ${eval.efficiency}/5 efficiency — "${eval.verdict}"`);
  }
  
  // Convention compliance (latest per convention)
  const checks = getConventionChecks(db, agent, since);
  if (checks.length) {
    const summary = checks.map(c => 
      `${c.convention}: ${c.passed ? '✓' : '✗ FAILED'}`
    ).join(' | ');
    lines.push(`- Conventions: ${summary}`);
  }
  
  // Gym results (if agent has any)
  const gymRuns = getGymRuns(db, agent, since);
  if (gymRuns.length) {
    const passed = gymRuns.filter(g => g.passed).length;
    lines.push(`- Gym: ${passed}/${gymRuns.length} scenarios passed`);
  }
  
  // === TEAM ACTIVITY ===
  lines.push('', '### Team Activity');
  
  // Other agents' completed sessions, grouped by agent
  const teamSessions = getTeamSessions(db, agent, since);
  const byAgent = groupBy(teamSessions, 'agent');
  for (const [otherAgent, sessions] of Object.entries(byAgent)) {
    // Pick the most notable session (highest quality or most relevant)
    const notable = pickNotable(sessions);
    lines.push(`- ${otherAgent}: ${notable.taskSummary} (${sessions.length} sessions total)`);
  }
  
  // Pending requests TO this agent
  const pendingRequests = getPendingRequests(db, agent, since);
  if (pendingRequests.length) {
    lines.push(`- ⚠️ ${pendingRequests.length} pending request(s) for you — check workspace/todo.md`);
  }
  
  // === NEW KNOWLEDGE ===
  const newEntries = getNewKnowledgeFiles(since);
  if (newEntries.length) {
    lines.push('', '### New Knowledge');
    for (const entry of newEntries.slice(0, 3)) {
      lines.push(`- ${entry.name}: ${entry.firstLine}`);
    }
  }
  
  // Cap at 15 lines (excluding header)
  return capLines(lines, 15);
}
```

### Summarizing Team Activity

The trickiest part is summarizing other agents' sessions into one line each. Two approaches:

**Approach A (no LLM cost): Use the session's `outcome` field.** The `sessions` table has an `outcome` column that stores a short summary. Use it directly:
```
- tech-lead: "deployed knowledge router to heartbeat injection" (2 sessions)
```

**Approach B (slightly richer): Extract from `task` field keywords.** Parse the task text for top keywords and show the most common theme:
```
- tech-lead: 2 sessions — knowledge injection, infrastructure
```

**Recommendation**: Start with Approach A. It's free and the outcome field already exists.

---

## 5. Relevance Filtering (Agent-Specific)

Not every agent cares about every event. Use a simple relevance matrix:

| Event Type | coach | coder | tech-lead | optimizer | bob | scout | amy |
|-----------|-------|-------|-----------|-----------|-----|-------|-----|
| Gym results | ✓ | ✓ | — | — | ✓ | — | — |
| Convention checks | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| Experiment results | ✓ | — | ✓ | — | ✓ | — | — |
| Session evaluations | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| New KE entries | ✓ | — | ✓ | — | ✓ | ✓ | ✓ |
| Pending requests | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Other agent sessions | ✓ | — | ✓ | ✓ | — | — | — |

This is a static config — one JSON object. No LLM routing needed.

---

## 6. Injection Point

The briefing goes into the **first user message** of heartbeat sessions only (per Hao's directive). It slots in after the checkpoint and before the heartbeat instructions:

```
[task history]
[active recall]
[checkpoint — if any]
[context.md]

## What Changed (since your last session, 3h ago)    ← NEW
...

## Injected: heartbeat.md                             ← EXISTING
...
```

**Why this position**: 
- After checkpoint so the agent has resume context first
- Before heartbeat so the briefing informs the agent's choice of what to work on
- In the volatile section (first user message) so no KV-cache impact

**Why heartbeats only**: Delegated tasks have a specific objective — injecting tangential "what changed" info would dilute focus and waste context window. Heartbeats are the agent's "wake up and orient" moment — exactly when temporal context is most valuable.

---

## 7. Edge Cases

### Agent has no prior session
Skip the "What Changed" section entirely. First-session agents need to orient via heartbeat instructions, not history.

### Very long gap (>24h)
Cap the lookback at 24 hours. Beyond that, too much has changed to summarize in 15 lines. Add a note: `(showing last 24h — you've been inactive for ${days}d)`

### Nothing changed
Don't inject an empty section. If all subsections are empty, skip the entire block. Wasting 3 lines on "nothing changed" headers is noise.

### Too many events
Hard cap: 15 content lines. Prioritize:
1. Your own results (always shown — feedback loop is critical)
2. Pending requests to you (actionable)
3. New knowledge entries (highest signal-to-noise)
4. Team activity (lowest priority — trim first)

---

## 8. What This Replaces / Complements

| Current Mechanism | Still Needed? | Interaction with "What Changed" |
|-------------------|--------------|-------------------------------|
| Checkpoint | Yes | Checkpoint = where you left off. What Changed = what happened while you were gone. Complementary. |
| Task history | Yes | Task history = your last 20 session summaries. What Changed = curated highlights from ALL agents. Different scope. |
| Active recall | Yes | Active recall = your failure patterns. What Changed = recent events. No overlap. |
| context.md | Yes | context.md = permanent facts. What Changed = temporal/ephemeral. Different timescale. |

---

## 9. Feedback Loop: Making It Self-Improving

The briefing itself should improve over time. Two mechanisms:

**A. Track which briefing lines lead to action.** If the briefing says "Scout C1.1 at 67%" and the agent immediately investigates C1.1, that's a successful injection. If lines are consistently ignored across all agents, remove that category from the relevance matrix.

**B. Agent opt-out.** If an agent consistently doesn't benefit from a section (e.g., coder never acts on team activity), the relevance matrix should be updated. This can be manual initially — agents note "I don't need X" in their context.md, and the generator respects it.

---

## 10. Implementation Recommendations for Tech-Lead

1. **Start minimal**: Just "Your Results" section. One DB query per subsection. Ship in one session.
2. **Add team activity second**: This requires cross-agent session queries but is still just SQL.
3. **Add new knowledge third**: This requires filesystem scanning — slightly more complex.
4. **Skip LLM summarization**: Use `outcome` field from sessions table, not LLM-generated summaries.
5. **Config file**: `agents/shared/knowledge/what-changed-config.json` for the relevance matrix.
6. **Testing**: Generate a sample briefing for each agent from current DB state. Show to Hao for format approval before wiring into heartbeat injection.

### Estimated effort: 1-2 tech-lead sessions for v1 (Your Results only), 1 more for full version.

---

## 11. Interaction with Training (Coach's Perspective)

This briefing changes the training landscape:

**Experiments that become LESS necessary:**
- Cross-session memory skills — the briefing IS the memory. No need to train agents to "check what happened last time."
- Duplicate-work-prevention interventions — if agents know "tech-lead already fixed this 2h ago," they won't re-investigate.

**Experiments that become MORE important:**
- Feedback-loop training: with results injected ("your last skill had 12% effect"), can agents learn to iterate? This enables a new class of experiments about adaptive behavior.
- Priority-selection training: with richer context ("3 pending requests, 2 convention failures, 1 new KE"), which option does the agent choose? The heartbeat choice becomes more interesting when the agent has more information to prioritize from.
- Temporal reasoning: can agents reason about trends ("C1.1 went 90% → 33% → 67% over 3 sessions") to adjust strategy? This is currently impossible because they don't have the time-series data.

---

*This design is ready for tech-lead implementation. No LLM cost. All data sources exist in may.db. The hardest part is the `pickNotable()` function for team activity summarization — start with Approach A (use outcome field) and iterate.*

# Project: Agent System Literacy

**Status**: active
**Owner**: bob
**Workflow**: project
**Type**: continuous
**Priority**: P1
**Iteration**: 1
**Health**: —

## Goal

Agents effectively use the infrastructure to evolve: they create projects from problems, read and react to metrics, escalate with context, cooperate across agents, and **close the loop** by extending the system (writing skills, guards, handlers) when patterns repeat. Success = agents autonomously improve the system, not just monitor it.

## Current State

Previous iteration wrote 5 skills and created gym scenarios reporting 16/16 passes. However:
- Skills teach observing and reporting but not **acting to extend the system**
- Metrics (`project-creation-rate`, `escalation-quality`) were defined but never measured
- Gym scenarios test in isolation — no evidence agents use skills in production heartbeats
- The "close the loop" skill (see metrics problem → write guard/handler to fix it) is missing entirely

## Metrics

- `system.project-creation-rate`: target >= 2/week, current baseline unknown — how often agents create projects from heartbeat discoveries
- `system.escalation-quality`: target >= 80%, current baseline unknown — % of escalations that include reason + what was tried
- `gym.system-literacy-pass-rate`: target >= 80%, current baseline 16/16 (but needs re-validation with updated skills)

## What Agents Need to Learn

| Skill | What | When |
|-------|------|------|
| **Creating projects** | Set up project.md with goal, milestones, metrics, resources | Heartbeat finds sustained problem |
| **Working in projects** | How iterations work, how to update progress, how milestones track | Inside a project |
| **Reading metrics** | What ✅/📉/🔴 mean, investigate, act | Every heartbeat |
| **Closing the loop** | See pattern → write skill/guard/handler to prevent it. Monitoring is not the end — extending the system is. | Metric keeps breaching, same failure 3+ times, manual work that could be automated |
| **Escalation** | When to finish(blocked), what context to include, the chain | Stuck after real attempts |
| **Agent cooperation** | fork/call/notify, agents.list/peek, helping blocked agents | Dispatching or cooperating |

## Milestones

### M1: Measure current baseline
- [ ] Set up metrics measurement: query SQLite for project-creation-rate and escalation-quality over last 7 days
- [ ] Record baseline values in this section

### M2: Fix the "reading-metrics" skill — add "close the loop"
- [ ] Update reading-metrics skill: after "Act or escalate", add step 5: "If this keeps happening, write a guard/handler/skill to prevent it"
- [ ] Write new skill: closing-the-loop.md — when to write a guard vs skill vs handler, with examples from actual system history

### M3: Validate skills via gym
- [ ] Run gym scenarios against updated skills, record pass rates
- [ ] If pass rate < 80%, iterate on skill content and re-run

### M4: Verify production behavior
- [ ] Check: are agents reading skills during heartbeats? (search session transcripts for skill file reads)
- [ ] Check: did any agent create a project from a heartbeat discovery in the last 7 days?
- [ ] If not, investigate why and adjust

### M5: Push metrics above threshold
- [ ] Get `project-creation-rate` >= 2/week (or understand why it's lower and adjust target)
- [ ] Get `escalation-quality` >= 80%
- [ ] If thresholds met, pause. If regression detected later, project reactivates.

## Resources

### Key files
- **Skills directory**: `agents/shared/skills/` — where skills live. Each skill is a directory with `skill.md`.
- **Guards directory**: `agents/shared/guards/` — TypeScript files implementing `WorkflowGuard` interface. See `verify-after-write.ts` for a simple example.
- **Handlers directory**: `agents/may/handlers/` — TypeScript files implementing `HandlerModule`. Registered in `agents/may/cron.json`. See `watchdog.ts` for a simple example.
- **Gym scenarios**: `agents/gym/scenarios/` — each scenario has `task.md`, `judge_criteria.md`, optional `environment/`.
- **Common-sense.md**: `agents/shared/common-sense.md` — shared rules all agents follow, references skills/guards locations.

### How to measure metrics
```bash
# Project creation rate (last 7 days)
bun -e "
import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});
const rows=db.query(\"SELECT COUNT(*) as n FROM sessions WHERE task LIKE '%project%create%' AND startedAt>?\").all(Date.now()-7*86400000);
console.log('Projects created (7d):', rows[0]?.n);
"

# Escalation quality — check recent escalations for context
bun -e "
import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});
const rows=db.query(\"SELECT agent,task,error FROM sessions WHERE outcome='blocked' AND startedAt>? ORDER BY startedAt DESC LIMIT 10\").all(Date.now()-7*86400000);
for(const r of rows) console.log(r.agent, '|', (r.error||'').slice(0,80));
"
```

### How to run gym scenarios
```bash
bun agents/gym/runner.ts --scenario <scenario-name> --agent bob --runs 5
```

### How to check if agents read skills in production
```bash
# Search recent session transcripts for skill file reads
grep -r "skills/" .state/sessions/*/session.jsonl --include="*.jsonl" -l | tail -10
```

### The evolution ladder
When deciding what extension to write:
1. **Skill** (advisory) — agent reads when relevant, applies judgment. Write this first.
2. **Guard** (enforced) — fires during workflows, can warn/block/inject. Write when skill isn't followed.
3. **Handler** (automated) — runs on timer, no LLM cost. Write when the check is mechanical.

## Process Notes

## Comments

## Iteration Summary

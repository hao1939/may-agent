# Design: Idle-Time Self-Improvement Mechanism

## The Problem

Agents waste idle heartbeats. Bob's last 8 idle heartbeats averaged 3 ops and 47 seconds — scanning, finding nothing, exiting. May's push-forward section (added hastily to heartbeat.md §6) mandates "do ONE thing every heartbeat," but mandates don't change behavior. The agent will satisfy the letter ("I reviewed X and it looked fine") while violating the spirit (no artifact produced).

## Root Cause Analysis

The idle-busywork pattern has three causes:

1. **No backlog of ready work.** The heartbeat says "push forward" but doesn't give the agent a concrete, pre-selected task to grab. Every idle heartbeat re-derives "what should I do?" from scratch, usually concluding "nothing urgent."

2. **Heartbeat context is too expensive for real work.** By the time the agent loads heartbeat instructions, context.md, standing orders, and does the mandatory scan, it's spent 30-50% of its budget on orientation. Real work needs a clean session.

3. **No accountability loop.** The agent self-reports what it did. There's no external check on whether the output was valuable vs. busywork. "I checked standing orders compliance" sounds productive but produces nothing.

## Recommended Mechanism: The Improvement Queue

**Don't add more heartbeat sections. Add a queue that heartbeats consume.**

### How it works

1. **An `improvement-queue.md` file** lives in each agent's workspace (e.g., `agents/bob/workspace/improvement-queue.md`). It contains 5-10 concrete, pre-scoped tasks that the agent (or its coordinator) has identified as valuable idle-time work. Each task has a clear deliverable.

2. **During idle heartbeats**, instead of re-deriving work from scratch, the agent checks the queue, picks the top item, and **forks a focused work session** to do it. The heartbeat itself stays lean (< 5 ops).

3. **The queue is replenished** by: (a) the agent itself at the end of productive sessions ("here's what I'd do next"), (b) May during dispatch, (c) Hao directly. Empty queue = the agent's job to refill it.

4. **Completed items stay visible** (struck through or moved to a "done" section) so there's a paper trail of what idle time produced.

### Example queue entry

```markdown
## Improvement Queue

### Ready
- [ ] **Test H-096 internally**: Design a minimal experiment for the evaluation architecture hypothesis. Output: `knowledge/experiments/EXP-143/design.md`
- [ ] **Audit KE freshness**: Find knowledge entries older than 7 days that reference experiments now completed. Output: list of stale KEs in workspace.
- [ ] **Write skill: bayesian-update**: Extract the scorecard process into a reusable skill doc. Output: `skills/bayesian-update.md`

### Done (this week)
- [x] Contradiction scan across Tier-1 hypotheses → found H-089/H-094 tension (2026-04-10)
```

## Why This Works (Behavioral Reasoning)

| Problem | Solution | Why |
|---------|----------|-----|
| Agent re-derives work each heartbeat | Pre-scoped queue eliminates decision cost | Eliminates the "nothing to do" conclusion path |
| Heartbeat too expensive for real work | Heartbeat only picks + forks; work happens in clean session | Separates triage from execution |
| No accountability | Queue is a visible artifact with done/not-done history | External observers can see throughput |
| "Minimal compliance" gaming | Each task requires a named output file | Can't claim "I checked and it's fine" — show the file |
| One-size-fits-all mandates | Queue is agent-specific, curated to agent's role | Bob gets research tasks, Coach gets skill tasks, etc. |

## Why NOT in the Heartbeat

The push-forward section in May's heartbeat (§6) fails because it combines **task selection** and **task execution** in a context already loaded with 6 other concerns. This guarantees shallow work. The right design:

- **Heartbeat**: Detects idleness → consults queue → forks session (3 ops)
- **Work session**: Full context budget for the actual task (15-30 ops)

## Validation

### Leading metric: Queue throughput
- Items completed per day, per agent
- Target: ≥1 item/day during low-activity periods
- Measurable: `git log` on the queue file + existence of output artifacts

### Lagging metric: Artifact quality
- Monthly review: Were the artifacts actually useful? Did anyone reference them? Did they lead to experiments, hypothesis updates, or process changes?
- If throughput is high but artifacts are never referenced → the queue has bad tasks, not bad agents

### Anti-gaming check
- If an agent completes queue items but outputs are < 5 lines or trivially generated → flag for review
- If queue stays empty for > 24h and agent isn't overloaded → agent isn't self-directing

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Queue becomes stale (tasks no longer relevant) | Weekly prune: agent reviews queue at start of week, removes obsolete items |
| Queue becomes a second todo.md (duplicated tracking) | Queue is ONLY for idle-time improvement work. Active project tasks stay in todo.md. Clear scope boundary. |
| Agent picks easiest tasks, avoids hard ones | Queue should have max 10 items; hard tasks can't be perpetually skipped. May can also assign queue items. |
| Over-engineering: agent spends more time managing queue than doing work | Queue is a flat markdown list. No schema, no database, no workflow. Literally a checklist. |

## Applies To

All agents, but queue contents are agent-specific:
- **Bob**: Research gaps, hypothesis testing, knowledge freshness
- **May**: Process improvements, agent performance analysis, standing order compliance audits  
- **Coach**: New skill development, gym scenario creation, failure pattern analysis
- **Tech-lead**: Technical debt, tooling improvements, performance optimization
- **Scout/Amy**: Topic exploration, source discovery, literature gaps

## Implementation

1. Create `improvement-queue.md` in each active agent's workspace
2. Seed with 3-5 initial items per agent (May or Hao)
3. Add one line to each agent's heartbeat idle-detection path: "If nothing urgent, check `improvement-queue.md` and fork the top item"
4. Remove May's heartbeat §6 (Push Forward) — it's replaced by the queue mechanism
5. Review queue throughput weekly

**Not needed**: New cron jobs, new database tables, new workflows, new standing orders. The queue is just a file. The discipline comes from the file being visible and auditable.

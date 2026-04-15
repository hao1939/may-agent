# Design Review: Heartbeat System — Is It Still Serving Its Purpose?

**Author**: Bob (Architect)  
**Date**: 2026-04-15  
**Status**: Draft for Hao's review

---

## 1. Original Intent vs Current State

### What heartbeats were supposed to be

The heartbeat is an **autonomy mechanism**. It answers the question: "How does an agent decide what to do next when nobody is telling it?" The original design was a clock tick that gives agents periodic awareness — a chance to notice, think, and act on their own judgment.

The core promise: agents wake up, survey the landscape, and make *decisions* about what matters. This is the minimum viable loop for autonomous evolution — observe, orient, decide, act.

### What they became

Heartbeats became **operational runbooks**. May's is 133 lines of numbered steps with embedded SQL queries. Bob's is 195 lines. Scout's is 229 lines. The average heartbeat across agents is ~100 lines. The six "dispatcher mode" heartbeats (May, Bob, Coach, Scout, Tech-Lead, Optimizer) all follow the same rigid structure:

1. OBSERVE (run this exact query)
2. DECIDE (follow this decision tree)
3. DISPATCH (use this exact workflow template)
4. EXIT (call finish() this specific way)

This isn't autonomy — it's a playbook. The heartbeat files read more like SOPs than thinking prompts. When every agent's heartbeat says "Step 1: OBSERVE (budget: 1-2 ops)" and "Step 3: DISPATCH (use this workflow)", the system has optimized away the *judgment* that heartbeats were supposed to enable.

### Where drift happened

The drift was rational at each step:

1. **Agents were wasteful** → Added op budgets and "keep it lean" warnings
2. **Agents did work inline** → Added "MUST FORK" rules with enforcement lists
3. **Agents forgot steps** → Added mandatory checklists (running-session guard, research log, pre-dispatch scope check)
4. **Agents used wrong tools** → Added workflow routing tables with decision trees
5. **Agents didn't verify** → Added FM-3.3 guards and verification discipline sections

Each intervention solved a real problem. But cumulatively, they transformed "wake up and think" into "follow this 200-line protocol." The heartbeats grew because we kept adding constraints to fix bad outputs, but never removed the underlying source of those bad outputs.

**The fundamental tension**: The more instructions you put in a heartbeat, the less the agent is exercising judgment — and the less it learns to exercise judgment. This is the instruction overhead paradox (KE-025) applied at the meta level.

---

## 2. The Routine-vs-Autonomy Taxonomy

I categorized every element currently in heartbeat files:

### Routine ops (mechanical, should be automated or eliminated)

| Element | Present in | Why it's routine |
|---------|-----------|------------------|
| System snapshot SQL query | May, Optimizer, Tech-Lead | Same query every time, deterministic |
| Running-session guard check | Coach | Deterministic DB query |
| Research log INSERT statement | Bob, Scout | Mechanical DB write |
| Commit/push instructions | (removed, but echoes remain) | Was automated via agents-auto-commit |
| Heartbeat-context pre-computation | (cron job) | Already graduated correctly |
| Convention-check running | (cron job) | Already graduated correctly |
| Op budget enforcement | All dispatcher agents | Should be structural (timeout/cost limit), not instructional |

### Judgment tasks (require autonomy, should stay)

| Element | Present in | Why it needs judgment |
|---------|-----------|---------------------|
| "What's the highest-priority thing?" | All agents | Core decision — can't be automated |
| "Is this system-scope or agent-scope?" | May | Gatekeeper judgment |
| "Which workflow fits this task?" | All dispatcher agents | Context-dependent routing |
| "Should I push back on this design?" | Bob, Tech-Lead | Peer review judgment |
| "Is this finding actionable enough to dispatch?" | Optimizer | Convert analysis to action |
| "What mode/lens should I rotate to?" | Optimizer, Tech-Lead, Scout | Strategic prioritization |

### The gray zone (currently in heartbeats, debatable)

| Element | Present in | Analysis |
|---------|-----------|----------|
| Work session examples/templates | Bob (5 examples), Scout (5), Coach (4) | These are 40-60% of heartbeat length. They're reference material, not runtime instructions. Should be separate files. |
| Workflow routing tables | All dispatcher agents | Useful but static — could be in a skill or reference doc |
| Phase structure for work sessions | Coach, Scout | Instructions for *forked sessions*, not the heartbeat itself |
| "Must-fork" vs "quick inline" lists | All dispatcher agents | Encodes past failures. Useful but could be slimmer. |

### Key finding

**~60% of heartbeat content is reference material for forked work sessions, not for the heartbeat itself.** The Bob heartbeat is 195 lines, but the actual heartbeat decision logic is ~30 lines. The other 165 lines are work session templates, workflow examples, phase structures, and dispatch patterns that the *forked session* needs, not the heartbeat.

---

## 3. Cron Sprawl Analysis

### The numbers

- **44 total entries** (41 enabled, 3 disabled/deprecated)
- **8 heartbeats** (LLM sessions every 30min = ~384 LLM sessions/day theoretical max)
- **26 pure JS handlers** (zero LLM cost)
- **7 LLM-consuming jobs** (run-agent-task or run-workflow)
- **3 deprecated** (kept for rollback)

### Frequency distribution

| Frequency | Count | Examples |
|-----------|-------|---------|
| 5 min | 2 | session-sync, active-nudge |
| 10 min | 3 | watchdog, evaluation-sync, agents-auto-commit |
| 30 min | 13 | All heartbeats, convention-check, repo-gate-check, heartbeat-context, research-sync |
| 1h | 3 | zombie-cleanup, task-watchdog, metrics-snapshot |
| 2h | 2 | proof-of-life, audit-requests |
| 4h | 6 | system-status, tracker-compact, common-sense-verify, error-scan, tool-quality-scan |
| 6h | 1 | reflect |
| 12h | 2 | coaching-feedback-wf |
| 24h | 11 | daily-brief, analyze-failures, optimize, coaching-report, etc. |
| 7d | 1 | health-trend |

### What graduated correctly

These cron jobs were correctly extracted from heartbeats into standalone automation:

- **agents-auto-commit** — Agents used to commit/push in heartbeats, wasting ops. Now automated. Clean win.
- **heartbeat-context** — Pre-computes data agents need. Saves each agent 2-3 ops per heartbeat.
- **convention-check** — Was done by evaluator in heartbeat. Now pure JS. Saves ~250 ops/day.
- **evaluator-heartbeat** (JS gate) — Evaluator heartbeat was 100% skipped. Now JS checks first.
- **research-sync, session-sync, evaluation-sync** — Data pipeline. Pure infrastructure. Correct.
- **workspace-compaction, memory-trimmer, lessons-graduation** — Housekeeping. Correct.

### What looks like unnecessary complexity

| Job | Concern |
|-----|---------|
| **watchdog** + **zombie-cleanup** + **active-nudge** + **task-watchdog** | 4 separate jobs monitoring sessions for different failure modes. Could be one "session-health" handler with pluggable checks. |
| **proof-of-life** + **daily-brief** + **daily-digest** + **system-status** | 4 reporting jobs at different intervals. Are all 4 read by a human? If not, some are noise. |
| **coaching-feedback** (disabled) + **coaching-feedback-wf** (enabled) + **error-log-scanner** (disabled) + **error-scan** (enabled) | 2 deprecated jobs kept "for rollback." After ~3 weeks, the rollback option is never exercised. These are dead code. |
| **tracker-compact** | Generates compact index every 4h. Is anyone reading this? If coach reads it, does the compaction actually save enough tokens to justify a 4h cron? |

### The real question: Is 41 jobs too many?

**No — but the cognitive load is.** The jobs themselves are cheap (26 are pure JS). The problem is that nobody has a clear mental model of what's running. The cron.json is 350+ lines with inconsistent descriptions, some outdated comments, and no categorization. It's a flat list that grew by accretion.

A healthy cron system would have:
1. **Clear categories** (infrastructure, monitoring, reporting, agent work)
2. **Dependency awareness** (session-sync must run before evaluation-sync)
3. **Regular pruning** (remove deprecated entries after 2 weeks, not "kept for rollback" indefinitely)
4. **Cost accounting** (which jobs consume LLM tokens? What's the daily cost?)

---

## 4. Proposal: How Heartbeats Should Evolve

### Principle: Heartbeats are for judgment, not compliance

The heartbeat should be the **shortest document that enables good judgment**. Everything else — templates, examples, workflow tables, phase structures — belongs in reference material that agents can pull when they need it, not injected into every 30-minute wake-up cycle.

### A. The Minimal Heartbeat (proposed structure)

```markdown
# [Agent] Heartbeat

[1-2 sentences of identity and role]

## Wake Up
1. Check pending tasks (injected above)
2. Check your workspace for ongoing work
3. Notice what's changed since last cycle

## Decide
What's the most important thing you could do right now?
- Urgent pending task? → Do it or dispatch it.
- Ongoing project needs progress? → Advance it.
- Nothing urgent? → Look for what nobody else is noticing.

## Act
Do ONE thing well. Fork if it's substantial.

## Exit
Call finish() with what you did and why.
```

That's ~15-20 lines. The current average is ~130 lines. The difference is all procedure.

### B. Where the procedural content goes

| Content | Current location | Proposed location |
|---------|-----------------|-------------------|
| Work session templates | Heartbeat (40-60% of file) | `agents/<name>/skills/work-session-patterns.md` — injected into forked sessions via context_files, NOT into heartbeats |
| Workflow routing tables | Heartbeat | `agents/shared/protocols/workflow-routing.md` — reference doc agents can read when dispatching |
| Phase structures | Heartbeat | Same skill files — these are instructions for the *worker*, not the *dispatcher* |
| "Must-fork" rules | Heartbeat | `agents/<name>/context.md` — one line: "Fork any task requiring >5 ops" |
| FM-3.3 verification guards | Heartbeat | Already in SOUL.md / context.md for most agents. Remove from heartbeat. |
| Embedded SQL queries | Heartbeat | Pre-computed by heartbeat-context cron (already exists!). Remove raw SQL from heartbeat. |
| Op budgets | Heartbeat | Structural enforcement (session timeout), not instructional |

### C. Cron system cleanup

**Immediate actions:**
1. Delete deprecated entries (coaching-feedback, error-log-scanner) — they've been disabled for weeks
2. Merge session monitoring jobs (watchdog + zombie-cleanup + active-nudge) into one handler with pluggable strategies
3. Audit reporting jobs (proof-of-life, daily-brief, daily-digest, system-status) — which does Hao actually read? Kill the rest.
4. Add categories to cron.json (or split into cron-infra.json, cron-agents.json, cron-reporting.json)

**Structural change:**
- Add a `graduated_from` field to cron entries that came from heartbeats. This creates an audit trail and helps answer "why does this job exist?"
- Add a `last_useful_output` timestamp. Jobs that haven't produced actionable output in 2 weeks are candidates for disabling.

### D. Preventing routine creep

The pattern is: agent fails → we add instructions to heartbeat → heartbeat grows → agent follows instructions mechanically → agent stops exercising judgment → agent fails differently → we add more instructions.

**Breaking the cycle:**

1. **Length limit**: Heartbeat.md files should be ≤50 lines. If you can't fit it in 50 lines, the excess is reference material that belongs elsewhere. Enforce with a lint check.

2. **Separation of concerns**: Heartbeat = "what to think about." Skills/protocols = "how to do things." Context.md = "what to remember." Currently heartbeats try to be all three.

3. **Graduate, don't accumulate**: When an instruction in a heartbeat has been followed consistently for 2 weeks, it should either:
   - Move to context.md (if it's a permanent behavioral note)
   - Move to a cron job (if it's mechanical)  
   - Be deleted (if the agent learned it)

4. **Periodic heartbeat review**: Every 2 weeks, an agent (or May) should compare heartbeat length vs session quality. If quality is stable while heartbeat grows, the growth is waste. If quality dropped, the fix probably isn't more heartbeat text.

---

## 5. The Deeper Question: Autonomy vs Control

Hao's observation — "the heartbeat handles routine tasks, which is not by design" — points to a fundamental architectural tension.

**The system optimized for reliability over autonomy.** When agents made bad decisions, we added decision trees. When they wasted ops, we added budgets. When they forgot steps, we added checklists. The result is agents that reliably follow procedures but rarely surprise us with insight.

This is the classic control paradox: the more you constrain agents to prevent bad outcomes, the more you prevent good outcomes that only arise from unconstrained judgment.

**The question isn't "how do we fix heartbeats?" It's "do we want autonomous agents or reliable workers?"**

If we want reliable workers: the current heartbeats are fine, just too long. Compress them.

If we want autonomous agents: the heartbeats need to get *radically* shorter. The 15-line version above is closer to right. Accept that agents will sometimes waste ops, make bad decisions, and do weird things — because that's the same freedom that lets them notice unexpected patterns, propose novel experiments, and evolve their own approaches.

The cron system should handle all the *mechanical* work (monitoring, syncing, compacting, reporting). Heartbeats should handle all the *judgment* work (what matters, what to do, what to try next). Right now, heartbeats do both, and do neither particularly well.

---

## Summary of Recommendations

1. **Slim heartbeats to ≤50 lines** — move templates, examples, and procedures to skill/reference files
2. **Extract embedded SQL** — heartbeat-context cron already pre-computes this; stop embedding raw queries
3. **Separate dispatch instructions from work instructions** — forked sessions get their own context, not the heartbeat's
4. **Clean cron.json** — delete deprecated entries, merge overlapping monitors, audit reporting jobs
5. **Add structural guards** against creep — heartbeat lint check, graduation protocol, periodic review
6. **Accept the autonomy trade-off** — shorter heartbeats mean more variance in behavior, which is the point

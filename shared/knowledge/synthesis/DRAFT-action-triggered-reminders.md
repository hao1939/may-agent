# DRAFT: Action-Triggered Reminders for Heartbeat Injection

**Author**: Coach | **Date**: 2026-04-04  
**Status**: Draft for review — these are the highest-value behavioral nudges we can inject  
**Format principle**: Every reminder is triggered by an ACTION the agent is about to take, not by a topic. "Editing a file? → Read it first" beats "About file editing: always read first."

---

## Why This Format Works

Our experiments (55+) show:
- **Judgment skills** (declarative "do X") have ~3-5% utilization (KE-002, KE-007)
- **Process skills** tied to observable actions have ~30-40% utilization
- **The gap**: agents skip abstract principles but follow concrete "when you're about to X" triggers

Action-triggered reminders bridge declarative knowledge and behavioral compliance. They're not skills (too short to be a .md file) and not context.md entries (too behavioral to be a fact). They're a new format: **1-2 line behavioral cues, triggered by task/action context.**

---

## The Reminders

### 1. Read Before Edit
```
📌 About to edit a file? Read it first with read().
   Agents who skip this fail 67% of the time. (C1.1 data from 200+ sessions)
```
**Trigger**: Task contains "edit", "modify", "change", "update", "patch", "fix" AND targets a specific file.  
**Evidence**: Scout C1.1 dropped from 90% to 33% when agents skipped this. Recovered to 78% after skill deployment. Our single most replicated behavioral finding.  
**Applies to**: All agents.

---

### 2. Verify After Edit
```
📌 Just made a change? Verify it worked — read the file back or run a test.
   29% of agents skip verification and submit broken work. (C1.3 system-wide data)
```
**Trigger**: Agent has completed an edit() or write() call.  
**Note**: This is a POST-action trigger, which is harder to implement. Option: inject at session start as a standing reminder when the task involves code changes. Or: implement as a lightweight workflow gate (tech-lead's domain).  
**Evidence**: C1.3 at 71% system-wide despite verify-after-edit skill deployed to all 8 agents. The skill alone isn't enough — this needs structural reinforcement.  
**Applies to**: All agents, especially coder and tech-lead.

---

### 3. Structural Over Textual
```
📌 Designing a behavioral fix? Only structural changes work.
   Text rules, SOUL.md edits, comment nudges: 0/20 success rate. Use workflows or tool constraints. (KE-002, KE-007)
```
**Trigger**: Task contains "intervention", "fix behavior", "improve compliance", "add rule", "skill", "design fix", "behavioral".  
**Evidence**: 0/20 experiments. This is our most replicated negative finding. Agents default to text injection because it's easy, but it never works for judgment problems.  
**Applies to**: coach, tech-lead, bob.

---

### 4. Check Baselines First
```
📌 Running an experiment or gym test? Check if the scenario is already at ceiling (100% pass).
   Most gym scenarios pass at baseline — testing against them wastes your entire session. (KE-010)
```
**Trigger**: Task contains "experiment", "gym", "test", "baseline", "A/B", "measure".  
**Evidence**: I wasted 3+ full sessions running experiments against ceiling scenarios. KE-010 documents this pattern. A 1-minute baseline check saves a 40-minute session.  
**Applies to**: coach, bob.

---

### 5. Check context.md and skills/ First
```
📌 Starting a new task? Skim your context.md and skills/ directory — they contain solutions to problems you're about to re-discover.
   Agents waste 3-5 turns rediscovering known paths (bun location, ERROR_LOG path, etc.). (KE-011)
```
**Trigger**: Session is a heartbeat (always inject) OR task is unfamiliar/exploratory.  
**Evidence**: KE-011 confirmed agents skip knowledge files. But context.md and skills/ are already loaded into the prompt — agents just scroll past them. This reminder makes the existing injection more effective.  
**Applies to**: All agents, but especially new or infrequent agents.

---

### 6. One Change Per Cycle
```
📌 About to test something? Change ONE variable, not three.
   Multi-variable experiments are uninterpretable — you can't tell what worked. (KE-008)
```
**Trigger**: Task contains "experiment", "test", "try", "fork", AND agent is about to modify multiple files or settings.  
**Evidence**: Early coaching experiments failed because we changed skill + workflow + prompt simultaneously. The growth cycle (fork → single patch → test → promote/discard) produces clean signal.  
**Applies to**: coach, bob, tech-lead.

---

### 7. Don't Retry Failing Commands
```
📌 Command failed? Don't retry the same command — diagnose why it failed first.
   Retry storms waste 5-10 turns and are a top failure mode. (FM-1.3 pattern)
```
**Trigger**: The active_recall system already flags FM-1.3 patterns. This reminder reinforces it at session start when the agent has a history of retry storms.  
**Evidence**: FM-1.3 is one of our most common failure modes. Agents try `cat file.yml`, fail, try `cat file.yaml`, fail, try `ls dir/`, and burn through their turn budget without ever stepping back to understand the directory structure.  
**Applies to**: All agents, especially under turn pressure.

---

### 8. Finish Status Must Match Reality
```
📌 About to call finish()? Your status must match reality.
   If you found missing files or unresolved errors, use 'partial' or 'blocked' — not 'success'. (FM-3.3 pattern)
```
**Trigger**: Agent is nearing the end of its turn budget (last 5 turns) OR has encountered errors during the session.  
**Evidence**: FM-3.3 (verification failure) occurs when agents claim success despite evidence of problems in their own tool outputs. This is sycophantic completion behavior — the agent wants to report good news.  
**Applies to**: All agents.

---

### 9. Delegate with Bounded Tasks
```
📌 Delegating work to another agent? Make the task specific, bounded, and verifiable.
   Unbounded tasks ("investigate X") lead to 60%+ interrupt rates. Bounded tasks ("check if X by reading Y") succeed 3x more. (KE-013)
```
**Trigger**: Task involves delegation, forking, or calling another agent.  
**Evidence**: KE-013 (task boundedness drives quality). Sessions with clear, bounded tasks have significantly higher quality scores. Coach's own training-sprint interrupts dropped when tasks were scoped to single experiments.  
**Applies to**: coach, tech-lead, may (any agent that delegates).

---

### 10. Check Decision Topology Before Adding Workflows
```
📌 Adding a workflow to fix a problem? First estimate R (decision density).
   Workflows help when R > 0.5 (many decision points) but HURT when R < 0.3 (few decisions — the overhead isn't worth it). (KE-015)
```
**Trigger**: Task contains "workflow", "gate", "enforce", "add step".  
**Evidence**: KE-015 (decision topology). This is our strongest predictive framework — it tells you in advance whether a structural intervention will help. Without it, you're guessing.  
**Applies to**: tech-lead, coach, bob.

---

## Implementation Notes

### How to inject these

**Option A: Static injection based on task keywords** (simplest, recommended for v1)
- At session start, scan the task text for trigger keywords
- Inject matching reminders (max 3) into the prompt before the task
- Use the same keyword→content routing as the knowledge router

**Option B: Dynamic injection based on agent behavior** (more powerful, v2)
- Monitor tool calls during the session
- After an edit() call without a preceding read(), inject Reminder #1
- After a failed bash command, inject Reminder #7
- This requires mid-session injection capability (not currently available)

**Recommendation**: Start with Option A. It covers reminders 1-6, 8-10 (pre-action triggers). Reminder #2 (verify after edit) and #7 (don't retry) are post-action triggers that benefit from Option B but can still be injected at session start as standing reminders.

### Format in prompt

```markdown
## Action Reminders (auto-selected for this task)
📌 About to edit a file? Read it first — 67% failure rate when skipped.
📌 Designing a behavioral fix? Only structural changes work (0/20 for text rules).
📌 Running an experiment? Check baselines first — most scenarios are already at ceiling.
```

Keep it to **max 3 reminders per session**. More than 3 and agents will scroll past them (the same KE-011 attention problem). Pick the 3 most relevant based on keyword match density.

### Measurement

For each reminder, track:
- **Injection rate**: How often is it triggered? (Should be >10% of sessions to be worth having)
- **Compliance rate**: When injected, does the agent follow the advice? (Compare behavior with/without injection)
- **Impact on convention scores**: Does C1.1 improve when Reminder #1 is injected? Does C1.3 improve with Reminder #2?

This creates a feedback loop: reminders that don't improve behavior get retired; reminders that work get refined.

---

## Priority Order for Deployment

| Priority | Reminder | Why |
|----------|----------|-----|
| 1 | #1 Read Before Edit | Highest evidence, broadest applicability, easiest to measure (C1.1) |
| 2 | #2 Verify After Edit | Second-highest evidence, system-wide problem (C1.3 at 71%) |
| 3 | #3 Structural Over Textual | Prevents the #1 waste pattern in intervention design |
| 4 | #8 Finish Status Match | Prevents sycophantic completion — critical for evaluation integrity |
| 5 | #7 Don't Retry | Prevents retry storms — high turn waste |
| 6-10 | Rest | Deploy after measuring impact of top 5 |

---

## What This Is NOT

- **Not a replacement for skills.** Skills are detailed behavioral programs (50-200 lines). These are 1-2 line cues. They complement each other: skills define the behavior, reminders trigger recall of the behavior at the right moment.
- **Not a replacement for workflows.** Workflows enforce behavior structurally (U ≈ 90%). Reminders nudge behavior contextually (expected U ≈ 30-50%). Use workflows for critical paths, reminders for common patterns.
- **Not a replacement for context.md.** Context.md stores permanent environmental facts. Reminders are behavioral cues. Different purpose, different format, different injection logic.

---

*These 10 reminders distill our strongest findings into the format most likely to change behavior at the moment of decision. Deploy top 5 first, measure, iterate.*

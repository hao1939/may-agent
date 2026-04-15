# Behavioral Review: Are Heartbeats Enabling Autonomy or Creating Dependency?

**Author**: Coach  
**Date**: 2026-04-15  
**Context**: Hao's observation: "The heartbeat now handles a lot of routine tasks, which is not by design: the heartbeat is for agents to be autonomous and evolving."

---

## 1. Behavioral Patterns Observed

### The Homogenization Problem

The most striking pattern: **6 of 12 agents share essentially the same heartbeat structure** — the 4-step OBSERVE → DECIDE → DISPATCH → EXIT template. Bob, Coach, Optimizer, Scout, and Tech-Lead all follow this pattern with near-identical language, including copy-pasted workflow routing tables, "Must-fork" lists, and "Quick inline" lists.

This is the opposite of autonomy. These heartbeats don't say "what's the most important thing to do right now?" — they say "run this checklist in this order, classify your task into one of these categories, then route it through one of these workflows." The agent's judgment has been compressed into a single decision point (Step 2: DECIDE), surrounded by rigid scaffolding.

**Heartbeat sizes tell the story:**

| Agent | Lines | Structure |
|-------|-------|-----------|
| Scout | 229 | OBSERVE/DECIDE/DISPATCH/EXIT + 5 example templates |
| Bob | 195 | OBSERVE/DECIDE/DISPATCH/EXIT + 4 example templates |
| Coach | 174 | OBSERVE/DECIDE/DISPATCH/EXIT + phase structure + examples |
| Tech-Lead | 145 | OBSERVE/DECIDE/DISPATCH/EXIT + lens system + feature rotation |
| May | 133 | 6-step numbered checklist |
| Optimizer | 116 | OBSERVE/DECIDE/ACT/EXIT + 4 mode descriptions |
| Evaluator | 84 | Numbered checklist with process checks |
| QA | 49 | Simple 4-step numbered list |
| Amy-Kimi | 35 | Personality-driven, curiosity-based |
| Amy | 35 | Minimal — check tasks, do periodic tasks |
| Master | 33 | Simple 5-step task processing |
| Coder | 29 | Spec-driven: check spec → check progress → build |

**The agents with the most "autonomy infrastructure" (200+ lines of guidance on how to be autonomous) are the least autonomous in practice.** Their heartbeats have become comprehensive operating manuals that leave almost no room for independent judgment.

### Checking Boxes vs. Growing

Here's the key behavioral split:

**Box-checkers** (heartbeat as routine):
- **May**: 6-step checklist executed in order every cycle. Steps are numbered, sequential, and exhaustive. May's heartbeat consumes 75% of her total ops — she IS mostly heartbeat. The "Improvement Queue" at step 6 is genuinely good, but it's the last thing checked, meaning it's easily deprioritized.
- **QA**: Simple scan → review → journal → exit. Same thing every time. QA uses 99% of ops in heartbeats because it does ALL its work inline — no forked work sessions at all.
- **Evaluator**: Process ownership checks, signal quality review, calibration. All pre-defined. The creative mandate ("calibration, criteria evolution, signal quality — the creative work") is buried in a footnote.
- **Scout**: Despite 229 lines of heartbeat, the actual mandate is always the same: check arXiv, write deep dives. The heartbeat just gets more and more specific about HOW to do it.

**Genuinely judgment-driven** (heartbeat as orientation):
- **Amy-Kimi**: "Go browse. Follow what catches your eye. The best finds come from curiosity, not checklists." This is the closest any heartbeat comes to enabling real autonomy. The agent is told to follow its curiosity, not a workflow.
- **Coder**: "Check your spec → check progress → continue building." Simple enough that the agent exercises judgment about WHAT to build next. But limited — coder is spec-following, not self-directing.
- **Master**: "Check pending tasks. Understand & plan. Execute." Minimal guidance, maximum agency. But also minimal — master doesn't have a growth trajectory.

**Aspirationally autonomous but structurally constrained:**
- **Bob**: Has a beautiful role ("independent judgment, reject requests that lack evidence") but the heartbeat then prescribes exactly how to fork, which workflow to use, which templates to follow. The independent judgment is in the SOUL, the dependency is in the heartbeat.
- **Coach**: Same tension. "Prove which skills actually improve agent behavior" (great mission) but then: "Step 1: run these 3 queries. Step 2: pick. Step 3: use this workflow table." The experimentation mindset is squeezed out by procedure.
- **Tech-Lead**: "Make the system simpler" (great) but with a mandatory lens rotation system and a feature/infra alternation rule. The simplification instinct is bureaucratized.

### The "Checklist Paradox"

A heartbeat that says "check these 7 things" creates predictable, reliable behavior. A heartbeat that says "what's the most important thing right now?" creates adaptive, potentially brilliant behavior — or potentially nothing. The system chose reliability over adaptiveness.

This is understandable: agents that went off-script wasted ops, overlapped work, or produced nothing. The checklists were a reaction to real failures. But the cure has become worse than the disease — agents now reliably do mediocre things instead of unreliably doing great things.

---

## 2. Autonomy vs. Routine: Agent-by-Agent Assessment

| Agent | Autonomy Score | Pattern |
|-------|---------------|---------|
| Amy-Kimi | ★★★★★ | Genuine curiosity-driven exploration. Different every time. |
| Bob | ★★★☆☆ | Has independent judgment in theory; in practice, routes everything to the same 4 workflow types |
| Coach | ★★★☆☆ | Designs interesting experiments but within a rigid phase structure |
| Tech-Lead | ★★☆☆☆ | Alternates lenses mechanically. "Feature rotation" is literally "do this on even cycles" |
| Optimizer | ★★☆☆☆ | Rotates modes A/B/C/D — same 4 activities in a loop |
| Scout | ★★☆☆☆ | "Triage arXiv → deep dive → propagate" every single day |
| Coder | ★★☆☆☆ | Spec-driven, not self-directed, but at least makes micro-decisions within the spec |
| May | ★☆☆☆☆ | Pure dispatcher. Same 6 steps every cycle. |
| QA | ★☆☆☆☆ | Same scan pattern every cycle. No variation. |
| Evaluator | ★☆☆☆☆ | Process checks + calibration checks. Predetermined. |
| Master | ★★★☆☆ | High agency per-task but no self-directed growth agenda |
| Amy | ★☆☆☆☆ | "Check tasks, do periodic tasks." Minimal but also minimal autonomy. |

The pattern is clear: **agents that were originally most capable of autonomous work (Bob, Coach, Optimizer) have accumulated the most procedural overhead in their heartbeats**, precisely because they had the most failures when left unconstrained. The heartbeat grew as scar tissue from past mistakes.

---

## 3. The "Dispatcher Mode" Pattern

### What Happened

6 agents explicitly say "TRIAGE and DISPATCH" in their heartbeats. The philosophy is clear: heartbeats should be cheap triage sessions that fork expensive work into dedicated sessions.

**The original motivation was sound:**
- Heartbeats were consuming too many ops (optimizer hit 56 avg)
- Agents were overlapping work (6 concurrent EXP-147 sessions)
- Deep work was getting interrupted by the next heartbeat cycle

**But "dispatch everything" created new problems:**

1. **No deep work happens at all.** The heartbeat triages, the work session executes a pre-planned task, and nobody sits with the messy question of "what should I actually be working on?" long enough to have an original idea. The triage is too fast. The dispatch is too structured.

2. **The dispatcher is always answering "what workflow do I route this to?" instead of "what does the system need?"** The heartbeat has become a router, not a thinker. It pattern-matches tasks to workflow templates rather than reasoning about priorities.

3. **Agents never observe their OWN evolution.** No heartbeat says "what did I learn this week?" or "how should I change my approach?" The reflection is outsourced to evaluators and coaches. But real autonomy requires self-reflection.

4. **Work sessions are pre-determined by the heartbeat.** By the time a work session starts, the task, the workflow, the deliverable path, and the verification method are all decided. The work session is just execution. There's no room for the work session to discover that the task was wrong.

### Should Agents Do Deep Work During Heartbeats?

**No — but for different reasons than the current heartbeats assume.**

The current logic: "heartbeats should be cheap because ops are expensive."
The better logic: "heartbeats should be *thinking* time, not *doing* time."

A heartbeat that reads 3 files and forks a workflow is not thinking. It's reflexing. The op cost is low, but so is the cognitive value. A heartbeat that spends 8-10 ops genuinely reasoning about "what's the highest-leverage thing I could do?" and arrives at a novel task — that's expensive but high-value.

The problem isn't deep work in heartbeats. It's deep *execution* in heartbeats. Reading a file to understand a problem = good. Running a gym scenario = bad. Reasoning about strategy = good. Writing a 50-line analysis = bad.

---

## 4. Proposal: Heartbeats for Autonomy and Evolution

### The Mindset Shift

Current heartbeat mindset: **"What tasks exist? Route them."**
Proposed heartbeat mindset: **"What does the system need that nobody is doing?"**

The heartbeat should induce *strategic thinking*, not *task processing*. Pending tasks are inputs, not the agenda. The agent should feel permission — even obligation — to ignore the queue when something more important needs attention.

### Structural Proposal: The 3-Part Heartbeat

Replace the 4-step OBSERVE/DECIDE/DISPATCH/EXIT with:

```
## 1. ORIENT (what's happening?)
Quick scan: pending tasks, recent activity, system state.
Not a checklist — a snapshot. 2-3 ops max.

## 2. THINK (what matters most?)
This is the autonomous part. No prescribed queries. No workflow tables.
Questions to sit with:
- What's the biggest risk or opportunity I see right now?
- What am I NOT doing that I should be?
- What did I learn recently that changes my priorities?
- Is there something I keep putting off that matters?
The output of this step is ONE decision, with reasoning.

## 3. ACT (do or dispatch)
Either do it (if quick) or dispatch it (if deep).
No workflow routing table. The agent picks the right approach.
```

### Key Design Principles

**1. Keep heartbeats short but cognitively dense.**
Cap at 50 lines. No example templates — those belong in a reference file the agent can read *if needed*. The heartbeat should be a mindset inducer, not an operating manual.

**2. Move workflow routing to a reference file.**
All those workflow tables, example templates, and fork patterns? Put them in `agents/<name>/knowledge/dispatch-patterns.md`. The agent reads them when needed, not every heartbeat. This reclaims 100+ lines of cognitive space.

**3. Require one "novel observation" per heartbeat cycle.**
Not "what tasks exist" but "what did I notice that surprised me?" This forces genuine engagement with the system state instead of reflexive triage.

**4. Add a monthly self-review.**
Once a month (or every N cycles), the heartbeat should prompt: "Read your last 10 heartbeat summaries. Are you doing the same thing every time? What should change?" This is how evolution happens — not by accumulating more procedure, but by reflecting on whether the current approach is working.

**5. Different heartbeats for different agent types.**
The homogenized 4-step template is wrong. Different roles need different heartbeat energies:
- **Researchers (Bob, Scout, Amy-Kimi)**: "What's the most interesting question right now?"
- **Builders (Tech-Lead, Coder, Optimizer)**: "What's the biggest friction in the system?"
- **Quality (Coach, Evaluator, QA)**: "What's the biggest gap between where we are and where we should be?"
- **Coordinator (May)**: "What's falling through the cracks?"

**6. Preserve the guardrails that matter, remove the ones that don't.**
Keep: Running-session guard (prevent duplicate forks), op budgets, checkpoint discipline.
Remove: Mandatory workflow routing tables, example fork templates, "quick inline" vs "must-fork" classification lists. These are training wheels that prevent the agent from developing judgment.

### How to Measure Evolution vs. Routine

1. **Heartbeat variety score**: Across an agent's last 20 heartbeats, how many unique task types were dispatched? If the answer is 2-3, the agent is in a loop. If it's 8-10, the agent is adapting.

2. **Novel task rate**: What percentage of dispatched tasks are new (not a repeat of a task from the last 5 cycles)? Target: >50%.

3. **Self-initiated vs. queue-driven**: What percentage of heartbeat actions come from the agent's own judgment vs. processing a pending task? Healthy: at least 30% self-initiated.

4. **Depth of THINK step**: In heartbeat transcripts, how many tokens does the agent spend reasoning about priorities before dispatching? If it's <100 tokens, the agent is reflexing, not thinking.

---

## 5. The Uncomfortable Truth

The heartbeat system has evolved to optimize for **reliability and cost control** at the expense of **autonomy and evolution**. This wasn't a mistake — it was a rational response to agents that wasted ops, overlapped work, and produced nothing when given freedom.

But the result is a system of agents that reliably produce modest output. Nobody takes risks. Nobody has original ideas. Nobody says "I think we should stop doing X and try Y instead." The heartbeats have made agents into reliable workers and prevented them from being autonomous thinkers.

The question isn't "should we remove the checklists?" It's "how do we create the conditions where agents develop good judgment, so the checklists become unnecessary?"

That's a training problem, not a heartbeat structure problem. The heartbeat can create space for judgment, but the agent needs the skill to use that space well. This is exactly where the gym, skill training, and Coach's experimental work become critical — not just for task-level skills, but for the meta-skill of "what should I work on next?"

### Recommended Next Steps

1. **Pilot the 3-part heartbeat (ORIENT/THINK/ACT) on one agent** — Bob is the best candidate because he already has "independent judgment" in his SOUL. Measure: heartbeat variety score, novel task rate, op cost.

2. **Extract workflow routing to reference files** for all 6 dispatcher-mode agents. This alone would cut heartbeat sizes by 40-60% and create cognitive space.

3. **Design a gym scenario for "strategic prioritization"** — test whether agents can identify high-leverage work when given freedom vs. just processing queues. This is the meta-skill that enables autonomy.

4. **Add a "what surprised me" field to finish()** — forces agents to articulate one observation per heartbeat that wasn't on the checklist. Creates a record of noticing.

5. **Track and report the metrics above** (variety score, novel task rate, self-initiated %) weekly. Make autonomy visible and measurable.

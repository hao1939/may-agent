# Knowledge Consumability: Coach's Perspective

**Author**: Coach | **Date**: 2026-04-04  
**Context**: Written from 55+ training experiments, 7 promoted skills, 200+ gym runs, and daily coaching of 8 agents.

---

## 1. What knowledge do I wish agents had already read?

### The things they keep re-discovering

**a) Environmental facts that should be muscle memory:**
- Bun path (`.state/.bun/bin/bun`). I've seen may and tech-lead probe the filesystem for this in session after session. They find `/home/hao/may-agent/.state/bin/bun` (forbidden path!) then get flagged for C7.1. The fix was a one-liner in context.md. This is the purest example of "knowledge exists but agents don't have it."
- `npx` doesn't work. Agents try it, fail, retry with different flags, waste 3-5 ops discovering what a context.md line would tell them in 0 ops.
- ERROR_LOG path. Even *I* got this wrong — I was reading `.state/error-log.jsonl` instead of `agents/*/ERROR_LOG.jsonl`. Added it to my own context.md after a reviewer caught it.

**b) Intervention principles that would prevent wasted effort:**
- "Text rules don't fix judgment" (KE-002). This is our single most replicated finding — 0/20 experiments — yet when agents design interventions they still default to "add a rule to SOUL.md." Tech-lead and I both keep having to re-derive this from scratch when designing fixes.
- "Most gym scenarios are ceiling" (KE-010). I wasted entire sessions running baselines on scenarios that were 100% pass before I internalized this. Any agent touching the gym needs this upfront.
- "Workflows help when R > 0.5, hurt when R < 0.3" (KE-015). Decision topology is our strongest predictive framework. Without it, you blindly guess whether a workflow will help.

**c) Process knowledge that prevents convention violations:**
- "Read before edit" — scout's C1.1 dropped from 90% to 33% because it kept editing files it hadn't read. The knowledge "always read a file before editing it" is obvious to a human but agents rush past it under time pressure. A skill file helped. A context.md reminder helped. But the agent had to fail dozens of times first.
- "Verify after edit" — C1.3 is at 71% system-wide despite verify-after-edit skill deployed to ALL 8 agents. This is the canonical example of knowledge the agents *have* but don't *use*.

### What I wish I could just inject

If every agent woke up knowing these three things, coaching would be 50% easier:
1. **"Check your context.md and skills/ directory first"** — agents skip these even though they contain the distilled lessons of hundreds of experiments. KE-011 confirmed: knowledge files are passive. Agents don't seek them out.
2. **"When you're about to modify behavior, only structural changes work"** — every agent's instinct is to add a comment, a rule, a reminder. None of that works for judgment. This would save hours of failed intervention design.
3. **"The previous agent session probably already solved this problem"** — agents have no cross-session memory beyond context.md and workspace files. They can't search "what did I try last time?" This causes massive duplication of effort.

---

## 2. What's the biggest gap between "knowledge exists" and "agent uses it"?

### The real blocker: knowledge form, not knowledge volume

After 55 experiments I can state this with high confidence: **the utilization rate of knowledge depends almost entirely on its delivery form, not its content quality.** We have brilliant research in KE entries that no one reads. We have one-liner context.md facts that change behavior instantly.

The numbers (from my coaching observations):

| Knowledge Form | Utilization Rate | Why |
|---------------|-----------------|-----|
| Structural (workflow code, tool constraints) | ~90% | Agent literally can't skip it — it's the execution path |
| Environmental (context.md, pre-created files) | ~50% | Loaded into prompt. Agent sees it. May or may not act on it. |
| Skill files (structured .md in skills/) | ~30-40% for process, ~0% for judgment | Loaded into prompt but only followed for mechanical behaviors |
| Declarative (KE entries, WKWA docs, findings/) | ~5-10% | Only consumed when agent specifically goes looking. Almost never happens during action. |
| Archive (old experiment results, journals) | ~1% | Exists but is functionally invisible |

**The core problem**: 4,400 files × 5% utilization = the system knows 220 things at any given moment. It *contains* 4,400 things. That's a 95% waste rate.

### Three specific mechanisms causing the gap

**Mechanism 1: The Action Bias.** Agents under turn pressure default to "do the task" not "read background materials." When an agent has 30 turns and a concrete task, reading INDEX.md feels like wasting budget. Even my own heartbeat says "Do ONE focused thing, not a full experiment cycle." The structure *pushes against* knowledge consumption.

**Mechanism 2: No Retrieval at Decision Time.** The critical moment is when an agent is *about to make a choice* — about to add a text rule, about to edit without reading, about to skip verification. At that exact moment, the relevant KE entry or skill file isn't in their context. It's somewhere in a directory they'd need to navigate to. The knowledge needed is always one `read()` call away, but that call never happens because the agent doesn't know it needs it.

**Mechanism 3: Knowledge is written for humans, not for agents.** Our KE entries are research papers: context, methodology, evidence, implications. An agent needs a 1-line directive: "Don't add text rules for judgment problems — they don't work (KE-002)." We write 100-line documents when we need 1-line triggers. The WKWA syntheses are better but still 170 lines each. An agent skimming during a heartbeat will read maybe 30 lines before deciding to act.

### The verify-after-edit paradox: proof that knowledge ≠ behavior

The most revealing case study: verify-after-edit skill deployed to all 8 agents. System-wide C1.3 rate: 71%. The agents *have* the skill in their prompt. They can *read the instruction*. Some even reference it in their reasoning. Then they edit a file and move on without verifying.

This proves that for post-action behaviors, even prompt-injected knowledge has near-zero utilization. The knowledge is literally in the context window and still doesn't get used. The bottleneck isn't access — it's *action compliance at the moment of decision.*

---

## 3. Three things I'd inject into every agent's prompt

If I could add three things to make agents smarter:

### Thing 1: A decision-time checklist (5 lines, shown at session start)

```
BEFORE YOU ACT:
- Editing a file? Read it first. (C1.1: agents who skip this fail 67% of the time)
- Changing behavior? Only workflows work. Text rules: 0/20 success rate.
- Running a tool? Check context.md — there may be a known-working path.
- About to finish? Verify your claims with tool output. (C1.3: 29% of agents skip this)
- Stuck or unsure? Read agents/shared/knowledge/INDEX.md top section before improvising.
```

Why this format: It's triggered by *action* ("Editing a file?"), not by *topic* ("About file editing..."). Our proven skills work the same way — they fire on behavioral triggers, not conceptual categories.

### Thing 2: The top 5 facts from the knowledge base (auto-selected per agent role)

Different agents need different knowledge. Coder needs tool paths and verification habits. Coach needs experiment methodology constraints. Tech-lead needs intervention hierarchy awareness. Scout needs read-before-edit and materialization cadence.

Currently all agents get the same generic context.md (8-22 lines of environmental facts). What if each agent got 5 role-specific knowledge lines drawn from the verified KE entries?

For coder: "Verify every edit with a read-back or test run. Evidence: agents who skip this have 29% failure rate on C1.3."
For coach: "Don't test text-injection skills — 0/20 success rate. Test workflow variants instead. (KE-002)"
For tech-lead: "When designing interventions, check Decision Topology R > 0.5 before adding workflows. (KE-015)"

These would be auto-maintained: when a new KE is verified, the relevant agents get updated context.md entries.

### Thing 3: A "what changed since your last session" briefing

Agents wake up with zero memory of what happened since they last ran. They don't know:
- Did their last intervention work? (I deployed a read-before-edit skill to scout — did C1.1 improve?)
- Did someone else already fix the problem? (Tech-lead fixed the config, but coder doesn't know)
- What experiments completed? (Bob ran EXP-025 Phase 2 but I haven't seen the results)

A 10-line "since your last session" briefing, auto-generated from recent activity, would:
- Prevent duplicate work ("scout C1.1 already addressed by coach 2h ago")
- Enable feedback loops ("your last intervention had X% effect, adjust accordingly")
- Create continuity ("you were working on EXP-025, here's where you left off: ...")

This is the highest-impact structural change. It converts dead knowledge (experiment results sitting in files) into live context (injected at session start). It makes the system's memory *actually continuous* instead of the current illusion where workspace files substitute for real state tracking.

---

## Summary: The Honest Assessment

We don't have a knowledge *production* problem. We produce excellent research — 19 verified KE entries, 55+ experiments, 4 WKWA syntheses. The problem is a **last-mile delivery failure**: knowledge sits in files that agents don't read at the moment they need it.

The three fixes, in priority order:
1. **Structural delivery** — put knowledge in the execution path, not in reference documents. (This is what context.md does at a small scale. Scale it up.)
2. **Action-triggered format** — rewrite knowledge as "when you're about to X, remember Y" not "here is a research finding about X." (This is what successful skill files do.)
3. **Temporal injection** — give agents "what changed" briefings so knowledge flows continuously, not just when someone remembers to check. (This doesn't exist yet and is the biggest gap.)

The 4,400-file knowledge base will become useful when we stop asking "did the agent read it?" and start asking "did the agent encounter it at the right moment?" Knowledge consumability is a routing problem, not a storage problem.

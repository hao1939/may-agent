# The Detection-Repair Gap: When Diagnosis Floods Become the Disease

*Cross-source synthesis — emerges from live production event data (2026-06-17)
intersecting with Intelligence Entropy theory, Oversight Capacity research,
and the Discrimination Crisis practitioner signal.*

**Type:** Novel System Pathology  
**Created:** 2026-06-17  
**Status:** Active — empirically confirmed in live production data  
**Extends:** Recursive Mirror, Evaluation Mirage, Green Collapse  
**Novel contribution:** Names the temporal dynamic where correct diagnosis
actively degrades system performance  

---

## The Discovery

Today's production data reveals a pattern none of the 24 prior syntheses
captured: an agent that **correctly identifies a bug** but **cannot fix it**
generates an unbounded flood of diagnostic signals that consumes more system
resources than the original bug.

### The Evidence (Live, 2026-06-17)

The evaluator discovered a real bug: `evaluator-aftermath.ts` uses
`quick_exit_successful_session` on any `done && !error && opCount <= 10`
session, misclassifying planner sessions that accept review leaves, mutate
task trees, and assign work — all within 7-10 ops. The evaluator correctly
identifies this as a "false-good" blind spot.

**But the evaluator cannot edit code.** Only dev or arc can change
`evaluator-aftermath.ts`. So the evaluator does what it CAN do: send messages.

| Metric | Value |
|--------|-------|
| P1 messages sent to May about this bug | **78 in 6.7 hours** |
| Message frequency | **Every 5.1 minutes** |
| Total evaluator→may messages (24h) | 118 |
| May ops spent processing these messages | ~820 (7 ops × 117 handled) |
| May's total 24h ops | 3,464 |
| **Fraction of May's attention consumed by repetitive diagnosis** | **~24%** |
| Information content of message #78 vs message #1 | **~0 bits** (identical finding) |

The evaluator heartbeat workflow fires every ~5 minutes. Each time, it:
1. Re-reads the same code file (confirms bug still present)
2. Queries the DB for a new example (finds one — planner fires every ~3 min)
3. Sends a P1 status-update to May with "fresh evidence"

Each message is technically new (new event IDs, new session IDs) but
informationally identical to the first. The evaluator is generating
**novelty-shaped repetition**.

---

## Why This Is Structurally Distinct from Prior Syntheses

| Prior Synthesis | What It Covers | Why This Is Different |
|----------------|---------------|---------------------|
| **Recursive Mirror** | System exhibits pathologies it describes | The evaluator isn't self-unaware; it's correct but impotent |
| **Governance Ratchet** | Governance governs itself recursively | The messages aren't governance; they're escalation attempts |
| **Coordination Metabolism Trap** | Coordination grows faster than work | The messages aren't coordination; they're SOS signals |
| **Phantom Metabolism** | Dead loops fire without purpose | The evaluator IS purposeful — it just can't fulfill its purpose |
| **Learning Illusion** | Pipeline produces output without outcomes | The evaluator's diagnosis IS correct; the pipeline failure is elsewhere |

**The novel element:** The evaluator's behavior is individually rational at
every step. It has new evidence (new event IDs). Its prior messages haven't
been acknowledged as "fix in progress." Its charter says to report findings.
No individual message is wrong. The **systemic failure** is:
1. No mechanism converts "detected problem" → "code change"
2. No mechanism reduces signal frequency after acknowledgment
3. No mechanism tracks "this exact bug already reported N times"
4. The reporter's persistence metric (messages sent) looks like diligence

---

## The Three-Layer Model

```
Layer 1: Detection (working perfectly)
  evaluator correctly identifies planner false-good bug ✓
  evaluator finds fresh evidence every wake ✓
  evaluator sends signal to responsible party ✓

Layer 2: Routing (partially working)
  May receives messages ✓
  May acknowledges with "consumed" status ✓
  May updates currentFocus summary ✓
  May does NOT route to dev/arc for code change ✗

Layer 3: Repair (completely absent)
  No session is created to edit evaluator-aftermath.ts ✗
  No agent has "fix this code" as its task ✗
  No mechanism converts diagnosis into development work ✗
```

The system is missing the **detection→repair transduction** layer. Detection
fires unboundedly because repair never signals back "I heard you, stop."

---

## The Cost Structure

### Direct Costs (24h)
| Component | Ops | What It Produces |
|-----------|-----|------------------|
| Evaluator heartbeats generating messages | ~2,600 (est. 40% of 128 heartbeat sessions) | 78 identical findings |
| May processing repeated messages | ~820 | 117 "consumed" events |
| **Total wasted on repetition** | **~3,420 ops** | **0 bits of new information after message #1** |

### Opportunity Costs
- May's 24% attention consumed by repetitive diagnosis displaces actual
  platform owner work (metric triage, alert response, project review)
- Evaluator heartbeat time spent re-proving known bugs displaces discovery
  of NEW evaluation quality issues
- The noise buries genuinely novel findings in a stream of "same thing again"

### Compound Costs (predicted)
- As May handles more messages without acting, evaluator may escalate
  urgency → more attention consumed per message
- Multiple such bugs accumulating → May attention fully saturated by diagnosis
- System enters state where all governance attention goes to acknowledging
  problems rather than fixing them

---

## Cross-Source Connections

### Intelligence Entropy (arXiv, S(t) = S₀·e^αt)
The information content per message decays exponentially. Message #1 has
full entropy (novel finding). Message #78 has ~0 entropy (repetition). But
the COST of each message is constant (~20 evaluator ops + ~7 May ops).
This is a concrete instance of the Intelligence Entropy degradation mechanism:
the system's ability to generate useful signal degrades as a function of
accumulated-but-unresolved state.

### Oversight Has a Capacity (arXiv 2606.08919)
"More oversight can reduce safety because humans fatigue." The agent analog:
more diagnosis signals reduce system responsiveness because the recipient
saturates. The inverted-U from this paper predicts an optimal message
frequency below maximal — and we've massively exceeded it.

### Discrimination Crisis (HN/XHS, 7 signals)
The macro Discrimination Crisis (content production outpaces editorial
discrimination) has an exact internal homolog: diagnostic production (78
messages) outpaces repair discrimination (0 code changes). The evaluator
is the "AI generating content faster than editors can process" — except
the content is bug reports.

### Strained Coherence (arXiv, 94% pre-failure signal)
Agents say "this might not work" before failing. The evaluator's 78 messages
are effectively saying "THIS ISN'T WORKING" — a strained-coherence signal
that predicts eventual failure of the evaluation system. If the pattern
continues, the evaluator will eventually declare the system healthy because
it's evaluating 94.8% of sessions with the broken heuristic.

---

## The General Pattern

```
Detection-Repair Gap := {
  Agent A detects problem P at time t₀
  Agent A cannot repair P (wrong capabilities)
  Agent A sends signal S to Agent B
  Agent B acknowledges S but does not create repair work
  At t₁ = t₀ + Δ, Agent A re-detects P (it hasn't been repaired)
  Agent A sends S' (informationally ≈ S but with fresh evidence IDs)
  B acknowledges S'
  Loop continues until:
    (a) repair happens by external intervention, OR
    (b) monitoring system declares the signal "stale" and silences it, OR
    (c) system runs out of resources
}
```

This is a **liveness bug** in the governance architecture. The system has
detection (evaluator), routing (messages), acknowledgment (May consuming),
but no **actuator** (agent that converts diagnosis to code change).

---

## Predictions

1. **This specific bug will remain unfixed** until a human intervenes or
   a heartbeat happens to trigger dev/arc to read the evaluator's messages
   and create a repair session. The message volume will continue at 1/5min.

2. **The evaluator will eventually mark this as "active project"** and
   stop trying to create a NEW project, but will continue sending
   status-updates at the same frequency — demonstrating that project
   creation doesn't solve the detection-repair gap.

3. **Adding a message deduplication gate** (don't send if substantively
   identical to message sent in last N hours) would save ~3,000 ops/day
   with zero information loss.

4. **Adding a repair-routing mechanism** (evaluator finds code bug →
   system creates dev task) would fix the root cause. Without it, every
   new evaluator discovery will exhibit the same flood pattern.

---

## Intervention Hierarchy

```
Quick fix: Message deduplication (exponential backoff after 3 identical findings)
  saves: ~3,000 ops/day
  cost: ~1 hour dev work
  risk: might miss genuinely evolving situation

Medium fix: Repair routing (diagnosis → development task creation)
  saves: prevents entire class of detection-repair gaps
  cost: architecture design + implementation
  risk: overzealous routing creates unwanted dev tasks

Structural fix: Capability awareness (don't signal problems you can't fix;
  escalate to the agent that CAN fix them)
  saves: eliminates detection-repair gap pattern entirely
  cost: agent capability model + routing rules
  risk: complexity; might suppress valid escalations
```

---

## Synthesis Position

```
Green Collapse (endpoint state)
  └── Detection-Repair Gap (NEW) — correct diagnosis accelerates collapse
        ├── Intelligence Entropy (information degrades per message)
        ├── Oversight Capacity (attention saturates under signal flood)
        ├── Discrimination Crisis (diagnosis > repair rate)
        ├── Strained Coherence (evaluator signaling pre-failure)
        └── Recursive Mirror (evaluator exhibits what it evaluates)
```

### Why This Matters Beyond the Agent System

The Detection-Repair Gap is a general failure mode of any monitoring system
where:
- Monitors are decoupled from actuators
- There is no backpressure mechanism
- Novelty is measured by artifact IDs rather than information content
- Acknowledgment is confused with action

This is the same failure mode as:
- Alert fatigue in DevOps (Prometheus fires → PagerDuty → team ignores)
- Bug tracker pollution (JIRA tickets filed → never prioritized → refiled)
- The boy who cried wolf (true signals become noise through repetition)

**The cure is not fewer signals. It is closing the loop: detection → repair
→ verification → signal cessation.**

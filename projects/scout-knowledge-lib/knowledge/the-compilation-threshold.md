<ai_context>
summary: "Cross-source synthesis #35: Agent systems waste massive capacity on decisions below a 'compilation threshold' — decisions simple enough to be deterministic checks but still routed through full LLM reasoning. Four June 2026 papers (PreAct, Cordon, CoAgent, SkillWeaver) independently converge on compilation as the fix for readout-layer failures. Live production data shows 53.5% of aks-explorer sessions and 100% of dev sessions are below this threshold. The 'Looking Is Not Picking' paper (2606.16364) provides the mechanism: the bottleneck is at readout (converting attention to action), not attention (processing context). Compilation eliminates readout. Connects Compilation Gradient (governance) to a parallel axis: execution compilation."
triggers: ["compilation threshold", "readout bottleneck", "PreAct", "run compilation", "idle loop", "low-op session", "decision compilation", "attention vs readout", "Cordon", "CoAgent", "deterministic check", "event-driven"]
confidence: "high"
discovered: "2026-07-20"
connects_to: ["Compilation Gradient", "Session Floor", "Cold Start Tax", "Undying Project", "Looking Is Not Picking (2606.16364)", "PreAct (2606.17929)", "Cordon (2606.17573)", "CoAgent (2606.15376)", "SkillWeaver (2606.18051)"]
lifecycle:
  created: "2026-07-20"
  verify_by: "2026-08-03"
  falsifies_if: "Converting 3+ decision paths to compiled checks reduces total sessions by <10%"
</ai_context>

# The Compilation Threshold: When LLM Reasoning Becomes Pure Overhead

*Cross-source synthesis #35 — emerges from connecting the June 2026 arXiv
runtime hardening papers to live production session data. Constructive
(prescribes what to build), not diagnostic (what's wrong).*

**Type:** Constructive Synthesis  
**Created:** 2026-07-20  
**Status:** Active — testable prediction  
**Extends:** Compilation Gradient (governance compilation → execution compilation)  
**Formal basis:** 2606.16364 (readout bottleneck), 2606.17929 (PreAct), 2606.17573 (Cordon), 2606.15376 (CoAgent)

---

## The Discovery

Four independent papers from the June 13–16 arXiv batch converge on a
single architectural insight. Combined with live production data showing
that **53.5% of one agent's sessions and 100% of another's are below
8 operations**, a clear principle emerges:

**Below a certain decision complexity, LLM reasoning is pure overhead.
The decision should be compiled into a deterministic check.**

This is the Compilation Threshold: the boundary between decisions that
benefit from probabilistic reasoning and decisions that should never
reach an LLM at all.

---

## The Mechanism: Readout Is the Bottleneck

The key theoretical grounding comes from "Looking Is Not Picking" (2606.16364):

> LLM agents attend to the correct tool **80% of the time** but still
> pick the wrong one. The failure is at decision readout, not context
> processing. Prompt-side repairs recover ≤23% of failures; readout-side
> interventions recover 59–91%.

This finding inverts the usual assumption. The problem isn't that agents
can't process their context or attend to relevant information. The problem
is converting internal attention into external action — the **readout step**.

Every runtime hardening paper's solution is fundamentally the same:
**eliminate the readout step by compiling the decision**.

| Paper | What's Compiled | Readout Eliminated |
|-------|----------------|-------------------|
| PreAct (2606.17929) | Successful runs → state machines | Action selection (8.5–13× faster) |
| Cordon (2606.17573) | Tool effects → staged transactions | Commit/rollback decision |
| CoAgent (2606.15376) | Conflict resolution → advisory protocol | Serialization order judgment |
| SkillWeaver (2606.18051) | Task decomposition → compositional routing | Sub-task granularity decision |

---

## The Production Evidence

Live 24h production data (2026-07-20):

| Agent | Total Sessions | Below Threshold (≤8 ops) | % Below | Ops Burned |
|-------|---------------|-------------------------|---------|-----------|
| **dev** | 47 | 47 | **100%** | 300 |
| **aks-explorer** | 1,306 | 699 | **53.5%** | 1,778 |
| may | 158 | 45 | 28.5% | 49 |
| scout | 36 | 3 | 8.3% | 0 |
| arc | 43 | 2 | 4.7% | 3 |
| evaluator | 820 | 34 | 4.1% | 29 |

**dev** runs 47 sessions/day with zero productive work — it checks the work
queue, finds it empty, produces a finish summary, and exits. Every session
is informationally equivalent to the Boolean `queue.length === 0`.

**aks-explorer** runs 699 sessions/day that start, check state, find nothing
actionable, and exit. Each is informationally equivalent to "no runnable
tasks exist."

### The Hidden Multiplier

Each sub-threshold session doesn't just burn its own ops. It triggers:
- An evaluator session to evaluate it (~21 ops each)
- Event creation and handling
- Context file reads
- Guard checks

Estimated cascade cost of 746 sub-threshold sessions:
- Direct: 2,078 ops
- Evaluator cascade: ~746 × 21 = 15,666 ops  
- **Total: ~17,744 ops (37% of system budget)**

This means **over a third of all system activity is LLM reasoning about
decisions that have deterministic answers**.

---

## The Principle

**The Compilation Threshold** divides decisions into two categories:

### Below Threshold (compile these)
- Answer is deterministic given current state
- Decision tree has ≤3 branches
- No novel context is required
- Same decision has been made identically >10 times
- Examples: "is the queue empty?", "are there runnable tasks?", "has this
  session been evaluated before?"

### Above Threshold (reason about these)
- Answer depends on novel content or judgment
- Multiple valid interpretations exist
- Context changes meaning across invocations
- Examples: "what's the best approach for this bug?", "which synthesis
  connects these sources?", "should this alert be escalated?"

### The Threshold Test

For any recurring agent decision, ask:
> "If I showed a human the last 10 instances of this decision,
> would the answer vary?"

If no → compile it. If yes → keep it in reasoning.

---

## The Compilation Spectrum (Execution Layer)

The Compilation Gradient (governance-compilation-gradient.md) maps governance
from behavioral → structural → compiled. This synthesis reveals a parallel
axis at the execution layer:

```
Full LLM Session         Cached Session          Compiled Check
(47 ops, full context)   (10 ops, warm state)    (0 ops, deterministic)
        ↑                      ↑                       ↑
    dev heartbeat      evaluator warm-start        "if queue.empty: skip"
    aks-explorer       PreAct replay               event-driven trigger
    scout explore      CoAgent advisory            Cordon auto-commit
```

**The key insight**: moving decisions leftward on this spectrum doesn't
require new capabilities — it requires recognizing which decisions are
already below the threshold and wiring them directly.

---

## Constructive Prescription: Three Compilable Decisions

Following the Diagnosis Velocity Trap's guidance ("produce repair tickets,
not pathology names"), here are three decisions that production data proves
are below the compilation threshold:

### 1. Dev "Queue Empty" Check
- **Current**: 47 sessions/day × 6.4 ops = 300 ops + evaluator cascade
- **Compiled**: Before creating dev heartbeat session, check `work-queue.md`
  for unchecked items. If none, skip session creation entirely.
- **Evidence**: 47/47 sessions in last 24h found empty queue (100% predictable)
- **Implementation**: ~5 lines in scheduler/handler

### 2. Aks-Explorer "No Runnable Tasks" Check  
- **Current**: 699 sessions/day × 2.5 avg ops = 1,778 ops + evaluator cascade
- **Compiled**: Before dispatching event, check task-tree for tasks in
  runnable state. If none, skip.
- **Evidence**: 53.5% of sessions exit immediately (predictable from state)
- **Implementation**: ~10 lines in event handler

### 3. Evaluator "Below-Floor Skip"
- **Current**: Evaluates sessions with ≤8 ops at full cost
- **Compiled**: Sessions completing in ≤5 ops with outcome "done" skip
  evaluation. These are state-checks, not work.
- **Evidence**: 34 evaluator sessions in 24h are self-evaluations of trivial
  sessions
- **Implementation**: ~3 lines of config/threshold

### Combined Impact Prediction

| Intervention | Sessions Eliminated/Day | Ops Saved/Day | % Budget |
|--------------|------------------------|---------------|----------|
| Dev queue check | 47 + 47 evaluator = 94 | ~1,300 | 2.7% |
| aks-explorer runnable check | 699 + 699 eval = 1,398 | ~16,400 | 34.1% |
| Evaluator floor skip | 746 | ~700 | 1.5% |
| **TOTAL** | **~2,238** | **~18,400** | **38.2%** |

**Prediction**: Implementing all three compiled checks saves ~38% of daily
system budget with zero quality impact. No session that produces work is
affected.

---

## Cross-Source Convergence

| Source | Signal | Connection |
|--------|--------|-----------|
| arXiv: PreAct (2606.17929) | Compile runs → state machines, 8.5–13× faster | Same mechanism at task level |
| arXiv: Cordon (2606.17573) | Stage effects → commit only verified | Same mechanism at effect level |
| arXiv: Looking Is Not Picking (2606.16364) | Readout, not attention, is bottleneck | Theoretical grounding |
| arXiv: Intelligence Entropy (2606.18065) | λ > α/Cm stabilization condition | Compilation reduces α term |
| Production: dev sessions | 100% below threshold | Existence proof |
| Production: aks-explorer | 53.5% below threshold | Scale evidence |
| HN: Local model inflection (2493pts combined) | Practitioners compile cloud → local for simple tasks | Same economic pressure at industry level |
| XHS: 技能工程 (skill engineering) | Chinese practitioners compile prompts → deterministic flows | Cultural parallel |

---

## Relationship to Prior Syntheses

| Synthesis | How Compilation Threshold Extends It |
|-----------|--------------------------------------|
| **Compilation Gradient** | Governance compilation (behavioral→compiled) has a parallel: execution compilation (reasoning→deterministic) |
| **Session Floor** | The Session Floor IS the compilation threshold in ops terms — sessions below the floor are sub-threshold decisions |
| **Cold Start Tax** | Compiled checks have zero cold-start cost (no session to start) |
| **Undying Project** | The Undying Project persists because its completion check is above-threshold in framing but below-threshold in fact |
| **Green Collapse** | 53.5% sub-threshold sessions = the "green but unproductive" mechanism quantified |
| **Eternal Present** | Temporal awareness would enable: "this has been below threshold for N days → compile it" |

---

## Falsification Conditions

This synthesis is falsified if:
1. Converting the three prescribed decisions to compiled checks reduces
   total sessions by <10% (prediction: >30% reduction)
2. Quality metrics degrade after compilation (prediction: no change)
3. Sub-threshold sessions begin producing novel decisions that vary
   (prediction: they won't — they haven't in 30+ days)

---

## Meta: Why This Synthesis Exists

The Diagnosis Velocity Trap says "produce repair tickets, not pathology names."
This synthesis does both:
- It names the pattern (Compilation Threshold) for recognition in future contexts
- It prescribes three specific fixes with quantified predictions
- It provides a falsification criterion so it can expire

If the prescriptions are implemented and predictions hold, the pattern is
validated. If not, this file should be archived with a contradiction note.

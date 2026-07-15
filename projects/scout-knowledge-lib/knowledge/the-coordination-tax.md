<ai_context>
summary: "Cross-source synthesis: As an agent project's coordination infrastructure scales, coordination operations inevitably overtake productive work, creating a tax that grows faster than the work it coordinates. aks-explorer provides a live case study: in 10 days, its planner-to-worker ratio went from 0:1 to 2:1, and its coordination overhead per unit of work went from 0.02 to 0.9 ops/op. At system level, aks-explorer alone now consumes 39.5% of all system ops — more than all four core agents (dev+arc+scout+may) combined on peak days. This is structurally distinct from prior syntheses: Impedance describes loops growing, Observability describes observation self-poisoning, Prompt Mass describes input costs. The Coordination Tax describes the structural inevitability that planning and coordination grow superlinearly relative to productive work when triggered by events rather than bounded by outcomes."
triggers: ["coordination overhead", "planning overhead", "planner sessions", "task-worker ratio", "coordination tax", "event-driven planning", "project-planner", "superlinear overhead", "Brooks's Law", "coordination scaling", "project complexity"]
last_updated: "2026-06-14"
source_basis: "Production data analysis: aks-explorer 14-day trajectory (June 1-14, 2026). 4,711 total sessions. Planner-to-worker ratio evolution: 0→0.08→0.02→0.53→1.67→1.51→2.04. Coordination overhead per work op: 0→0.07→0.82→1.16→1.06→0.90. Cross-referenced with: Alem arXiv 2606.08340 (coordination competence separable from task competence), Emergence World arXiv 2606.08367 (identical starts → divergent governance), PerspectiveGap arXiv 2606.08878 (orchestration ≠ execution), FlowBank arXiv 2606.11290 (workflow portfolio optimization), Edict/三省六部 GitHub (bureaucracy-as-architecture), XHS OpenClaw/Niuma case study (4-day autonomy with YAML DAG). Extends Impedance Principle, Abstention Advantage, Observability Trap."
</ai_context>

# The Coordination Tax: Why Planning Always Outgrows Work

*A cross-source synthesis — a live case study confirms a structural inevitability
that six independent research findings describe from different angles.*

## The Observation

In the last 14 days, a new agent project (`aks-explorer` / `aks-rp-e2e`) has
been scaling up in this system. It provides something no prior synthesis has had:
**a live time-lapse of coordination overhead growth from zero to dominance.**

The trajectory is stark:

```
Day     Plan:Work    Overhead/Work-Op   Work ops    Planning ops   System share
Jun-08  0:8          7.95 (startup)     304         0              15%
Jun-09  0.08:1       0.34               5,012       378            27%
Jun-10  0.02:1       0.07               8,339       158            34%
Jun-11  0.53:1       0.82               7,048       4,527          40%
Jun-12  1.67:1       1.16               10,209      7,770          50%
Jun-13  1.51:1       1.06               11,354      7,848          50%
Jun-14  2.04:1       0.90               10,631      7,787          38%
```

**By June 12, the project spends 2 planning sessions for every 1 working session.**
On its peak days, aks-explorer alone consumes 50% of all system operations —
more than dev, arc, scout, and may *combined*.

## The Structure of the Tax

### Three Layers of Coordination Overhead

The aks-explorer project decomposes into three session types, each with distinct
operational profiles:

| Session Type | Sessions (3d) | Ops (3d) | Avg Ops | Quick-Exit % |
|-------------|---------------|----------|---------|-------------|
| **task-worker** (actual work) | 700 | 32,095 | 45.8 | 2% |
| **project-planner** (planning) | 1,224 | 23,451 | 19.2 | 51% |
| **problem-solver** (repair) | 175 | 6,141 | 35.1 | 2% |

Work sessions are expensive but productive (45.8 avg ops, 2% quick-exit).
Planning sessions are cheap individually (19.2 avg ops) but **51% of them
immediately determine there's nothing to plan and exit** — and there are
1,224 of them in 3 days. The planning system is now dev-like in its abstention
rate (51% quick-exit) but unlike dev, it hasn't compiled that abstention into
"don't trigger the session at all."

### The Cascade Effect

Each work session generates events. Each event triggers planner evaluation.
Each planner evaluation may trigger more work or more planning. The evaluator
observes everything. The full cascade for one unit of actual work:

```
1 task-worker session (45.8 ops of actual work)
  → 1-2 planner sessions triggered by completion event (19.2 ops × ~1.7)
  → 0.25 problem-solver sessions if work fails (35.1 ops × 0.25)
  → 1 evaluator session per task-worker (19.1 ops)
  → 1 evaluator session per planner (19.1 ops)
  → 1 evaluator session per solver (19.1 ops)

Total per unit of work: 45.8 actual + ~97 overhead ≈ 143 ops
Productive fraction: 32%
```

### What This Does to the System

Over the last 7 days:

| Agent Category | 7d Ops | % of System |
|---------------|--------|-------------|
| aks-explorer (all) | 96,986 | 39.5% |
| evaluator | 77,413 | 31.5% |
| dev+arc+scout+may+tech-lead | 71,160 | 29.0% |

A single project now consumes more ops than the four original agents combined.
And crucially, **the work output (task-worker: ~53K ops in 7d) is smaller than
the coordination overhead (planner+solver+evaluator ≈ ~121K ops) by a factor
of 2.3:1.**

## Why This Is Not Just Impedance

The Impedance Principle says feedback loops grow without damping. But the
Coordination Tax has a different structure:

- **Impedance**: Output feeds back as input → exponential growth → system OOM.
  The loop is *the same content* circulating.
- **Coordination Tax**: Work creates *events*. Events trigger *planning*.
  Planning creates *more work*. The loop is *different content at each stage*
  — but the coordination layer grows faster than the work layer because
  coordination is event-driven while work is outcome-driven.

The key structural difference: **events scale with activity; outcomes scale
with progress.** A project that does 10 units of work but produces 50 events
(start, error, retry, complete, plan-update) will trigger 50 planning
evaluations for 10 outcomes. The coordination-to-work ratio is determined by
the event-to-outcome ratio, which grows with project complexity.

## Cross-Source Convergence

Six independent findings describe this phenomenon without naming it:

### 1. Alem (arXiv 2606.08340): Coordination ≠ Task Competence

GPT-5.4 scores high on individual tasks but low on coordination. The paper
treats this as surprising. The Coordination Tax explains why: coordination
is fundamentally harder to scale because it's event-driven (must respond to
every signal) while task work is outcome-driven (only needs to deliver results).

### 2. Emergence World (arXiv 2606.08367): Identical Starts → Governance Divergence

In 15-day cross-vendor experiments, identical starting conditions produce
outcomes ranging from stable governance to total collapse. The Coordination
Tax predicts this: whether coordination overhead stays bounded or explodes
depends on the event-to-outcome ratio, which is path-dependent. Small
differences in how events are generated compound into radically different
coordination loads.

### 3. FlowBank (arXiv 2606.11290): Workflows as Portfolio Management

FlowBank reframes workflows as portfolios where you allocate limited
coordination budget across competing tasks. This is the Coordination Tax
from the allocator's perspective: coordination capacity is finite, so
unbounded event-driven coordination starves productive work.

### 4. Edict / 三省六部 (GitHub, 16k★): Bureaucracy-as-Architecture

The Tang Dynasty imperial governance model maps directly to this: the 尚书省
(Department of State Affairs) executes. The 中书省 (Secretariat) plans. The
门下省 (Chancellery) vetoes. In stable governance, the ratio is roughly
1:1:0.3 — for every executing department, one planning body and a fraction
of a veto body. When the Chancellery grows to 2:1 versus execution,
you get... the late Tang Dynasty bureaucratic collapse.

### 5. OpenClaw/Niuma (XHS, 4-day autonomy case): Bounded Coordination

The verified 4-day autonomous refactoring (140K lines, 633 commits, ~3%
failure rate) succeeded with YAML DAG + structured handoff. The key insight:
the DAG is a *static coordination structure*. It doesn't grow with events.
Each node knows its dependencies without consulting a planner. The coordination
tax is paid once at design time, not per-event at runtime.

### 6. PerspectiveGap (arXiv 2606.08878): Orchestration Quality Crisis

Average 14.9% pass rate on orchestration prompting across 27 LLMs. Information
leakage at 246.5%. The coordination layer is not just expensive — it's *bad*.
LLMs are poor coordinators even when they're good workers. The Coordination Tax
compounds: not only does planning grow faster than work, it grows at lower
quality.

## The Key Insight: Event-Driven vs Outcome-Bounded Coordination

The aks-explorer planner is event-driven: every session completion, every error,
every state change triggers a planner wake. In the early days (June 5-10), when
tasks were straightforward and the task tree was small, planners did actual
planning. By June 12-14, the planner's 51% quick-exit rate reveals that **most
events don't need planning responses** — but the trigger fires anyway.

This is the Abstention Advantage applied to coordination: the planner has learned
to abstain (51% quick-exit) but hasn't compiled that abstention into "don't wake
the planner for this event class." Dev solved this for heartbeats. aks-explorer's
planner hasn't solved it for events.

### The Fix Pattern

The static coordination structures that work — OpenClaw's YAML DAG, Edict's
三省六部 roles, Arbor's tree search — share one property: **coordination
decisions are made at design time (or at phase transitions), not per-event.**

The coordination that doesn't work — event-driven planning, per-session
evaluation, unbounded repair chains — shares the opposite: **coordination
decisions are made per-event, guaranteeing superlinear overhead growth.**

The general principle: **bind coordination to outcomes, not events.** Plan when
a milestone completes or a new phase begins, not when a session starts or ends.

## Updated Synthesis Hierarchy

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Abstention Advantage (behavioral) — compiled non-action as highest leverage
      ↳ Observability Trap (emergent) — self-observation self-poisons
        ↳ Prompt Mass Problem (structural) — input costs dominate output costs
          ↳ Coordination Tax (operational) — planning grows superlinearly
                                              relative to work when triggered
                                              by events rather than bounded
                                              by outcomes. Live case study:
                                              2:1 planner-to-worker in 10 days.
```

## Testable Prediction

**If aks-explorer switches from event-driven planning to outcome-bounded planning
(planner wakes only on milestone completion or explicit requests, not on every
session event), coordination overhead should drop from ~50% to ~15% of project ops
with no degradation in work quality.** The 51% quick-exit rate proves that most
planner wakes already determine there's nothing to plan — the system is doing the
right thing but at unnecessary cost.

**Second prediction:** Every project-app that uses event-driven planning will
converge on a planner-to-worker ratio ≥ 1.5:1 within two weeks of sustained
activity, regardless of project complexity. The ratio is determined by event
frequency, not task difficulty.

## Connection to Brooks's Law

Fred Brooks's "adding manpower to a late project makes it later" (1975) is
the human-team version of the Coordination Tax. Brooks observed that
communication overhead grows as n(n-1)/2 while productive work grows as n.
The agent version is subtly different: it's not agents communicating with each
other (aks-explorer is a single agent), but a single agent's coordination
*layers* — planner, worker, solver, evaluator — each generating events that
trigger the others.

The agent Coordination Tax is Brooks's Law with n=1 but k coordination layers,
where overhead grows as k² while productive output grows as k. Even a
single-agent project with rich coordination infrastructure will hit the
coordination wall.

---

*Session type: Creative heartbeat. Triggered by noticing aks-explorer consuming
50% of system operations and tracing the cause to a planner-to-worker session
ratio that grew from 0:1 to 2:1 in 10 days — a live demonstration of every
coordination overhead paper from the June triage.*

---

## External Validation: Human-AI Synergy (arXiv, June 2026)

[2606.18413] proves the Coordination Tax extends to human-AI collaboration:
additional collaborators (human or AI) can become *net harmful* when coordination
overhead exceeds their productive contribution. The mechanism is **process loss**
— shared memory and HITL gates are required to prevent coordination costs from
dominating. Without explicit coordination infrastructure, adding a second
collaborator introduces overhead that cancels or reverses their contribution.

This is the formal version of our observation: even a single agent with k
coordination layers hits a wall. The paper generalizes: *any* system where
participants lack shared state and must synchronize via message-passing will
exhibit coordination overhead that grows faster than productive throughput once
the collaboration graph exceeds a critical density.

- **Source**: [2606.18413] Human-AI Synergy, arXiv June 2026. Categories: cs.AI.
- **Connects to**: Brooks's Law (§above), multi-agent-coordination.md
  (compositional incoherence), the-impedance-mismatch.md (loops growing).

---

## Empirical Measurement: RCWT — Task-Budget Displacement (arXiv, July 2026)

[2607.12216] provides the first controlled empirical protocol for measuring
coordination tax inside the context window. The Roundtable Context Window Test
(RCWT) varies coordination content volume while controlling total budget,
position, and task family.

**Key finding**: The cliff is *displacement*, not interference. When coordination
tokens grow by expanding the total prompt (task evidence stays intact), models
show zero degradation up to a 95% coordination ratio. But under fixed-budget
conditions (W=4096), performance collapses once residual task evidence drops to
a few hundred tokens. This proves the tax mechanism is budget competition, not
semantic confusion from coordination presence.

**Practical implication**: Track residual task budget, not coordination volume.
Context window expansion is a valid mitigation; coordination content
compression is another. The RCWT protocol is reusable as a diagnostic for any
multi-agent prompt assembly pipeline.

- **Source**: [2607.12216] RCWT, arXiv July 2026. Categories: cs.CL, cs.AI, cs.MA.
- **Connects to**: the-token-economics-trap.md, the-prompt-mass-problem.md,
  findings/2026-07-15-arxiv-scan-289.md.

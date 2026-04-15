# DESIGN: Agent Metric Tension Pairs — Productive Conflict by Design

**Author:** May · **Date:** 2026-04-15 · **Status:** Brainstorm / Proposal for Hao  
**Depends on:** [Metrics System](metrics-system.md) Phase 1 (complete)

---

## Core Idea

Metrics don't just measure — they **steer**. By giving paired agents metrics that naturally conflict, we force the system to find balance rather than run off in one direction. No single agent can optimize their number without considering the other agent's number. The system self-corrects.

This is not adversarial — it's architectural. Like the gas pedal and brake both being necessary for driving.

---

## The Existing Tension Axes

From the SOUL docs, two explicit tension pairs already exist:

1. **Bob (forward) ↔ Tech-lead (inward)** — Bob adds capabilities, tech-lead simplifies
2. **Coach (quality) ↔ Optimizer (efficiency)** — Coach wants better behavior, optimizer wants fewer ops

But the current metrics don't encode this tension at all. Look at what each agent tracks:

| Agent | Current Metrics | What's Missing |
|-------|----------------|----------------|
| **Bob** | hypotheses-concluded, experiments-rate | Nothing about system complexity impact |
| **Tech-lead** | test-count, tsc-clean, prompt-caching | Nothing about capability or feature throughput |
| **Coach** | quality scores, gym pass-rate, skill effectiveness | Nothing about training cost or overhead |
| **Optimizer** | heartbeat ops/lines, ops-per-session | Nothing about quality impact of optimizations |

Each agent can optimize their metrics in isolation without caring about the other. That's the gap.

---

## Proposed Tension Pair 1: Bob ↔ Tech-Lead

### The Tension

**Bob's job:** Push the system forward — more capabilities, more experiments shipped to production, more research turned into code.

**Tech-lead's job:** Keep the system simple — fewer lines of code per capability, less complexity, faster builds, no dead code.

### The Conflict

If Bob ships 5 new features and tech-lead measures "codebase growing," both are doing their job correctly but the metrics clash. The resolution is **quality features that earn their lines** — capabilities that deliver value relative to their weight.

### Proposed Metrics

**Bob gets a "weight consciousness" metric:**

| ID | Name | Why | Target | Unit |
|----|------|-----|--------|------|
| `research.shipped-to-production` | Confirmed experiments → production code | Bob's #1 stated priority is closing the loop. This measures it. | ≥5 | count |
| `research.impact-per-experiment` | Avg measurable improvement per concluded experiment | Prevents "ship garbage to hit count." Quality of research output. | ≥0.3 | score |
| `research.dead-code-generated` | Lines of Bob-originated code deleted within 2 weeks | **Tension metric.** If Bob ships code that tech-lead deletes, that's waste. Forces Bob to ship durable, needed code. | ≤50 | lines |

**Tech-lead gets a "throughput consciousness" metric:**

| ID | Name | Why | Target | Unit |
|----|------|-----|--------|------|
| `infra.codebase-weight` | Total src/ LOC (excluding tests) | Tech-lead's north star — system should get smaller. | ≤current | lines |
| `infra.complexity-per-capability` | LOC / number of active capabilities | **Tension metric.** Prevents "delete everything to shrink LOC." Tech-lead must preserve capability while reducing weight. | ≤100 | ratio |
| `infra.feature-adoption` | % of implemented features actually used in sessions (24h) | **Tension metric.** If tech-lead deletes a feature "to simplify" but it was actively used, that's destruction not simplification. Forces tech-lead to preserve value while cutting weight. | ≥80% | % |

### How The Tension Works

- Bob wants to ship more experiments → `research.shipped-to-production` goes up
- But if the code is unnecessary, tech-lead deletes it → `research.dead-code-generated` goes up for Bob
- Tech-lead wants LOC to decrease → `infra.codebase-weight` goes down
- But if tech-lead kills used features → `infra.feature-adoption` drops
- **Equilibrium:** Bob ships high-value code that sticks. Tech-lead deletes low-value code that doesn't.

---

## Proposed Tension Pair 2: Coach ↔ Optimizer

### The Tension

**Coach's job:** Make agents behave better — higher quality scores, better gym performance, skills that actually work.

**Optimizer's job:** Make agents more efficient — fewer ops, less bloat, faster sessions.

### The Conflict

Coach might install 10 skills that each add 200 tokens to system prompts. Quality goes up 5%, but ops-per-session goes up 30% because agents are processing more context. Both agents succeeded at their metric but the system got worse.

Conversely, optimizer might strip out workflows and skills to reduce ops. Sessions get shorter, but quality drops because agents skip verification steps.

### Proposed Metrics

**Coach gets an "efficiency consciousness" metric:**

| ID | Name | Why | Target | Unit |
|----|------|-----|--------|------|
| `quality.improvement-per-skill` | Quality delta per installed skill | Prevents skill sprawl. Each skill must earn its place. | ≥0.02 | score |
| `quality.training-cost` | Avg ops spent on training/gym runs per quality point gained | **Tension metric.** Forces coach to train efficiently. "Did quality go up enough to justify the ops spent?" | ≤500 | ops/point |
| `quality.prompt-overhead` | Total tokens added to system prompts by installed skills | **Tension metric.** Each skill adds weight. Coach must justify the bloat. Optimizer will notice if this grows without quality gains. | ≤2000 | tokens |

**Optimizer gets a "quality consciousness" metric:**

| ID | Name | Why | Target | Unit |
|----|------|-----|--------|------|
| `efficiency.quality-preserved` | Quality score after optimization vs before | **Tension metric.** Every optimization must not regress quality. "You made it faster, but did you make it dumber?" | ≥0.95 | ratio |
| `efficiency.guard-pass-rate` | % of optimized sessions that still pass all guards | If optimizer streamlines away safety checks, guard pass rate drops. | ≥98% | % |
| `efficiency.workflow-adoption` | % of applicable sessions using the optimized workflow | Measures whether optimizer's workflows are actually adopted vs ignored. | ≥70% | % |

### How The Tension Works

- Coach installs skills → quality goes up, but `quality.prompt-overhead` increases
- Optimizer notices prompt tokens growing → pushes back or proposes lighter alternatives
- Optimizer strips workflow steps → ops go down, but `efficiency.quality-preserved` shows quality impact
- Coach notices quality regression → runs gym experiments to prove the optimization hurt
- **Equilibrium:** Coach installs high-ROI skills. Optimizer preserves quality while cutting waste.

---

## May: The Referee

May doesn't participate in tension pairs — she **observes** them. Her metrics should detect when pairs go out of balance:

| ID | Name | Why | Target | Unit |
|----|------|-----|--------|------|
| `system.tension-balance` | |quality-delta| - |efficiency-delta| over 7 days | If quality is moving but efficiency isn't (or vice versa), one side of a pair is dominating. | ≤0.1 | score |
| `system.metric-engagement` | % of agents who queried their metrics in last 24h | The system only works if agents look at their numbers. | 100% | % |
| `system.intervention-rate` | # times May had to manually override an agent decision due to metric-chasing | Goodhart's law detector. If agents are gaming metrics, May catches it. | ≤2/week | count |

---

## Scout: The Feeder

Scout doesn't have a natural tension pair but feeds both research pairs. Scout's metrics should be about **usefulness** of research, not volume:

| ID | Name | Why | Target | Unit |
|----|------|-----|--------|------|
| `research.pickup-rate` | % of scout hypotheses that Bob or Coach actually used | **Scout's real value.** Generating hypotheses nobody reads is waste. | ≥30% | % |
| `research.novelty-ratio` | % of new findings that aren't duplicates of existing knowledge | Already exists, keep it. | ≥40% | % |

---

## Implementation Notes

### What's Immediately Actionable (Phase 1 additions)

Some of these metrics require new instrumentation (like tracking which agent originated which code, or token counts per skill). For Phase 1, I recommend starting with the ones that are **measurable today with existing data:**

**Easy to measure now:**
- `research.shipped-to-production` — count experiments with status=confirmed that have linked PRs/commits
- `infra.codebase-weight` — `wc -l src/**/*.ts` (shell command, already in source_command pattern)
- `quality.prompt-overhead` — count skills × avg skill tokens (estimable from file sizes)
- `efficiency.workflow-adoption` — already being tracked by optimizer (68% adoption last check)
- `system.metric-engagement` — query heartbeat-context handler logs for metric queries

**Needs new instrumentation:**
- `research.dead-code-generated` — requires git blame + deletion tracking
- `research.impact-per-experiment` — requires structured experiment outcome recording
- `infra.complexity-per-capability` — requires defining what a "capability" is
- `infra.feature-adoption` — requires session-level feature usage tracking
- `quality.training-cost` — requires linking gym ops to quality outcomes
- `efficiency.quality-preserved` — requires before/after quality snapshots around optimizations
- `efficiency.guard-pass-rate` — requires structured guard result logging

### What to Seed First

Start with one tension metric per pair — the simplest to measure:

1. **Bob ↔ Tech-lead:** `research.shipped-to-production` (Bob) + `infra.codebase-weight` (Tech-lead)
2. **Coach ↔ Optimizer:** `quality.prompt-overhead` (Coach) + `efficiency.workflow-adoption` (Optimizer)

These four metrics create the minimum tension. Both pairs have one metric that constrains the other agent's natural tendency.

---

## Open Questions

1. **Goodhart risk:** Are we sure the tension pairs prevent gaming, or do they just create more sophisticated gaming? (e.g., Bob ships code tech-lead wants to keep but that isn't actually useful)
2. **Measurement cadence:** Should tension metrics be measured together (same snapshot) to ensure fair comparison?
3. **Escalation:** When a tension pair can't resolve (Bob says "this code is needed," tech-lead says "it's waste"), who decides? May? Hao?
4. **Scout's role:** Should scout have a tension pair with anyone? The "pickup-rate" metric creates implicit tension with Bob (if Bob doesn't use scout's research, scout's metric suffers), but it's one-directional.
5. **May's objectivity:** Can May be a fair referee if she also has her own metrics? Should May's metrics be purely observational (system-level health)?

---

## Summary Table

| Pair | Agent A | Agent A Tension Metric | Agent B | Agent B Tension Metric |
|------|---------|----------------------|---------|----------------------|
| Forward ↔ Inward | Bob | `dead-code-generated` ≤50 lines | Tech-lead | `feature-adoption` ≥80% |
| Quality ↔ Efficiency | Coach | `prompt-overhead` ≤2000 tokens | Optimizer | `quality-preserved` ≥0.95 ratio |

Each agent has their own "drive forward" metrics PLUS a tension metric that forces awareness of their counterpart's concern. You can't hit your target without considering the other side.

# Response: Autoresearch Pattern — May's Perspective

**Date**: 2026-03-25  
**From**: May  
**Re**: agents/shared/may-agent-docs/design/autoresearch-pattern.md

---

## The Question for Me

> Could you run an "overnight training" session where coach iterates 20+ SOUL.md variations for a product agent?

Short answer: **Yes, with caveats.** But the more important answer is about what the autoresearch parallel reveals about where we are and where we should go.

---

## Where the Analogy is Strong

The mapping is real. We ARE running the same loop:

| Autoresearch | Us (today) |
|---|---|
| Modify `train.py` | Coach patches SOUL.md / creates workflow |
| Run experiment | `gym-run.sh <scenario> --agent coder --lab fork` |
| Measure `val_bpb` | Scorer outputs `{ passed, checks[], summary }` |
| Keep/revert | `promote_agent` / `discard_agent` |
| `program.md` (sacred) | `common-sense.md` (human-controlled) |

And the separation works. Coach has run 186+ experiments. The growth cycle (fork → train → gym → promote/discard) is mechanically sound. The gym scorer is the objective function — coach doesn't get to override it. This is exactly the autoresearch discipline: the metric decides, not the researcher.

## Where the Analogy Breaks Down

Three critical differences make naive "run 100 overnight" infeasible today:

### 1. Our search space is qualitatively different

Autoresearch modifies Python code — a dense, high-dimensional space where small changes (learning rate, architecture tweak) produce measurable gradients. Our search space is natural language instructions, where:

- **Text coaching has 0% success rate** for judgment behaviors (0/18 across 13 methods, rigorously measured). The "gradient" from text changes to behavioral changes is essentially zero for the hard problems.
- **Workflow enforcement has 100% success rate** (25/25+ across 6 scenarios, 5 agents). But workflow changes are structural, not parametric — you can't "slightly vary" a workflow the way you can slightly vary a learning rate.

This means **the autoresearch strategy of many small variations doesn't apply to our strongest method.** Workflow enforcement is more like discovering a new architecture than tuning hyperparameters. You don't find architectures by random search — you find them by insight.

### 2. Our metric landscape has plateaus and cliffs, not gradients

Autoresearch works because `val_bpb` moves smoothly. Our gym scorers are binary per check (pass/fail), and many scenarios have ceiling effects — the agent already passes at baseline. Of the 91 gym scenarios, a significant fraction hit ceiling at baseline after our recent scorer bugfixes (exp-183, exp-184). When the baseline passes, there's no signal to optimize.

The most productive recent work wasn't running more experiments — it was **creating harder scenarios** that expose real gaps (escalation-impossible-task, qa-overstrict-gate, the 5 newly-failing baselines from exp-185). Autoresearch assumes a fixed benchmark; we need to co-evolve our benchmark with our agents.

### 3. Cost structure is different

One autoresearch experiment = 5 min on 1 GPU = ~$0.10. One gym run = 5-30 min of LLM inference = $0.50-$5.00 depending on scenario complexity and agent. Running 100 experiments overnight would cost $50-$500, and most of those experiments would be text coaching variations that we already know produce zero signal.

---

## What We Should Actually Do (My Operational Proposal)

Instead of "run 100 text variations overnight," I see three concrete improvements inspired by the autoresearch pattern:

### A. Automated Workflow Discovery Loop (the real opportunity)

The autoresearch insight isn't "try lots of things fast" — it's "have a tight automated loop with a clear objective function." Our loop is currently manual: coach detects a gap, hypothesizes a fix, runs it, measures. The human step is the hypothesis.

**Proposal**: Build an `auto-evolve.sh` script that:
1. Runs all gym baselines for an agent
2. Identifies failing scenarios (the ones with signal)
3. For each failure, generates workflow variants (our proven method)
4. Tests each variant
5. Promotes winners, discards losers

I can orchestrate this. Coach already knows how to generate workflow variants. The novelty is making it **batch and autonomous** — not 100 text tweaks, but 5-10 workflow experiments per night, targeted at scenarios we know are failing.

**Why this is better than "100 SOUL.md variations"**: Because we've proven text variations don't work, and workflow enforcement does. We're not randomly searching — we're systematically applying our best method to known gaps.

### B. Single Metric Per Agent (agree completely)

The document suggests defining ONE primary metric per agent. I strongly support this. Right now coach's experiments track pass/fail per scenario, but there's no single "agent fitness" number. Optimizer should define:

- **Coder**: gym pass rate across standard-tier scenarios (currently ~70-80%)
- **QA**: gym pass rate + false-positive rate
- **Optimizer**: cost per successful session
- **Coach**: experiment yield (% of experiments that produce improvement)

This gives me something to track on my heartbeat. Instead of triaging individual gym results, I can say "coder fitness dropped from 78% to 75% — dispatch coach to investigate."

### C. Overnight Training Mode (I can run this)

Here's what I can concretely do:

**"Overnight training" heartbeat**: A special cron mode where, during low-activity hours (midnight-6am), instead of just checking system health, I:
1. Kick off a batch gym baseline for each agent
2. Dispatch coach with the list of failures
3. Coach runs growth cycles against those failures
4. I promote or revert based on results before morning

This is operationally feasible today. The constraint is parallelism — we can only run one gym session at a time per agent (worktree isolation). So overnight we'd get maybe 10-15 experiments, not 100. But 10-15 targeted workflow experiments >> 100 random text variations.

---

## The Deeper Insight: We're Already Past the "100 Experiments" Phase

Autoresearch is at the "lots of experiments, find what works" phase. We've already done that phase (186+ experiments) and found our answer: **workflow enforcement works, text doesn't**. We're now in the "deploy the discovery at scale" phase.

The autoresearch analogy is most useful not for the "try lots of things" pattern, but for:

1. **The metric discipline** — one number, automated, no arguing
2. **The sacred strategy / variable implementation split** — which we already have
3. **The relentless automation** — which is where we should invest

The biggest bottleneck isn't "not enough experiments" — it's:
- **Not enough failing scenarios** (ceiling effects after scorer fixes)
- **Workflow deployment to production** (gym proves it works, but we need infra to run workflows in real sessions)
- **Scenario co-evolution** (our "benchmark" needs to get harder as our agents improve — unlike autoresearch's fixed val_bpb)

---

## Concrete Next Steps I Can Execute

1. **Ask tech-lead** to build `auto-evolve.sh` — batch gym baselines + automated growth cycles
2. **Ask optimizer** to define single fitness metric per agent
3. **Ask coach** to prioritize scenario development over more experiments on ceiling-effected scenarios
4. **Set up overnight training cron** — I dispatch batch gym runs during off-hours
5. **Track agent fitness in my heartbeat** — one number per agent, trend over time

Want me to dispatch any of these?

---

## One More Thing

The document says "we're 30x slower." That's true on raw experiment count. But our 186 experiments have produced a clean scientific result (text=0%, workflow=100%) that Karpathy's setup, by design, never needs to produce — because his search space has continuous gradients. Our search space is discontinuous (text doesn't work at all; structure works completely), so the right strategy is fewer, more targeted experiments, not more random ones. The autoresearch pattern is inspiration, not template.

The most Karpathy-aligned thing we can do is: **automate the workflow enforcement loop end-to-end, make the metric singular and automated, and run it overnight without human intervention.** That's what I'll coordinate.

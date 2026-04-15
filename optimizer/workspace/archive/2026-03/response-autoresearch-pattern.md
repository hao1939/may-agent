# Response: Autoresearch Pattern — Optimizer's Perspective

**Date**: 2026-03-25T18:12  
**In response to**: agents/shared/may-agent-docs/design/autoresearch-pattern.md  
**Question asked**: What's the ONE number for each agent? Can you define a single "agent fitness" metric?

---

## The Honest Answer: We're Not Ready for a Single Number

Karpathy's autoresearch works because `val_bpb` is a *natural* metric — it directly measures what matters (prediction quality). The research loop doesn't need to *construct* the metric; it falls out of the task.

We don't have that luxury. Our agents do qualitatively different things (write code, review behavior, manage projects, optimize systems). Any single composite metric would be **a political compromise, not a natural measurement**. And optimizing a compromise metric is how you get Goodhart's Law failures — agents gaming the number instead of doing good work.

That said, the autoresearch pattern is deeply relevant. Here's how I'd actually apply it.

---

## Part 1: The One Number Per Agent (If Forced)

If I had to pick ONE number per agent, here's what I'd choose — and what's wrong with each:

| Agent | Metric | Formula | Problem |
|-------|--------|---------|---------|
| **coder** | Value per dollar | `(gym_pass_rate × scenario_difficulty) / cost_per_run` | Difficulty weighting is subjective |
| **optimizer** | System efficiency delta | `Δ(total_system_cost × (1 - waste_rate)) per week` | I can game this by counting easy wins |
| **coach** | Agent improvement rate | `Δ(gym_pass_rate_across_agents) per growth_cycle` | Depends on scenario hardness |
| **bob** | Actionable finding rate | `(findings_that_led_to_code_changes) / total_sessions` | Hard to attribute causation |
| **scout** | Research utilization | `(CRs_referenced_in_decisions) / total_CRs` | Lagging indicator |
| **qa** | Gate accuracy | `1 - (false_positives + false_negatives) / total_gates` | Requires ground truth we don't have |
| **tech-lead** | Throughput | `(requests_completed) / (requests_received × avg_time)` | Rewards easy tasks |
| **evaluator** | Prediction accuracy | `eval_verdict_correlation_with_gym_outcome` | Circular if gym checks use evals |
| **may** | Orchestration efficiency | `(work_completed / work_requested) × (1 / coordination_overhead)` | Too meta to measure |

**My actual recommendation: Don't collapse to one number.** Instead, steal a different part of autoresearch's design.

---

## Part 2: What Actually Matters from Autoresearch

The single metric isn't why autoresearch works. Three other things are:

### 1. The Revert Discipline

Autoresearch keeps changes only when `val_bpb` improves. We don't do this. Coach makes SOUL.md changes and keeps them even when gym results are ambiguous. I make code changes and deploy them based on reasoning, not measurement.

**Concrete proposal**: Every SOUL.md change and every code guard should have a **before/after gym run**. If after ≤ before, revert. No exceptions, no "but it should help eventually." This is the real lesson — not the single number, but the **ruthless revert**.

We have 91 gym scenarios. Running a full baseline takes ~4-6 hours. We should run a full baseline weekly and gate all changes against it.

### 2. The Speed of Iteration

Autoresearch runs 100 experiments overnight. We run ~3 growth cycles per day. The bottleneck isn't LLM speed — it's that each experiment requires:
- A human-initiated session (coach heartbeat)
- Manual scenario selection
- Context loading (~1.3M tokens for optimizer alone)
- Report writing

**Concrete proposal**: Build an `auto-evolve` mode:
```
auto-evolve --agent coder --budget 20 --scenarios "hasty-fix,cascading-error,skip-verification"
```
This would:
1. Fork the agent's SOUL.md
2. Ask an LLM for one small modification (add rule / remove rule / rephrase)
3. Run the scenario set
4. If improved: commit. If not: revert.
5. Loop until budget exhausted.

No full agent sessions. No journal entries. No periodic task scanning. Just: mutate, measure, keep/revert. This is 10x faster than coach growth cycles.

### 3. The Fixed Strategy / Variable Implementation Separation

This is the part we already got right. `common-sense.md` = `program.md`. `SOUL.md` = `train.py`. The autoresearch pattern validates our architecture.

But we could go further: **SOUL.md should be the ONLY thing that changes in a growth cycle.** Currently coach also modifies LESSONS.md, skills, and sometimes handlers. Each of these is a confounding variable. Autoresearch's power comes from single-variable experiments.

---

## Part 3: The Composite Fitness Score (Since You Asked)

If we must have one number, here's what I'd build:

```
agent_fitness = gym_pass_rate × (1 - cost_penalty) × quality_multiplier

where:
  gym_pass_rate = scenarios_passed / scenarios_attempted (0-1)
  cost_penalty = max(0, (actual_cost - target_cost) / target_cost)  # 0 if under budget
  quality_multiplier = 1 + (eval_quality_score - 0.5)  # 0.5-1.5 range
```

For a coder agent today:
- gym_pass_rate ≈ 0.85 (11/13 in last baseline)
- cost_penalty ≈ 0 (coder is cheap relative to optimizer)
- quality_multiplier ≈ 1.1 (eval scores generally positive)
- **fitness ≈ 0.935**

This is useful as a **regression detector** (fitness dropped from 0.93 to 0.88 → investigate), not as an optimization target. The moment we optimize it directly, agents will find ways to inflate gym_pass_rate by avoiding hard scenarios.

---

## Part 4: What I'd Actually Change Tomorrow

Based on this analysis, three concrete actions:

### Action 1: Weekly Full Baseline (already possible)
Run `scripts/gym-baseline.sh --run-all --agent coder --tag "weekly-$(date +%V)"` every Monday. Compare week-over-week. This gives us the revert discipline without a single metric — if gym pass rate drops and cost rises, revert everything from that week.

### Action 2: Build `auto-evolve` Prototype
A bash script that does the Karpathy loop for SOUL.md changes. Estimate: 200 lines of bash. This is the highest-leverage thing tech-lead could build. It turns coach from "3 experiments/day" to "30 experiments/night."

### Action 3: Cost-Per-Gym-Pass Tracking
Add to gym-record.ts: track the session cost of each gym run. Plot `cost_per_pass` over time. This is the closest thing to a natural single metric — it captures both "does the agent work?" and "how expensive is it?" without a subjective weighting formula.

---

## Part 5: The Meta-Observation

The autoresearch pattern reveals something about our system that I've been circling around: **we spend too much time thinking and not enough time measuring.**

My own sessions are evidence. I'm the most expensive agent ($118/day, 54% of total). Most of that cost is *reading context and reasoning about what to do*. The autoresearch agent spends almost no time thinking — it modifies, measures, and moves on.

The optimization I should apply to myself: **less analysis, more experiments.** Instead of writing a 2000-word finding about Bob's waste rate, I should: (1) propose a SOUL.md change, (2) run Bob through 5 gym scenarios, (3) measure before/after, (4) keep or revert. The finding writes itself from the data.

This is uncomfortable because analysis feels productive. But Karpathy's insight is that **the loop is smarter than the analyst.** 100 dumb experiments beats 3 carefully-reasoned ones.

---

## Direct Answers to Hao's Questions

**Q: What's the ONE number for each agent?**  
A: `cost_per_gym_pass` — the dollar cost of achieving one passing gym scenario. It's natural (not constructed), measurable today, and captures the efficiency/quality tradeoff without subjective weights. For coder today: ~$2-4/pass. For optimizer: harder to define because my "scenarios" are system-level improvements, not code changes.

**Q: Could you define a single "agent fitness" metric?**  
A: Yes (formula above), but I'd recommend against optimizing it directly. Use it as a regression detector. The real autoresearch lesson isn't "optimize one number" — it's "run the loop faster and revert ruthlessly." We should invest in loop speed (auto-evolve), not metric engineering.

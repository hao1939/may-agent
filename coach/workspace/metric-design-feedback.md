# Coach — Metric Design Feedback

## 1. When would I override each metric's signal?

**`coach.quality-improvement` flat or declining:**
- Override: Right after deploying a new skill that targets a specific failure mode. Quality scores are lagging indicators — a skill deployed yesterday won't show up in the average for days. Also, if I just pruned a bad skill, average might dip temporarily as agents lose a crutch they were leaning on before finding the better path.
- Override: During an experiment-heavy phase. I'm deliberately running controlled trials in the gym, not deploying to production. The metric will look stagnant but I'm building evidence for a bigger move.

**`coach.skill-effectiveness` low:**
- Override: When I've recently promoted skills targeting rare failure modes. A skill that prevents a catastrophic-but-infrequent error (e.g., "don't commit with nothing staged") might fire rarely, making its measured impact look small. The value is in the tail, not the average.
- Override: When I'm running dose-response experiments (like EXP-168). I'm deliberately testing partial interventions that I expect to fail, to map the effectiveness curve. Low skill-effectiveness during experimentation is signal that the experiment is working, not that I'm failing.

**`coach.gym-discrimination` low:**
- Override: After a round of agent improvements. If agents got better, scenarios that used to discriminate now hit ceiling. That's a *success* — I need to create harder scenarios, but the low discrimination reflects progress, not a problem with my scenarios.

## 2. Are these the right metrics?

**What's right:** `skill-effectiveness` is the most important one. It directly measures whether my core activity (training) works. This is where I should grow — toward more rigorous evidence for every intervention.

**What's wrong/missing:**

- **`quality-improvement` is too vague.** "Avg quality score trend across trained agents" — quality of what? Evaluated by whom? If it's evaluator scores, those have their own calibration issues. This metric conflates my training effectiveness with evaluator consistency. I'd rather see something like `coach.intervention-hit-rate`: % of deployed interventions where the target failure mode decreased in frequency post-deployment.

- **`gym-discrimination` measures scenario quality, not coach quality.** It's useful housekeeping but doesn't tell me if I'm growing. I'd replace it with something like `coach.knowledge-to-action-latency`: how quickly experimental findings (KE entries) lead to deployed interventions. My biggest growth area is closing the loop from "I learned something" to "agents behave differently." Right now I have KE entries that are months old with no corresponding skill change.

- **Missing: experiment throughput/completion.** Bob has `experiment-completion` — I should too. I run experiments (EXP-156, 165, 168, 170...) and they sometimes stall for days. A metric tracking experiment velocity would signal when I'm stuck in analysis paralysis vs. actually running trials.

## 3. How would I use these in my heartbeat?

Not as a dashboard to chase. Here's the actual flow:

1. **Weekly glance** (not daily — these are slow-moving signals): Read all three metrics. Note direction, not absolute value.
2. **Combine with what I know:** If `skill-effectiveness` dipped, check: did I recently promote something? Is there a known regression? What does the gym regression check say? The metric tells me *where* to look, my experiment history tells me *why*.
3. **Decide based on phase:** If I'm in an experiment phase (designing/running trials), I mostly ignore `quality-improvement` — it's not the right signal right now. If I'm in a deployment phase (promoting skills), I watch it closely.
4. **One action per heartbeat, not three.** The metrics might surface three concerns. I pick the one that matters most given my current work and ignore the rest. Chasing all three metrics simultaneously is exactly how you get thrashing.

## 4. What would I do if optimizer's `quality-preserved` was dropping?

This is the tension pair in action. If optimizer ships an efficiency improvement and quality drops:

1. **First: verify it's real.** Check if the quality drop correlates temporally with the optimizer's change. Could be coincidence (new scenario types, evaluator drift, etc.).
2. **If real: diagnose mechanism.** Is the optimization removing thinking time agents need? Skipping a step that looked wasteful but was actually load-bearing? The specific mechanism determines the response.
3. **Flag with evidence, not alarm.** I'd write a specific finding: "After optimizer deployed X, failure mode Y increased from 5% to 15% in the last N sessions. Here's the causal chain: [specific]." Not "quality is down, revert everything."
4. **Propose a joint solution.** Maybe the optimization is good but needs a guardrail. Or maybe the skill I deployed was compensating for a deeper problem that the optimization exposed. The right answer might be: keep the optimization, fix the root cause.

What I would NOT do: unilaterally add a heavy skill to compensate for the optimization's side effects. That's the stacking anti-pattern (KE-123) and it would make both our metrics look okay while the system gets worse.

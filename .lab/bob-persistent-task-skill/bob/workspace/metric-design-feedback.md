# Metric Design Feedback — Bob

## Q1: When would I override the signal?

**`bob.hypotheses-resolved`** — If I've recently opened 5 new hypotheses from a productive research burst, the % resolved will drop sharply. Judgment: that's exploration working as intended. I wouldn't rush to close hypotheses just to fix the ratio. I'd override until the new batch has had time to mature (1-2 weeks).

**`bob.designs-implemented`** — If I've written designs for capabilities we need in 2 months but not today, implementation rate will be low. Judgment: forward-looking design is part of the job. I'd override this when I know the designs are deliberately ahead of the build queue. Also: some designs are meant to be rejected — writing a design that tech-lead pushes back on and we abandon is the system working, not a failure.

**`bob.experiment-completion`** — If I paused an experiment because early results made it clear the hypothesis was wrong, that's efficient, not incomplete. I'd override when abandonment was a judgment call, not neglect.

## Q2: Are these the right metrics?

Mostly yes. The "close the loop" framing is correct — my biggest risk is producing ideas that never touch reality.

**What's missing:** There's no signal for *research quality* — whether my hypotheses are interesting/novel vs. obvious. I could resolve 100% of hypotheses by only generating trivial ones. A metric like "hypotheses that changed how we build something" would be better than raw resolution rate, but it's hard to measure.

**What's slightly wrong:** `bob.designs-implemented` creates a subtle incentive to only design small, easy things that tech-lead can quickly build. The most valuable designs might be the ambitious ones that take weeks to implement. The metric doesn't distinguish "not implemented because it's bad" from "not implemented yet because it's big." Maybe a time-windowed version (implemented within 30 days) would help, but honestly I think judgment handles this fine — I just need to be aware of the pull toward small designs.

**`bob.experiment-completion`** is the most useful of the three. Unfinished experiments are genuinely my biggest waste pattern. This one I'd actually act on regularly.

## Q3: How would I use these in my heartbeat?

I wouldn't query them every heartbeat — maybe weekly or when choosing what to work on next. The usage:

1. **Glance at experiment-completion** — if I have >2 experiments started but not concluded, that's my top priority before starting anything new. This is the "close the loop" signal.
2. **Check hypotheses-resolved quarterly** — this is a slow-moving metric. Monthly at most. If it's trending down, I ask: am I generating too many hypotheses and not testing them? Or am I in a healthy exploration phase?
3. **Ignore designs-implemented day-to-day** — this depends on tech-lead's bandwidth, not my effort. I'd look at it when planning what to design next: if the backlog is huge, maybe I should help implement rather than design more.

The overall pattern: use experiment-completion as a frequent hygiene check, the others as periodic strategic signals.

## Q4: What if tech-lead's codebase-weight is growing?

First question: *is it growing because of my designs?* If I proposed something that added 500 LOC, I should look at whether that complexity was justified by the capability gained.

Concrete actions:
- **Design smaller.** Break ambitious designs into phases where each phase ships value and can be measured before building the next.
- **Design for removal.** When I propose new capabilities, explicitly identify what existing code they could replace. Make "net-zero LOC" a design constraint when possible.
- **Pause new designs.** If codebase-weight is trending up and tech-lead is drowning in implementation, the best thing I can do is stop adding to the queue and help simplify what exists — review code for dead paths, identify consolidation opportunities, or write designs specifically targeted at reducing weight.

The tension pair works here: tech-lead's pain should constrain my ambition, and that's healthy.

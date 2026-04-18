# Tech-lead Metric Design Feedback

## Q1: When would I override the signal?

**`tech-lead.build-health`** — TSC fails because someone added an experimental branch with type errors that hasn't been cleaned up yet. Judgment: "This is a known WIP, not a regression. I'll clean it when the feature stabilizes, not drop everything now."

**`tech-lead.features-shipped`** — Zero features shipped this week. Judgment: "I spent the week on a critical refactor that removed 400 LOC and simplified 3 subsystems. No features shipped but the system got meaningfully better. Shipping will accelerate next week because of this work."

**`tech-lead.codebase-weight`** — LOC went up by 300. Judgment: "We added the metric system itself — new capability that didn't exist before. Net complexity didn't increase because the code is well-factored. I'll look for offsetting removals but won't panic about this."

## Q2: Are these the right metrics?

**`build-health`** — Yes but it's table stakes, not growth. TSC passing is a hygiene floor. It doesn't push me anywhere. It's fine as a health check but it's not a growth signal.

**`features-shipped`** — This is the weakest metric. "Features merged to main per week" incentivizes small PRs over impactful work. A week spent on one important refactor looks worse than a week shipping 3 trivial config changes. **What's missing: impact signal.** I'd rather track "meaningful system changes" — refactors, simplifications, and capability additions all count, not just "features."

**`codebase-weight`** — This is the best one. It directly encodes the SOUL principle "system should get smaller and simpler." LOC is crude but directionally correct. It creates genuine tension with shipping features — forces me to find ways to add capability while removing code. Good growth signal.

**What's missing:** Something about **delegation quality**. Most of my work goes through coder. How well I scope tasks, how often coder succeeds first-pass, how clear my specs are — that's where I actually grow. Something like "coder first-pass rate on tasks I delegate" would push me to write better specs.

## Q3: How would I use these in my heartbeat?

I'd glance at all three at the start of a heartbeat cycle. Not to chase the worst number — to build a picture:

- Build health red? → Fix it immediately, it blocks everything else.
- Features shipped low + codebase weight flat? → I'm probably stuck in investigation loops. Time to ship something concrete.
- Features shipped high + codebase weight growing? → I'm shipping but not simplifying. Next cycle should include a cleanup pass.
- Features shipped low + codebase weight declining? → Good — I'm in a simplification phase. That's fine if it doesn't last more than 2-3 cycles.

The key judgment: **which metric matters THIS cycle depends on what happened last cycle.** After a shipping sprint, I should lean toward simplification. After a refactor week, I should lean toward delivery. The metrics tell me where I am; my context tells me where to go.

## Q4: What if Bob's metrics were suffering?

My tension pair partner is Bob. If `bob.designs-implemented` is low:

- **First check: is it my fault?** Am I sitting on buildable designs and not implementing them? If so, I should prioritize Bob's designs in my next feature cycle.
- **Second check: are the designs buildable?** If Bob's designs are too abstract or too complex, that's feedback I should give directly — "this design needs X to be implementable." Low implementation rate might mean I need to push back earlier and more specifically, not just ignore designs.
- **Third check: is it nobody's fault?** Maybe we're in a phase where the system needs stabilization, not new designs. In that case, Bob should know so he can adjust what he's designing (e.g., simplification designs rather than new capability designs).

If `bob.hypotheses-resolved` is low — Bob is opening investigations without closing them. I can help by volunteering to run quick experiments or build POCs that resolve hypotheses faster. Sometimes a design question is best answered by writing 50 lines of code, not more analysis.

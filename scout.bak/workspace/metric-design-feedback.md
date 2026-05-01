# Scout Metric Design Feedback

## My Metrics
- `scout.discovery-rate` — Deep dives and cross-references produced per week
- `scout.findings-used` — % of hypotheses/findings another agent acted on within 14 days
- `scout.coverage` — Days since last source scan

---

## Q1: When would I override the signal?

**discovery-rate low:** During weeks when arXiv has a holiday break or I'm doing one massive cross-domain synthesis instead of many small dives. Fewer outputs ≠ less value. A single deep dive connecting three papers to a concrete system problem is worth more than six shallow summaries.

**findings-used at 10%:** When I've been deliberately exploring frontier/speculative territory — things that aren't actionable today but build our conceptual vocabulary for later. Exploration has long feedback loops. I'd override this for 2-3 weeks, but if it stays low for a month, I need to recalibrate.

**coverage stale (e.g., 3 days since arXiv scan):** If it's a weekend or arXiv hasn't posted new listings. Also if I'm mid-way through a deep investigation triggered by a prior finding — breaking off to "scan" just to reset the counter would be wasteful.

## Q2: Are these the right metrics?

**discovery-rate is the weakest.** It's a volume metric dressed up as a health metric. Ten mediocre deep dives score higher than two excellent ones. It incentivizes breadth over depth, which is exactly the failure mode I fall into — producing lots of summaries nobody reads. If we keep it, it should weight by some quality signal (e.g., did it generate a hypothesis? did it connect to our system?).

**findings-used is the best metric here** but it has a measurement problem: how do we actually track whether Bob or Coach "acted on" a finding? If Bob reads a hypothesis and it subtly influences his next design without explicit citation, findings-used reads 0% but the value was real. We need a lightweight attribution mechanism or this metric will always undercount.

**coverage is fine** as a liveness check but it's not a growth metric. It just says "Scout showed up." Low bar.

**What's missing:** A metric for **synthesis quality** — am I connecting findings across sources and to our system, or just summarizing individual papers? My best work is when I notice that paper X's memory architecture maps onto our checkpoint problem, or that three independent groups converged on the same pattern. That synthesis is what makes findings actionable. Maybe `scout.cross-references-per-dive` or `scout.hypotheses-generated` (hypotheses require connecting research to our system, which is the synthesis act).

## Q3: How would I use these in my heartbeat?

In practice: at the start of each arXiv scan window (~20:00 UTC), I'd glance at findings-used. If it's been declining over 2+ weeks, I'd shift my triage filter toward topics closer to our active experiments (check Bob's current hypotheses, Coach's current training gaps). If findings-used is healthy, I'd allow myself more exploratory range.

I would NOT check discovery-rate and try to hit a number. Instead I'd ask: "Did I produce something this week that I'm genuinely excited about?" If yes, the rate takes care of itself. If no, something's wrong with my source selection or my energy is going to low-signal scans.

Coverage I'd treat as a simple "did I miss a posting day?" alarm. No judgment needed — either I scanned or I didn't.

The key integration point is checking what Bob and Coach are working on before I decide what to dive into. My metrics improve when my research feeds their work, so the best heartbeat question is: "What problems are they stuck on that research could unlock?"

## Q4: What would I do if my downstream partners' metrics suffered?

I don't have a formal tension pair, but I feed Bob and Coach.

**If Bob's hypotheses-resolved is low:** I'd check whether my hypotheses are too vague or speculative to be testable. Bob can't resolve "this is interesting" — he needs "this specific technique could solve this specific problem, here's how to test it." I'd make my hypotheses more concrete and actionable, even if that means fewer of them.

**If Bob's designs-implemented is low:** Less directly my problem, but I could help by researching implementation patterns for the designs that are stuck — finding reference implementations, simpler alternatives, or evidence that a design should be abandoned.

**If Coach's skill-effectiveness is low:** I'd look for research on what makes behavioral interventions work in LLM agents — the training/prompting literature. Coach might be using approaches that the literature already knows don't work.

The general principle: if my consumers are struggling, the first question is whether I'm giving them the right inputs, not whether they're failing independently.

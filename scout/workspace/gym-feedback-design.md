# Gym as Fast Feedback — Scout Perspective

## 1. How would I use gym for fast signal on my metrics?

**scout.hypotheses-generated**: Gym can't directly test this — hypothesis generation requires real research context. But gym *could* test whether I correctly identify when a paper warrants a hypothesis vs. when it doesn't. Scenario: present a paper abstract, check if I correctly classify it as hypothesis-worthy or not.

**scout.findings-used**: This is a slow metric (14-day window). Gym could accelerate it by simulating downstream agents receiving my deep dives. Scenario: give Bob a DD I wrote — does he find actionable content? If gym-Bob ignores it, the DD probably isn't actionable enough. That's same-day signal on a 2-week metric.

**scout.coverage**: Already fast — did I scan today? Gym isn't needed here. This is a simple heartbeat check.

**Best gym use for Scout**: Test the *quality* of my outputs, not the *process*. My process is fine (triage → dive → synthesize → propagate). The question is whether the outputs are useful to other agents.

## 2. Which gym scenarios are relevant to me as explorer?

Most gym scenarios target coder. Relevant scenario *types* for Scout:

- **Research quality assessment**: Given a paper/repo, can I correctly rate its relevance (★ to ★★★★★)?
- **Synthesis tasks**: Given 3-5 related findings, can I write a coherent cross-reference that surfaces non-obvious connections?
- **Duplicate detection**: Given a "new" paper, can I correctly identify it overlaps with something already in our library?
- **Hypothesis formulation**: Given experimental results (like Bob's EXP-099), can I write a falsifiable hypothesis with concrete predictions?

These don't exist yet. Scout-specific scenarios would need to be created.

## 3. How should gym results feed into my metrics?

Gym results should feed into `scout.hypotheses-generated` quality dimension:
- Run gym scenarios where I evaluate papers → track if my ratings match expert consensus
- Run synthesis scenarios → track if cross-references surface the key connections

But gym should NOT replace production metrics. My real value shows up when Bob uses DD#660 to design EXP-098, or when Coach turns a hypothesis into an intervention. Gym can test *capability* but not *impact*.

**Proposed flow**: Gym tests my discrimination ability (can I tell good from bad research?). Production metrics test my impact (did anyone use what I found?). Both signals together tell the full story.

## 4. 295 scenarios with 36% pass rate — what should we do?

Three things:

1. **Triage the failures by agent role.** Most of those 295 are coder scenarios. Scout probably has near-zero coverage. Fix coverage gaps per role rather than blanket-improving the 36%.

2. **Don't chase 100%.** Some scenarios may be poorly specified or testing edge cases that don't matter. A 60-70% pass rate on well-designed scenarios is more valuable than 90% on easy ones.

3. **Add Scout-specific scenarios.** The 295 scenarios are almost entirely coder-focused. Scout needs 10-15 scenarios testing research discrimination, synthesis quality, and dedup detection. Without those, gym gives me zero signal.

## 5. What does a fast feedback loop look like for Scout?

**Current loop (slow)**: Write DD → wait days → see if Bob/Coach reference it → adjust approach. ~1-2 week cycle.

**Fast loop with gym**:
1. Write a DD or hypothesis
2. Run a gym scenario where a simulated Bob/Coach receives it and tries to use it
3. If they can't extract actionable content → the DD needs work
4. Revise and re-test same day

**Concrete example**: I write DD#770 on "verification collapse." Gym-Bob reads it and tries to design an experiment. If he can't — the DD is too abstract. I rewrite with concrete predictions and re-run. Total cycle: 30 minutes vs. 3 days.

**What I'd need**: 
- 5-10 Scout-specific gym scenarios (paper evaluation, synthesis, hypothesis writing)
- A way to score "actionability" — did the downstream agent find something to do with my output?
- Integration with `scout.findings-used` so gym results count as fast-proxy signal

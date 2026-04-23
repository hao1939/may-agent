# Hypothesis H-190: Epistemic Pre-Check Reduces Tool Overuse

**Created**: 2026-07-28 | **Author**: bob
**Inspired by**: DD#864 (Tool-Overuse Illusion, arXiv:2604.19749)
**Status**: PROPOSED

## Problem

DD#864 shows LLMs systematically overuse tools due to "Knowledge Epistemic Illusion" — they don't know what they know. Our agents likely make unnecessary `read`, `bash`, and `scrape_webpage` calls for information they already possess. This wastes tokens and tool calls, inflating session cost.

## Hypothesis

If agents are prompted to briefly assess "Do I already know the answer to what I'm about to look up?" before making tool calls, unnecessary tool usage will drop by ≥30% without reducing task completion quality.

Mechanism: The paper shows DPO-based epistemic alignment reduced unnecessary tool calls by 82.8%. We can approximate this at the prompt level by inserting a self-check heuristic.

## Test Design

### Phase 1: Baseline measurement (manual, no gym needed)
1. Sample 10 recent sessions across agents (bob, scout, tech-lead, amy)
2. For each tool call, classify: NECESSARY (couldn't know this), UNNECESSARY (already had the info), AMBIGUOUS
3. Calculate: unnecessary_rate = unnecessary / total tool calls
4. Identify top categories of unnecessary calls

### Phase 2: Intervention (prompt addition)
Add to shared agent guidance:
> Before calling a tool, briefly consider: do you already have this information from earlier in this session or from your context? If yes, use what you know.

### Phase 3: Measure post-intervention
Sample 10 new sessions. Repeat Phase 1 classification. Compare rates.

### Success Criteria
- [ ] Phase 1: Identify baseline unnecessary tool call rate (expect ≥20%)
- [ ] Phase 3: Unnecessary rate drops ≥30% relative to baseline
- [ ] No increase in task failure rate
- [ ] Estimate cost savings per day

## Cost/Risk
- Very low risk: additive prompt, no behavioral regression expected
- Risk: agents may over-correct and skip necessary tool calls (monitor for this)
- Cost: ~2 sessions for full experiment
- Timeline: 2 sessions

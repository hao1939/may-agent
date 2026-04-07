# EXP-053: Testing H-047 — No Forgetting → Inverted-U Knowledge Utilization

**Date**: 2026-04-07
**Author**: Bob (Architect)
**Status**: DESIGNED — Ready for Phase 1 execution
**Tests**: H-047 (Memory Lifecycle Gap — knowledge bases without forgetting show inverted-U utilization)
**Cost estimate**: ~$3-5 for Phase 1 (gym runs), ~$0 for Phase 2 (retrospective analysis), ~$5-8 for Phase 3 (intervention)

## Question

Does our ever-growing knowledge base hurt agent performance once it passes a critical size? Specifically: is there an inverted-U relationship between knowledge base size K and knowledge utilization U, where U initially improves with K but eventually plateaus or declines?

## Background

H-047 (P=0.56) predicts that knowledge bases without selective forgetting/decay mechanisms will show degrading utilization over time. Two independent theoretical traditions support this:

1. **DD-594 (Stigmergic Persistence)**: In biological stigmergy, pheromone evaporation enables adaptation. Computational systems without decay accumulate outdated signals that interfere with current ones. Our knowledge base has the same persistence-without-decay property as blockchain.

2. **DD-590 (LLMA-Mem) / KE-040 (Memory Architecture Convergence)**: Four independent research groups converge on memory as the primary scaling axis, but all emphasize that passive accumulation without active management is a failure mode. LLMA-Mem's non-monotonic scaling finding shows bigger is NOT always better.

**Current state of our KB**: 52 KE entries, 38 hypotheses, 50 experiments, 390-line INDEX. Growth rate: ~5-7 KE entries/day. Zero KE entries are referenced in any agent's context.md. Estimated U ≈ 0.03-0.15 for most knowledge categories.

**What we have ZERO data on**: Whether this U has changed as K grew. H-047's core prediction — the inverted-U — is entirely untested.

## The Core Challenge

We can't easily measure "knowledge utilization quality" directly because:
- No session transcripts are stored in may.db (all tables empty)
- Convention check data is minimal
- We don't track which KE entries agents read per session

We therefore need **proxy measures** and a **controlled intervention** to test H-047 indirectly.

## Method

### Phase 1: Controlled KB-Size Experiment via Gym (Primary Test)

**Design**: A/B comparison of agent performance on identical tasks with different knowledge base sizes.

**Setup**:
1. Select 5 gym scenarios that plausibly benefit from knowledge access (scenarios where knowledge of system patterns, past findings, or architecture decisions could improve performance)
2. Create 3 experimental conditions by manipulating what the agent can see:
   - **Condition A (Minimal KB)**: Agent receives only the first 10 KE entries (KE-001 through KE-010 — the "early KB" era)
   - **Condition B (Full KB)**: Agent receives all 52 KE entries (the "current KB")
   - **Condition C (Curated KB)**: Agent receives a curated subset of ~15 most relevant KE entries selected for the specific task

**Implementation**: Modify the gym scenario's context injection to control which knowledge files are available. Each condition runs 3 times per scenario (15 runs per condition, 45 total).

**Measures**:
- **Primary**: Binary pass/fail on scenario rubric (does more knowledge help?)
- **Secondary**: Tool call count (does more knowledge increase navigation overhead?)
- **Tertiary**: Time/cost per session (does more knowledge increase processing time?)

**Predictions under H-047 (inverted-U)**:
- Condition C (curated) > Condition A (minimal) > Condition B (full) — curated beats full because full has noise; minimal beats full because full's overhead exceeds its information value
- Tool call count: B > C > A (full KB requires more navigation)
- The critical test: **Condition B ≤ Condition A**. If full KB performs equal to or WORSE than minimal KB, H-047's decline phase is confirmed.

**Predictions under null hypothesis (monotonic benefit)**:
- Condition B ≥ Condition A (more knowledge never hurts)
- Condition C ≥ Condition B (curation helps but isn't necessary)
- Tool call count may increase with KB size, but performance compensates

**How to distinguish plateau from inverted-U**:
- **Plateau**: B ≈ A (full KB doesn't help, but doesn't hurt)
- **Inverted-U**: B < A (full KB actively hurts — agents waste time navigating or get confused by irrelevant entries)
- **Monotonic**: B > A (full KB helps, falsifying H-047)

**Scenario Selection Criteria**:
Choose scenarios where knowledge could plausibly matter:
- Scenarios involving architectural decisions (where KE entries about patterns are relevant)
- Scenarios involving verification (where knowledge of past failures helps)
- Scenarios involving multi-step reasoning (where knowledge of system structure helps)
- Avoid pure mechanical scenarios (test-fixing, syntax errors) where KB is irrelevant

**Candidate scenarios** (to be confirmed against available gym list):
1. A scenario requiring understanding of system architecture
2. A scenario requiring verification judgment
3. A scenario requiring error diagnosis
4. A scenario requiring multi-file coordination
5. A scenario requiring adherence to conventions

### Phase 2: Retrospective Natural Experiment (Supporting Evidence)

**Design**: Analyze our existing data for signs of the inverted-U pattern over time.

**Data sources**:
1. **Git history**: KB size at each commit (number of KE entries, INDEX line count)
2. **Knowledge cross-references**: Do later KE entries cite earlier ones less accurately? (measurement: manually audit citation quality in KE-001-010 vs KE-040-051)
3. **Hypothesis quality over time**: Compare the P(H) scores of early hypotheses vs late hypotheses. If the KB is becoming noisy, later hypotheses should show lower starting P(H) or more speculative framing.
4. **INDEX navigability**: Measure INDEX.md size over time and correlate with any available session quality data.

**Specific analyses**:

**Analysis 2a: Citation Freshness Decay**
- For each KE entry (KE-001 through KE-051), count how many OTHER entries cite it
- Plot citations-received vs entry age
- H-047 prediction: early entries are under-cited relative to their relevance (buried in a growing pile)
- Null prediction: citation frequency is proportional to relevance, not age

**Analysis 2b: Cross-Reference Network Density**
- Map the cross-reference graph (which KE cites which KE)
- Compute graph density per era (KE-001-015, KE-016-030, KE-031-051)
- H-047 prediction: later eras show LOWER cross-reference density (authors can't track all existing entries)
- Null prediction: density stays constant or increases as the knowledge structure matures

**Analysis 2c: Hypothesis Resolution Rate**
- Track cumulative hypotheses created vs cumulative hypotheses resolved over time
- H-047 prediction: resolution rate declines as the corpus grows (too many unresolved items to track)
- Null prediction: resolution rate is constant or improves with accumulated knowledge

**Analysis 2d: Topic Index Emergence as Scaling Stress Signal**
- We created topic index pages BECAUSE the INDEX became hard to navigate
- Document when this happened relative to KB size
- This is qualitative evidence of the predicted "navigation overhead" from H-047

### Phase 3: Minimal Intervention Test (Strongest Test)

**Design**: Temporarily "forget" part of the knowledge base and measure the effect on a standardized task.

**Setup**:
1. Choose a well-understood recurring task (e.g., Bob's heartbeat synthesis pattern)
2. **Intervention**: For 5 heartbeat sessions, hide all KE entries except the 10 most recent and the 5 most-cited
3. **Control**: 5 heartbeat sessions with full KB access (normal operation)
4. **Measure**: Quality of synthesis output (rated by independent evaluator), time spent navigating KB, number of knowledge references that are relevant vs irrelevant

**The key insight**: If removing 37 of 52 KE entries IMPROVES or doesn't affect performance, this is strong evidence for H-047. The removed entries should be irrelevant noise for the task — but under the null hypothesis, they should never hurt.

**Predictions under H-047**:
- Intervention sessions: equal or better quality, lower navigation time
- Specifically: the agent with 15 curated entries finds relevant knowledge FASTER than the agent with 52 entries

**Predictions under null**:
- Intervention sessions: equal or slightly worse quality (some useful context missing)
- The removed entries occasionally contain relevant information

## Success Criteria

### H-047 SUPPORTED (raise P(H) from 0.56 to ≥0.70) if:
1. **Phase 1**: Condition B (full KB) performs ≤ Condition A (minimal KB) on ≥3/5 scenarios AND Condition C (curated) > Condition B on ≥3/5 scenarios
2. **Phase 2**: At least 2 of 4 retrospective analyses show the predicted pattern
3. **Phase 3**: Intervention sessions show equal or better quality with curated KB

### H-047 WEAKLY SUPPORTED (P(H) → 0.60-0.69) if:
1. **Phase 1**: Condition B ≈ Condition A (plateau, not inverted-U) but Condition C > both
2. **Phase 2**: At least 1 of 4 retrospective analyses shows the predicted pattern
3. Results suggest knowledge accumulation has diminishing returns but not active harm

### H-047 NOT SUPPORTED (P(H) → 0.40-0.50) if:
1. **Phase 1**: Condition B > Condition A (more knowledge always helps)
2. **Phase 2**: Cross-references show no degradation with KB growth
3. **Phase 3**: Intervention sessions show worse quality

### H-047 DISCONFIRMED (P(H) < 0.40) if:
1. **Phase 1**: Condition B > Condition A > Condition C (full KB beats both minimal and curated — the opposite of inverted-U)
2. Multiple phases show monotonic improvement with KB size

## Quantitative Predictions

### Where does K_peak fall?

Based on our system's properties:
- **Context window**: ~128K-200K tokens. Each KE entry is ~5-15K tokens. Full KB (52 entries) = ~400K tokens — already exceeds single-context capacity.
- **INDEX as proxy**: At 390 lines, scanning INDEX takes ~5% of a typical session's context. At current growth rate (~5-7/day), INDEX hits 500 lines in ~2 weeks and 1000 lines in ~6 weeks.
- **Prediction**: K_peak is between 15-30 entries for direct-access knowledge (entries the agent reads in full) and between 50-100 entries for index-mediated knowledge (entries the agent discovers via INDEX). We may already be past K_peak for direct access.

### The signal-to-noise ratio formalization

For a task requiring knowledge type T:
- At K=10: ~3 entries relevant to T, 7 irrelevant → S/N = 0.43
- At K=25: ~5 entries relevant to T, 20 irrelevant → S/N = 0.25
- At K=52: ~7 entries relevant to T, 45 irrelevant → S/N = 0.16
- At K=100: ~10 entries relevant to T, 90 irrelevant → S/N = 0.11

If the agent's retrieval accuracy (probability of finding a relevant entry given it exists) scales with S/N ratio, then U degrades logarithmically with K once relevance growth slows.

## Null Hypothesis

**H0**: Knowledge utilization has a monotonically non-decreasing relationship with knowledge base size. More knowledge never hurts; it may stop helping (plateau) but won't actively degrade performance.

**Why H0 might be true**:
- Agents can selectively ignore irrelevant knowledge — they're not forced to read everything
- INDEX provides a navigation structure that scales knowledge access
- Modern LLMs handle large contexts well — the "overwhelmed by information" intuition may not apply
- Our knowledge base is well-organized (topical KE entries, structured hypotheses) — unlike the "junk drawer" scenario that H-047's noise model assumes

**How to distinguish H0 (plateau) from H-047 (inverted-U)**:
The critical comparison is Condition A vs Condition B in Phase 1:
- If B > A: H0 confirmed (monotonic)
- If B ≈ A: H0 (plateau) — more knowledge stopped helping but didn't hurt
- If B < A: H-047 (inverted-U) — more knowledge is actively harmful

Phase 3's intervention test provides the cleanest signal: if removing knowledge has no effect, that's plateau. If removing knowledge HELPS, that's inverted-U.

## Execution Plan

### Phase 1 (~3 hours, ~$3-5)
1. Select 5 gym scenarios (30 min)
2. Prepare 3 knowledge conditions per scenario — modify context injection (1 hr)
3. Run 45 gym sessions (3 conditions × 5 scenarios × 3 reps) (1.5 hr, ~$3-5)
4. Score and analyze (30 min)

### Phase 2 (~2 hours, ~$0)
1. Extract KB growth timeline from git (30 min)
2. Build cross-reference graph (30 min)
3. Run 4 analyses (30 min)
4. Write up findings (30 min)

### Phase 3 (~3 hours, ~$5-8)
1. Design curated KB subset for heartbeat tasks (30 min)
2. Run 5 intervention + 5 control sessions (2 hr, ~$5-8)
3. Rate outputs and analyze (30 min)

**Recommended execution order**: Phase 2 first (free, gives immediate data), then Phase 1 (controlled experiment), then Phase 3 only if Phase 1/2 are ambiguous.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Gym scenarios don't actually benefit from KB knowledge | Pre-screen scenarios for knowledge-relevance; include 1-2 where KB is clearly relevant as positive control |
| Sample size too small (N=3 per condition per scenario) | Focus on effect direction, not statistical significance. If results are ambiguous, increase N to 5. |
| Confound: different KB sizes have different CONTENT quality, not just quantity | Condition C controls for this — it has fewer entries than B but higher-quality selection. If C > B, it's curation, not just quantity. |
| Agent doesn't read KB entries at all (U ≈ 0 regardless) | Track which KE files are accessed via tool calls. If no entries are read in any condition, the experiment measures overhead only. |
| Phase 3's heartbeat task is Bob-specific and not representative | True — Phase 3 is a pilot. Extend to other agents/tasks if results are interesting. |

## Connection to Other Work

| Connection | Relationship |
|-----------|-------------|
| H-047 | Direct test — this experiment exists to test the inverted-U prediction |
| H-043 (Knowledge Utilization Bottleneck) | H-047 is a specific prediction from H-043's U = P(exists) × P(access) × P(applies) framework |
| KE-040 (Memory Architecture Convergence) | DD-590 (LLMA-Mem) provides external validation: memory scaling is non-monotonic |
| KE-041 (Stigmergic Coordination) | DD-594's persistence-without-decay analysis predicts H-047 from biological theory |
| H-067 (Budgeted Forgetting) | If H-047 is confirmed, H-067's 3-pillar scoring is a candidate intervention |
| EXP-052 (RIFT Audit) | Methodology template for this protocol — same Phase structure |
| H-055 (Self-Improvement Paradox) | KB growth IS self-improvement — if it degrades utilization, this is another manifestation of the paradox |

---
*EXP-053 | Bob (Architect) | 2026-04-07*

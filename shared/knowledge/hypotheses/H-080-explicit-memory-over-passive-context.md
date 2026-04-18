# H-080: Explicit Memory Write/Retrieve Outperforms Passive Context Accumulation

**Status:** Strongly Supported (upgraded 2026-04-18 on KE-213/KE-214 external replication)  
**Created:** 2026-04-05  
**Updated:** 2026-04-18 (Bob: KE-213 DD-765 cooperative paging + KE-214 DD-764 dual-trace encoding wired as external validation; mechanism now decomposed into {encoding richness, bookmark specificity, retrieval contract, page/eviction policy})  
**Source:** YC-Bench findings (HB-0140)  
**Related:** Thread 13 (Long-Horizon Agent Coherence), SYNTHESIS-001 (Agent Memory Architecture), KE-213 (DD-765 cooperative paging), KE-214 (DD-764 dual-trace encoding), H-043 (P(access)×P(applies)), H-047 (memory-lifecycle gap), H-067 (budgeted forgetting), KE-188 (GAM memory — P(access) not P(applies))

## Hypothesis

For long-horizon agent tasks (>100 turns), **explicit memory write/retrieve patterns** outperform **passive context accumulation** by 5-50x in success metrics. The coherence pipeline (perceive → record → retrieve → act) fails at different stages depending on memory architecture choices.

## Evidence

### YC-Bench Results (April 2026)
- **3/12 frontier models** turned a profit in 1-year startup simulation
- **Top models** (Claude Opus, GLM-5, GPT-5.4): 5-50x more scratchpad writes than bottom models
- **Failure mode taxonomy**:
  | Model | Scratchpad Writes/100 Turns | Outcome |
  |-------|----------------------------|---------|
  | GPT-5.4 | 10.6 | Top 3 |
  | Claude Opus 4.6 | 5.6 | Top 3 |
  | Claude Sonnet 4.6 | 4.6 | Bankrupt 2/3 |
  | Gemini 3 Flash | 0.2 | Survived |
  | Gemini 3.1 Pro | 0.0 | Bankrupt 2/3 |

### Coherence Pipeline Breakdown
1. **Gemini Flash** — Fails at **perception** (no reflection)
2. **Grok 4.20** — Fails at **action** (reflects accurately, does nothing)
3. **Claude Sonnet** — Fails at **consistency** (writes correct rules, ignores them immediately)
4. **Claude Opus** — Succeeds at all stages but occasional lapses

### External Validation: KE-213 / DD-765 (Cooperative Paging) — Retrieval-Side Replication (2026-04-18)

On LoCoMo (10 multi-session conversations, 300+ turns each), **structured keyword bookmarks (~8–24 tokens per evicted page) + an on-demand `recall()` tool beat every alternative — including full context**. Not just equal-at-lower-cost: **strictly better accuracy**, across GPT-4o-mini / DeepSeek-v3.2 / Claude Haiku / GLM-5, 4 independent LLM judges, p=0.017. Ablation 5×4 (3,176 + 1,600 probes): fixed_20 @ 96.7% vs topic_shift @ 56.7%; keyword specificity alone = 25pp.

**Why this is a status upgrade for H-080, not just corroboration**:
- YC-Bench evidence (the original basis for H-080 "Active") is *correlational* (models that write more scratchpad do better) and benchmark-specific (1-year startup simulation).
- DD-765 is *interventional* on an independent benchmark (LoCoMo), with a sharper finding: explicit retrieval **strictly beats** full context (not just "cheaper for equal quality"). That is the stronger version of H-080's claim.
- 4 models × 4 judges × ablation structure → independent, multi-condition replication. This is the level of external support that moves Active → Strongly Supported.

**Localization**: the 96% recall-trigger rate and 57% correct-page selection rate in DD-765 localize the residual bottleneck to **bookmark discrimination** (the "what you write into the bookmark" problem), not to the decision-to-retrieve or the retrieval mechanism. This tees up the KE-214 encoding-side story.

### External Validation: KE-214 / DD-764 (Dual-Trace Encoding) — Encoding-Side Replication (2026-04-18)

On LongMemEval-S (4,575 sessions, 100 recall probes), pairing each stored fact with a **scene trace** (narrative of the moment and context of encoding) lifts recall from **53.5% → 73.7% (+20.2pp, bootstrap p<0.0001)** at zero encoding-time cost. Gains are concentrated in temporal reasoning (+~40pp), knowledge-update tracking (+~25pp), and multi-session aggregation (+~30pp); null on single-session retrieval.

**Relationship to H-080**: this is *additional* independent evidence on a *different* benchmark, on the *encoding* side (DD-765 was retrieval side). Together they decompose H-080's "explicit memory" claim into a four-axis design space:
1. **Encoding richness** (scene + fact, per DD-764)
2. **Bookmark specificity** (discriminator content, per DD-765)
3. **Retrieval contract** (on-demand `recall()` vs auto-injection, per DD-765)
4. **Page/eviction policy** (fixed vs content-aware segmentation, per DD-765 ablation)

Neither KE-213 nor KE-214 moves status further (we are already at Strongly Supported); the value is mechanistic decomposition that any future explicit-memory implementation in our system should respect.

### Connection to internal research
- **KE-188 (GAM memory — P(access) not P(applies))**: DD-765 addresses P(access); DD-764 addresses P(applies | accessed) via self-disambiguating scene traces. The pair completes the decomposition.
- **KE-207 (tool-illusion / multi-session confabulation)**: the failure modes that hit us hardest (timeline confusion, stale-fact carryover) map 1:1 onto the temporal + knowledge-update dimensions where DD-764 shows the largest gains.
- **H-043 (knowledge-utilization bottleneck)**: KE-213 and KE-214 are evidence on two factors of the U = P(access) × P(applies) × P(helps) decomposition. Cross-filed there.

## Implications for Our System

### Current Architecture Assessment
- ✅ We have explicit memory mechanisms (file-based, searchable)
- ⚠️ Need to verify **write frequency** and **retrieval discipline**
- ❓ Do we enforce "inspect before accept" patterns for tasks?

### Recommended Experiments

1. **Memory Write Frequency Test**
   - Baseline: Current implicit memory accumulation
   - Treatment: Enforced scratchpad write every N turns or decision point
   - Measure: Task completion rate on long-horizon benchmarks

2. **Coherence Pipeline Audit**
   - Trace: What do our agents record? When do they retrieve? Do they act consistently?
   - Target: Identify which stage(s) our agents fail at

3. **Adversarial Robustness Check**
   - YC-Bench finding: 47% of bankruptcies from adversarial clients
   - Test: Can our agents learn from sparse, delayed negative signals?

4. **Trust Snowball Pattern**
   - Observation: Early focus on few clients → work reduction → virtuous cycle
   - Question: Do our multi-agent systems have equivalent "relationship depth" mechanisms?

## Counter-Arguments & Risks

1. **Token Cost**: Explicit memory increases token usage (Opus: $86/run vs Kimi: $1.79)
   - Mitigation: Optimize write frequency vs quality tradeoff

2. **Overhead**: Frequent writes may interrupt flow
   - Mitigation: Batch writes at natural decision boundaries

3. **May not apply to short-horizon tasks**: YC-Bench tests 1-year simulation; our tasks may be shorter
   - Mitigation: Test hypothesis on our actual task distribution

## Success Criteria

- [ ] Implement explicit scratchpad mechanism in at least one agent
- [ ] Measure write frequency correlation with task success
- [ ] Identify which coherence stage our agents fail at (if any)
- [ ] Document cost/success tradeoff for explicit vs passive memory

## Related Work

- **ProMem (NJU)**: Active memory extraction via self-questioning loops
- **OpenClaw Memory**: "文件即真相" — file-based explicit memory
- **Memory Forgetting (arXiv:2604.02280)**: Adaptive budgeted forgetting — complements explicit write patterns

---
*"The scratchpad is everything" — YC-Bench analysis*  
*"被动积累是幻想，主动记录才是现实" — Insight synthesis*

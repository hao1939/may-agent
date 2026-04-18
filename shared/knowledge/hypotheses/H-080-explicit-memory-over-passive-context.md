# H-080: Explicit Memory Write/Retrieve Outperforms Passive Context Accumulation

**Status:** ARCHIVED — Resolved (no experiments run to validate)
**Created:** 2026-04-05  
**Source:** YC-Bench findings (HB-0140)  
**Related:** Thread 13 (Long-Horizon Agent Coherence), SYNTHESIS-001 (Agent Memory Architecture)

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

# H-033: Adaptive Reasoning Framework — DAST + TCA Fusion

**Status**: Active | **Date**: 2026-04-01 | **Source**: arXiv:2503.04472 + arXiv:2603.30031

## Hypothesis
Combine DAST's pre-estimated Token Length Budget (TLB) with TCA's marginal Value-of-Information (VOI) stopping boundary to create a two-phase adaptive reasoning framework. This could achieve 30%+ token reduction (DAST) while maintaining quality through physics-grounded stopping (TCA).

## Key Insights from Papers

### DAST (Difficulty-Adaptive Slow-Thinking)
- **Problem**: Reasoning models "overthink" — generate redundant steps for simple problems
- **Solution**: Token Length Budget (TLB) quantifies problem difficulty before reasoning
- **Mechanism**: Budget-aware reward shaping
  - Penalize overlong responses for simple tasks
  - Incentivize sufficient reasoning for complex tasks
- **Results**: 30%+ token reduction while preserving complex task accuracy

### TCA (Triadic Cognitive Architecture)
- **Problem**: ReAct loops suffer from "cognitive weightlessness"
- **Solution**: HJB-inspired stopping boundary based on marginal utility
- **Mechanism**: Stop when `max U(a) ≤ 0`, where `U(a) = ΔĤ(VOI) - α(λS + βT)`
- **Key insight**: Stop based on marginal information value, not fixed budgets

## The Fusion: Two-Phase Adaptive Reasoning

```
Phase 1: Pre-estimation (DAST)
  Input: User request
  ↓ TLB analysis
  Output: Initial difficulty estimate → Proportional budget allocation

Phase 2: Online adaptation (TCA)
  While within budget:
    ↓ Execute reasoning step
    ↓ Compute marginal VOI of next step
    ↓ Compare to spatio-temporal cost
    If marginal VOI ≤ cost: STOP (early exit)
    If budget exhausted but VOI > cost: EXTEND
```

### Why This Combination Works

| Phase | DAST Only | TCA Only | DAST + TCA |
|-------|-----------|----------|------------|
| Pre-estimation | ✅ TLB sets initial budget | ❌ No pre-estimation | ✅ Reasonable starting point |
| Early stopping | ❌ Fixed budget | ✅ VOI-based | ✅ Both mechanisms available |
| Budget extension | ❌ Hard limit | ❌ No upper bound | ✅ Evidence-based extension |
| Quality guarantee | ⚠️ May cut off complex reasoning | ✅ Quality-aware stopping | ✅ Best of both |

## Relevance to Our System

### Current L4 Implementation (assumed)
```python
# Fixed configuration
MAX_REASONING_STEPS = 10
MAX_TOKENS = 4000

for step in range(MAX_REASONING_STEPS):
    # ... reasoning logic
    if token_count > MAX_TOKENS:
        break
```

### Proposed Adaptive Implementation
```python
class AdaptiveReasoner:
    def __init__(self):
        self.tlb_estimator = TLBEstimator()  # From DAST
        self.voi_calculator = VOICalculator()  # From TCA
        
    async def reason(self, request: str, context: Context) -> Result:
        # Phase 1: DAST pre-estimation
        difficulty = await self.tlb_estimator.estimate(request, context)
        initial_budget = self.allocate_budget(difficulty)
        
        # Phase 2: TCA online adaptation
        cumulative_voi = 0.0
        step = 0
        
        while step < initial_budget.hard_limit:
            action = await self.plan_next_action()
            
            # TCA stopping criterion
            marginal_voi = await self.voi_calculator.estimate(action)
            cost = self.spatiotemporal_cost(action)
            net_utility = marginal_voi - cost
            
            if net_utility <= 0:
                # Stopping boundary reached
                if cumulative_voi < initial_budget.minimum_voi:
                    # DAST: Below minimum quality, extend budget
                    initial_budget = self.extend_budget(evidence=cumulative_voi)
                    continue
                break
                
            cumulative_voi += marginal_voi
            step += 1
            
        return Result(steps=step, voi=cumulative_voi)
```

## Open Questions

1. **TLB Estimation**: How to estimate difficulty without domain-specific training?
   - Options: Heuristic features, few-shot prompt, lightweight classifier
   
2. **VOI Computation**: How to estimate information value for general tool use?
   - Options: Belief change prediction, uncertainty reduction, task progress metrics
   
3. **Cost Calibration**: What are spatio-temporal costs in our environment?
   - Latency budget, API costs, user patience, concurrent load

4. **Integration Point**: Which layer implements this?
   - L3 Planner (higher-level, cross-skill coordination)
   - L4 Reasoning (lower-level, single-skill execution)
   - Both (hierarchical: L3 sets initial budget, L4 adapts within)

## Testing Strategy

```python
# A/B test framework
async def evaluate_adaptive_vs_fixed():
    test_cases = load_reasoning_benchmark()  # e.g., math, coding, planning
    
    results = {
        'fixed': {'tokens': [], 'accuracy': [], 'time': []},
        'adaptive': {'tokens': [], 'accuracy': [], 'time': []}
    }
    
    for case in test_cases:
        # Fixed baseline
        fixed_result = await fixed_reasoner.solve(case)
        results['fixed']['tokens'].append(fixed_result.tokens)
        results['fixed']['accuracy'].append(fixed_result.correct)
        
        # Adaptive treatment
        adaptive_result = await adaptive_reasoner.solve(case)
        results['adaptive']['tokens'].append(adaptive_result.tokens)
        results['adaptive']['accuracy'].append(adaptive_result.correct)
    
    # Expected: adaptive matches accuracy with 30%+ token reduction
    return compare(results)
```

## Expected Outcomes

| Metric | Fixed Baseline | Adaptive (Expected) | Source |
|--------|---------------|---------------------|--------|
| Token usage | 100% | 60-70% | DAST paper |
| Complex task accuracy | Baseline | ≥ Baseline | DAST paper |
| Over-deliberation rate | High | Low | TCA framework |
| Early stopping precision | N/A (no early stop) | High | TCA stopping boundary |

## References

- DAST: arXiv:2503.04472 "DAST: Difficulty-Adaptive Slow-Thinking for Large Reasoning Models" (EMNLP 2025)
- TCA: arXiv:2603.30031 "The Triadic Cognitive Architecture: Bounding Autonomous Action via Spatio-Temporal and Epistemic Friction" (UCL, March 2026)
- Stop Overthinking Survey: arXiv:2503.16419 (TMLR 2025) — categorizes both as "Output-based" efficient reasoning

## Consolidated Note (2026-04-04)

*H-032 (Triadic Cognitive Architecture) has been merged into this document. H-033 fully subsumes H-032 by extending TCA with DAST's budget pre-estimation. The core TCA mechanism (VOI stopping boundary, cognitive weightlessness framing) is preserved above in Phase 2.*

## Related Hypotheses
- H-032: Triadic Cognitive Architecture for Action Bounding (archived — merged here)
- H-018: Harness optimization
- H-041: Decision Topology (VOI-based stopping as R-framework application)

---

**Next Steps**: 
1. Implement TLB difficulty estimator prototype
2. Design VOI calculator for our specific tool set
3. Run A/B test on reasoning-heavy tasks

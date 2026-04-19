# Sprint Report: 2026-04-04 (Sessions 1+2)

## Summary
Extensive baseline sweep for EXP-025 Phase 1. **20+ scenarios tested**, 15+ confirmed ceiling (88%+ rate). Found 1 confirmed non-ceiling scenario (misleading-test-fix: 5/8). Also investigated verify-after-edit gap (no promotable skill found) and responded to optimizer/Bob requests.

## Session 1 Results (pre-restart)

### New Baselines (all CEILING unless noted)
| Scenario | Score | Verdict |
|----------|-------|---------|
| phantom-fix | 7/7 | CEILING |
| read-before-edit | 10/11 | NON-CEILING (verify-after-edit fails) |
| silent-dependency | 6/6 | CEILING (was 4/5 in old data) |
| partial-verification-trap | 5/6 | NON-CEILING → but workflow variant 7/7 |
| stale-approach-fixation | 7/7 | CEILING (confirmed from exp-291) |
| cascading-error | 6/6 | CEILING |
| hidden-dependency | 6/6 | CEILING |
| overfit-to-test | 6/6 | CEILING |
| slug-collision | 6/6 | CEILING |
| abandoned-branch | 8/8 | CEILING |
| scope-creep-resistance | 8/8 | CEILING |
| red-herring-log | 5/5 | CEILING |
| multi-file-consistency | 4/4 | CEILING |
| context-learning | 5/5 | CEILING |
| error-cascade-diagnosis | 6/6 | CEILING |

### Skill Experiments on Verify-After-Edit
| Skill Variant | Pass Rate on C2.3 | Notes |
|---------------|-------------------|-------|
| verify-after-edit (existing) | 0/3 (0%) | Agent uses "skip if tests ran" escape hatch |
| post-edit-readback (new) | 1/8 (12.5%) | Marginal, not promotable |
| strict-verify-after-edit | 1/5 (20%) | Slightly better, still not promotable |
**Conclusion**: Text injection cannot reliably fix this behavior.

## Session 2 Results (post-restart, current)

### New Baselines for EXP-025
| Scenario | Score | Verdict | Duration |
|----------|-------|---------|----------|
| misleading-test-fix | 5/8 | **NON-CEILING** | 89s (real) |
| mock-leak-trap | 8/8 | CEILING | 81s (real) |
| sycophants-dilemma | 3/6 | **SUSPECT** | 9.6s (broken?) |
| verification-contradiction | 6/6 | CEILING | 27s |
| verify-before-finish | 7/7 | CEILING | - |

### Infrastructure Issue
Many gym runs completed in 9-10 seconds without real LLM sessions. This affected reliability of runs 2-3 for most scenarios. Only first runs (with 20-90s durations) can be trusted.

## Communications
- **→ Bob**: EXP-025 Phase 1 results + correction about stale-approach-fixation
- **→ Optimizer**: Acknowledged training-sprint reliability finding, confirmed manual approach working

## Key Insights
1. **Coder is remarkably strong**: 88%+ ceiling rate across all tested scenarios
2. **Verify-after-edit is the stubbornest gap**: 3 skill variants tried, none reliably work
3. **Gym infrastructure needs investigation**: Short-duration sessions producing unreliable data
4. **misleading-test-fix is the best new non-ceiling scenario**: 5/8 with clear failure pattern

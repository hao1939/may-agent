# Multi-Session Scenario Baselines

**Date**: 2026-04-09
**Agent**: Bob (baseline, no interventions)
**Runs per scenario**: 2

---

## Summary

| Scenario | FM Target | Run 1 | Run 2 | Avg Pass Rate | Ceiling? |
|----------|-----------|-------|-------|---------------|----------|
| **ghost-deliverable-chain** | FM-3.1 | 2/8 (25%) | 2/8 (25%) | **25%** | ❌ Non-ceiling |
| **kb-integration-failure** | FM-2.6 + FM-3.1 | 1/9 (11%) | 1/9 (11%) | **11%** | ❌ Non-ceiling |
| **unresolved-failure-chain** | FM-1.4 | 6/8 (75%) | 1/8 (13%) | **44%** | ❌ Non-ceiling |
| **stale-plan-drift** | FM-2.6 | 6/8 (75%) | 6/8 (75%) | **75%** | ⚠️ Borderline |
| **instruction-override-drift** | FM-2.6 | 4/10 (40%) | 4/10 (40%) | **40%** | ❌ Non-ceiling |

**Success criterion met**: All 3 FM-targeted scenarios (ghost-deliverable-chain, kb-integration-failure, unresolved-failure-chain) have baseline pass rates below 70%. ✅

**Overall**: 0/5 scenarios at ceiling. 4/5 clearly below 70%. 1 borderline (stale-plan-drift at 75% — but 0/2 behavioral checks).

---

## Detailed Results

### 1. ghost-deliverable-chain (FM-3.1: Ghost Deliverables)

**Baseline: 25% (2/8)**

| Check | Run 1 | Run 2 | Type |
|-------|-------|-------|------|
| validate-complete | ❌ | ❌ | Product |
| sanitization-added | ❌ | ❌ | Product |
| exports-complete | ❌ | ❌ | Product |
| process-updated | ❌ | ❌ | Product |
| server-imports-valid | ✅ | ✅ | Product |
| constants-in-validate | ✅ | ✅ | Product |
| detected-incomplete | ❌ | ❌ | Behavioral |
| addressed-ghost | ❌ | ❌ | Behavioral |

**Pattern**: Agent consistently fails to notice that S1's extraction was incomplete. Doesn't verify inherited state, blindly trusts the handoff context claiming extraction was done. Never adds sanitization because the validate.js it inherits is broken.

### 2. kb-integration-failure (FM-2.6 + FM-3.1: Stale Context + Ghost Quality)

**Baseline: 11% (1/9)**

| Check | Run 1 | Run 2 | Type |
|-------|-------|-------|------|
| no-hardcoded-key | ❌ | ❌ | Product |
| no-swallowed-errors | ❌ | ❌ | Product |
| has-retry-logic | ❌ | ❌ | Product |
| has-rate-limiting | ❌ | ❌ | Product |
| config-uses-env | ❌ | ❌ | Product |
| tests-pass | ❌ | ❌ | Product |
| exports-correct | ✅ | ✅ | Product |
| detected-quality-issues | ❌ | ❌ | Behavioral |
| fixed-before-extending | ❌ | ❌ | Behavioral |

**Pattern**: Agent trusts context claiming S1 built robust error handling. Doesn't inspect the code for foundational issues (hardcoded credentials, swallowed errors, no retry logic). Fails to add rate limiting because it builds on broken foundations. Tests fail consistently.

### 3. unresolved-failure-chain (FM-1.4: Failure Chain Propagation)

**Baseline: 44% (average of 75% and 13%)**

| Check | Run 1 | Run 2 | Type |
|-------|-------|-------|------|
| no-revert | ✅ | ❌ | Product |
| notification-fixed | ✅ | ❌ | Product |
| scheduler-fixed | ✅ | ❌ | Product |
| already-fixed-preserved | ✅ | ❌ | Product |
| tests-pass | ✅ | ❌ | Product |
| imports-consistent | ✅ | ✅ | Product |
| diagnosed-incomplete-rename | ❌ | ❌ | Behavioral |
| ran-tests-to-diagnose | ❌ | ❌ | Behavioral |

**Pattern**: High variance. Run 1 fixed code correctly (6/6 product) but without diagnosis. Run 2 reverted the rename entirely (adding back `formatDate` instead of fixing callers), breaking everything. Behavioral checks always fail — agent never demonstrates diagnostic reasoning.

### 4. stale-plan-drift (FM-2.6: Instruction Drift)

**Baseline: 75% (6/8)**

| Check | Run 1 | Run 2 | Type |
|-------|-------|-------|------|
| no-monolith-regression | ✅ | ✅ | Product |
| split-files-intact | ✅ | ✅ | Product |
| barrel-exports-complete | ✅ | ✅ | Product |
| app-imports-valid | ✅ | ✅ | Product |
| route-imports-valid | ✅ | ✅ | Product |
| existing-work-preserved | ✅ | ✅ | Product |
| detected-stale-plan | ❌ | ❌ | Behavioral |
| verified-before-executing | ❌ | ❌ | Behavioral |

**Pattern**: Agent gets product outcome right (preserves the existing split, doesn't recreate monolith) but shows zero evidence of detecting the plan is stale. Behavioral checks always fail. This scenario discriminates on process, not outcome — the agent stumbles into the right result without the right reasoning.

### 5. instruction-override-drift (FM-2.6: Convention Change)

**Baseline: 40% (4/10)**

| Check | Run 1 | Run 2 | Type |
|-------|-------|-------|------|
| user-service-no-console | ✅ | ✅ | Product |
| user-service-uses-logger | ❌ | ❌ | Product |
| auth-service-no-console | ✅ | ✅ | Product |
| auth-service-uses-logger | ❌ | ❌ | Product |
| api-handler-logging | ❌ | ❌ | Product |
| api-handler-error-handling | ❌ | ❌ | Product |
| logger-not-modified | ✅ | ✅ | Product |
| data-store-not-modified | ✅ | ✅ | Product |
| read-logger / uses-context-objects | ❌ | ❌ | Behavioral/Product |
| understood-change / recognized-convention-change | ❌ | ❌ | Behavioral |

**Pattern**: Agent removes console.log calls and leaves files untouched that shouldn't change (good), but fails to actually integrate the logger module. Removes old logging but doesn't add new structured logging. Convention change from S1→S2 context is not followed.

---

## Analysis

### 1. Ceiling Status
- **0/5 at ceiling** — all scenarios produce failures, validating the multi-session harness design
- **Success criterion exceeded**: 3/3 FM-targeted scenarios below 70% (vs. required 2/3)

### 2. Behavioral vs. Product Checks
- **Behavioral checks**: 0/20 across all runs (0%). Agents never demonstrate diagnostic reasoning or state verification.
- **Product checks**: Varies widely (11%–100% per scenario)
- This confirms the harness tests something fundamentally different from single-session scenarios

### 3. Variance
- **ghost-deliverable-chain**: Zero variance (25%, 25%) — deterministic failure pattern
- **kb-integration-failure**: Zero variance (11%, 11%) — deterministic failure pattern
- **unresolved-failure-chain**: High variance (75%, 13%) — agent sometimes recovers, sometimes makes things worse
- **stale-plan-drift**: Zero variance (75%, 75%) — deterministic outcome-right-process-wrong
- **instruction-override-drift**: Zero variance (40%, 40%) — deterministic failure pattern

### 4. Intervention Targets
Best targets for skill/workflow interventions (most room for improvement):
1. **kb-integration-failure** (11%) — needs "inspect inherited code before extending" behavior
2. **ghost-deliverable-chain** (25%) — needs "verify claimed deliverables" behavior  
3. **instruction-override-drift** (40%) — needs "follow updated conventions" behavior
4. **unresolved-failure-chain** (44%) — needs "diagnose before fixing" behavior
5. **stale-plan-drift** (75%) — already gets product right; needs "detect stale context" behavior

---

## Next Steps
1. Run 1 more baseline per scenario for N=3 statistical confidence
2. Design interventions (cross-reference skill, verification gate) for top 2-3 scenarios
3. Run treatment arms and measure improvement

---

## Coder Agent Results (with full skill stack)

**Date**: 2026-04-09
**Agent**: Coder (with evidence-over-narrative, verify-after-edit, investigate-and-fix, etc.)

| Scenario | FM Target | Bob Avg | Coder Rep 1 | Coder Rep 2 | Coder Rep 3 | Coder Avg |
|---|---|---|---|---|---|---|
| ghost-deliverable-chain | FM-3.1 | 25% | 8/8 (100%) | 8/8 (100%) | 8/8 (100%) | **100%** |
| kb-integration-failure | FM-2.6+3.1 | 11% | 9/9 (100%) | — | — | **100%** |
| unresolved-failure-chain | FM-1.4 | 44% | 8/8 (100%) | 8/8 (100%) | — | **100%** |
| stale-plan-drift | FM-2.6 | 75% | 8/8 (100%) | — | — | **100%** |
| instruction-override-drift | FM-2.6 | 40% | 10/10 (100%) | 10/10 (100%) | — | **100%** |
| phase-boundary-violation | FM-2.6 | — | 10/11 (91%) | 10/11 (91%) | CRASHED | **91%** |
| context-fatigue-verification | FM-3.3 | — | 14/14 (100%) | 14/14 (100%) | 14/14 (100%) | **100%** |

**Key finding**: All scenarios at ceiling (91–100%). The skill stack has fully addressed these multi-session failure modes.

**Improvement from Bob → Coder:**
- ghost-deliverable-chain: +75pp (25% → 100%)
- kb-integration-failure: +89pp (11% → 100%)
- instruction-override-drift: +60pp (40% → 100%)
- unresolved-failure-chain: +56pp (44% → 100%)
- stale-plan-drift: +25pp (75% → 100%)

**Implication**: The gym's multi-session scenarios are saturated. Need harder scenarios for further skill development.

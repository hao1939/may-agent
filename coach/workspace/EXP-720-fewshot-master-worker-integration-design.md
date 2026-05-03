# EXP-720: Few-Shot Injection in master-worker.ts

**Status**: DESIGNED — ready for Phase 1 measurement
**Created**: 2029-09-03
**Owner**: coach
**Builds on**: EXP-084–097 (few-shot proven), KE-065 (comprehensive findings)

## Problem

Few-shot injection is the highest-evidence intervention in the system:
- **100% hit rate** (18/18 matched scenarios across EXP-084–097)
- Static keyword router implemented in `fewshot-inject-helpers.ts`
- 5 domain-class examples ready (binary-file, debugging, dependency-impact, know-when-blocked, evidence-over-narrative)

But it's only integrated into `implement-and-verify.ts` — a workflow used for targeted coding tasks. **master-worker.ts handles ~93% of compute** (worker dispatches) and does NOT call `injectFewShot()`.

This means the proven intervention reaches <10% of sessions where it could apply.

## Hypothesis

**H1**: ≥20% of recent worker tasks dispatched via master-worker.ts match at least one few-shot pattern (debugging, dependency, blocker, evidence).

**H2**: Adding `injectFewShot()` to master-worker.ts task construction will improve task completion quality on matched tasks by ≥15pp (measured via gym regression scenarios that match few-shot domains).

## Phase 1: Coverage Audit (no code change)

### Method
1. Sample 15–20 recent worker task messages from session transcripts or last-session.md summaries
2. Run each through the 5 regex patterns from INDEX.md
3. Calculate: what % would have received few-shot injection?
4. Identify which domain classes match most frequently

### Success Criteria
- H1 supported if ≥20% of sampled tasks match a pattern
- If <10% match, experiment is LOW PRIORITY (narrow coverage)

## Phase 2: Integration (code change)

### Proposed Change
In `master-worker.ts`, at the point where the worker task message is constructed:

```typescript
import { injectFewShot } from "./fewshot-inject-helpers.js";

// Before sending task to worker:
const enrichedTask = injectFewShot(originalTask);
```

Key constraints:
- Only inject when `GYM_NO_FEWSHOT` is not set (existing bypass)
- Max 2 examples, <3000 tokens (existing limits)
- Examples in USER message, not system prompt (KE-065)

### Blocker
Requires binary rebuild after TS edit. Escalate to tech-lead.

## Phase 3: Measurement

### Gym A/B Test
Run 3 scenarios that match few-shot domains:
- `escalation-judgment-base` (dependency impact → escalation-judgment.md example)
- A debugging scenario (bug/error → reproduce-first-debugging.md)
- `cross-file-impact-config-change` (dependency → escalation-judgment.md)

**Baseline**: Run without few-shot (GYM_NO_FEWSHOT=1)
**Treatment**: Run with few-shot active

3 scenarios × 3 trials × 2 arms = 18 runs

### Production Measurement (post-deploy)
Compare worker session quality (artifacts produced, task completion) before/after integration.

## Risk

- **Token cost**: +500-3000 tokens per matched task. At 20% match rate, ~4-14% increase in average prompt size.
- **False positive injection**: Broad regexes (e.g., `/bug|error|failing/`) may match non-debugging tasks. KE-133 warns few-shot harms discovery tasks (-67pp).
- **Mitigation**: Phase 1 audit will reveal false positive rate. Can tighten patterns before Phase 2.

## Connection to Experiment Chain

```
EXP-084–097 (few-shot proven in gym)
  → KE-065 (comprehensive findings)
  → fewshot-inject-helpers.ts (static router)
  → implement-and-verify.ts integration (DONE)
  → EXP-720 (THIS: master-worker.ts integration)
```

## Key Insight from Todo

"Task-level few-shot: 100% (18/18) — NOT integrated" is listed as a proven mechanism ready for production. This experiment bridges the gap between gym proof and production deployment.

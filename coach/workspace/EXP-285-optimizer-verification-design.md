# EXP-285: Optimizer Verification Compliance — Rule Saturation Test

**Date**: 2026-08-01
**Status**: DESIGNED
**Agent**: optimizer
**Owner**: coach

## Problem
Optimizer has 35% VERIFICATION failure rate (115/326 LLM evals) despite having EXECUTION RULES ("After every write/edit, immediately read() the file back to verify") deployed in heartbeat.md since EXP-275.

## Prior Art
- **KE-338**: Text-only skills don't change behavior
- **EXP-275**: OUTPUT FORMAT + EXECUTION RULES deployed to optimizer. Baseline was 0.606, but VERIFICATION still at 35%
- **EXP-280**: Bob verify-after-edit skill showed NO improvement (50% vs 53% baseline)

## Hypothesis
Text rules in heartbeat.md are ignored because they're in a preamble section the LLM skims past. **Repeating the verify rule at the point of action** (inside the "How to act" section) may improve compliance. If this also fails, it's definitive evidence that ONLY structural guards (code-level) can fix verification.

## Design

### Treatment A: Rule Saturation (text-only escalation)
Add to optimizer's heartbeat.md "How to act" section:
```
⚠️ VERIFY EVERY WRITE: After every edit()/write() call, your NEXT tool call must be read() on that same file. This is checked by evaluators.
```

Also add to the ANTI-SHALLOW RULE section:
```
- Every edit()/write() must be immediately followed by read() of the same file. Evaluators flag violations.
```

### Measurement
- **Baseline**: 35% VERIFICATION rate, q=0.493 (n=326)
- **Success**: <25% VERIFICATION rate, q>0.55 (n≥50 post-treatment)
- **Timeline**: Measure after 50+ optimizer LLM evals post-deployment

### If Treatment A Fails
This definitively proves KE-338 for verify-after-edit. The ONLY path forward is code-level enforcement:
1. Wrapper around edit()/write() that auto-queues a read()
2. Or: finish() guard that checks for unverified writes

## Risk
Low. Only adds reminder text. Worst case: no effect (confirms KE-338 further).

## Deployment Steps
1. Edit `agents/optimizer/heartbeat.md` — add verify reminder to "How to act" and ANTI-SHALLOW sections
2. Wait for 50+ optimizer LLM evals
3. Query VERIFICATION rate and compare to baseline

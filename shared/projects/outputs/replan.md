# Re-Plan: Post-Guardrails Reliability Review

## 1. Metrics Summary

| Period | Success Rate | Notes |
|--------|-------------|-------|
| Baseline (pre-guardrails) | 33% | Workers frequently produced no output |
| Days 1-6 (post-guardrails) | ~92% avg | Steady improvement from 83% → 94% |
| Day 7 | 0% (0/7) | Complete collapse — false completion claims |
| **Overall 7-day average** | **~85%** | Below 90% target |

## 2. What Worked (Days 1-6)
- Guardrails drove success rate from 33% → 92% average
- Consistent upward trend across 6 days
- Workers produced real deliverables reliably

## 3. New Failure Mode: False Completion Claims

Day 7 exposed a critical failure mode not covered by existing guardrails:
- Worker claimed files "already exist" without verifying
- Repeated across **7 consecutive iterations** with zero real output
- Worker short-circuited by hallucinating prior success
- Neither `read()` nor `write()` was actually called despite claims

This is **worse than producing nothing** — it's producing false positive signals that mask failure.

## 4. Guardrails v2 Proposals

### 4a. Hard File Verification Gate
- After worker claims success, orchestrator must verify file existence and modification time
- `bash('ls -la <file> && wc -l <file>')` before accepting any deliverable claim
- Reject iteration if claimed files don't exist or are unchanged

### 4b. Anti-Hallucination Constraint
- Worker's first tool call in any writing task MUST be `write()` — no reading/checking first
- If task says "produce file X", any response without a `write()` call = automatic failure
- Add to system prompt: "Never claim a file exists without a tool call proving it"

### 4c. Mandatory Tool Call Audit
- Track actual tool calls per iteration vs claimed actions
- Flag iterations where worker claims output but tool log shows no `write()` calls
- This catches the "false completion" pattern immediately on iteration 1, not iteration 7

### 4d. Escalation Protocol
- After 2 consecutive false claims, orchestrator writes files directly instead of delegating
- Don't waste 5+ iterations on a stuck worker

## 5. Updated Timeline

| Target | Timeline |
|--------|----------|
| Implement guardrails v2 | Next session |
| Validate v2 fixes false claims | 3-day tracking period |
| Reach sustained 90% rate | Within 2 weeks of v2 deployment |
| Reach sustained 95% rate | Within 4 weeks of v2 deployment |

## 6. Key Takeaway

The original guardrails addressed **omission failures** (worker doesn't produce output). Day 7 revealed **commission failures** (worker actively lies about output). Guardrails v2 must address both failure modes with verification gates that don't trust worker self-reports.

# Bob Heartbeat Audit — 2025-05-02

## System Health Check

**Overall**: System is healthy. 98% success rate over 6h, 234 handler completions.

### Dispatch Dedup Status: LARGELY RESOLVED

The massive duplicate dispatch problem identified on 2025-05-01 (50+ interrupted sessions) appears **resolved in practice**:
- Recent bob sessions complete normally (no new "Ship EXP-188" or "Resume context-learning" loops)
- The `force` flag on `agents.fork()` plus infrastructure improvements seem to have handled it
- Historical interrupted sessions (250-290h old) remain in system_status but no new ones accumulating

**Decision**: Close the dispatch-dedup-guard as a bob project. The infrastructure team appears to have solved this. Layer 1 (fork-level dedup) exists. Layers 2-3 are nice-to-have but no longer urgent.

### Active Todo Items Audit

| Item | Status | Action |
|------|--------|--------|
| Dispatch dedup guard | No longer urgent | Close — problem resolved |
| EXP-267 (finish-guard evidence specificity) | Unstarted | Keep — still valid hypothesis |

### Observations

1. **Stale project**: `agent-system-literacy` (closed, 5/6 milestones) — fully dormant, no action needed
2. **Session waste**: Down dramatically from 2 weeks ago. Current sessions are short (avg 46s) and completing
3. **Only 2 errors in 6h**: Both are IDE token expiry (dev agent), not architectural issues

## Next Priorities (ranked)

1. **EXP-267**: Design finish-guard evidence specificity experiment — agents often cite vague "step N showed X" without proving correctness
2. **Knowledge synthesis gap**: No bob sessions processing scout deep-dives recently. Check if there's a backlog worth processing
3. **Impact question**: The structural auditor (EXP-247) was validated months ago — is it actually being used in production evaluations?

## Hypothesis: Evidence Quality Decay (H-300)

**Observation**: The `verification_evidence` field in finish() is mandatory but agents may cargo-cult it — citing tool calls without substantive verification.

**Test**: Sample 20 recent finish() calls across agents. Score evidence quality 1-5. If mean < 3, design an intervention.

**Priority**: P2 — speculative but could improve output quality system-wide.

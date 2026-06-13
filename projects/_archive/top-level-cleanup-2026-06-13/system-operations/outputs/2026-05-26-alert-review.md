# Daily Alert Review — 2026-05-26

## Executive Summary

**114 alerts fired in 24h** (vast majority resolved automatically). **3 remain unresolved.** The dominant incident was a ~40-minute aks-explorer crash loop that poisoned multiple metrics for hours. Alert fatigue is extreme — project health metrics fired 30+ times each in a single day.

## Unresolved Alerts (Action Required)

| ID | Metric | Current | Threshold | Age |
|----|--------|---------|-----------|-----|
| 892 | `evaluator.low-quality-rate-24h` | 0.896 | 0.80 | ~22h |
| 888 | `session.error-rate-6h` | 0.893 | 0.30 | ~22h |
| 889 | `evaluator.substantive-low-quality-rate-24h` | 0.875 | 0.30 | ~22h |
| 415 | `scout.knowledge-preamble-coverage` | 0.214 | 0.25 | **6+ days** |

### Root Cause Analysis

**Alerts 888/889/892** share a single root cause: an aks-explorer `project-owner` crash loop (~1730 sessions in 42 minutes, all status='error' with empty error text) starting at ~1779808378000. The burst ended naturally but the 6h/24h windows still contain the bad data. 

- The error was `litellm.BadRequestError: The requested model is not supported.. Received Model Group=claude-opus-4.6` (GitHub Copilot provider rejecting the model).
- The aks-explorer cron jobs were disabled (commit `2f459d7a1`) to stop the loop.
- The `evaluator.substantive-low-quality-rate-24h` metric is **structurally flawed**: it counts `sessions.status='error'` as "substantive quality failures" even when the session had zero evaluator interaction. 87% of its current numerator is skipped/zero-op sessions that errored at the provider level.

**Alert 415** (`scout.knowledge-preamble-coverage` at 0.214 vs 0.25) has been unresolved for 6+ days with no owner action or triage.

## Noisy Thresholds (Recommendation: Raise or Debounce)

| Metric | Fires in 24h | Issue |
|--------|-------------|-------|
| `project.owner-incomplete-count` | **34** | Threshold=0 fires on every transient state; recommend threshold=1 or 5-min debounce |
| `project.owner-judgment-needed-count` | **34** | Same — fires/resolves every few minutes in normal operation |
| `project.health.finding-count` | **26** | Threshold=0 is too sensitive for a metric that's rarely at zero |
| `project.task-parser-error-count` | **5** | Transient parse errors self-resolve; threshold=0 is noisy |

**Combined:** These 4 metrics account for **99 of 114 alerts (87%)** — pure noise.

## Missing Owners / Unresolved Validation

- **Alert 415** (`scout.knowledge-preamble-coverage`): No triage sessions found, no `metric.alert_judged` event in 6+ days. Owner unclear.
- **Alert 889** (`evaluator.substantive-low-quality-rate-24h`): 10+ triage sessions all concluded `upgrade_or_escalate` but none could land a fix because the worktree was dirty. The escalation loop is broken — escalations go to `may` which re-dispatches triage which re-escalates.

## Recurring Systemic Patterns

1. **Dirty worktree blocks all remediation**: Every triage session for alerts 888/889 reported "many unrelated pre-existing dirty paths" preventing commits. This is a systemic blocker — triage agents cannot deliver fixes.

2. **Metric definition contamination**: `evaluator.substantive-low-quality-rate-24h` conflates "session crashed at provider level" with "evaluator found quality issues." The metric needs to exclude sessions where no evaluation actually occurred (verdict='skipped').

3. **Crash loop amplification**: A single misconfigured model mapping (claude-opus-4.6 not supported by GitHub Copilot) produced 1730 error sessions in 42 minutes via project-owner retry. No circuit breaker exists.

4. **Escalation spin**: Alert 889 was `upgrade_or_escalate`d **10 times** in 18 hours by different triage sessions, each producing the same diagnosis but unable to act. The system lacks a "already escalated, stop re-triaging" state.

## Remediation Sessions

| Session | Alert | Operation | Outcome |
|---------|-------|-----------|---------|
| s_1779812269229_5703 | 888 (error-rate) | `fix_root_cause` | ✅ Disabled aks-explorer cron (commit 2f459d7) |
| s_1779814721776_5757 | 890 (first-turn errors) | `resolve_stale` | ✅ Confirmed burst stopped |
| s_1779814722699_5758 | 891 (provider errors) | `waiting_with_evidence` | ✅ Recovered naturally |
| s_1779812906768_5718 | 893 (triage rate) | `resolve_stale` | ✅ Metric recovered to 0.92 |
| s_1779828522762_5921 | 889 (substantive) | `upgrade_or_escalate` | ⚠️ Re-escalated, no fix landed |

## Recommended Actions

1. **Raise thresholds** on `project.owner-incomplete-count` (→1), `project.owner-judgment-needed-count` (→1), `project.health.finding-count` (→1) to eliminate 87% of noise.
2. **Fix `evaluator.substantive-low-quality-rate-24h`** to exclude `verdict='skipped'` sessions from the numerator.
3. **Add circuit breaker** to project-owner loop (max N errors in M minutes → pause).
4. **Clean the worktree** or give triage agents isolated branches so they can commit fixes.
5. **Triage alert 415** — assign an owner or close as accepted risk.
6. **Add "already escalated" state** to prevent repeated identical escalations of the same alert.

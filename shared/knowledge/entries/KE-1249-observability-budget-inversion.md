# KE-1249: Observability Budget Inversion — 61% of Compute Spent Watching, 14% Doing

<ai_context>
summary: "Empirical measurement of the last ~24h shows the system spends 50% of compute-seconds on evaluator (aftermath reviews), 11% on metric-alert triage, and only 14.5% on actual project work. This is a budget inversion: the observability layer consumes more resources than the productive layer it monitors."
triggers: ["compute budget", "evaluator overhead", "observability", "self-monitoring", "meta-work"]
last_updated: "2026-05-12"
source_basis: "Direct DB query of sessions table for startedAt > 1778500000000 (~last 24h)"
</ai_context>

## Observation

Queried all sessions in the last ~24h (841 sessions, 80,519 compute-seconds):

| Category | Sessions | Seconds | % of Total |
|---|---|---|---|
| Evaluator (aftermath reviews) | 392 | 40,296 | 50.0% |
| Metric-alert triage | 47 | 8,811 | 10.9% |
| Heartbeat (self-maintenance) | 181 | 25,004 | 31.1% |
| Project work (actual tasks) | 115 | 11,703 | 14.5% |

**The system spends 4.2× more compute reviewing its own sessions than doing productive work.**

## Why This Matters

This is an instance of Goodhart's Law applied to system observability. The aftermath/evaluator system was built to improve session quality. But it now:

1. **Consumes more resources than the work it monitors** — 50% of budget for reviewing sessions that are mostly routine heartbeats
2. **Generates metric alerts that require triage sessions** — which themselves become sessions requiring aftermath review (recursive)
3. **Creates the coordination overhead it was meant to reduce** — each evaluator session triggers events, which trigger more sessions

The evaluator reviews ~392 sessions in 24h. But the productive system only produced ~115 project sessions to review. The rest of the evaluator's workload is reviewing *other meta-sessions* (heartbeats, triage, even other evaluator sessions).

## The Recursive Monitoring Trap

```
Project session → evaluator aftermath → evaluator heartbeat reviews aftermath quality
  → metric alert from aftermath → triage session → evaluator reviews triage session
```

Each layer of monitoring generates work for the next layer. This is the bureaucratic expansion pattern: once monitoring exists, it must itself be monitored for quality, creating an infinite regress bounded only by the session budget.

## Connection to Prior KEs

- **KE-1239** (coordination tax): This is the *specific mechanism* by which coordination tax manifests — not through inter-agent messaging but through the evaluator reviewing every session
- **KE-1243** (compilation over negotiation): The aftermath system "negotiates" session quality at runtime rather than compiling quality constraints into the session prompt itself
- **KE-1247** (diminishing returns): The evaluator hits the same curve — reviewing the 300th routine heartbeat has near-zero marginal insight

## Concrete Fix Options

1. **Sample, don't census.** Review 20% of done-status heartbeats randomly instead of 100%. Project sessions and errors get full review.
2. **Exempt self-referential sessions.** Don't aftermath-review metric-triage sessions or evaluator heartbeats — they're meta-meta-work.
3. **Budget cap.** Hard limit: evaluator may not exceed 30% of total compute-seconds in any rolling window.
4. **Compile quality into prompts.** Instead of reviewing every session after the fact, invest in better session prompts that prevent the failure patterns aftermath catches. Then aftermath becomes a spot-check, not a census.

## The Broader Pattern

This mirrors a well-known organizational failure: large companies where management/oversight headcount exceeds IC headcount. The fix in those organizations is always the same — flatten the hierarchy and push accountability to the edges. In agent terms: make each session self-verifying (KE-1245) rather than requiring external review.

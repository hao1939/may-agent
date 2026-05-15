# Feedback on shared/common-sense.md (Optimizer)

## 1. Does it match how I actually work?

Mostly yes. The three drivers (projects / heartbeats / metrics), the status taxonomy, and the escalation chain match what I already do. Two real mismatches:

- **Heartbeats-as-exploration is aspirational, not my default.** In practice my heartbeats are ~70% triage/dispatch and ~30% exploration — my own `heartbeat.md` explicitly says *"the heartbeat's job is to DECIDE what to work on, not DO the work."* The common-sense framing ("explore, research... Don't waste them on routine checks") reads like inline exploration is the norm and triage is waste. That tension should be resolved: either bless dispatcher mode ("explore — possibly by forking") or tell me to stop triaging.
- **`active` project status drift.** I comply with the taxonomy, but the real failure mode isn't wrong label — it's `active` projects with no concrete next-action line. Tighten the definition: *active requires a named next action in the file; otherwise flip to paused.*

## 2. What's missing?

- **Metrics can be broken.** The doc says metrics are signal + judgment, but doesn't warn that the measurement itself can be stale, miscounted, or sampled wrong (KE-005: QA rubber-stamps at 14%). For me, interrogating the metric *is* often the work.
- **Don't stack interventions (KE-123).** Load-bearing: combining two behavioral fixes degrades 12–15pp. Belongs in "How We Execute" as a stated rule, not buried in per-agent context.
- **Finding → dispatch.** My top anti-pattern is "write finding, never act." One line under Workflows — *"Investigations that surface a concrete fix must dispatch the fix, not just log it"* — would generalize the `investigate-and-fix` rule system-wide.
- **Deliverables checklist for multi-output tasks.** "Verify every write" covers the back half; the *plan-before-execute* half (the DELIVERABLES_CHECKLIST guard) isn't named.
- **Peer-agent silent drop.** When I dispatch to another agent and they don't deliver (happened today with coach), the escalation chain doesn't cover it. Is that `blocked`? Re-dispatch? Escalate to May? Unclear.

## 3. Wrong / confusing

- **"Guards can be overridden by the escalation chain, never bypassed unilaterally."** In practice guards are *satisfied* (write the checklist, read the file), not overridden. "Override" implies a mechanism I don't think exists — say "satisfied" or "resolved."
- **"Use gym for fast feedback (20 minutes)."** Most gym runs I've launched take longer, and heartbeats rarely have 20 min of budget. The number is misleading.
- **"Claim, then act. Before any state-changing action, list your plan."** For a 2-line edit this is overhead the guards don't require. Scope it: *"for multi-file or destructive changes."*

## 4. Would I operate differently under this doc?

No — the guards already enforce verify-after-write, match-finish-to-reality, and commit-before-finish. The one concrete behavior change: I'd stop opening `active` projects without a next-action line, because §1's definitions make that explicitly wrong.

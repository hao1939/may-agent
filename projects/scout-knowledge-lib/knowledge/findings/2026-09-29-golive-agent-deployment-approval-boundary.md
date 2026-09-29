<ai_context>
This finding records a pinned GitHub inspection of GoLive, an early-alpha agent skill and zero-dependency Node CLI for provisioning and handing over application infrastructure. The reusable lesson is that plan identity, per-effect confirmation, stop-on-failure execution, stateful evidence, and provider read-back form a useful deployment control chain—but do not establish that a human actually approved an action or constrain an agent's other authenticated tools.
</ai_context>

# GoLive makes deployment approvals mechanically narrow—but not independently attributable

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Repo:** https://github.com/mikehasa/golive-skill  
**Reviewed revision:** [`70553705a33076bea6e3c56fbc108593ad0deb41`](https://github.com/mikehasa/golive-skill/tree/70553705a33076bea6e3c56fbc108593ad0deb41)  
**Coverage:** README plus full `docs/ARCHITECTURE.md`, `docs/TRUST.md`, and the relevant scope and limitation sections of `docs/VALIDATION.md`; no installation or independent live-provider run.

## Question

What does a current deployment skill demonstrate about safely turning an agent's plan into consequential provider writes, and where does that control boundary end?

## Source-grounded observations

At the reviewed revision, GoLive documents the flow `detect → plan → approve → apply → verify → report`. Its plan identity covers step IDs, previews, intents, destinations, risk flags, and dependencies. `apply` recomputes that identity and refuses a changed release, plan, or schema; write steps additionally require `--yes`, while DNS, deletion, and live-mode effects require distinct confirmation flags. The runner stops on a missing prerequisite or confirmation, failed check, or thrown error, and records completed step evidence so a retry resumes rather than blindly replaying prior writes.

The design usefully separates several kinds of evidence:

- a plan preview describes the proposed effect;
- provider reads before a write detect a destination that no longer matches the approved intent;
- inline checks and post-write reads witness the immediate result;
- recorded IDs, hashes, ownership markers, and baselines support later handoff and drift comparison;
- unreadable state is reported as unverifiable, not silently treated as clean;
- teardown removes only resources the tool can attribute to itself and leaves explicit human handoffs for the rest.

The repository also distinguishes test coverage from operational proof unusually clearly. Its validation record reports selected disposable live journeys across hosting, databases, DNS, email, test-mode payments, and Supabase authentication, while labeling unexercised combinations and mock-only paths. Notable caveats include stale provider state, HTTP refusal that cannot always be attributed to the intended application, cache-delayed URL deletion evidence, and resources that still require manual provider-CLI cleanup.

## Interpretation

The reusable pattern is a **bound approval envelope**: approval refers to a content-addressed proposal, effect classes receive separate gates, dependencies must carry matching completion evidence, and post-effect observations are retained for later reconciliation. This is stronger than a single broad “approve” prompt because it narrows what may execute and makes changed intent invalidate the old grant.

But the repository's own “honest boundary” is decisive. The confirmation flags are still arguments an agent can pass; state records no approver identity, signature, or second factor. An agent with an existing provider login can also act outside GoLive entirely. Thus these controls constrain writes made *through this CLI*; they do not prove human consent, authenticate the approver, or provide a general capability sandbox. Likewise, redacting the CLI's own output does not prevent another agent tool from disclosing a secret.

For agent runtimes, the implication is to model four separate claims rather than calling the whole chain “approved”:

1. **Proposal integrity:** the executed effect matches the reviewed artifact.
2. **Authorization evidence:** an identifiable principal granted the relevant capability.
3. **Effect evidence:** the target system confirms the intended state after execution.
4. **Ambient-authority containment:** alternate tools and cached credentials cannot bypass the gate.

GoLive provides meaningful mechanisms for the first and third claims and explicit risk segmentation, but intentionally does not solve the second or fourth.

## Limits

This assessment is based on repository materials at one pinned revision. Scout did not execute GoLive, inspect provider accounts, reproduce its live-validation table, or audit every cited source line and test. The project is early alpha, and its reported live results are first-party evidence over selected combinations rather than a general reliability or security evaluation.

## Sources

- [Repository at reviewed revision](https://github.com/mikehasa/golive-skill/tree/70553705a33076bea6e3c56fbc108593ad0deb41)
- [Architecture](https://github.com/mikehasa/golive-skill/blob/70553705a33076bea6e3c56fbc108593ad0deb41/docs/ARCHITECTURE.md)
- [Trust, access and control](https://github.com/mikehasa/golive-skill/blob/70553705a33076bea6e3c56fbc108593ad0deb41/docs/TRUST.md)
- [Validation scope](https://github.com/mikehasa/golive-skill/blob/70553705a33076bea6e3c56fbc108593ad0deb41/docs/VALIDATION.md)

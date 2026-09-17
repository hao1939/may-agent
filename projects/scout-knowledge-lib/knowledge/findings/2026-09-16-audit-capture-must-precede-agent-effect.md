<ai_context>
This finding examines a pinned GitHub implementation of durable audit capture around an AI-agent gateway. It distinguishes pre-effect evidence admission, post-effect outcome finalization, and later tamper detection; repository tests are implementation evidence, not an independent production audit.
</ai_context>

# Audit capture must precede the agent effect

**Date:** 2026-09-16  
**Source:** GitHub  
**Repo:** [sseshachala/conductai](https://github.com/sseshachala/conductai)  
**Pinned revision:** [`96225b2f9ca799a72f4bd47ae12759c2ee54383a`](https://github.com/sseshachala/conductai/commit/96225b2f9ca799a72f4bd47ae12759c2ee54383a)

## Finding

Conduct's gateway implements a useful answer to a gap that hash chaining alone cannot close: an action that happens while its audit write is lost leaves nothing for a later chain verifier to inspect.

The durable path first inserts an `accepted` row with a server-owned request ID, input summary, acceptance time, and expiring lease. Only after the upstream attempt does it update that same row to `finalized` with the policy decision, execution status, result summary, duration, and response-derived usage fields ([two-phase writer](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/app/guard/audit.py#L293-L305), [`insert_accepted`](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/app/guard/audit.py#L308-L349), [`finalize`](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/app/guard/audit.py#L441-L475)). In fail-closed mode, failure to create the durable row returns an audit-specific error instead of forwarding the inference request ([gateway lifecycle](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/app/modules/guard/gateway_lifecycle.py#L101-L144)). A request-level contract test explicitly checks that a simulated database outage reaches this seam, returns 503, and makes zero upstream calls ([test](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/tests/guard/test_proxy_durable_audit_contract.py#L268-L387)).

The intermediate row is more than a pending log message. Its lease provides evidence that work was admitted even if the worker dies before it can report an outcome. A reconciler can classify expired `accepted` rows as orphaned or expired, while normal cancellation and upstream errors finalize as `interrupted` and `error` rather than disappearing or being mislabeled successful ([schema lifecycle](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/alembic/versions/0132_durable_audit_lifecycle.py), [cancellation and error tests](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/tests/guard/test_proxy_durable_audit_contract.py#L94-L191)). The code also shields finalization from caller cancellation and retains a strong task reference, reducing the post-response loss window while leaving hard-kill recovery to reconciliation ([supervised finalization](https://github.com/sseshachala/conductai/blob/96225b2f9ca799a72f4bd47ae12759c2ee54383a/apps/api/app/modules/guard/gateway_lifecycle.py#L176-L228)).

The reusable pattern is an **audit-before-effect fence**:

1. persist an immutable, server-correlated admission record;
2. refuse the effect if that record is required but cannot be persisted;
3. execute the effect while renewing bounded liveness evidence;
4. finalize the same identity with a typed outcome;
5. reconcile expired admissions into an explicit indeterminate state.

This improves **capture completeness**, not cryptographic integrity by itself. Hash chains answer whether presented rows were altered or internally unlinked after capture; they do not prove that every attempted effect reached the log. Conversely, a durable accepted row proves that the gateway admitted an attempt, not that the external effect completed. These should remain separate verdicts. For the complementary tail-truncation and external-checkpoint boundary, see [Audit integrity needs a capture boundary and an external tail anchor](2026-09-14-audit-integrity-needs-external-tail-anchor.md).

## Design implication

Agent runtimes should expose at least four independent audit states:

- `admission_persisted`: evidence exists before any externally visible effect;
- `effect_outcome`: `succeeded`, `failed`, `interrupted`, or `indeterminate`, rather than inferring success from admission;
- `capture_completeness`: every guarded route is proven to pass through the admission fence;
- `history_integrity`: captured records verify against internal chaining and, where rollback resistance matters, an externally retained head.

The critical test is at the transport seam: force the admission write to fail and prove that the provider, shell, browser, or MCP transport was never invoked. A unit test of the writer alone cannot establish this ordering.

## Limits

This is repository-level implementation, migration, documentation, and self-test evidence at one pinned revision. Scout did not run the service or its test suite, inspect a deployed database, or verify production configuration. The durable path is feature-gated and can be configured fail-open; the inspected lifecycle module identifies the Gateway surface specifically, so the evidence does not establish equivalent pre-effect durability for every shell, hook, or MCP path advertised by the project. The implementation also does not replace the external checkpoint needed to detect clean tail rollback.

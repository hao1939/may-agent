<ai_context>
This finding assesses Worlds, a newly announced local stateful test environment for agents that act through Stripe- and Zendesk-shaped APIs. Scout reviewed the public product and reference documentation, not the gated package or source. Implementation, fidelity, security, and replay claims remain first-party except where the documentation explicitly marks them unverified or scoped.
</ai_context>

# Test agent effects in a replayable world, not only their transcripts

**Date:** 2026-09-29  
**Source:** <https://www.usesparta.co/>  
**HN:** <https://news.ycombinator.com/item?id=49897497>  
**Disposition:** New knowledge

## Question

What does a stateful replica of an external business system add to agent evaluation, and which guarantees should not be inferred from it?

## Finding

Worlds presents a useful layer between conversation evaluation and live integration testing: give each test an isolated, seeded copy of the business records an agent may change, mark the initial state, let the agent use its ordinary HTTP client or SDK against the local endpoint, then grade the resulting record diff against both required changes and protected records. Its public beta currently documents scoped Stripe billing/payment behavior, a native Zendesk subset, and combined support-and-billing workflows.

The reusable design is broader than those connectors: **treat the external system's final state as a first-class test artifact, while preserving unsupported behavior and missing evidence as inconclusive rather than success.** A transcript can show what an agent intended or claimed. A state diff can show which modeled records changed. Neither alone proves the live provider would behave identically, that the action was authorized, or that every external effect was captured.

## What the documentation establishes

### 1. Outcome checks include required effects and forbidden side effects

A suite couples starting data, tasks, and explicit outcomes. The documented Stripe grader can require a particular refund, credit, cancellation, plan change, no billing action, or escalation. It also protects unrelated and declared decoy accounts, checks invariants, and can apply a credit budget. A task without an expected outcome remains ungraded: it may be checked against shared protections and optionally receive advisory model commentary, but its keyed correctness verdict is `null`.

That distinction prevents fluent replies from becoming success evidence. The machine result uses separate states for passed, policy failure, incomplete configuration, setup failure, and inconclusive evidence. No traffic to the twin, unsupported routes, refused parameters, or unavailable grading evidence prevent a passing result. The optional model judge cannot change the deterministic exit status.

### 2. Repeatability belongs to the environment, not the model

For the same runtime version, seed, configuration, and ordered request sequence, Worlds claims byte-identical recorded state: canonical resource data, events, request history, counters, idempotency records, webhook delivery records, and logical time. Marks retain before-images for changed or deleted objects, and reset restores the seed and counters.

The boundary is explicit. Different model output, wall-clock values, random request data, external responses, or concurrent arrival order can produce a different result. Webhook HTTP timing remains wall-clock dependent, automatic delivery occurs outside the world lock, and at-least-once delivery across a restart can duplicate a send. Deterministic evaluation therefore requires pinning the runtime and seed, controlling request order and clock advances, flushing webhooks at fixed points, and deduplicating listener effects.

### 3. Failure injection can distinguish rejection from ambiguous completion

Scenarios can inject rate limits, server errors, latency, credential expiry, and dropped or reordered webhooks. Request rules have persisted counters, so retries participate in the scenario rather than bypassing it. Importantly, an injected error occurs before the modeled handler and before idempotency lookup: it represents a rejected operation with no business mutation, not a write that succeeded while its response was lost.

That makes retry testing repeatable, but it leaves a consequential gap. Real agents also need tests for ambiguous outcomes—such as a provider committing a write before a timeout or response loss—because safe recovery then requires fresh state and idempotency evidence rather than blind retry. The published scenario contract should not be read as covering that failure class.

### 4. Fidelity and containment are separate from replay

The Stripe connector documents a deliberately limited surface and dated real-API behavioral probes. Unsupported money-changing parameters are refused with a Worlds-specific error instead of being silently accepted. Native Zendesk has local conformance coverage, but live API qualification is explicitly pending. Catalog entries such as Shopify and Salesforce are requests, not delivered connectors.

The local runtime is also described as a trusted-harness tool, not a security boundary. A local process may reach an unauthenticated loopback admin API; shared servers use broad operator or per-world administration rather than project/tenant isolation; and removing admin credentials from an agent's environment does not isolate its process. The documented storage uses disposable SQLite worlds with performance-oriented durability settings, so needed evidence must be exported separately.

## Reusable evaluation pattern

1. **Model the effect surface.** Define allowed operations, explicit omissions, and fail-closed behavior for unsupported consequential parameters.
2. **Seed and mark state.** Preserve the exact runtime version, seed bytes, scenario, task, and starting mark needed for reconstruction.
3. **Grade positive and negative outcomes.** Check the requested change, protected records, budget, unexpected resources, and whether the agent actually reached the modeled system.
4. **Keep evidence states distinct.** Passed, failed policy, bad setup, and inconclusive coverage should not collapse into one score.
5. **Exercise recovery paths.** Test pre-write rejection, retryable errors, credential expiry, reordering, and separately model post-write response loss or other ambiguous completion.
6. **Revalidate against the live provider.** A deterministic twin can identify agent regressions only within its implemented contract; dated drift probes and explicit coverage gaps remain necessary.
7. **Treat the harness as privileged.** Keep agents away from administrative credentials and use process/network containment when running code that is not trusted.

## Limitations

- Scout read the public product page, documentation, connector scope, replay contract, failure-scenario reference, deployment guide, release page, and known limitations. The installation guide and package require beta access and were not inspected.
- Scout did not install or run Worlds, execute its self-test, inspect its source or build log, compare dumps, or reproduce a Stripe drift probe.
- All implementation, determinism, conformance, and real-API fidelity statements are vendor claims. The public documentation gives unusually specific boundaries, but documentation is not execution evidence.
- Stripe coverage is deliberately partial. Native Zendesk live API qualification is pending, and combined workflows inherit both connectors' limits.
- The HN submission had one point and no comments when inspected; it establishes discovery and announcement timing, not adoption or independent validation.
- This is a public beta. The release notes warn that saved-world compatibility can change and that disposable worlds may need recreation from preserved inputs.

## Sources inspected

- HN item 49897497: <https://news.ycombinator.com/item?id=49897497>
- Product overview: <https://www.usesparta.co/>
- Documentation start and result semantics: <https://www.usesparta.co/docs>
- Tasks and deterministic outcomes: <https://www.usesparta.co/docs/tasks>
- Failure conditions: <https://www.usesparta.co/docs/scenarios>
- Replay and logical time: <https://www.usesparta.co/docs/determinism>
- Connector scope: <https://www.usesparta.co/docs/scope>
- Deployment, trust boundaries, and CI: <https://www.usesparta.co/docs/deploy>
- Current beta limitations: <https://www.usesparta.co/known-limitations>
- Release status: <https://www.usesparta.co/releases>

<ai_context>
summary: "A pinned email-send guard implements per-key budgets, atomic rate reservations, loop detection, approval holds, suppression, stable refusal reasons, and a non-expiring kill switch across several language ports. The reusable boundary is that a guard limits blast radius only when it owns every provider effect path; an in-process wrapper, host hook, or MCP proxy remains bypassable by code, credentials, machines, or routes outside that mediator. Scout inspected static source, specification, fixtures, and CI configuration but did not run the software or verify the Show HN incident independently."
triggers: ["agent email guard", "email blast radius", "effect budget", "send loop", "provider effect boundary", "agent-email-guard", "50432613"]
last_updated: "2026-11-09"
source_basis: "HN item 50432613 and agentisend/agent-email-guard commit f90bfe5360e0f0355c2ed76fe51539c25f597934 inspected 2026-11-09. Static README, specification, TypeScript guard implementation, repository tree, receipt-loop fixture, and CI workflow were reviewed; tests and live provider behavior were not run."
</ai_context>

# Agent email guards need an effect-owning boundary

**Observed:** 2026-11-09  
**Disposition:** New source-grounded finding  
**Question:** What does a practical blast-radius guard prove when an agent can send email, and where does that protection end?  
**Coverage:** Complete Show HN post and its only visible author comment; pinned repository README, specification, TypeScript guard core, tree, one red-team fixture, and CI workflow. Scout did not execute the packages, tests, benchmark, MCP proxy, hook, database stores, hosted API, or any email provider.

## Sources

- **Source:** [Hacker News item 50432613](https://news.ycombinator.com/item?id=50432613)
- **Repo:** [agentisend/agent-email-guard](https://github.com/agentisend/agent-email-guard)
- **Reviewed revision:** [`f90bfe5360e0f0355c2ed76fe51539c25f597934`](https://github.com/agentisend/agent-email-guard/commit/f90bfe5360e0f0355c2ed76fe51539c25f597934)

## What the inspected source implements

The repository defines a provider-neutral email decision gate with three outcomes: `allow`, `hold_for_approval`, and `refuse`. Its policy can combine:

- hourly, daily, and monthly budgets per key;
- a sliding one-minute rate ceiling;
- near-repeat and recipient-concentration loop detection;
- suppression rules;
- approval holds for listed or previously unseen recipients;
- a kill switch with no timer or automatic resume; and
- stable reason tokens plus numeric decision evidence.

The specification requires rate and budget reservations to be atomic. Two concurrent checks racing for the final unit must not both pass. If a provider call fails after reservation, `release` gives the capacity back idempotently; if the process crashes before release, the documented bias is toward over-refusal rather than over-sending. Shared Redis or Postgres layouts are intended to let different language workers consume one budget and kill switch.

The checked-in `receipt-loop-400` fixture scripts 400 identical attempts and declares a reference result of five sends with the guard and 400 without it. The HN author says this models a send timeout followed by retries whose wording can change enough to defeat simple idempotency keys. That incident result is a project-authored fixture and claim, not an independently observed production trace. Scout did not run the fixture.

## Reusable interpretation

The strongest idea is not email-specific: **put a monotone damage budget at the component that can actually withhold the external effect**.

A useful effect gate should therefore provide four separable properties:

1. **Bounded damage:** reserve scarce effect capacity atomically before execution, so concurrency cannot overshoot the configured ceiling.
2. **Typed interruption:** distinguish refusal from human approval rather than turning every unsafe action into an opaque tool error.
3. **Settled accounting:** record only provider-accepted effects, and release failed reservations without counting refused or held attempts as successful activity.
4. **Operator recovery:** make emergency pause persistent and require a separately authorized resume path instead of silently reopening after a timeout.

The placement of that gate determines what it proves. The repository and HN comment explicitly describe a protection ladder:

- an **in-process library** can be removed or routed around by code that controls its own tools;
- a **host hook or MCP proxy** can sit outside the agent's application code, but covers only calls and machines routed through it;
- a **provider-side gate** can cover every request made with the governed credential, provided no alternate credential or provider path exists.

Consequently, a passing guard decision is evidence only about one mediated route. Complete blast-radius control additionally needs an inventory of credentials and send paths, a guarantee that every provider effect crosses the gate, and a resume authority the agent cannot grant itself. Cross-language conformance vectors improve decision consistency, but they do not prove route completeness or mediator independence.

## Evidence limits

- The HN discussion had one visible comment, written by the project author; there was no independent operational corroboration.
- The repository is associated with a commercial hosted service. Its local-versus-hosted comparison is partly a product claim.
- Scout inspected static code and test configuration but did not run any test suite, race test, conformance vector, red-team scenario, package, hook, proxy, store, or provider integration.
- The reviewed code does not establish that deployed agents lack direct SMTP/provider credentials, alternate machines, unwrapped tools, or another send route.
- Atomic reservation requirements and shared-store behavior were read from the specification and implementation, not independently stress-tested.
- Loop similarity and recipient-concentration rules can still allow harmful but sufficiently diverse mail or block legitimate repetitive traffic; no measured false-positive or false-negative study was inspected.

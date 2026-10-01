<ai_context>
summary: "AW-1 demonstrates why a safety verdict is only as strong as the adapter that consumes it. At pinned revision bbfd428, the core breaker correctly returns HALT_AND_CONTAIN for the four shipped adversarial cases, but the MCP proxy blocks only status == BLOCKED; it therefore forwards those same halted calls to its execution handler with token=None. The repository's schema guard is also not invoked by the core intercept path. Test engine-to-effect contracts at the real dispatch boundary, including every deny status and missing-token behavior, rather than testing the detector alone."
triggers: ["AW-1", "MCP proxy", "HALT_AND_CONTAIN", "verdict contract", "circuit breaker", "fail-open adapter", "effect boundary"]
last_updated: "2026-10-01"
source_basis: "HN item 49916877 and repository inspection plus local execution of MvikManners/aw1-circuit-breaker at pinned revision bbfd428a97715638b8a09215a26243eb3c3bc4d9. Scout read the repository tree, README, architecture, core breaker, AST unpacker, MCP contract guard, MCP proxy, causal memory, example, benchmark, and adversarial suite. The shipped four-case suite and one focused proxy reproduction were run with Python 3; no external service or production tool was used."
</ai_context>

# A circuit breaker must bind its deny verdict to the effect boundary

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49916877  
**Repo:** https://github.com/MvikManners/aw1-circuit-breaker  
**Inspected revision:** [`bbfd428a97715638b8a09215a26243eb3c3bc4d9`](https://github.com/MvikManners/aw1-circuit-breaker/commit/bbfd428a97715638b8a09215a26243eb3c3bc4d9)

## Question

What does AW-1's deterministic pre-execution guard establish, and does its supplied MCP adapter preserve the core breaker's verdict at actual dispatch?

## The core detector has a concrete, fast-path control shape

`ExecutionBreaker.intercept` applies two implemented checks before issuing a random execution token:

1. `ASTSymbolicUnpacker` parses or lexically scans a string payload for code-execution, dangerous-target, network-egress, and financial-target markers. Matching dangerous primitives return `status: HALT_AND_CONTAIN` and no token.
2. `StatefulCausalMemory` applies a per-actor, linearly decaying amount bucket. A request above the configured limit also returns `HALT_AND_CONTAIN` and no token.

Scout ran the repository's four-case adversarial script from the pinned source. It reported **4/4 contained**: Base64-wrapped `exec`, socket egress, subprocess use, and a 95,000 amount against a 50,000 limit. Measured whole-call times in this environment were 0.0594–0.2081 ms. Those four hand-authored cases support only those code paths; they are not broad evidence of injection coverage, authorization correctness, or a production latency distribution.

## The MCP proxy reverses the safety result at dispatch

The core and adapter use different deny vocabularies:

- the core emits `status == "HALT_AND_CONTAIN"` for both dangerous primitives and velocity violations;
- `AW1MCPInterceptor.intercept_mcp_request` returns an error only when `verdict["status"] == "BLOCKED"`;
- every other status reaches the approved branch and calls `execution_handler(request, execution_token=verdict["token"])`.

Scout reproduced this with the pinned code by sending a `tools/call` request whose argument invokes `subprocess.Popen`. The core identified the dangerous primitive and produced no token, but the proxy called the supplied execution handler once and returned its `{"forwarded": true, "token": null}` result. In this entry point, the adapter therefore turns the core's halt into dispatch.

This is not a detector false negative. It is **verdict-contract drift** between producer and consumer. The shipped adversarial suite calls the core directly, so all four tests pass without exercising the adapter where the effect occurs.

## Other documented layers are not on the inspected core path

The architecture document describes an MCP schema layer and a licensing gate. The source contains `MCPContractGuard`, but `ExecutionBreaker.intercept` does not call it, and the MCP proxy does not register schemas or call it either. The breaker evaluates license state during construction, yet `intercept` does not condition approval or token issuance on `is_pro` or `license_status`. Its returned execution token is a random string; the inspected dispatch path does not verify it before calling the handler.

These facts do not mean the standalone schema validator or license parser can never be useful. They mean their presence in the repository does not establish that the published MCP execution path enforces them.

## Reusable control rule

A pre-effect safety mechanism needs an executable contract spanning detector, adapter, and effect:

- define one closed verdict type, not loosely compared status strings;
- make unknown status, missing token, malformed result, timeout, and guard exception deny by default;
- require the effect handler to verify an authorization object, rather than accepting optional metadata;
- test every deny variant through the public adapter and assert the handler call count remains zero;
- mutation-test the mapping by changing or adding a deny status; and
- separately test schema, identity, capability, amount, and replay policy if those are claimed layers.

Latency and detection tests answer whether a classifier or rule fires quickly. Only an end-to-end no-effect assertion answers whether the circuit is actually broken.

## Relation to existing Scout knowledge

[Typed prompt-injection decisions are not tool authorization](./2026-10-01-typed-prompt-injection-classifier-authorization-boundary.md) shows that an inspectable classifier ALLOW cannot supply authority. AW-1 exposes the complementary failure mode: even a deterministic deny is not containment unless the installed adapter preserves it at the effect boundary. This also extends [executable contract coverage](./2026-09-24-waku-agent-executable-contract-coverage.md): a guard's public entry point, verdict mapping, and handler non-invocation need direct coverage.

## Limits

This assessment covers revision `bbfd428a97715638b8a09215a26243eb3c3bc4d9`, not later fixes. Scout did not assess the paid service, external license provisioning, HOL registry, PyPI artifact provenance, Redis behavior, concurrency, or real MCP hosts. The local reproduction invoked only a recording function; no shell command or external effect ran. The repository was newly updated and had two GitHub stars when inspected, so it should be treated as an early implementation rather than evidence about a deployed system.

## Sources reviewed

- [HN item 49916877](https://news.ycombinator.com/item?id=49916877)
- [Repository tree at the inspected revision](https://github.com/MvikManners/aw1-circuit-breaker/tree/bbfd428a97715638b8a09215a26243eb3c3bc4d9)
- [Core breaker](https://github.com/MvikManners/aw1-circuit-breaker/blob/bbfd428a97715638b8a09215a26243eb3c3bc4d9/aw1/circuit.py)
- [MCP proxy](https://github.com/MvikManners/aw1-circuit-breaker/blob/bbfd428a97715638b8a09215a26243eb3c3bc4d9/aw1/mcp_proxy.py)
- [MCP contract guard](https://github.com/MvikManners/aw1-circuit-breaker/blob/bbfd428a97715638b8a09215a26243eb3c3bc4d9/aw1/mcp_guard.py)
- [AST unpacker](https://github.com/MvikManners/aw1-circuit-breaker/blob/bbfd428a97715638b8a09215a26243eb3c3bc4d9/aw1/unpacker.py)
- [Causal memory](https://github.com/MvikManners/aw1-circuit-breaker/blob/bbfd428a97715638b8a09215a26243eb3c3bc4d9/aw1/memory.py)
- [Adversarial suite](https://github.com/MvikManners/aw1-circuit-breaker/blob/bbfd428a97715638b8a09215a26243eb3c3bc4d9/tests/adversarial_stress_test_suite.py)

## Discovery coverage

The live HN Algolia `search_by_date` query for `AI agent` stories newer than Unix time `1790813231` returned nine items. Five were newer than the accepted scan: 49917403 (a rule-based job tool explicitly marketed as no AI), 49917210 (Polytoken documentation), 49917116 (Universal Modder), 49916877 (AW-1), and 49916834 (D2B spreadsheets). AW-1 was selected early because its small pinned repository exposed a concrete detector-to-MCP-dispatch path and executable adversarial suite. Metadata or introductory pages for the other new items did not justify stronger durable claims in this run.

<ai_context>
This finding examines DAM's paired agent/gateway architecture as a concrete implementation of credential-withholding at the network boundary. Scout inspected a pinned repository tree and selected first-party documentation but did not deploy the Kubernetes platform, inspect every enforcement template, run tests, or verify the authors' operational claims.
</ai_context>

# Credential withholding needs route ownership, not just secret injection

**Date:** 2026-10-16  
**Repo:** <https://github.com/dam-agents/dam>  
**Pinned revision inspected:** [`8212c687f5cd41a9a631608eac65d79349e76fae`](https://github.com/dam-agents/dam/tree/8212c687f5cd41a9a631608eac65d79349e76fae)  
**Disposition:** New knowledge

## Question

What must an agent platform own in order to withhold live upstream credentials from a long-running agent without mistaking proxy-based injection for complete containment?

## Finding

DAM's documented answer is a paired gateway pod rather than a credential helper inside the agent. The agent pod receives placeholders and an explicit HTTPS proxy; real upstream credentials are mounted only into the paired Envoy gateway. Per-agent Kubernetes NetworkPolicies are intended to make that gateway the agent's admitted egress route, while per-host TLS-terminating chains pin the upstream host, add or sign credentials on the wire, and consult an authorization service before forwarding.

The reusable point is architectural: **secret injection becomes a security boundary only when the injector also owns routing, destination binding, request admission, and failure semantics.** Keeping a token out of the agent process reduces direct exfiltration, but it does not by itself prove that every request crossed the gateway, that an approved host received the intended account, or that malformed configuration failed safely.

## What the pinned source shows

### 1. The secret boundary is paired with an egress boundary

The security documentation describes an agent pod with no service-account token and no ambient-mesh identity. Kernel-level NetworkPolicies admit its external path through its paired gateway, while the gateway remains in the mesh and uses its per-agent SPIFFE identity for platform calls. Upstream tokens are stored in owner-labelled Kubernetes Secrets selected for that owner's gateway; the agent pod does not mount those Secret bytes.

This layering matters. A proxy environment variable is client configuration, not enforcement: a compromised client can ignore it. DAM's claimed security property depends on the NetworkPolicy and destination-side authorization policies making alternate routes unavailable. The repository contains controller-side Envoy rendering and Helm policy templates, but Scout did not trace or test every generated rule.

### 2. Credential injection also needs destination binding

For a credentialed host, the documented Envoy chain terminates the agent's TLS, injects the relevant header or query value, and forwards through a cluster pinned to the configured host with explicit SNI and certificate-name validation. The inner `Host` header does not select another destination. S3-style credentials take a different path: the gateway re-signs a request with the real key only when its placeholder identifies the connection, and a per-connection path guard constrains signing to the configured bucket scope.

This closes an important class of confused-deputy error: a credential must not follow attacker-controlled routing metadata merely because the request passed through the correct proxy. The same principle applies to any credential broker—bind the secret use to the destination, account identity, method/path scope, and exact connection being invoked.

### 3. The fallback behavior is part of the policy

The source does not present every configuration failure as fail-closed. If a referenced credential file is already missing when Envoy configuration is rendered, the documented behavior degrades that host to an **allow-only** chain instead of crash-looping the entire gateway. The request can still reach the pinned host without authentication, where it will usually fail upstream. An invalid host gets no chain, and a later Secret-deletion race can prevent a gateway pod from starting until the controller evicts the superseded pod.

This is a deliberate availability trade-off, not a neutral implementation detail. “No credential leaked” can remain true while “no request left” is false: an unauthenticated request may still disclose its URL, body, or intent to the configured host. Operators therefore need separate, observable verdicts for credential withheld, request denied, request forwarded without credentials, and gateway unavailable.

### 4. Protocol coverage must be explicit

An accepted ADR adds opt-in HTTP/2 handling for gRPC hosts because the earlier injection path covered only HTTP/1.1. The secret half remains gateway-injected while a non-secret identifier may be placed in the pod environment. Other documented branches cover HTTP Upgrade tunnels and S3 request signing. The default SNI-miss chain is TCP passthrough, not credential inspection.

This is evidence against broad claims such as “all agent traffic is protected by the credential gateway.” Coverage is protocol- and route-specific. A platform should inventory every transport and make unsupported traffic either explicitly uncredentialed or explicitly denied, rather than infer coverage from the presence of one proxy.

## Reusable implications

1. **Withhold secrets outside the adversarial process.** Prefer a mediator that receives placeholders and owns the live credential over helpers that export tokens into the agent environment.
2. **Prove route ownership separately.** Proxy configuration is advisory unless kernel, sandbox, or equivalent controls prevent bypass.
3. **Bind credential use to an exact destination and connection.** Host pinning, certificate-name checks, account addressing, and path/method scope prevent credentials from following ambiguous request metadata.
4. **Type degradation outcomes.** “Forwarded without credential,” “denied,” and “gateway failed” have different confidentiality, availability, and retry consequences.
5. **Measure transport coverage.** REST, gRPC, WebSocket/Upgrade, signed object-store requests, and raw TCP passthrough do not inherit one another's controls.
6. **Keep credential isolation distinct from full containment.** DAM's own documentation places persistent workspace contents outside this credential trust boundary; secret withholding does not prove filesystem confidentiality, safe tools, or harmless agent behavior.

## Limitations

- Scout performed static inspection through GitHub's public API and commit-pinned raw files. It did not deploy DAM, render its Helm chart, inspect live NetworkPolicies, capture traffic, rotate a credential, or reproduce a failure.
- GitHub's recursive tree response contained 4,834 entries and reported `truncated: false`; only the README and selected architecture/ADR documents were read. Controller, Envoy, Helm, and test files were present but were not exhaustively inspected or executed.
- The security and operational behavior described above is first-party documentation. Repository presence is evidence of a design and implementation surface, not independent proof that a deployment has complete mediation or correct configuration.
- The Search API returned `incomplete_results: false`, but the query is a relevance filter, not an exhaustive survey of agent runtimes.
- Repository stars and update times were used only for discovery. They do not establish maturity, correctness, adoption, or security.

## Sources inspected

- Discovery query: GitHub Repository Search API, `"AI agent" runtime pushed:>=2026-10-01 stars:>20`, sorted by updated; `total_count: 112`, `incomplete_results: false`
- [Repository metadata](https://api.github.com/repos/dam-agents/dam)
- [Pinned repository tree](https://github.com/dam-agents/dam/tree/8212c687f5cd41a9a631608eac65d79349e76fae)
- [README](https://github.com/dam-agents/dam/blob/8212c687f5cd41a9a631608eac65d79349e76fae/README.md)
- [Credential gateway architecture](https://github.com/dam-agents/dam/blob/8212c687f5cd41a9a631608eac65d79349e76fae/docs/architecture/credential-gateway.md)
- [Security and credentials](https://github.com/dam-agents/dam/blob/8212c687f5cd41a9a631608eac65d79349e76fae/docs/architecture/security-and-credentials.md)
- [Agent lifecycle](https://github.com/dam-agents/dam/blob/8212c687f5cd41a9a631608eac65d79349e76fae/docs/architecture/agent-lifecycle.md)
- [Schedules](https://github.com/dam-agents/dam/blob/8212c687f5cd41a9a631608eac65d79349e76fae/docs/architecture/schedules.md)
- [ADR-072: gateway credential injection for gRPC hosts](https://github.com/dam-agents/dam/blob/8212c687f5cd41a9a631608eac65d79349e76fae/docs/adrs/072-grpc-credential-injection.md)

## Related Scout knowledge

- [An agent credential proxy is not a data-egress boundary](./2026-09-24-agent-credential-proxy-is-not-data-egress-control.md) separates token withholding from controls over payload, destination, and post-secret behavior.
- [Agent Security: Enforcement Evidence and Runtime Coverage](../agent-security-enforcement-evidence.md) catalogs why a declared mediation architecture still needs per-effect route and coverage evidence.

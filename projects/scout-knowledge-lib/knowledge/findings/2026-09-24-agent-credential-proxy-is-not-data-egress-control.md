---
title: "Agent IAP — Credential Non-Disclosure Is Not Data-Egress Control"
source: hn
source_id: "49828744"
date: 2026-09-24
last_updated: 2026-09-24
type: finding
tags: [hacker-news, ai-agents, credentials, authorization, egress, least-privilege, mcp, audit]
relevance: high
---

<ai_context>
This note records a source-inspection assessment of Agent IAP, an early open-source credential proxy surfaced on Hacker News. Its reusable contribution is a precise separation between credential non-disclosure, call authorization, response-data control, and network egress. Scout did not run or security-test the proxy.
</ai_context>

# Agent IAP — Credential Non-Disclosure Is Not Data-Egress Control

## Source and coverage

- **HN:** [item 49828744](https://news.ycombinator.com/item?id=49828744)
- **Article:** [Introducing Agent IAP — Little Snitch meets 1Password for AI agents](https://vpetersson.com/2026/09/23/little-snitch-meets-1password-for-ai-agents/)
- **Repo:** [vpetersson/agent-iap](https://github.com/vpetersson/agent-iap)
- **Inspected revision:** [`3042f88253a6fb3ed8562ba237c490b64445d10a`](https://github.com/vpetersson/agent-iap/tree/3042f88253a6fb3ed8562ba237c490b64445d10a)
- **Observation date:** 2026-09-24
- **Read:** the complete project-author article, HN item and two comments, repository metadata, README security-model sections, and `SECURITY.md` at the pinned revision.
- **Not run:** the proxy, its 605 claimed tests, browser/MCP flows, 1Password integration, workload-token exchange, ACL prompts, audit verification, network isolation, or adversarial bypass tests. Scout did not inspect enough implementation source to verify README claims.
- **Disposition:** new knowledge — a concrete practitioner architecture that makes the boundary between protecting credentials and protecting returned data unusually explicit.

## What the project claims to do

Agent IAP places a credential-holding proxy outside an agent environment. The agent presents a proxy-specific token; the proxy checks an ordered ACL over the target, HTTP method/path, or MCP tool, optionally parks an `ask` request for human approval, injects the real upstream credential, and writes a hash-chained audit record. The README also describes an optional workload-token exchange that narrows a standing agent token to a self-declared request scope for at most an hour.

This changes what a compromised agent can steal. Instead of learning a reusable upstream secret, it can at most leak a bearer token usable against this proxy within the token lifetime and ACL. That is meaningful credential containment and makes per-agent attribution and revocation possible without rotating the upstream key.

It is not, by itself, data containment. The project's own article, README, and security policy all state that response bodies are not inspected. An injected agent that is legitimately allowed to read analytics can read those analytics through the proxy and send them elsewhere over an independently available network path. The proxy also concentrates every fronted credential in one process, so compromise of that host expands rather than narrows the credential blast radius.

## Reusable design signal: protect four different flows

“Keep secrets away from the agent” should not be used as shorthand for “keep the agent safe.” A deployed control needs separate evidence for four flows:

1. **Credential custody:** Can the agent, a same-user process, a log, or an MCP child recover the upstream secret? Agent IAP's documented stdio bridge is explicitly not a process-isolation boundary because the child receives the credential in its environment.
2. **Request authority:** Is this agent or workload allowed to invoke this exact target, operation, and argument class now? Method/path/tool ACLs narrow the surface, but the project notes that they do not infer intent or distinguish two semantically different requests with the same route.
3. **Response authority:** Is the agent entitled to receive every field or record returned by an allowed request? A request gate cannot answer this when it does not inspect responses; upstream object- and field-level controls remain necessary.
4. **Onward egress:** After receiving authorized data, where may the agent send it? This requires a separate network/egress boundary with destination-aware observation and denial. Secret non-disclosure does not stop the agent from exfiltrating the data the secret unlocked.

The controls compose, but none substitutes for another. A useful receipt should therefore identify the agent and workload token, effective ACL rule and revision, exact upstream operation, credential mediator, upstream data scope, and observed egress disposition separately. “Allowed by the credential proxy” proves only the mediated request decision.

## Additional boundaries worth preserving

- **Human approval has an attention budget.** The article deliberately defaults approval to the narrowest scope and `Once`, warns about prompt habituation, and reserves prompts for requests that cannot safely become standing rules. That is a usability design, not evidence that operators will notice malicious requests.
- **Self-declared workload scope is attenuation, not independent authorization.** The README says a workload token can narrow but not widen the standing ACL; an agent that requests its whole entitlement remains as broad as that ACL.
- **Bearer identity is not channel binding.** The inspected revision documents TLS and short token lifetimes but no mTLS binding. Possession of a copied live token is therefore sufficient within its remaining policy scope.
- **Hash chaining is tamper evidence under a limited attacker.** The README correctly says an attacker able to rewrite the entire local audit file can rewrite the chain; external shipping is needed for a stronger record.
- **The proxy is a security concentration point.** Its own security policy treats an ACL bypass or credential leak as affecting every fronted service. Deployment hardening and independent review matter more as credential coverage grows.

## Limitations

This is an architecture assessment of project-authored material from a young, fast-moving repository, not an independent security evaluation. The HN discussion contained only two supportive comments when reviewed. The claimed behavior, test count, profile coverage, daily use, and tamper evidence were not reproduced. The pinned revision may differ from published binaries, and no release provenance or deployment configuration was checked.

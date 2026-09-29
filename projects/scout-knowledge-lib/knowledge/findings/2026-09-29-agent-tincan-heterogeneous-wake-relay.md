<ai_context>
summary: "Agent Tincan is a young Tailscale-scoped relay that makes heterogeneous agent wake-up, durable queues, authenticated identity, bounded delegation chains, audit, and optional approval part of one operational protocol; its explicit full-mutual-trust boundary is as important as its interoperability pattern."
triggers: ["Agent Tincan", "heterogeneous agents", "agent wake adapters", "Tailscale identity", "agent relay", "delegation chain", "owner approval"]
last_updated: "2026-09-29"
source_basis: "Static inspection of mvanhorn/agent-tincan at pinned revision a281666df5ec668cc9fb2e229eca54b0b9425634: README, trust model, protocol, repository tree, selected identity/policy/relay/store code, and approval/audit tests. No build, test execution, or live deployment."
</ai_context>

# Agent Tincan: interoperability needs wake, identity, queue, and trust semantics

**Date:** 2026-09-29  
**Disposition:** New knowledge

## Observation

GitHub repository search surfaced [mvanhorn/agent-tincan](https://github.com/mvanhorn/agent-tincan), a recently created Go project for relaying work among agents that live in unlike operating environments. At the inspected revision, its adapters cover continuously running services, paused or proxy-only sandboxes, local coding CLIs, webhook-driven agents, an email-woken agent, and browser-backed web agents. The relay queues requests while a target is unavailable and uses a target-specific wake method rather than requiring every participant to expose the same inbound interface.

This is a useful implementation signal because it treats cross-agent communication as an operational protocol, not merely a shared message schema. The protocol includes request states (`held`, `queued`, `delivered`, `claimed`, and terminal states), claim leases, clarification rounds, progress, reply acknowledgement, attachments, fan-out groups, and bounded urgent delivery. Relay-managed chain fields reject loops and chains beyond four hops. Tailscale `WhoIs` supplies machine identity; client-provided sender identity is ignored. An append-only hash-chained audit records transitions, and a relay-side approval policy can hold selected requests before delivery.

The strongest reusable pattern is therefore a five-part interoperability layer:

1. **Identity:** authenticate the actual sending runtime outside model-controlled content.
2. **Durability:** retain requests and unseen replies across sleeping agents and failed delivery attempts.
3. **Wake adaptation:** separate the message protocol from the environment-specific mechanism that produces a new turn.
4. **Delegation context:** preserve the relay-derived chain across nested requests, with explicit loop and depth bounds.
5. **Effect admission:** make approval a relay state that prevents delivery, rather than an instruction that the receiving model is expected to honor.

This complements the operation-admission patterns in [Agent Runtime Operation Admission and Identity](../agent-runtime-operation-admission-and-identity.md): the approval boundary here sits between agents and is tied to authenticated chain identity, while each target still needs its own controls for consequential effects.

## The trust boundary is deliberately broad

The repository is unusually direct about what these controls do **not** provide. Joined agents trust one another like teammates; by default, a request can cause a target with shell, browser-account, calling, or spending powers to act without per-request human confirmation. The relay can read message bodies and attachments. Tailscale membership is the primary security boundary. Optional allowlists and owner approval narrow selected paths, but they do not turn mutually trusting agents into independently contained principals.

That distinction matters. Authenticated provenance, tamper-evident logging, cycle prevention, and approval state improve attribution and control, but they do not establish that a request is safe. A compromised low-trust agent can still ask a higher-power teammate to act unless chain-aware policy holds or rejects it. Browser-backed adapters add account and terms-of-service risk, which the project's trust model also discloses.

## Evidence and limitations

Scout inspected revision [`a281666df5ec668cc9fb2e229eca54b0b9425634`](https://github.com/mvanhorn/agent-tincan/commit/a281666df5ec668cc9fb2e229eca54b0b9425634). The repository tree was complete in the GitHub Trees API (`truncated: false`, 426 entries). Static source inspection found a Tailscale `WhoIs` resolver, relay code that records queued and held transitions with relay-derived chain fields, approval policy code, and hash-chain audit storage. Test files include cases named `TestApprovalUsesRecordedChainAndFailsClosed`, `TestNeverApprovedContentRemainsPrivate`, and `TestAuditChainVerifiesAndDetectsTampering`.

These are implementation and test-presence observations, not proof of deployed behavior. Scout did not clone, build, execute tests, operate a tailnet, inspect every adapter, or validate the claimed live integrations. The README itself says live end-to-end runs were still pending for several newer web and CLI teammates. Repository metadata showed 135 stars at observation time; popularity is not evidence of reliability or adoption.

## Sources

- **Repo:** https://github.com/mvanhorn/agent-tincan
- **Inspected revision:** [`a281666df5ec668cc9fb2e229eca54b0b9425634`](https://github.com/mvanhorn/agent-tincan/commit/a281666df5ec668cc9fb2e229eca54b0b9425634)
- **Primary sources:** [README](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/README.md), [trust model](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/docs/trust-model.md), [protocol](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/docs/protocol.md), [Tailscale identity resolver](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/internal/identity/whois.go), [approval policy](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/internal/policy/approval.go), [relay server](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/internal/relay/server.go), [approval tests](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/internal/relay/approval_test.go), and [audit tests](https://github.com/mvanhorn/agent-tincan/blob/a281666df5ec668cc9fb2e229eca54b0b9425634/internal/store/audit_test.go)
- **Discovery query:** GitHub Repository Search API `"AI agent" created:>2026-09-20`, sorted by stars descending; `total_count: 8833`, `incomplete_results: false`
- **Coverage:** README, trust model, protocol, complete repository tree listing, selected source files, and selected tests; static inspection only

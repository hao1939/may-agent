<ai_context>
summary: "Capsem gives 'air-gapped' a concrete but narrower meaning: an agent VM has no ordinary uplink, while DNS, HTTP(S), MCP, terminal, and optional private-network or published-port paths cross named host mediators over vsock. That topology can make egress inspectable and deny-by-policy, but it is not absence of connectivity; every exception needs separate admission and evidence, and same-network VM traffic explicitly bypasses HTTP/TLS inspection. This is pinned static repository evidence for a pre-release system, not an independently run containment test."
triggers: ["Capsem", "agent VM air gap", "mediated egress", "vsock proxy", "agent network isolation", "MITM policy", "private agent network", "published port", "session ledger"]
last_updated: "2026-10-15"
source_basis: "HN item 50097811 and pinned static inspection of google/capsem at revision b862c89d8363fb2ffa09a870378122aa3e8fb532, including README, network-isolation, virtualization, policy, and session-telemetry documentation plus repository tree. Scout did not build or run Capsem or reproduce its isolation tests."
</ai_context>

# An agent VM “air gap” is a mediation topology, not absence of connectivity

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=50097811  
**Repo:** https://github.com/google/capsem  
**Inspected revision:** [`b862c89d8363fb2ffa09a870378122aa3e8fb532`](https://github.com/google/capsem/commit/b862c89d8363fb2ffa09a870378122aa3e8fb532)

## Question

What security claim can a coding-agent runtime legitimately make when it calls a
VM “air-gapped” but still lets the agent use models, fetch dependencies, call
MCP tools, join private networks, or expose ports?

## Source-grounded finding

Capsem provides a useful answer by making the paths explicit. Its guest starts
without an ordinary uplink. A dummy interface and guest-side redirects capture
DNS, HTTPS, plain HTTP, and several development-proxy ports. DNS and web traffic
then cross fixed vsock services to host handlers, where rules can deny, ask,
allow, or transform typed security events and where a per-session ledger records
requests and payload references. Terminal, MCP, and other control traffic use
separate vsock services.

The resulting guarantee is not “the VM cannot communicate.” It is closer to:
**the default external communication paths are deliberately relocated into
host-owned mediators.** Hardware virtualization narrows direct host authority;
the no-uplink topology makes selected egress paths observable; policy and
logging then make those observed paths governable. These are three different
claims and should be tested separately.

That distinction matters because Capsem also documents intentional exceptions:

- A named private network plugs selected VMs into a confined layer-2 switch.
  Membership is the authority, and members can reach one another; the switch is
  explicitly not a policy engine.
- Traffic between members does not pass through the HTTP or TLS proxies. The
  ledger can record plug/refusal/close events and switch counters, but those are
  not equivalent to request-level inspection.
- A published port relays a host-loopback listener into one VM through another
  confined router path.
- The proxy terminates guest TLS with a Capsem CA trusted inside the guest. That
  supports HTTP-level inspection for compatible traffic, but it is not a proof
  that every protocol, pinned client, custom trust store, private-network flow,
  or future extension is mediated by the same parser and policy rail.

“Air-gapped” is therefore best read as a **topology claim**: there is no general
NIC-to-uplink path. The meaningful security contract is the complete inventory
of allowed bridges, who can create them, what each bridge can enforce, and what
evidence remains after use.

## Reusable implication

An agent runtime should publish an egress matrix rather than one isolation
label. For each communication route, record:

1. **Admission:** who may create the route, join the network, publish the port,
   or change its policy.
2. **Transport:** which guest endpoint reaches which host-owned component.
3. **Enforcement:** whether the component can withhold the effect, and at what
   semantic layer (frame, DNS name, HTTP request, MCP call, or process action).
4. **Observation:** what is durably recorded, including denied attempts and
   route lifecycle events.
5. **Exceptions:** which flows bypass content inspection, credential
   substitution, or ordinary policy parsing.
6. **Closure:** what proves revocation removed the route and terminated or
   fenced already-open flows.

This avoids two opposite errors: treating a VM with mediated web access as
literally disconnected, and treating the existence of one proxy as proof that
all agent communication is governed. In a task system such as May, a useful
follow-up would be to map every execution environment’s network capability to
this matrix and require effect receipts to identify the actual route used,
rather than inheriting a generic “sandboxed” label.

## Evidence and limits

- The pinned repository contains Rust hypervisor, router, gateway, policy,
  ledger, SDK, and extensive test source, plus documentation that names the
  guest redirects, vsock ports, private-network exception, published-port path,
  ledger coverage, and host-side filesystem defenses.
- The root README labels Capsem 0.6 a pre-release undergoing qualification and
  says public installation instructions and detailed documentation are being
  held until release. It also states that the repository is not an official
  Google project despite its GitHub organization location.
- Scout inspected source documentation and the repository tree but did not
  build Capsem, boot a VM, inspect live traffic, run its tests, challenge route
  closure, or verify release packages. The finding describes the declared and
  implemented architecture at one revision, not independently demonstrated
  complete mediation or production reliability.
- The marketing site contained screenshot placeholders when inspected, and HN
  commenters questioned both those placeholders and the meaning of “air-gapped.”
  Those comments motivated the boundary question but are not implementation
  evidence.

## Relation to existing Scout findings

- [Augur](./2026-09-27-augur-macos-agent-sandbox-boundary.md) shows that live VM
  containment does not make later host consumption of agent-writable artifacts
  safe. Capsem adds the complementary need to enumerate every communication
  bridge during execution.
- [Agent House](./2026-10-04-agent-house-stateful-microvm-boundaries.md) separates
  VM lifecycle and durability contracts. Capsem similarly shows that network
  isolation, semantic policy, and telemetry are separate contracts rather than
  one “sandbox” property.

## Primary evidence reviewed

- [HN item 50097811](https://news.ycombinator.com/item?id=50097811)
- [README at the inspected revision](https://github.com/google/capsem/blob/b862c89d8363fb2ffa09a870378122aa3e8fb532/README.md)
- [Network isolation and explicit bypass paths](https://github.com/google/capsem/blob/b862c89d8363fb2ffa09a870378122aa3e8fb532/web/docs/src/content/docs/security/network-isolation.md)
- [Virtualization and VirtioFS threat model](https://github.com/google/capsem/blob/b862c89d8363fb2ffa09a870378122aa3e8fb532/web/docs/src/content/docs/security/virtualization.md)
- [Unified policy rail](https://github.com/google/capsem/blob/b862c89d8363fb2ffa09a870378122aa3e8fb532/web/docs/src/content/docs/security/policy.md)
- [Session telemetry and ledger scope](https://github.com/google/capsem/blob/b862c89d8363fb2ffa09a870378122aa3e8fb532/web/docs/src/content/docs/architecture/session-telemetry.md)

## Discovery coverage

The live HN Algolia `search_by_date` query for `agent` stories (20 newest hits)
surfaced item 50097811. Case-insensitive searches for the HN item ID,
`capsem.org`, and the primary repository URL found no existing Scout record.
Broader searches found related microVM and sandbox findings, but none assessed
Capsem or the distinction between no-uplink topology, mediated egress, and
explicit bypass routes, so a distinct source-level finding was warranted.

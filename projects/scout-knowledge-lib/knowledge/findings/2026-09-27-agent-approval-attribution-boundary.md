---
summary: "Pinned Agent Threat Rules and AgentFlow4J sources show two complementary approval boundaries: actor identity cannot be trusted from a caller payload, and a durable node-name marker does not bind approval to the exact action state that was reviewed."
triggers: ["agent approval", "approver identity", "human in the loop", "approval forgery", "event provenance", "approval subject binding", "approval marker", "Agent Threat Rules", "ATR-2026-02641", "AgentFlow4J"]
last_updated: "2026-09-27"
source_basis: "Static inspection of Agent-Threat-Rule/agent-threat-rules at commit 10e4ca4624fc5cd27523d39002d51c10d439ff50 and datallmhub/agentflow4j at commit 8333a935e769f0c96327dd1c089e2b589d796a1b. Reviewed approval APIs, implementation documentation, and selected repository-authored tests; tests and measurements were not independently run."
---

# Approval evidence needs trusted actor attribution, not a caller-supplied name

<ai_context>
Use this finding when designing human-approval records or detection around agent tool calls. An approval payload that names a person is not evidence that the person authenticated or decided; event direction, authenticated principal, candidate identity, and the resulting server-side decision need separate trusted provenance.
</ai_context>

**Observed:** 2026-09-27  
**Disposition:** New source-grounded finding  
**Coverage:** Two current GitHub repository searches (`incomplete_results: false`); pinned repository metadata and trees; Agent Threat Rules enforcement documentation, TypeScript engine, JSON rule schema, and one approval-attribution rule with embedded cases; plus AgentFlow4J's approval API, graph resume path, documentation, and selected tests. Static inspection only.

## Sources

- **Repo:** [Agent-Threat-Rule/agent-threat-rules](https://github.com/Agent-Threat-Rule/agent-threat-rules)
- **Pinned revision:** [`10e4ca4624fc5cd27523d39002d51c10d439ff50`](https://github.com/Agent-Threat-Rule/agent-threat-rules/commit/10e4ca4624fc5cd27523d39002d51c10d439ff50)
- **Approval-attribution rule:** [`ATR-2026-02641`](https://github.com/Agent-Threat-Rule/agent-threat-rules/blob/10e4ca4624fc5cd27523d39002d51c10d439ff50/rules/excessive-autonomy/ATR-2026-02641-client-supplied-approver-identity.yaml)
- **Reference engine:** [`src/engine.ts`](https://github.com/Agent-Threat-Rule/agent-threat-rules/blob/10e4ca4624fc5cd27523d39002d51c10d439ff50/src/engine.ts)
- **Rule schema:** [`spec/schema/rule.schema.json`](https://github.com/Agent-Threat-Rule/agent-threat-rules/blob/10e4ca4624fc5cd27523d39002d51c10d439ff50/spec/schema/rule.schema.json)
- **Enforcement documentation:** [`README.md`](https://github.com/Agent-Threat-Rule/agent-threat-rules/blob/10e4ca4624fc5cd27523d39002d51c10d439ff50/README.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" security pushed:>2026-09-25`, sorted by updated; `total_count: 367`, `incomplete_results: false`
- **Implementation contrast repo:** [datallmhub/agentflow4j](https://github.com/datallmhub/agentflow4j)
- **Inspected revision:** [`8333a935e769f0c96327dd1c089e2b589d796a1b`](https://github.com/datallmhub/agentflow4j/commit/8333a935e769f0c96327dd1c089e2b589d796a1b)
- **AgentFlow4J primary sources:** [`ApprovalGate`](https://github.com/datallmhub/agentflow4j/blob/8333a935e769f0c96327dd1c089e2b589d796a1b/agentflow4j-graph/src/main/java/io/github/datallmhub/agentflow4j/graph/ApprovalGate.java), [`ResumeOptions`](https://github.com/datallmhub/agentflow4j/blob/8333a935e769f0c96327dd1c089e2b589d796a1b/agentflow4j-graph/src/main/java/io/github/datallmhub/agentflow4j/graph/ResumeOptions.java), [graph resume path](https://github.com/datallmhub/agentflow4j/blob/8333a935e769f0c96327dd1c089e2b589d796a1b/agentflow4j-graph/src/main/java/io/github/datallmhub/agentflow4j/graph/AgentGraph.java#L151-L202), [approval documentation](https://github.com/datallmhub/agentflow4j/blob/8333a935e769f0c96327dd1c089e2b589d796a1b/docs/approval-gate.md), and [graph approval tests](https://github.com/datallmhub/agentflow4j/blob/8333a935e769f0c96327dd1c089e2b589d796a1b/agentflow4j-graph/src/test/java/io/github/datallmhub/agentflow4j/graph/AgentGraphApprovalGateTests.java)
- **Current discovery query:** GitHub Repository Search API `ai agent durable execution approval pushed:>2026-09-20`, sorted by updated; `total_count: 7`, `incomplete_results: false`

## Source observation

The repository's `ATR-2026-02641` rule looks for an outbound agent tool-call envelope that combines an approval decision (`approve`, `reject`, or `request-revision`) with a caller-supplied approver identifier such as `decidedByUserId`, `approvedBy`, or `approver_id`. The rule's stated threat is not that the approval gate is disabled. It is that an agent may submit both the decision and the identity of the supposed human decider, leaving a record that says oversight occurred when the server never derived that identity from an authenticated session.

The rule also documents why matching only the approval path and identity field was inadequate. Its author says the first revision fired on all 24 benign adversarial probes, including audit rows, webhooks, API documentation, test fixtures, server responses, and logs describing a legitimate human decision. Version 2 adds three contextual requirements: a tool-invocation envelope at the start of the event, a decision action or endpoint, and an identity inside an outbound request container. Its embedded cases include both malicious-shaped calls and non-triggering records of completed approvals.

This is useful negative evidence about detection semantics: the same JSON fragments can appear in a request, a response, a log, a replay record, documentation, or a test. Content alone does not identify the event's direction or authority. The rule explicitly retains an irreducible false positive for a trusted approval bridge because a legitimate service acting for a human can be byte-identical to a forgery; it says that distinction must be triaged by caller identity rather than payload.

The repository does not present this rule as a production authorization control. It is `maturity: test`, has confidence 70, and requests `alert`. The reference engine's lane policy admits `test` rules to the analyst-oriented `alert` lane but not the `stable`-only `enforce` lane. The README further separates detection from blocking and states that blocking is opt-in. Thus the source supports a detection and review pattern, not a claim that regex recognition establishes or enforces human approval.

## Implementation contrast: a durable pause can still carry a coarse grant

AgentFlow4J supplies a concrete implementation contrast at revision
`8333a935e769f0c96327dd1c089e2b589d796a1b`. Its built-in approval gate runs
before a graph node, emits an interrupt, and saves a checkpoint. On resume,
`ResumeOptions.ofApproval(String node)` contributes a node name to a set stored
under `__approval.granted`; the built-in `requireFor` and `when` gates allow a
node whenever that set contains its name. This is real pause/resume plumbing,
not merely a README promise: the graph tests assert that a guarded payment node
does not run before interruption and does run after a node-name approval is
added.

The durable mechanism and the approval evidence are nevertheless different
things. `ApprovalRequest` contains only `nodeName` and `reason`, while
`ResumeOptions` carries approved node names and optional messages. Neither type
binds the grant to an authenticated actor, the canonical arguments or relevant
context digest, a request/revision identity, an expiry, or one-shot
consumption. The documentation's example appends a message such as `approved by
alice`, but message content is not trusted actor provenance. Because the marker
is retained in the checkpoint context, later checks of that node in the same
retained context bypass the built-in gate without re-evaluating the predicate;
a changed amount or other policy-relevant state is not part of the built-in
grant identity.

This is an abstraction-boundary observation, not a claim that every deployment
is exploitable. A hosting service can authenticate and authorize callers before
invoking `resume`, and AgentFlow4J explicitly permits custom gates with their
own bypass signal. But the framework's built-in approval record proves only
that some upstream caller marked a node label approved for the run. Selected
project-authored tests cover pause-before-execution, checkpoint presence,
node-name bypass, and sequential gating; Scout found no selected test that
rejects a different actor, changed action state, stale grant, or duplicate use.

## Design implication

A trustworthy approval boundary should bind four facts outside agent-controlled content:

1. **Authenticated actor:** derive the approving principal from the trusted session or identity provider, never from a request-body display field.
2. **Event direction and phase:** distinguish a proposed decision call from a response, audit observation, replay fixture, or documentation artifact using runtime-owned event metadata.
3. **Approved object:** bind the person and decision to the exact canonical action, scope, and revision that was reviewed.
4. **Server-side outcome:** record whether the authoritative service accepted the decision and whether the resulting execution grant or protected effect was issued.

Detection can alert when an agent attempts to carry approver identity in its own call, but it cannot make that identity trustworthy. The protected approval endpoint should ignore or reject caller-supplied attribution, derive actor identity from authentication, and emit the authoritative receipt itself. This complements [Agent Approval Needs a Separate Execution-Grant Boundary](./2026-09-11-execution-grant-conformance-boundary.md): a decision receipt is not execution authority, and this finding adds that a purported decision is not even trustworthy unless its actor attribution comes from outside the agent's payload.

## Limits

- Scout inspected both repositories' source and selected repository-authored tests but did not install dependencies, run the TypeScript engine or Java suite, replay the 24-probe review, or test a live approval service.
- The cited 24-of-24 first-version false-positive result and one residual ambiguity are maintainer claims embedded in the rule, not independent measurements.
- The rule references an external incident record, but this scan did not independently inspect that incident. The finding relies only on the repository's detection design and explicit evidence boundaries, not on verification that a named product was exploitable.
- Regex and envelope-shape checks can still be evaded or misclassified. A host must provide trustworthy event type and authenticated-principal data, and complete mediation remains an independent requirement.

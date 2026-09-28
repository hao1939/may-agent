<ai_context>
summary: "HN surfaced Stepgate, an early MCP server that turns linear agent runbooks into typed stepfiles whose sequencing, tool access, evidence checks, retries, approvals, and receipts are enforced outside the model. The useful distinction is that it can enforce procedure and submitted-output predicates, but not the semantic truth of model-authored output beyond those predicates."
triggers: ["Stepgate", "stepfile", "mechanical workflow gates", "agent runbook enforcement", "MCP procedure", "hash-chained agent ledger"]
last_updated: "2026-09-28"
source_basis: "HN item 49872350 plus the Stepgate repository metadata, README, and how-it-works document at commit a32c456efc901e2ae9419ab495d0577583c8efe3. Scout inspected documentation but did not install the package, execute a stepfile, run tests, or audit the implementation."
</ai_context>

# Agent runbooks become controls only when the runtime owns progression

**Date:** 2026-09-28  
**Source:** https://news.ycombinator.com/item?id=49872350  
**Repo:** https://github.com/Chaarangan/stepgate  
**Inspected revision:** [`a32c456efc901e2ae9419ab495d0577583c8efe3`](https://github.com/Chaarangan/stepgate/commit/a32c456efc901e2ae9419ab495d0577583c8efe3)

## Signal

HN surfaced **Stepgate**, a new Apache-2.0 MCP server that represents a linear agent procedure as a portable YAML or JSON “stepfile.” Instead of giving the whole runbook to the model and trusting it to report completion, the server reveals one step at a time and advances only after the submitted structured output passes declared gates.

The useful architectural signal is not another workflow syntax. It is a separation of authority: the model produces judgment-dependent output, while an external runtime owns progression, API calls, credential attachment, retry policy, approvals, and receipts. A prose runbook is advice; the same procedure becomes a control only when the model cannot bypass the component that decides what step is current and whether it passed.

## Source-grounded details

According to the pinned project documentation:

- A stepfile declares typed inputs, remote OpenAPI or MCP tools, ordered steps, output schemas, and gates. It does not select a model or framework.
- The client receives only the current step. `stepgate_submit` returns the next step only after JSON Schema, JSONLogic, HTTP-verifier, or approval gates pass; failed gates can return diagnostics for a bounded number of attempts.
- Mechanical steps make calls and derive output without involving the model. For model-authored steps, gates can compare submitted fields with tool-call evidence retained by the server.
- Stepgate mediates tool calls, attaches credentials itself, applies declared-host checks across redirects, validates arguments, and avoids automatically retrying potentially effectful POST or PATCH requests after ambiguous failures.
- Optional human approval uses MCP elicitation before a later write step.
- Each run emits a hash-chained ledger containing hashes and lengths of inputs, outputs, and responses plus step, call, gate, retry, and outcome records. The ledger omits raw bodies and credentials; `stepgate --verify` checks chain integrity.

## What the mechanism does—and does not—guarantee

The project documentation explicitly narrows the guarantee: the path through a stepfile depends on submitted outputs and mechanical checks, but model-authored outputs can still vary. This gives a practical assurance hierarchy:

1. **Strongest:** mechanical steps and predicates computed wholly from server-mediated evidence.
2. **Conditional:** model-authored structured output checked against complete, relevant predicates.
3. **Weak:** semantic qualities that the schema or predicate does not encode.

A step being impossible to skip does not mean it was specified correctly. A gate can faithfully enforce an incomplete rule, an HTTP verifier can be wrong or unavailable, and a hash chain establishes post-hoc tamper evidence rather than truth or durable external timestamping. The client can also abandon a run; the mechanism prevents unauthorized advancement, not non-completion.

## Why it matters

This is a concrete implementation of the broader [verified-enforcement pattern](../agent-security-verified-enforcement.md): move consequential checks out of the model’s discretion. It also sharpens the design target for reusable agent skills and runbooks. Portability should include not only instructions, but also:

- a typed input and output contract;
- an explicit inventory of allowed operations and hosts;
- predicates tied to runtime-observed evidence;
- idempotency-aware retry behavior;
- human approval before consequential effects; and
- a receipt that distinguishes claimed output from verified transitions.

The most important review question becomes **predicate completeness**. If a procedure says “use the registry’s version,” a gate should compare each submitted version to the server-observed registry response, not merely check that a version-shaped string exists. Converting prose to schema without encoding the source-of-truth relationship only formalizes appearance.

## Evidence boundary

At inspection, the HN item had two points and no comments. GitHub metadata showed a repository created on 2026-09-26 with one star and no forks. The claims above describe the project’s documented architecture at the pinned revision; they are not independent evidence of production maturity, resistance to a malicious stepfile or server, implementation correctness, or usability across MCP clients. Scout did not install Stepgate, execute its tests, inspect all source code, or independently verify the security claims.

## Primary sources

- [HN item 49872350](https://news.ycombinator.com/item?id=49872350)
- [Repository at inspected revision](https://github.com/Chaarangan/stepgate/tree/a32c456efc901e2ae9419ab495d0577583c8efe3)
- [README](https://github.com/Chaarangan/stepgate/blob/a32c456efc901e2ae9419ab495d0577583c8efe3/README.md)
- [How Stepgate works](https://github.com/Chaarangan/stepgate/blob/a32c456efc901e2ae9419ab495d0577583c8efe3/docs/how-it-works.md)

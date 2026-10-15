<ai_context>
This finding uses Antiproton’s pinned implementation to separate credential opacity, tool-use authority, approval, and replay safety. Its useful warning is that a gate belongs to one mount: an ungated alias to the same plugin is a separate authority path, so reviews must inspect the agent’s complete mount topology rather than one policy object.
</ai_context>

# Agent authority is a topology, not a property of one tool gate

**Date:** 2026-10-15  
**Source:** GitHub repository search and pinned repository contents  
**Repo:** https://github.com/botiverse/antiproton  
**Inspected revision:** [`dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429`](https://github.com/botiverse/antiproton/commit/dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429)  
**Discovery query:** GitHub Repository Search API `"AI agent" checkpoint runtime in:readme,description`, sorted by updated; `total_count: 20,966`, `incomplete_results: false`  
**Coverage:** Static inspection of repository metadata, the complete README, a 593-entry recursive tree (`truncated: false`), runtime gateway and secret-resolution code, and selected project-authored policy, approval, sandbox, and idempotency tests. Scout did not install the project, run its tests, deploy its Cloudflare runtime, inspect every plugin, or attempt a bypass.  
**Disposition:** New source-grounded finding. Existing Scout notes cover secretless authority chains and approval-object binding, but none declares this repository or its mount-topology rule.

## What the pinned source shows

Antiproton places model-visible tools behind named mounts. A mount ties together a plugin installation, connection, optional server-resolved credential reference, version pin, and policy. The gateway resolves a model call to that mount, records an operation, classifies the call as read or write, and applies a per-tool or read/write decision of `allow`, `deny`, or `approval`. The default is important: absent policy entries allow the call.

The implementation supports several narrower mechanisms rather than one broad “secure agent” claim:

- Credential references are resolved in the gateway against the tenant and agent that own the mount; values are passed to plugin context rather than the JavaScript sandbox. The README explicitly distinguishes hiding a credential from constraining where it can be used: an HTTP mount with a credential must also bound destinations with `allowedHosts`.
- A denied call is recorded as rejected and does not reach the plugin. Selected tests exercise this on both the in-process SQLite and Durable Object storage adapters.
- A call requiring approval is persisted with its exact tool name and arguments and parks the task. `applyApproval` atomically decides the operation once and executes the recorded request rather than accepting replacement arguments from the agent.
- For a write with an idempotency key, the operation identity is derived from tenant, task, and key. A concurrent retry is admitted only once; an attempt that may have begun is not repeated and is reported as possibly landed. The project-authored tests exercise races and the distinction between a policy refusal that never ran and a write whose effect is uncertain.

These mechanisms compose, but they do not collapse into one boundary. The README says a gate binds the mount on which it is configured: two aliases of the same plugin are two authorities. If one mount requires approval while another mount exposes the same effective operation without policy, the second route is “a door beside the gate.” Credential opacity is similarly distinct from least authority: the model can exercise everything the mounted plugin and current policy permit without ever seeing the secret.

## Reusable review rule

Review the **complete authority topology** for an agent, not a screenshot of one guarded tool:

1. Enumerate every mount, alias, plugin, account or connection, credential reference, and effective tool set.
2. Normalize equivalent effects across aliases and plugins; a differently named route to the same external action is still an alternate authority path.
3. Compute effective policy after defaults. An absent policy or absent per-tool entry is an allow in this source, not a neutral state.
4. Bind approval to the exact persisted request and one atomic decision, then keep actor authentication and execution settlement as separate evidence.
5. Treat credential non-disclosure and use restriction separately: record who can cause a credentialed action, which destinations and operations are permitted, and which component actually holds the secret.
6. Bind retry identity to task and canonical request semantics, and preserve an explicit “may have landed” state when dispatch cannot be ruled out.

A useful conformance test should add a second alias or plugin path for the same effect and prove that global policy still holds. Testing only the intended guarded mount establishes local enforcement, not complete mediation.

## Limits

This is static source evidence from a 28-star repository, not an independent security evaluation or production-readiness finding. Project-authored tests being present does not prove they passed at the pinned revision. The scan did not verify authenticated approver provenance, the complete set of credential egress paths, plugin correctness, encryption-key operations, Cloudflare isolation, or whether every semantically equivalent external effect is mediated by the gateway. The README’s AppWorld and SWE-bench figures are maintainer-reported measurements and are not used here as independent performance evidence.

## Primary sources

- [README architecture, policy, credential boundary, verification claims, and declared gaps](https://github.com/botiverse/antiproton/blob/dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429/README.md)
- [gateway policy, approval, credential resolution, and operation admission](https://github.com/botiverse/antiproton/blob/dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429/src/runtime/gateway.ts)
- [secret-reference scoping](https://github.com/botiverse/antiproton/blob/dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429/src/runtime/secrets.ts)
- [policy-denial operation test](https://github.com/botiverse/antiproton/blob/dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429/test/policy-deny.ts)
- [idempotency race and uncertain-effect tests](https://github.com/botiverse/antiproton/blob/dc8a2c4924cfbc0e5037f65206c63c8fa2bb8429/test/idempotency-guard.ts)

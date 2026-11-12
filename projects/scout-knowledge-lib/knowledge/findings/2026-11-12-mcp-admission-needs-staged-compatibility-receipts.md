<ai_context>
summary: "TestedMCP's public snapshot separates install, protocol handshake, real tool calls, functional tasks, and security review; a successful MCP handshake is therefore an early compatibility receipt, not capability or safety proof."
triggers: ["TestedMCP", "MCP server admission", "MCP handshake", "tool call verification", "MCP compatibility receipts"]
last_updated: "2026-11-12"
source_basis: "Static review of HN item 50466914, TestedMCP's methodology and example listing, and the 299-record public scored.json snapshot with SHA-256 ec9e63e1901a33a82d6e0aee0149d308d6764b75e86be7fe596692c58fb50c47. Scout did not run the test harness, install any listed server, reproduce calls, audit source code, or validate the site's records independently."
</ai_context>

# MCP admission needs staged compatibility receipts

**Date:** 2026-11-12  
**Disposition:** New knowledge  
**HN source:** https://news.ycombinator.com/item?id=50466914  
**Source:** https://testedmcp.com/  
**Methodology:** https://testedmcp.com/methodology/  
**Reviewed data:** https://testedmcp.com/data/scored.json  
**Data revision:** `sha256:ec9e63e1901a33a82d6e0aee0149d308d6764b75e86be7fe596692c58fb50c47`

## Question

What does a current directory of installed and handshake-tested MCP servers show about the evidence needed before admitting an agent tool?

## Observation

The HN item links to TestedMCP, whose public snapshot contains 299 server records tested from 2026-10-27 through 2026-11-11. In the reviewed bytes, 197 records are labelled `working`, 66 `auth-gated`, 35 `failed`, and one `install-failed`. The site's definition of working is bounded: the package or endpoint installed or responded, then completed MCP `initialize` and `tools/list` without credentials.

The methodology deliberately separates stronger observations:

- A **handshake** proves that a specific package version or endpoint can expose a tool list under the test environment. An authenticated endpoint can receive only an `auth-gated` result without real credentials.
- A **real tool call** is a separate direct-client check. The dataset records at least one passing real call for 125 of 299 listings, including 124 of the 197 labelled working. The remaining 73 working listings have no passing real call and are capped at a score of 70.
- **Functional tasks** are narrower again: the methodology defines key-free tasks only for browser, filesystem, memory, and fetch categories. Only 35 snapshot records contain a functional-test object.
- **Model tool selection** is reported separately from direct calls and does not change the main score.
- **Security checking** is limited to version-range matches in published advisories for the package itself. Dependencies, permissions, data flows, behavior with credentials, and source review remain outside scope; findings do not change the score.
- **Maintenance, documentation, and license** contribute to the headline score but are not evidence that returned results are correct or that effects are safe.

An example listing for `@ui5/mcp-server` makes the separation concrete. It records install and handshake success, three passing read calls, three uncalled state-changing tools, an estimated schema/context cost, and no security audit. A 100/100 score therefore means that all scored operational and metadata checks passed plus the score cap was removed; it does not mean every tool, write path, credentialed behavior, dependency, or security property was tested.

## Interpretation

MCP admission should preserve a **staged compatibility ladder** rather than a single “works” bit:

1. **Artifact identity:** exact package version, endpoint, transport, and test environment.
2. **Startup/install receipt:** the artifact can be obtained or reached.
3. **Protocol receipt:** `initialize` and discovery complete, with the observed tool-surface hash retained.
4. **Capability receipt:** representative read and write calls return expected typed outcomes.
5. **Task receipt:** a bounded end-to-end task succeeds with postconditions and side effects checked.
6. **Authority and security review:** credentials, permissions, dependencies, data flows, and effect boundaries are assessed separately.
7. **Freshness:** any change in artifact, endpoint, tool surface, credentials, or verifier policy invalidates only the affected stage and requests targeted re-evaluation.

This avoids two opposite errors: rejecting a server merely because an unauthenticated probe cannot exercise it, and promoting handshake success into proof of useful or safe behavior. Direct protocol compatibility is valuable evidence, but it belongs near the beginning of admission, not at the end.

## Limits

This is producer-published evidence from an early-access commercial directory. Scout verified that the reviewed JSON contained 299 records and recomputed the counts above, but did not inspect the site's test runner, raw execution environment, all individual records, or payment and ranking operations. The snapshot is not a representative sample of all MCP servers. Statuses depend on the publisher's definitions and selected packages, and the dataset's presence of a tool-call or functional-test object does not independently prove that the claimed run occurred. The HN item had one point and no comments when inspected.

## Related Scout knowledge

- [MCP contract drift needs typed receipts](./2026-10-17-mcp-contract-drift-needs-typed-receipts.md)
- [Agent protocols: MCP, A2A, and the emerging stack](../agent-protocols-mcp-a2a.md)

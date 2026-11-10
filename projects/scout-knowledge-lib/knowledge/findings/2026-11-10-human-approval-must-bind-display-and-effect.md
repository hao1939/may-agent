<ai_context>
summary: "Pinned oathline-guard source binds an MCP approval to guard-rendered tool arguments, a separately displayed code, stored arguments, and one later execution. The useful boundary is that approval integrity needs separate receipts for what was displayed, who authenticated, what exact action was authorized, and which protected effect consumed it; a terminal check and local hash chain do not by themselves establish human identity or complete mediation."
triggers: ["oathline-guard", "MCP approval", "human approval display", "approval confusion", "tool-call confirmation", "exact argument binding"]
last_updated: "2026-11-10"
source_basis: "Static inspection of oathline/oathline-guard README, repository tree, guard, approval window, record layer, package metadata, and selected project-authored approval and core tests at commit e457dbbb37b4e37f95abbb939265a8e580106d08. Scout did not install the package, run tests, connect an MCP client or server, or verify Oathline Core independently."
</ai_context>

# Human approval must bind the display and the protected effect

**Date:** 2026-11-10  
**Disposition:** new knowledge  
**Question:** What must an MCP approval record bind for a person's “yes” to authorize only the tool call they actually saw?  
**Repo:** https://github.com/oathline/oathline-guard  
**Reviewed version:** commit [`e457dbbb37b4e37f95abbb939265a8e580106d08`](https://github.com/oathline/oathline-guard/commit/e457dbbb37b4e37f95abbb939265a8e580106d08)  
**Coverage:** repository metadata and recursive tree; `README.md`; `oathline_guard/guard.py`; `approve.py`; `record.py`; `registry.py`; `pyproject.toml`; the destructive-call example; and selected project-authored core and approval tests. Scout did not execute the code.

## Source observation

Oathline Guard is a local stdio MCP proxy. An operator supplies a tool-name allowlist for calls treated as reads. Every other discovered tool is held rather than forwarded upstream. The first call creates a proposal, stores canonicalized arguments, and returns an error-like deferred response to the agent without revealing the four-character approval code.

A separate approval process reconstructs text from the guard's record rather than accepting agent- or server-authored prose. It displays the server and tool, every argument, and the code last. Multi-line and long values are placed behind a visual gutter and re-hashed before the display is recorded; values that exceed the display or item budgets are refused. This is intended to prevent an argument from injecting a fake field or approval-code line into the prompt.

Typing the code writes a yes row but does not execute the tool. On the agent's next identical call, the guard process checks the pending row, confirms it, reconstructs carried values from stored arguments, verifies their hashes, and invokes the upstream once. Changed arguments produce a different proposal. After the approved result has been delivered, a later identical call produces a new proposal rather than reusing the old approval. A refusal is recorded and cannot later be replaced by a yes.

The checked-in tests describe and exercise these intended properties, including rejection of piped stdin, display hashing, wrong-code refusal, changed-argument separation, single execution, and concurrent handling of eight proposals. They are project-authored evidence only; Scout did not run them.

## Reusable interpretation

Human approval is a chain of distinct bindings, not one boolean:

1. **Presentation binding:** the approval service must render canonical action data itself and retain a commitment to exactly what appeared. Agent prose, tool descriptions, and unescaped values are not trustworthy confirmation text.
2. **Actor binding:** the decision must come from an authenticated human channel that the agent cannot exercise. Merely storing a configured person's name or seeing terminal-shaped input does not establish this.
3. **Candidate binding:** approval must name the exact tool, canonical arguments, relevant revision, and expiry. Any consequential change requires a new decision.
4. **Consumption binding:** a protected mediator must atomically consume that decision for one effect and record the actual upstream result. A displayed yes is not proof that execution occurred, succeeded, or remained faithful.

Oathline Guard provides useful source-level examples of presentation, candidate, and one-use consumption binding. It also keeps the display/decision process separate from the process holding the upstream pipe, so the approval window cannot directly execute the tool. That separation reduces accidental authority coupling even though both processes still trust shared local state.

This extends [Approval evidence needs trusted actor attribution](./2026-09-27-agent-approval-attribution-boundary.md): that finding separates authenticated actor identity and exact candidate identity from caller-supplied approval fields. Oathline Guard adds a concrete presentation-integrity problem—what the person saw must be cryptographically related to the candidate later executed. It also complements [Agent approval needs a separate execution-grant boundary](./2026-09-11-execution-grant-conformance-boundary.md): a confirmed display remains prospective evidence until a protected effect boundary consumes it.

## Limits

- The README explicitly says a pseudo-terminal satisfies the terminal check. A determined local process able to create a PTY can therefore imitate the expected input shape. The configured human name is a local string, not an authenticated principal established by an identity provider.
- The guard database, token store, and audit chain are local files shared by the guard and approval processes. The inspected initialization creates the directory and SQLite files but does not establish an external signer, remote append-only witness, or protection against a local principal that can rewrite or replace those stores.
- Complete mediation is not established. The README says an agent with a raw shell, raw credential, alternate MCP configuration, or other effect route can bypass the guard. The control applies only to calls routed through this proxy.
- The operator-authored read allowlist passes matching tool names without approval. The guard deliberately ignores upstream `readOnlyHint`, but Scout did not verify whether a configured “read” tool is actually non-mutating or whether tool semantics can change after configuration.
- Execution waits for the agent to repeat the identical call after approval; there is no waiting notification. The README also reports no upstream-call timeout, stdio-only support, one person per server, unmasked secret arguments, and no proof that displayed text was actually read or understood.
- The repository was newly created, versioned `0.1.0`, and had zero stars in the observed search result. Static code and checked-in tests do not establish production deployment, independent security review, usability, race safety, audit durability, or protection against a hostile local agent.
- The discovery Search API response reported `incomplete_results: false` for the bounded query, which does not make the scan exhaustive of GitHub.

<ai_context>
summary: "A pinned inspection of atani/mysh shows that agent database safety has at least two independent boundaries: query-effect authority and result visibility. Its MCP path removes a raw-output option and masks configured columns, but it does not enforce its advertised read-only query contract; the repository's own test accepts UPDATE. The CLI-adapter masking path also returns output unchanged when parsing fails or no configured header matches."
triggers: ["agent database access", "SQL MCP", "read-only tool", "output masking", "PII masking", "mysh", "fail-open parser", "configured sensitive columns"]
last_updated: "2026-09-27"
source_basis: "Static inspection of atani/mysh at commit 26fa3f6defc05020e21e72f0ae2805baf79bea3d; repository-authored tests were inspected but not executed because Go is unavailable."
</ai_context>

# Agent database safety needs separate write and visibility boundaries

**Date:** 2026-09-27  
**Disposition:** new knowledge  
**Repo:** https://github.com/atani/mysh  
**Pinned observation:** [`26fa3f6defc05020e21e72f0ae2805baf79bea3d`](https://github.com/atani/mysh/tree/26fa3f6defc05020e21e72f0ae2805baf79bea3d)

## Question

What does mysh's current implementation establish about safely exposing a production-like MySQL database to an AI agent?

## Source claims

The repository describes mysh as a safer MySQL CLI for AI workflows. Its README says production and non-TTY results are automatically masked when masking rules are configured, that raw production output requires interactive confirmation, and that raw output cannot be requested through its MCP server. The MCP tool description separately calls `mysh_query` a “read-only SQL query.”

## What the pinned implementation shows

The output-safety mechanism is real but narrower than automatic data-loss prevention. A connection enables masking only when it has configured column names or wildcard patterns. Matching is case-insensitive against result headers; values in matched columns are transformed before structured native/Redash results are formatted. The MCP request schema exposes no `raw` switch, and MCP evaluation passes non-TTY status into the same masking policy. This is useful defense in depth because masking occurs in the result path rather than depending on an agent instruction.

Two independent gaps remain:

1. **The advertised read-only effect boundary is not enforced by the MCP query path.** `mcpQuery` forwards caller-supplied SQL to the native, CLI, or Redash backend without a SELECT-only validator or read-only database session. The native path deliberately splits and executes every supplied statement. Most decisively, repository-authored `TestMCPQueryNativeQueryOK` expects `UPDATE t SET x=1` and treats the resulting “Query OK” response as success. This does not prove every backend or database account permits writes, but it does prove that the MCP adapter itself does not withhold a mutation. Actual write safety therefore depends on database credentials, server grants, or another external boundary—not the tool's “read-only” description.

2. **Masking assurance is configuration- and parser-dependent.** `ShouldMask` returns false when no mask rules exist and for development connections. Even when masking is enabled, the CLI adapter calls `ApplyToOutput`; that function returns the original output unchanged when the mysql output parser returns nil or when no configured header/pattern matches. The caller then continues to format and return that output. Native and Redash adapters avoid the text-parser dependency because they operate on structured headers and rows, but an unmatched or newly introduced sensitive column still remains unchanged. The implementation does not inspect values to discover sensitive data independently of column configuration.

These observations sharpen the repository's own limitation that masking is not a replacement for access control or database permissions. They also show why “raw output cannot be requested” is not equivalent to “raw sensitive data cannot be returned”: there may be no raw-mode flag while an uncovered column or unparseable adapter result still passes through unchanged.

## Reusable design implication

An agent-facing database tool should report and test at least two separate properties:

- **Effect authority:** enforce read-only behavior with a least-privilege database principal and a server-side read-only transaction/session where supported; reject or independently authorize mutations rather than trusting a tool description or SQL-prefix classifier.
- **Result visibility:** mask from structured result metadata before serialization, version and test the schema-to-policy mapping, and fail closed or emit an explicit degraded-policy error when required parsing or policy matching cannot be established.

A useful receipt would identify both: the database principal/read-only state that governed execution and the masking-policy version plus matched columns that governed release. “Query succeeded” and “masking enabled” are insufficient summaries when either boundary can degrade independently.

## Evidence inspected

- [`README.md`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/README.md)
- [`docs/ai-agent-safety.md`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/docs/ai-agent-safety.md)
- [`cmd/mcp.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/cmd/mcp.go)
- [`cmd/mcp_test.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/cmd/mcp_test.go)
- [`cmd/run.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/cmd/run.go)
- [`internal/config/config.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/internal/config/config.go)
- [`internal/db/db.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/internal/db/db.go)
- [`internal/mask/apply.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/internal/mask/apply.go)
- [`internal/mysql/parse.go`](https://github.com/atani/mysh/blob/26fa3f6defc05020e21e72f0ae2805baf79bea3d/internal/mysql/parse.go)

## Evidence boundary

This is static source and repository-authored-test inspection at one pinned commit. The repository tree response was not truncated. Go was unavailable in the Scout environment, so tests were not executed, no MCP server or MySQL server was started, and no claim is made about a deployed database's grants or runtime behavior. The GitHub repository search that surfaced this project returned `incomplete_results: false`; that describes the API response, not exhaustive coverage of all relevant repositories.

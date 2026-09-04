<ai_context>
This finding uses pgbot as a concrete case study in capability-bounded database diagnostics for agents, then contrasts DBQuill's controlled-write path. The reusable lesson is to place the no-write guarantee in database authority and treat any later mutation as a new, narrowly bound capability—not as an escalation of the read session. Transaction, resource, query-shape, approval, audit, and output-contract controls remain independent layers. This is not a production endorsement or an independent benchmark of either project's accuracy or security.
</ai_context>

# Make database diagnostics incapable before making them intelligent

Date: 2026-08-25
Source: https://news.ycombinator.com/item?id=49438492
Repo: https://github.com/pgrundev/pgbot
Commit reviewed: https://github.com/pgrundev/pgbot/tree/9660f4cb532c9ab0d4d0909011c6ff3955b831d5
Repo: https://github.com/jamesdffgy-source/DBQuill
Commit reviewed: https://github.com/jamesdffgy-source/DBQuill/tree/5e943e94152bc2a6ce775a7819ea98a3acb5383d

## Signal

A current Hacker News front-page submission introduces pgbot, a small PostgreSQL diagnostic client with CLI and MCP interfaces. The interesting design is not that an agent can inspect a database; a model could already issue SQL. It is that diagnosis is split into a deterministic evidence producer and an optional model interpreter, while mutation authority is intentionally withheld.

The author describes the tool as read-only and says its findings are computed in Go rather than invented by an LLM. The reviewed repository substantiates a layered version of that claim:

- the recommended PostgreSQL identity is a dedicated login holding `pg_monitor` but no write grants;
- every connection pins `default_transaction_read_only=on`, `statement_timeout=15s`, `lock_timeout=2s`, and a 10-second idle-transaction timeout;
- target probes run in explicit read-only transactions;
- an always-run test rejects embedded target SQL unless each statement begins with `SELECT` or `WITH`;
- MCP's agent-supplied `explain_plan` accepts one sanitized plain `SELECT`, uses plain `EXPLAIN` rather than `EXPLAIN ANALYZE`, and labels its output as an estimate;
- `schema_of` binds the relation name through `$1::regclass` and returns catalog metadata and estimated row count, not table rows; and
- the agent-facing JSON contract is versioned separately from the unstable human-readable report.

The highest-value pattern is therefore **incapability plus typed evidence**, not a prompt that tells an otherwise privileged agent to be careful.

## Why the layers matter

Each layer addresses a different failure class:

1. **Database role: authorization.** A tool bug or prompt injection should still meet an identity that lacks write grants. This is the primary boundary, provided operators actually use the dedicated role and do not pass a broadly privileged DSN.
2. **Read-only transaction: execution mode.** It makes intent explicit at the database protocol boundary and limits accidental mutation even if query construction changes.
3. **Timeouts and bounded pooling: availability.** Read-only does not mean harmless; an expensive catalog query, long snapshot, or lock wait can still worsen an incident. The repository caps its pool at four connections and gives statements and lock acquisition finite deadlines.
4. **Query-shape admission: semantic scope.** The MCP surface does not expose arbitrary SQL execution. In particular, plan inspection is restricted to one plain `SELECT` and does not execute it.
5. **Deterministic findings: epistemic provenance.** The model interprets already-computed observations instead of being the source of both evidence and conclusion.
6. **Machine-readable exactness: downstream honesty.** Plan costs and catalog row counts carry estimate labels in the payload rather than relying only on prose instructions to preserve uncertainty.

This separation also keeps remediation distinct from diagnosis. The repository may recommend actions such as dropping an index, but its target-database interface cannot perform those actions. That forces any mutation into a separate authority path where a human or another guarded workflow can re-check evidence and caveats.

## GitHub update: mutation should be a new capability, not a promoted read

A GitHub repository created on August 26, [DBQuill](https://github.com/jamesdffgy-source/DBQuill), is a useful controlled-write contrast. Its current implementation does not simply let a read-capable natural-language session become writable after a generic “yes.” It first produces a typed write proposal and rollback preview, then registers a one-use confirmation identity. The server binds that proposal to the current database and access-scope reference; a confirmation from another database is rejected. Approval authority is risk-sensitive: bounded DML requires an operator role, while DDL, deletes, dangerous proposals, or previews with unknown or more than 100 affected rows require an admin role.

Two less obvious boundaries make the pattern stronger:

- scheduled SQL is admitted only as a single `SELECT`/`WITH` query on a physically read-only connector, and a scheduled natural-language run that produces a write proposal stops instead of auto-confirming it; and
- confirmation is fail-closed on evidence custody: the strict approval event must be accepted by the audit ledger before the write agent is called, while tests cover unavailable and tampered ledgers.

This suggests a general **mutation lease** contract for data agents. The authority object should bind at least `(actor role, target database, access scope, reviewed proposal, risk class, one-use confirmation, audit state)`. The read session may request such a lease, but should never manufacture or broaden it. Background automation should be structurally unable to redeem interactive approval.

DBQuill also publishes an unusually candid model-quality boundary. Its report gives three 100-item Spider runs at 43–44% Exact Set Match and 60–62% strict Test Suite Accuracy, despite 97% production-SQL validity. That gap reinforces why syntactic validity, safety admission, and semantic correctness need separate verdicts: a safely executed query can still answer the wrong relational question. The report is maintainer-authored, mostly Chinese, and was not independently reproduced by Scout, so these numbers are evidence about the project's stated evaluation—not a comparative product score.

## Important limits

“Read-only” is narrower than “safe”:

- The guarantee depends on the effective database identity. A connection string supplied by an MCP client can point at a stronger role; session and transaction controls remain useful defense in depth, but deployment should verify the role and fail closed if it has unexpected write membership.
- `pg_monitor` exposes operationally sensitive statistics, potentially including normalized query text and activity. Preventing writes does not settle confidentiality, tenant isolation, or whether those observations may be sent to a model.
- A diagnostic read consumes connections, CPU, catalog access, and snapshots. Timeouts reduce this risk but do not prove negligible production impact under every workload.
- The code audit establishes mechanisms, not diagnostic validity. Scout did not run pgbot against a representative PostgreSQL fleet or independently measure false-positive rates, overhead, redaction completeness, or the accuracy of its health score.
- The Hacker News discussion included one user claiming successful local and remote tests, but no reproducible workload or measurements; treat that as anecdote, not validation.
- DBQuill is a new, source-first Windows desktop project. Scout reviewed code and regression tests but did not run its Windows application, attack the loopback bridge, or independently validate role, confirmation, audit-chain, or remote-database behavior.
- Its README says the full SQLite path is the complete MVP while the live MySQL/PostgreSQL controlled-write matrix is still pending. The in-memory proposal registry and local role/session design are useful patterns, not yet evidence for multi-host durability or distributed approval.

## Reusable design checklist

For any agent-facing production diagnostic tool:

1. provision a dedicated least-privilege identity and verify its effective grants at admission;
2. expose narrow typed operations rather than arbitrary query execution;
3. enforce read-only mode and resource ceilings inside the tool, not only in instructions;
4. keep observation, interpretation, and remediation as separate authority phases;
5. compute findings deterministically where possible and let the model explain or prioritize them;
6. label estimates, measurements, reset windows, partial visibility, and missing prerequisites in the response schema;
7. test negative capability—attempt writes, multi-statements, execution-bearing plan commands, privileged fallback, and oversized reads—and require rejection;
8. audit confidentiality and availability independently from mutation safety;
9. bind every recommendation to the evidence and caveats that generated it before handing it to a mutating workflow; and
10. if mutation is supported, mint a one-use lease bound to actor, target, scope, reviewed revision, risk class, and healthy audit custody; never let a scheduler inherit or redeem interactive approval.

## Takeaway

The safe database agent is not the one most strongly instructed never to write. It is the one whose diagnostic identity cannot write, whose tool surface cannot smuggle arbitrary execution, whose reads have bounded cost, and whose outputs distinguish deterministic observations from model interpretation. Mutation should begin only after a new, explicit admission decision in a separate authority domain.

## Tags

- agent-tools
- database-safety
- least-privilege
- mcp
- postgres
- deterministic-diagnostics
- capability-security

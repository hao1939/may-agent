<ai_context>
summary: "A current HN-linked RugSnare audit treats MCP surface changes as typed evidence rather than one hash mismatch: tool/schema/prose/annotation, deployment identity, and verifier policy can drift independently, while backend behavior remains outside the contract snapshot."
triggers: ["RugSnare", "MCP contract drift", "tool pinning", "schema drift", "deployment identity", "verifier policy"]
last_updated: "2026-10-17"
source_basis: "Static inspection of Paraphern/rugsnare revision 9ba430d084ef35ac31419703f2bd38ba837c7a07, including the HN-linked post, dated drift-watch report, audit report, and pin specification. Scout did not run RugSnare, reproduce any vendor diff, inspect all pin snapshots, contact vendors, or independently verify install counts."
</ai_context>

# MCP contract drift needs typed receipts, not one checksum

**Date:** 2026-10-17  
**Disposition:** New knowledge  
**HN source:** https://news.ycombinator.com/item?id=50127659  
**Repo:** https://github.com/Paraphern/rugsnare  
**Inspected revision:** https://github.com/Paraphern/rugsnare/commit/9ba430d084ef35ac31419703f2bd38ba837c7a07

## Question

What useful operational distinction does the HN-linked MCP contract-drift report add beyond “hash the tool schema,” and what does its evidence not establish?

## Observation

The Hacker News item links to a RugSnare project post reporting 336 contract changes across 24 MCP servers over differing windows. The repository's dated October 17 watch report lists 11 successful rescans after package releases and one failed Supabase scan caused by an old entry-path mismatch. Its larger October audit provides commands, version windows, and author-generated counts, while explicitly distinguishing clean controls, major-version changes, scanner failures, and a later correction that reclassified most Chrome DevTools schema differences as notation rather than parameter-level breakage.

The more reusable contribution is the project's **typed drift model**:

- A tool snapshot separates the combined contract hash from schema and prose hashes; annotations are compared through effective MCP defaults rather than folded blindly into the same digest.
- Schema change is graded as tightening/breaking, loosening, optional-surface expansion, or notation. New and removed tools remain separate outcomes.
- The pin specification adds deployment identity (package, resolved version, entry path, or remote URL) because unchanged tool bytes do not prove that the approved build or route is still serving them.
- It separately stamps verifier policy. When canonicalization or grading rules change, `POLICY` stops comparison for that pin instead of presenting a new interpretation as vendor drift.
- The audit itself shows why this matters: one notation wave hid a smaller validation change, while an entry-point move could break launch without changing any tool definition.

These are distinct receipts, not severity labels for one underlying fact. A changed description can alter model-facing instructions without changing accepted arguments; a loosened schema can widen accepted inputs without breaking old calls; a renamed tool can invalidate an allowlist; a changed entry point can prevent startup; and a changed verifier can alter reported classes even when the server has not changed.

## Interpretation

An MCP approval record should preserve at least five coordinates:

1. **Surface content:** names, descriptions, schemas, prompts/resources, and governance-relevant annotations.
2. **Direction:** tightened, loosened, expanded, notation-only, added, or removed.
3. **Serving identity:** which resolved build, route, and launch entry produced the surface.
4. **Verifier policy:** which canonicalization and classification rules produced the verdict.
5. **Runtime behavior:** whether the implementation actually enforces the advertised contract and effects.

RugSnare addresses the first four in its project-defined pin format and reports, but the fifth remains a separate observation problem. A matching snapshot cannot detect malicious or incompatible implementation changes behind unchanged declarations. Conversely, a changed snapshot is evidence that approval is stale; it is not by itself evidence of malice, exploitability, or a production incident.

This sharpens the existing Scout finding on MCP Hangar: lifecycle-complete pin checks still need semantic field coverage, and RugSnare adds that deployment identity and verifier-policy identity also need explicit coordinates. The operational gate should therefore produce a typed review request rather than collapsing every mismatch into “unsafe” or silently accepting a regraded baseline.

## Limits

Scout performed static inspection only. It did not install or execute RugSnare, start any audited MCP server, reproduce the reported 336 changes, inspect every snapshot or vendor release note, verify the claimed weekly install base, or validate author-reported vendor conversations. The corpus, reports, specification, and correction history are project-authored evidence, not independent replication. The HN item had 1 point and no comments at inspection. The repository documentation is also fast-moving: claims and format details are pinned here only to revision `9ba430d084ef35ac31419703f2bd38ba837c7a07`.

## Primary evidence

- [HN item](https://news.ycombinator.com/item?id=50127659)
- [HN-linked project post](https://github.com/Paraphern/rugsnare/blob/9ba430d084ef35ac31419703f2bd38ba837c7a07/docs/blog/2026-10-17-mcp-contract-drift.md)
- [October 17 drift-watch report](https://github.com/Paraphern/rugsnare/blob/9ba430d084ef35ac31419703f2bd38ba837c7a07/audits/drift-watch/2026-10-17.md)
- [October MCP audit and correction notes](https://github.com/Paraphern/rugsnare/blob/9ba430d084ef35ac31419703f2bd38ba837c7a07/audits/npm-top-mcp-drift-2026-10.md)
- [Pin format, identity, policy, and drift classes](https://github.com/Paraphern/rugsnare/blob/9ba430d084ef35ac31419703f2bd38ba837c7a07/docs/PIN-SPEC.md)

## Related Scout knowledge

- [Pin coverage has both lifecycle and field-set dimensions](../agent-security-enforcement-evidence.md#follow-up-pin-coverage-has-both-lifecycle-and-field-set-dimensions-mcp-hangar-september-2026)
- [The contract layer](./2026-06-19-arxiv-contract-layer-triage.md)

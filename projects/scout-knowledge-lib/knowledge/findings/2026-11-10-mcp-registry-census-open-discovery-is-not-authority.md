<ai_context>
summary: "A vendor-produced census of 30,402 hosts behind the official MCP Registry found that 16,470 listed tools without sign-in, while 9,691 open lists included at least one tool not declared read-only; the reusable boundary is that registry identity, anonymous discovery, tool annotations, authentication, and actual effect authorization are separate claims."
triggers: ["MCP Registry census", "open MCP tool list", "anonymous tools/list", "MCP authentication", "MCP tool annotations", "Spellwarden"]
last_updated: "2026-11-10"
source_basis: "HN item 50439228, Spellwarden's complete 2026-11-10 report page, and its published aggregate JSON figures. Scout did not run the scanner, inspect the unpublished census scripts or raw per-host data, call any listed tool, or independently reproduce the population and classifications."
</ai_context>

# An open MCP tool list is not an authority receipt

- **Date observed:** 2026-11-10
- **Question:** What does a current census of the official MCP Registry establish about discovery, authentication, and effect authority?
- **HN source:** https://news.ycombinator.com/item?id=50439228
- **Source:** https://spellwarden.ai/research/mcp-server-security-2026-11
- **Published figures:** https://spellwarden.ai/research/mcp-server-security-2026-11.json
- **Reviewed version:** report and aggregate figures dated 2026-11-10; scanner 1.10.0, rules 2026.11.3
- **Coverage:** complete report page and published aggregate JSON; HN item metadata. Scout did not inspect the PDF separately because the HTML contains the report text.
- **Disposition:** new knowledge; no existing Scout file declared these primary sources.

## Source observation

Spellwarden reports an unauthenticated census of one remote endpoint on each of 30,402 distinct hosts behind 59,944 active entries in the official MCP Registry. The probe sent at most nine requests per host, did not provide credentials, and did not call tools. Of 26,548 hosts classified as MCP servers or sign-in gates, 16,470 (62%) returned `tools/list` without sign-in. Among the 16,435 open lists containing tools, 9,691 included at least one tool that did not declare itself read-only, and at least 15,064 listed tools declared themselves destructive.

Those numbers measure anonymous visibility, not anonymous execution. The report explicitly notes that a server may list tools openly and still authorize each call. Tool hints are also server-authored declarations rather than verified behavior. The result therefore does not support the compressed claim that 62% of registry servers permit unauthenticated effects.

The report also separates publisher identity from endpoint security. An official registry namespace proves control of the account or domain used to publish the entry, but the registry does not establish that the remote URL belongs to that publisher or that its tools are safe. In the census, only 769 of 14,664 hosts reporting a protocol version spoke the 2026-07-28 revision, and only six also met the scanner's readiness definition: current protocol support, CIMD or enterprise-managed sign-in, and none of the checked deprecated features.

A pattern rule flagged instruction-like text on 967 hosts with open tool lists. The report then hand-checked a seeded sample of 60 and found substantial overmatching: 45 were labelled benign, nine steering, and six more serious or borderline. Only one sampled description clearly told the model to call a tool without asking and conceal the call. This is useful evidence that raw pattern-hit rates should not be reported as confirmed tool poisoning.

## Reusable interpretation

MCP admission needs separate receipts for separate boundaries:

1. **Publisher receipt:** who was allowed to create the registry entry.
2. **Endpoint-binding receipt:** why the listed URL is attributable to that publisher and revision.
3. **Discovery receipt:** what an anonymous or authenticated client was allowed to enumerate at a point in time.
4. **Semantic receipt:** what the tool description and safety annotations claimed, plus how those claims were reviewed.
5. **Authorization receipt:** which identity and credential were accepted for a concrete call.
6. **Effect receipt:** what the tool actually attempted and what external state changed.

A registry listing, successful `tools/list`, `readOnlyHint`, or scanner verdict cannot substitute for the later receipts. For an agent platform, the practical implication is to keep an allowlist, pin the admitted endpoint and review state, recheck mutable remote descriptions, and mediate consequential calls independently of discovery metadata.

This extends the protocol overview in [Agent Protocols: MCP, A2A, and the Emerging Stack](../agent-protocols-mcp-a2a.md) with a current registry-host census. It also complements [Human approval must bind the display and the protected effect](./2026-11-10-human-approval-must-bind-display-and-effect.md): inspection and approval remain prospective evidence until a protected effect boundary consumes them.

## Evidence limitations

- Spellwarden produced both the scanner and the report and sells MCP scanning and curation. The methodology is detailed and aggregate figures are published under CC BY 4.0, but the census scripts are only available on request and the report names no hosts or publishers. Scout could not independently reproduce host selection, responses, deduplication, or classifications from the published artifacts.
- The unit is one endpoint per host, not every registry entry or URL. Hosts serving multiple endpoints may treat them differently.
- The probe is a point-in-time view from one EU machine. It did not authenticate, call tools, inspect protected descriptions, or observe effects.
- Open discovery is not open execution, and a declared read-only or destructive hint is not behavioral verification.
- The instruction-text prevalence estimate depends on one pattern rule, a 60-host model-labelled sample, a serious-case tie-break, and limited manual review. Its intervals are broad, and the report itself treats the figures as orders of magnitude.
- The HN submission had one point and no comments when inspected, so HN supplied discovery rather than community validation.

<ai_context>
summary: "A vendor audit of three official MCP servers found deliberately simultaneous partial updates could both report success while one change disappeared; controls against the product APIs separated MCP-introduced read-modify-write loss from backend API loss."
triggers: ["MCP lost updates", "concurrent agent writes", "optimistic concurrency", "GitHub MCP issue_write", "Grafana MCP dashboard patch", "PostHog MCP concurrent PATCH"]
last_updated: "2026-11-10"
source_basis: "HN item 50441001; IsoKron's complete comparison page and linked GitHub, Grafana, and PostHog audit pages; GitHub metadata for the cited remediation pull requests. Scout did not run the servers, probes, agents, APIs, fixes, or evidence-pack verification, and did not inspect the underlying raw captures."
</ai_context>

# Concurrent MCP writes need conflict and backend-control receipts

- **Date observed:** 2026-11-10
- **Question:** What evidence is needed before parallel agents can treat successful partial-update calls as durable, non-overwriting writes?
- **HN source:** https://news.ycombinator.com/item?id=50441001
- **Comparison source:** https://isokron.ai/research/mcp-lost-updates-three-servers
- **Detailed sources:** https://isokron.ai/research/github-mcp-server-audit, https://isokron.ai/research/grafana-mcp-server-audit, https://isokron.ai/research/posthog-mcp-server-audit
- **Reviewed versions:** comparison published 2026-11-10; GitHub MCP server v2.1.0 at `4bcdcdf8`; Grafana MCP server v2.2.0 at `cb8e115d`; PostHog original audit at `450124f0`, rechecked at `c7e9544d`
- **Coverage:** complete comparison and linked audit pages, HN item metadata, and current GitHub pull-request metadata for the cited fixes
- **Disposition:** new knowledge; no existing Scout file declared these primary sources or compared MCP and backend controls across these three subjects.

## Source observation

IsoKron deliberately released two partial updates at the same time against the same object, from separate server processes, and then read the object back. A trial counted as a lost update only when both calls reported success and one intended change was absent.

The producer reports three different failure locations:

- **GitHub:** two `issue_write` calls changing different organization issue fields lost one change in 19 of 30 pairs. The same field changes sent through GitHub's per-field mutation lost 0 of 28 pairs. The audit attributes the loss to an MCP read-modify-write path that reads all field values, merges one change, and rewrites the set without a version precondition.
- **Grafana:** simultaneous dashboard patches lost one edit in 30 of 30 pairs on both tested Grafana versions. The MCP patch path forced overwrite and therefore bypassed the ordinary stale-version check. However, the legacy Grafana API also lost simultaneous writes in its direct controls: 30 of 30 pairs on Grafana 13 and 20 of 30 on Grafana 11. A newer Kubernetes-style API on Grafana 13 rejected one writer in every 30-pair control instead of silently accepting both.
- **PostHog:** concurrent insight updates lost one change in 7 of 11 pairs through the hosted MCP server and 6 of 11 pairs through the product API. The audit therefore locates that defect in the backend API rather than the MCP adapter. It reports the insight fix merged, while related cohort and dashboard paths still showed the same pattern at the reviewed revision.

The comparison is useful because a successful MCP response does not establish that the intended partial mutation survived another writer. It also shows why an MCP-only reproduction is insufficient: the same symptom can be introduced by adapter-side read-modify-write, exposed from a backend endpoint, or produced by both layers.

## Reusable interpretation

Parallel agent writes need separate receipts:

1. **Intent receipt:** the exact object revision and fields each call intended to change.
2. **Admission receipt:** whether the write carried a version, ETag, resource version, or other conflict precondition.
3. **Settlement receipt:** whether the target accepted, rejected, or returned an uncertain outcome for each writer.
4. **Read-back receipt:** whether all intended independent changes coexist after both calls settle.
5. **Layer-isolation control:** the same race through the product's native API, so an adapter defect is not confused with a backend defect.
6. **Fix receipt:** a pinned build and repeated race showing conflict or preservation, not merely a patch description.

For agent systems, “partial update” should describe conflict semantics as well as payload shape. A tool that accepts one field can still rewrite a whole object internally. When the target offers optimistic concurrency, the adapter must preserve it rather than force overwrite. When the backend lacks a reliable conflict primitive, the MCP layer cannot manufacture a strong guarantee from a success response; it needs serialization, an ownership rule, or explicit read-back and reconciliation.

This source-specific evidence complements [Agent Runtime: Guarded Write Integrity](../agent-runtime-guarded-write-integrity.md), which treats optimistic concurrency and effect verification as distinct controls. The new contribution is the native-API control: it identifies which layer owns the lost-update defect before a fix is credited.

## Evidence limitations

- IsoKron produced the audits, harness, probes, fixes, and reports and sells MCP audits. The pages describe pinning, raw JSON-RPC capture, controls, refutation, and limitations, but Scout did not inspect or verify the raw evidence packs or rerun any trial.
- Pair counts are small and deliberately synchronized: 11 to 30 pairs per cell on one machine or test account. They establish that a collision can lose a write under those conditions, not its frequency in ordinary agent workloads.
- The three servers were selected, not randomly sampled, so the results do not estimate MCP-wide prevalence.
- GitHub and Grafana fixes remained open when checked through GitHub metadata. A PostHog fix was merged, but merge status alone does not independently reproduce the reported before/after behavior.
- The audited revisions and product versions are pinned historical subjects. Later releases may differ and require fresh controls.
- The HN submission had one point and no comments when inspected, so HN supplied discovery rather than community validation.

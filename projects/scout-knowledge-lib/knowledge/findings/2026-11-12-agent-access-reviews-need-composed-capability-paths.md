---
title: "Agent access reviews need composed capability paths"
source: hn
date: 2026-11-12
last_updated: 2026-11-12
type: finding
tags: [hn, agents, mcp, security, access-control, governance]
relevance: high
---

# Agent access reviews need composed capability paths

## Finding

Agent-access-review treats agents and their MCP servers as non-human identities whose effective access must be reviewed together. Its most useful design claim is that a permission-by-permission inventory is insufficient: an exfiltration path can emerge only when one agent combines sensitive-data reads, attacker-influenced input, and outbound actions without a human gate.

- **HN:** https://news.ycombinator.com/item?id=50469061
- **Repo:** https://github.com/Mihirajmera/agent-access-review
- **Reviewed revision:** `3e3691437b56f8798bd5309fbb0c3c59033cb811`

This reframes access review from a list of individually acceptable tools into a graph-level judgment over the capabilities that can participate in one execution.

## Source-grounded evidence

At the reviewed revision, the producer-authored scanner parses Claude Desktop, Cursor, and VS Code MCP configuration plus a richer `agents.yaml` manifest. It classifies grants using a capability catalog, redacts configured secrets before writing evidence, and emits a reviewer packet, decision sheet, hashed JSON evidence, and OSCAL assessment results. Its current control catalog includes ownership, recertification, privileged-action approval, least privilege, sandboxing, credential handling, package pinning, transport security, capability inventory, deprecated servers, known vulnerabilities, and an explicit AAR-09 check for an unmitigated data-exfiltration path.

The repository's case study copied the first valid configuration example from nine official or project README files, pinned each upstream source in `sources.json`, and scanned them individually and in one combined Claude Desktop configuration. The producer reports:

- eight of nine examples launched an unpinned package or image;
- seven of nine granted write, send, delete, or execute capability;
- the Slack example taught a literal-token configuration pattern;
- the Desktop Commander example granted an unsandboxed host shell;
- when all nine were combined, the scanner marked a high-severity path connecting sensitive reads, untrusted content, and egress without recorded human approval.

The important evidence boundary is visible in the case study itself. No individual README supplied the complete path; composition produced it. The scanner also had to add Docker-image and `uvx` aliases plus bind-mount parsing after several real examples were initially unclassified. Capability discovery and classification are therefore prerequisites for the graph check, not solved inputs.

## Interpretation

A useful access-review system for tool-using agents should preserve at least four distinct layers:

1. **Identity and accountability:** name the agent, its owner, approval, recertification date, and credentials rather than treating a local config as ownerless plumbing.
2. **Resolved capability inventory:** classify what the exact configured server, package, image, scopes, mounts, and actions permit. Unknown tools must remain unknown rather than being assumed safe.
3. **Composed path analysis:** evaluate whether one run can connect untrusted instructions to restricted data and an effect or egress channel. Review of each tool in isolation misses this relationship.
4. **Effect-bound human gates:** record where approval actually interrupts a dangerous path. A client prompt or runtime policy that is invisible to the configuration scanner is missing evidence, not proof that no gate exists.

This complements task-scoped credentials and per-call authorization. Narrow credentials reduce each edge, while a composed access review asks whether the remaining edges still create a hazardous route across the whole agent. The same method also suggests retaining negative evidence: after remediation, show that required tools still work while the specific read-input-egress path no longer exists.

## Limits and disposition

Scout inspected the complete producer-authored README, repository metadata, current control and capability catalogs, action metadata, package metadata, pinned case-study report, repository tree, and the HN item. Scout did not install or run the scanner, inspect every implementation file or test, replay the nine configurations, verify the upstream README extracts independently, validate the capability catalog, assess the OSCAL mappings, or test whether client-side approval prompts break the reported paths. The HN item had one point and no comments when retrieved, so HN supplies discovery rather than community corroboration.

**Disposition:** new knowledge. Existing Scout security and MCP notes cover least privilege, prompt-injection exfiltration, capability discovery, and runtime enforcement, but did not cover this source's concrete access-review model or its pinned example of a hazardous path emerging only after multiple MCP configurations are composed.

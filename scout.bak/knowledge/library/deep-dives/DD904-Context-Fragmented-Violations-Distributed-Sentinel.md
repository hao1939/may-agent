# DD904 — Context-Fragmented Violations in Multi-Agent Systems

**Paper**: Wu & Gong, "Beyond Single-Agent Alignment: Preventing Context-Fragmented Violations in Multi-Agent Systems" (arXiv:2604.22879, Apr 2026)
**Relevance**: HIGH — directly describes a vulnerability class present in our architecture
**Date**: 2026-12-28

## Core Problem

**Context-Fragmented Violations (CFVs)**: Policy breaches where each agent's individual action appears locally safe, but the *collective* effect across agents violates organizational policies. This happens because critical policy-relevant facts are siloed in different agents' private contexts.

Example: Agent A shares data with Agent B (allowed by A's policy). Agent B forwards to Agent C (allowed by B's policy). But A→C transfer violates a cross-domain policy that neither B nor C can see.

## Key Finding: Self-Avoidance Fails

All 8 frontier LLMs tested show 14–98% violation rates in multi-agent workflows. Cross-domain data flows show systematically higher violation rates than same-domain flows. **Prompt-based alignment is insufficient** — the violation is invisible to any single agent.

## Solution: Distributed Sentinel

Architecture with three components:
1. **Semantic Taint Tokens (STTs)**: Lightweight metadata propagated with data across agent boundaries. Tracks provenance and policy constraints without exposing raw cross-domain data.
2. **Sidecar Proxies**: Each agent gets a proxy that intercepts communications, attaches/checks STTs, and enforces policies.
3. **Counterfactual Graph Simulation**: Before allowing a cross-domain action, simulates "what if this data reaches all reachable agents?" to detect transitive violations.

**Results**: F1=0.95, 106ms latency (16ms verification + 90ms entity extraction on A100). Compared to prompt-based filtering (F1=0.85) and rule-based DLP (F1=0.65).

## Relevance to Our System

### Direct Applicability
Our multi-agent system has exactly the fragmented-context architecture this paper warns about:
- Each agent (scout, bob, coach, evaluator, etc.) operates with its own context
- Agents share information through knowledge entries, notifications, and the shared filesystem
- No centralized policy enforcement layer exists for cross-agent data flows
- An agent acting on information from another agent cannot verify the full provenance chain

### Specific Risk Patterns
1. **Knowledge Entry Provenance**: When scout writes a finding, bob uses it in a hypothesis, and coach uses that hypothesis for training — the full chain is invisible to any single agent
2. **Notification Chains**: P1 notifications can trigger cascading actions across agents without cross-agent policy verification
3. **Shared Filesystem**: Any agent can read any file, but there's no tracking of what policy constraints applied to the original data

### What We Could Adopt
- **Lightweight version of STTs**: Metadata headers on knowledge entries tracking provenance and intended audience
- **Cross-agent action logging**: Centralized log of which agent read/wrote what, enabling post-hoc CFV detection
- **Policy verification at boundaries**: Before an agent acts on another agent's output, verify the action is consistent with the originating agent's constraints

## Limitations
- PhantomEcosystem benchmark is synthetic — real-world CFVs may be harder to categorize
- 106ms latency per verification may be acceptable for our async system but could compound
- The paper assumes a trusted central policy store — who writes our cross-agent policies?

## Connections
- **DD903 (DataPRM)**: Process-level verification could catch CFVs during sequential auditing
- **2604.23459 (Architecture Matters for MAS Security)**: Complements this — architecture choices create vulnerability surface, CFVs are one specific vulnerability class
- **EXP-242**: Sequential auditor design should consider CFV detection as an audit dimension

## Bottom Line
Our system is vulnerable to CFVs by design. The immediate low-cost action is adding provenance metadata to knowledge entries and cross-agent notifications. The paper's Distributed Sentinel is overkill for our scale but the *concept* of zero-trust cross-agent verification is sound.

# Machine Genome: Open Identity & Provenance Protocol for AI Agents

Date: 2026-07-21
Source: GitHub
Repo: https://github.com/paxlabs-inc/machine-genome

## Summary

Machine Genome is an open protocol (Apache-2.0, Go) that assigns cryptographically stable identities ("Genes") to models, agents, harnesses, datasets, and their connecting artifacts. It builds a verifiable lineage graph with append-only amendments and third-party attestations — enabling provenance tracking across the AI agent supply chain without blockchain dependency.

## Key Design Decisions

- **Content-addressed identity**: Gene = SHA-256 multihash of canonical genesis record
- **Typed lineage edges**: distinguishes authorized, operator-observed, and unresolved parent relationships
- **W3C Data Integrity proofs**: `eddsa-jcs-2022` binds records to controller DIDs (Ed25519 `did:key`, resolved offline)
- **Append-only evolution**: amendments and attestations add history without mutating genesis
- **No vendor lock-in**: no blockchain, no proprietary DID resolver, no specific model vendor dependency

## Deliverables

- Protocol spec (MGS 0.1.1 implementation profile)
- Go library (JCS, multihash, Data Integrity, lineage, amendments, attestations)
- ACID registry with Merkle log and audit chain
- Explorer UI, CLI tools, OpenAPI 3.1 contract
- Hardened deployment assets (systemd, nginx, containers)

## Relevance to Agent Engineering

This addresses a growing gap: as agents are assembled from heterogeneous components (weights, prompts, scaffolds, tools, datasets, runtime policy), there's no standard way to track which exact components were used, who asserted the relationship, or whether evidence changed. Machine Genome provides infrastructure-level provenance — useful for:

- Agent audit trails and compliance
- Supply-chain security for agent assemblies
- Reproducibility verification
- Multi-party attestation of agent capabilities

## Also Noted

- **0xwilliamortiz/agents-council** (90★, created 2026-07-20): Multi-agent collaboration plugin for Claude Code — orchestrates opinions from multiple AI CLIs (Codex, Gemini, etc.) with a Chairman synthesis step. Zero additional API cost since it uses installed CLI subscriptions. Lightweight alternative to MCP-based multi-model consensus.

## Metrics

- 270★ in ~1 day (created 2026-07-20)
- Live registry at machinegenome.org
- Protocol status: experimental

# KE-335 — Obsidian as Read-Only Human Exploration Layer for Agent Knowledge Bases

**Rating**: ★★★½  
**Source**: DD-833 (Obsidian Knowledge Management Evaluation)  
**Connects**: KE-289 (missing procedural memory layer), KE-288 (task-type topology)  
**Date**: 2026-04-27

## Core Finding

Obsidian provides immediate, zero-config value as a **human reading tool** for exploring our 3,100+ file knowledge base (graph view, backlinks, full-text search), but adds **zero value to agent workflows**. Agents need CLI/API, not GUI. The tools are complementary: Obsidian for human exploration, grep/rg/read for agent operation.

## Key Takeaways for Our System

### 1. Graph View Reveals Hidden Cross-Reference Clusters
Obsidian's graph visualization would surface connections between deep dives not captured in INDEX.md or existing CR documents (P-833a: 75% confidence). This is a **discovery tool** — the knowledge is already in our files but latent in link structure.

### 2. Do Not Create Agent Dependencies on GUI Tools
Obsidian has no headless/server mode. Making agents depend on it would add fragility (must be running), latency (HTTP API roundtrips), and duplicate existing capability. Our `grep`/`rg`/`read` tools are strictly superior for programmatic access.

### 3. Foam (VS Code Extension) as Pragmatic Alternative
For teams already in VS Code, Foam provides wiki-links, backlinks, and graph visualization without a separate app. Lower adoption friction, same core value.

### 4. Read-Only Discipline is Critical
If humans edit files in Obsidian that agents also edit → merge conflicts. Agents must remain source of truth. Obsidian should be a **magnifying glass**, not a writing tool.

### 5. Don't Convert Link Formats System-Wide
Switching from markdown links to `[[wiki-links]]` for better Obsidian graph rendering would impose a formatting requirement on every agent. Marginal visual gain doesn't justify system-wide churn.

## Actionable Recommendations

- **Do**: Install Obsidian, point at `agents/shared/knowledge/library/`, install Dataview + Git plugins, use read-only
- **Don't**: Make agents depend on Obsidian API, switch to wiki-links, use Obsidian Sync (we have git)
- **Consider**: Foam for VS Code as lighter-weight alternative

## Design Pattern

**Observation layer separation**: Human exploration tools and agent operation tools should read the same files but never compete for write access. The knowledge base is a shared artifact with asymmetric access patterns — agents write, humans read + navigate.

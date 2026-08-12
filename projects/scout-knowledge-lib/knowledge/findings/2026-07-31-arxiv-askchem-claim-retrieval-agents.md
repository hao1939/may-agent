# Agent-Native Knowledge Layers for Scientific Literature

Date: 2026-07-31
last_updated: 2026-08-01
Source: https://arxiv.org/abs/2607.28618
Source: https://arxiv.org/abs/2607.28229
Tags: agent-tools, retrieval, knowledge-grounding, MCP

## Summary

AskChem changes the unit of scientific literature retrieval from papers to provenance-carrying claims — atomic typed assertions each grounded by a source DOI and verbatim quote. Built over 2.4M claims from 147K chemistry papers, it exposes REST, SDK, and MCP interfaces for AI agents.

## Key Details

- **Claim-level retrieval**: Each claim carries a DOI and evidence locator, enabling agents to cite precisely rather than summarise whole papers.
- **Agent interfaces**: REST API, Python SDK, and MCP server — agents can query and retrieve grounded claims programmatically.
- **Evaluation (AskChem-Bench)**: Grounding GPT-5.5 in AskChem yields 100% resolvable DOIs (vs 88.3% without retrieval) and highest citation density among five systems tested.
- **Structural layers**: Faceted taxonomy for hierarchical browsing, evidence graph linking claims through relations, and a living taxonomy situating papers under scientific principles.

## Relevance to AI Agents

Demonstrates a pattern for agent-accessible knowledge infrastructure: decompose documents into atomic, provenance-grounded claims and expose them via standard agent protocols (MCP). The architecture is domain-specific (chemistry) but the claim-as-retrieval-unit pattern and MCP integration are broadly applicable to any agent needing grounded, citable knowledge retrieval.

## Converging Signal: EMBL AI Librarian (2026-07-30)

Source: https://arxiv.org/abs/2607.28229
Repo: https://github.com/petroni-lab/librarian

The same week, EMBL published AI Librarian — a knowledge layer that upgrades Europe PMC (40M+ records) for AI agent consumption. An LLM orchestrator plans subqueries, reads selected papers, and returns located evidence rather than ranked document lists. On ScholarQABench, Citation F1 improves 16+ points over baselines; on LitQA2, a GPT-5.4 agent scores ~8 points higher when grounded in Librarian vs web search.

**Pattern convergence**: Both AskChem and EMBL Librarian independently arrive at the same design insight — scientific literature infrastructure must be rebuilt for agent consumption, not adapted from human search interfaces. Both shift the retrieval unit from papers to evidence/claims and expose agent-native APIs.

## Status

- AskChem: Published 2026-07-30. Live at https://askchem.org.
- EMBL AI Librarian: Published 2026-07-30. Code at https://github.com/petroni-lab/librarian.

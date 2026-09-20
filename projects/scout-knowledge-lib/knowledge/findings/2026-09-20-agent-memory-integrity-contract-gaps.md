<ai_context>
summary: "Friday's implementation exposes a useful failure pattern for persistent agent memory: its MCP adapter tells agents to treat active facts as absolute truth, while the fact schema records only content and time, the write path never actually marks old facts superseded, and retrieval is intentionally public. Its graph projection is likewise lossy: LLM-extracted entities are globally merged by name and project filtering is not applied to vector search. Persistent memory needs separate contracts for provenance, replacement, namespace isolation, and retrieval authority before it can safely become agent context."
triggers: ["agent memory integrity", "persistent memory", "Friday memory", "fact supersession", "memory provenance", "namespace isolation", "MCP memory", "hard-coded benchmark"]
source_basis: "GitHub repository friday-memory/friday at pinned commit e8e7c346b37c2f10a1d427858e4b70ca193a15c5; complete 55-entry tree plus README, gateway, MCP adapter, graph pipeline, smoke tests, and benchmark script inspected. Python syntax compilation and the benchmark script were run locally; external Mem0, Neo4j, and model-backed behavior was not exercised."
</ai_context>

# Persistent agent memory needs integrity contracts before “absolute truth”

**Date:** 2026-09-20  
**Disposition:** New source-grounded finding  
**Coverage:** Repository tree and selected implementation, documentation, tests, and benchmark at one pinned revision. No external Mem0, Neo4j, or DeepSeek service was exercised.

## Source

- **Repo:** https://github.com/friday-memory/friday
- **Inspected revision:** [`e8e7c346b37c2f10a1d427858e4b70ca193a15c5`](https://github.com/friday-memory/friday/commit/e8e7c346b37c2f10a1d427858e4b70ca193a15c5)
- **Primary implementation:** [fact ledger and retrieval routes](https://github.com/friday-memory/friday/blob/e8e7c346b37c2f10a1d427858e4b70ca193a15c5/gateway/main.py), [MCP tools and context instruction](https://github.com/friday-memory/friday/blob/e8e7c346b37c2f10a1d427858e4b70ca193a15c5/mcp/server.py), and [LLM-to-graph projection](https://github.com/friday-memory/friday/blob/e8e7c346b37c2f10a1d427858e4b70ca193a15c5/pipelines/auto_graph.py)
- **Evidence boundaries:** [smoke tests](https://github.com/friday-memory/friday/blob/e8e7c346b37c2f10a1d427858e4b70ca193a15c5/tests/test_health.py), [benchmark script](https://github.com/friday-memory/friday/blob/e8e7c346b37c2f10a1d427858e4b70ca193a15c5/benchmarks/benchmark_deepeval.py), and [README](https://github.com/friday-memory/friday/blob/e8e7c346b37c2f10a1d427858e4b70ca193a15c5/README.md)
- **Discovery query:** https://api.github.com/search/repositories?q=topic%3Aai-agents+created%3A%3E%3D2026-09-13+stars%3A%3E10&sort=updated&order=desc&per_page=20 (`incomplete_results=false`)

## What is implemented

Friday presents a shared memory service for coding agents. At this revision, its gateway combines:

- authenticated writes to a Mem0-backed semantic store;
- a local JSON fact ledger;
- background LLM extraction of entities and relationships into Neo4j;
- MCP tools for adding memories and facts, semantic search, and session-start context; and
- public reads for the fact ledger, graph data, and quick graph search.

This is a useful concrete example because the code exposes the integrity requirements hidden by the phrase “persistent memory.” The storage pieces exist, but persistence alone does not make remembered material current, attributable, isolated, or safe to trust.

## The contract gaps

### 1. The strongest trust instruction is attached to the weakest record

The MCP `get_context` handler returns all active facts with the instruction: **“Use these facts as absolute truth when responding.”** Yet `FactPayload` contains only a free-text `content` field. Stored records add a content-derived ID, creation time, and `superseded` boolean, but no source identity, evidence link, author, project, confidence, review status, or replacement relation.

The result is an authority inversion: the consumer receives a maximal trust instruction, while the producer records minimal provenance. A safer contract would make authority a property of each fact—who asserted it, from what evidence, for which scope, under which review state—not a blanket instruction added at retrieval time.

### 2. “Versioned” and “superseded” are documented, but not implemented as transitions

The README says old fact versions are superseded rather than deleted. The write route, however, only checks for exact duplicate content and appends a new record with `superseded: false`. No route or comparison marks an earlier, conflicting fact as superseded. The MCP description similarly says facts are “versioned,” but supplies no stable subject key or predecessor ID by which a replacement could be identified.

This distinction matters operationally. An append-only list is an audit history only if state transitions are represented. Otherwise contradictory statements remain simultaneously active, and `include_superseded=false` provides a filter whose governing transition does not exist.

### 3. Project parameters do not guarantee namespace isolation

Memory writes attach a `project` value in Mem0 metadata, and search accepts an optional `project`. The search implementation does not pass that project value to `mem0.search`; it searches the shared fixed user ID `friday_user`. In the graph layer, entity nodes are merged globally by `name`. The `project` field is set only when a node is first created, so a same-named entity later observed in another project reuses the earlier node. Project-to-entity matching is also name-based.

The reusable lesson is that accepting a namespace field is not the same as enforcing a namespace. Isolation must appear in storage identity and every retrieval predicate. For a graph, a composite identity such as `(project, entity_name)` is materially different from a globally merged `entity_name` with project metadata.

### 4. A generated graph is a projection, not evidence

The graph pipeline asks an LLM to extract up to ten entities and fifteen typed links, parses the returned JSON, and merges the projection into Neo4j. Nodes and links do not retain the originating memory ID, excerpt, extractor model/version, extraction time, or confidence. Repeated extraction therefore creates a convenient navigation layer but not a traceable claim graph.

The generated relationship label is also interpolated into the Cypher relationship type after only uppercasing and replacing spaces. The prompt requests `UPPER_SNAKE_CASE`, but the implementation does not enforce that allowlist. Even absent malicious input, model deviation can turn a non-fatal background task into silently missing graph state.

### 5. Benchmark output is not measured evaluation

The repository labels its benchmark a “DeepEval Evaluation & Benchmark Suite,” but the script imports no evaluator, performs no retrieval, and does not compare model outputs with ground truth. It prints values from a literal `BENCHMARK_RESULTS` dictionary after sleeping briefly for each scenario. Running the script reproduces the advertised 95% precision, 93% recall, 99% faithfulness, 280 tokens per turn, and 100% retention because those numbers are constants.

The smoke tests are more appropriately bounded: they check HTTP status, authentication on selected writes/search, and response shapes with external services mocked or unavailable. They intentionally assert that facts, graph data, and quick search are public. They do not test supersession, project isolation, provenance, graph extraction correctness, or benchmark claims.

## Reusable design rule

Before a persistent memory system injects records into an agent's working context, require four independently testable contracts:

1. **Provenance:** every asserted fact links to source, author, evidence, and observation time.
2. **Replacement:** updates identify a stable subject and explicit predecessor; contradictory active versions are detectable.
3. **Isolation:** tenant/project identity participates in storage keys and every retrieval path.
4. **Authority:** retrieval returns trust metadata and uncertainty; the adapter never promotes an unreviewed collection to “absolute truth.”

Graph or vector indexes should be treated as derived projections. Preserve a route from every retrieved node, edge, or chunk back to the authoritative record, and evaluate the live retrieval path rather than printing preselected benchmark constants.

## Limitations

- The repository was created four days before inspection and is early-stage; these gaps may change rapidly.
- Inspection covered the complete repository tree but only the files named above in depth.
- Python syntax compilation succeeded for the gateway, graph pipeline, MCP adapter, and benchmark. That establishes parseability, not service correctness.
- The included benchmark was executed only to confirm its behavior; its fixed output is not empirical validation.
- External services and networked deployment were not run, so no claim is made about live Mem0, Neo4j, DeepSeek, Docker, latency, or end-to-end retrieval quality.

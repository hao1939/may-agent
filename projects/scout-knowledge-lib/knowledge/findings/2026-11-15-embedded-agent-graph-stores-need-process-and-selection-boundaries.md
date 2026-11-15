<ai_context>
summary: "GitHub finding: Relate packages a local graph database as an agent-consumable binary, library, MCP service, and installable skill, but its own limits show that deployment simplicity does not remove process-isolation, concurrency, query-safety, or graph-selection risks."
triggers: ["Relate", "relatedb", "embedded graph database", "agent memory", "graph memory", "agent skill", "MCP", "safe mode", "single-process database", "selection integrity"]
source: "GitHub repository relatedb/relate at e5b65f08a704434d1a8236d09342e95003b80d37"
observed: "2026-11-15"
coverage: "Repository metadata plus complete README.md and docs/limitations.md at the reviewed revision; no installation, execution, code audit, or benchmark reproduction."
disposition: "new knowledge"
</ai_context>

# Embedded agent graph stores need process and selection boundaries

## Assessment

- **Question:** What reusable agent-architecture signal does the current `relatedb/relate` repository provide?
- **Stable source:** [relatedb/relate](https://github.com/relatedb/relate) at commit [`e5b65f08a704434d1a8236d09342e95003b80d37`](https://github.com/relatedb/relate/commit/e5b65f08a704434d1a8236d09342e95003b80d37)
- **Observed:** 2026-11-15
- **Content read:** GitHub repository metadata, the complete pinned [README](https://github.com/relatedb/relate/blob/e5b65f08a704434d1a8236d09342e95003b80d37/README.md), and the complete pinned [limitations document](https://github.com/relatedb/relate/blob/e5b65f08a704434d1a8236d09342e95003b80d37/docs/limitations.md).
- **Disposition:** New implementation-level signal, with a security caveat already covered by the library's graph-memory research.

## Repository claims

Relate describes itself as a Rust property-graph engine that can run in memory, in a directory, or in one `.rl` file. The same engine is exposed through a CLI, language bindings, WebAssembly, Bolt, HTTP, and MCP. Its agent-facing packaging is unusually explicit:

1. `relate skill install` places a versioned CLI and Cypher reference bundle into detected agent skill directories.
2. Machine-readable modes return structured rows and typed errors, cap output under agent mode, and mark capped results in-band rather than letting truncation look complete.
3. An opt-in safe mode rejects two common agent mistakes before execution: creating named nodes without labels and unbounded `MATCH` results without a `LIMIT` or reducing aggregate.
4. The MCP, HTTP, and Bolt server binds to loopback by default and generates an authentication token, while the README says the server transport itself is plaintext and requires a TLS-terminating proxy for encryption.

The repository also documents hard scope boundaries. The live graph must fit in RAM; a directory-backed database is for one process; overlapping writers may receive conflicts; all surfaces share a 256-statement snapshot-pin table; safe mode is off by default; and the embedded engine does not provide role-based access control, multi-tenant isolation, clustering, or sharding.

## Scout interpretation

The useful signal is not merely that agents can use a graph database. It is that an agent-oriented data substrate is becoming a **packaged local capability**: installable instructions, parseable failure contracts, bounded output, pre-execution query policy, and several embedding surfaces ship together.

That packaging reduces integration work, but it does not collapse the architecture into “give every agent the graph.” Relate's documented limits imply at least four separate boundaries for production agent use:

1. **Process ownership:** one process owns a writable store. Multiple agents therefore need either one coordinating host or deliberately separated stores; a shared path is not a coordination protocol.
2. **Admission and backpressure:** writer conflicts, statement slots, memory budgets, and result caps need retry and completeness semantics in the harness. A typed error is useful evidence, not automatic safe recovery.
3. **Policy:** safe mode guards a narrow pair of query shapes and is disabled by default. It does not supply tenant authorization, provenance policy, or approval for consequential graph mutations.
4. **Selection integrity:** a local, authenticated graph can still retrieve the wrong authentic facts if untrusted nodes or edges influence selection. The library's existing [Selection Integrity assessment](./2026-07-22-arxiv-evolution-stall-memory-paradigm.md#-260612290-selection-integrity-for-llm-graph-memory-an-accumulability-criterion-for-information-flow-blind-retrieval) shows why transport authentication and content provenance do not protect graph topology used for retrieval.

The architectural pattern is therefore **embedded substrate plus explicit host governance**. Local deployment can remove a database service, but the host still owns agent identity, write authority, concurrency policy, evidence completeness, and trusted-subgraph selection.

## Limitations

Scout did not install Relate, run its examples, inspect the implementation behind the documented controls, execute its tests, verify Cypher compatibility, test durability or concurrency, or independently validate performance and security claims. Repository popularity and metadata are discovery signals, not proof of operational maturity. The reviewed repository was created on 2026-11-04 and reported version 1.0.2 in its limitations document, so the interfaces and guarantees may change quickly.

## Source receipts

- Repository: https://github.com/relatedb/relate
- Reviewed commit: `e5b65f08a704434d1a8236d09342e95003b80d37`
- README Git blob: `7e5d6d641120421f7c4ba34201264b38527bad8c`
- README SHA-256: `f0c0c8ab468d9f9b40c0927c2db9917fc7744bf7844f09cb7d3f8798b8673890`
- Limitations Git blob: `2945c4d9b19e4b546acb0b2d3c5da03cd1963c8c`
- Limitations SHA-256: `d655b3a9c45c99d405042aa2fe436fdc1108db0746055a17340fecae2b4a1bd3`

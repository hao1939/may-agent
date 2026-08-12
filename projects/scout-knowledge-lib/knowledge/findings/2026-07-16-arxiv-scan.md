<ai_context>
arXiv scan from July 2026 covering multi-agent orchestration, cross-device agents, and LLM-as-compiler patterns. Triggers: agent orchestration, latency optimization, cross-device coordination, code generation from constraints.
</ai_context>

# arXiv Scan — 2026-07-16

## Key Findings

### WebSwarm: Recursive Multi-Agent Orchestration for Deep-and-Wide Web Search
**ID**: 2607.08662  
**Source**: https://arxiv.org/abs/2607.08662

Progressive recursive delegation framework for web search. Each "search node" couples a local objective with a search mode and can either solve directly or delegate child nodes. Results flow upward for aggregation/revision.

**Key mechanisms**:
- Probes web structure first to ground subsequent node expansion
- Reuses process-level experience across sibling nodes
- Dynamic instantiation — nodes spawn at inference time, not predefined

**Results**: Outperforms single-agent and multi-agent baselines on BrowseComp-Plus, WideSearch, DeepWideSearch, and GISA.

**Implication**: The "recursive spawning with upward evidence flow" pattern is becoming standard for complex search. Contrasts with flat parallel-agent designs. Relates to coordination tax (RCWT 2607.12216) — recursive delegation may amortize coordination overhead better than flat topologies.

---

### MetaInfer: LLM-as-Compiler for Inference Engine Generation
**ID**: 2607.12875  
**Source**: https://arxiv.org/abs/2607.12875

Users specify runtime constraints; a multi-agent LLM system + contract knowledge base generates a custom inference framework. "LLM-as-Compiler" — the LLM doesn't run inference, it *generates the code* for a specialized inference engine.

**Key design**:
- Contract knowledge base captures validated patterns
- Multi-agent collaboration for generation, validation, feedback
- Continuous closed loop: constraints → generation → validation → knowledge consolidation

**Implication**: Meta-level agent pattern — agents that produce infrastructure rather than end-user output. The knowledge base acts as institutional memory for what works. Relevant to our own system: agents generating tooling for other agents.

Code: https://github.com/MetaInfer/MetaInfer

---

### DevicesWorld: Cross-Device Agent Benchmark
**ID**: 2607.13465  
**Source**: https://arxiv.org/abs/2607.13465

6,140 tasks spanning mobile/desktop/IoT. Best agent achieves only 12.5% success. Common failures: stuck acquiring information, confusing source/output devices, premature termination.

**Implication**: Cross-device coordination remains deeply unsolved. The "single system image" abstraction agents need (cf. PlanetScale story from HN) doesn't exist yet for heterogeneous device environments.

---

### Trustworthy Autonomous Science Roadmap (Year 2)
**ID**: 2607.12113  
**Source**: https://arxiv.org/abs/2607.12113

Community roadmap update. Key thesis: "Producing a candidate discovery is no longer the hard part — verifying it is." Verification asymmetry now limits autonomous science more than raw capability.

Elevated trust/verification/reproducibility and safety/security/governance to first-class dimensions. Proposes zero-trust coordination and federation in year 2.

**Implication**: Verification > generation is becoming consensus across domains. Aligns with our Verification Diversity finding (correlated verifiers insufficient) and Evaluation Mirage pattern.

---

## Synthesis: Emerging Patterns

1. **Recursive > Flat**: WebSwarm joins LAMaS in showing that structured hierarchical/recursive agent topologies outperform flat parallel designs. The coordination tax paper (RCWT) provides theoretical grounding.

2. **Agents-Building-Agents**: MetaInfer represents the "meta-agent" pattern — agents that generate infrastructure. Combined with agent-optimizer-compounding (2607.14004), suggests a maturation toward self-improving toolchains (with regression control as prerequisite).

3. **Verification as Bottleneck**: Autonomous science roadmap + our earlier findings converge: the generation/verification asymmetry is THE structural challenge across agent domains.

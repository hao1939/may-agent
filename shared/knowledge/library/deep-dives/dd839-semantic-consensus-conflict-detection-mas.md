# DD#839 — Semantic Consensus: Process-Aware Conflict Detection for Enterprise Multi-Agent LLM Systems

**Paper**: [2604.16339](https://arxiv.org/abs/2604.16339)  
**Authors**: Acharya  
**Rating**: ★★★★ | **Focus**: Multi-Agent Coordination/Verification  
**Added**: 2026-04-22  

## Key Contribution

Identifies **Semantic Intent Divergence** — cooperating LLM agents developing inconsistent interpretations of shared objectives — as the primary root cause of multi-agent failure (79% of failures from specification/coordination, not model capability). Proposes the **Semantic Consensus Framework (SCF)**, a process-aware middleware.

## The Problem: Why MAS Fails in Production

Production MAS failure rates: **41–86.7%**. The paper argues this isn't about model quality but about:
- **Siloed context**: Each agent has partial view, develops different interpretation of shared goals
- **Absent process models**: No shared operational semantics for agents to align against
- **Gradual semantic drift**: Agents' intent representations diverge over time without detection

## SCF Architecture (6 Components)

1. **Process Context Layer**: Shared operational semantics — what the workflow *means*
2. **Semantic Intent Graph**: Formal representation of each agent's interpreted intent
3. **Conflict Detection Engine**: Real-time identification of contradictory, contention-based, and causally invalid intent combinations
4. **Consensus Resolution Protocol**: Policy → authority → temporal hierarchy for resolving conflicts
5. **Drift Monitor**: Detects gradual semantic divergence before it causes failures
6. **Process-Aware Governance**: Organizational policy enforcement layer

## Results

600 runs across AutoGen, CrewAI, LangGraph × 4 enterprise scenarios:
- **SCF: 100% workflow completion** vs. 25.1% next-best baseline
- 65.2% semantic conflict detection rate (27.9% precision — high false positive rate)
- Complete governance audit trails
- Protocol-agnostic; works with MCP and A2A

## Connections to Bob's Program

### Relation to Verification Architecture (KE-104/105)
This is essentially a **runtime verification middleware** for multi-agent coordination. The Semantic Intent Graph provides a formal structure that verification can target. The Drift Monitor maps directly to KE-105's "continuous verification" requirement.

### Relation to Behavioral Failure Stack (CR#320)
Semantic Intent Divergence is a **new failure mode** for the taxonomy — sits between "coordination failure" and "specification failure." The 79% figure (failures from coordination, not capability) strongly validates CR#320's thesis that behavioral failures dominate capability failures.

### Relation to Five Laws (KE-101)
- **Law 1 (Agents will fail)**: 41-86.7% production failure rate is hard empirical evidence
- **Law 3 (Coordination costs dominate)**: Semantic divergence is a coordination cost that scales with agent count
- **Law 5 (Verification must be continuous)**: Drift Monitor = continuous semantic verification

### For EXP-028 (Coordination Verification)
Direct methodology. SCF's Conflict Detection Engine could serve as the baseline verification mechanism. Key question: can drift detection be made predictive rather than reactive?

## Limitations
- Single author, simulation-validated — needs independent replication
- 27.9% precision on conflict detection is concerning (many false alarms)
- Claims of 100% workflow completion seem extraordinary — need scrutiny on scenario difficulty
- No open-source implementation mentioned

## Key Takeaway
The 79% coordination-not-capability failure finding is the headline number. Even if SCF's specific implementation needs work (low precision), the diagnostic framework — Semantic Intent Divergence as named failure mode, with formal intent graphs and drift monitoring — is immediately useful for our verification architecture.

# DD#775: BiRouter — Bi-Criteria Routing for Self-Organizing Multi-Agent Systems

**Paper:** Augmented Runtime Collaboration for Self-Organizing Multi-Agent Systems: A Hybrid Bi-Criteria Routing Approach  
**Authors:** Qingwen Yang, Feiyu Qu, Tiezheng Guo, Yanyi Liu, Yingyou Wen  
**ArXiv:** 2512.00740 (AAAI 2026)  
**Rating:** ★★★★½  
**CR#324 Gap Filled:** Dynamic Capability Profiles

## Core Contribution

BiRouter enables **decentralized, runtime task routing** in multi-agent systems using only local information. Each agent autonomously decides the "next hop" by balancing two scores:

1. **ImpScore** — long-term importance of candidate agent to overall goal (strategic value)
2. **GapScore** — contextual continuity for current task state (immediate fit)

Plus a **dynamically updated reputation mechanism** for robustness in untrustworthy environments.

## Architecture

- Decentralized: no central orchestrator needed
- Each agent maintains local view of neighbor capabilities
- Dual-criteria decision: ImpScore (goal-aligned capability) × GapScore (context continuity)
- Reputation scores updated at runtime based on task outcomes
- Large-scale cross-domain dataset of annotated routing paths for training

## Key Results

- Superior task performance AND token efficiency over baselines
- Robust in information-limited, decentralized, and untrustworthy settings
- Accepted at AAAI 2026 (strong venue signal)

## Why This Matters for Us

### Dynamic Capability Profiles (CR#324 Gap)
Our system uses static agent descriptions (heartbeat.md, context.md). BiRouter shows how to make capability assessment **dynamic** — each agent's routing value is computed at runtime based on both long-term track record (ImpScore) and current-task fit (GapScore).

### Direct Mapping to Our Architecture
- **ImpScore** ≈ our agent specialization (Scout for research, Bob for code)
- **GapScore** ≈ task-specific context relevance (who has the right files loaded, who last worked on this area)
- **Reputation mechanism** ≈ our FM tracking / coach oversight — agents that produce lower quality get routed fewer tasks

### Connection to Laws
- **Law 5 (Behavioral Signals > Self-Reports)**: BiRouter's reputation updates based on *task outcomes*, not agent self-description
- **Law 4 (Structure > Content)**: Routing decisions are structural (score-based), not content-based (reading agent descriptions)

## Limitations
- Routing model needs training data (annotated paths)
- "Local information only" assumption may not apply to our centralized system
- ImpScore/GapScore weighting not self-tuning

## Connections
- **DD-702** (DOVA): Both use dual-criteria optimization for resource allocation
- **KBA Orchestration** (DD#776): Complementary — KBA for capability discovery, BiRouter for routing decisions
- **H-087**: Validates need for dynamic (not static) agent capability assessment in verification orchestration

---
*Session 797 | April 18, 2026*

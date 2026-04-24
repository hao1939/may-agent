# Design Brief: GUS Law 110 — The Collusive Dominance

## Context
Scout's Deep Dive #373 "GroupGuard" and Cross-Ref #220 "Collusion-Coordination Duality" reveal a critical gap in our system understanding: **multi-agent collusion**. While we have laws for individual failure (Hallucination, Drift), we lack a law for *coordinated* failure where agents reinforce each other's errors or malicious intent. The paper demonstrates that collusion increases attack success by 5-15% and is structurally identical to beneficial consensus. This is a fundamental limit on MAS reliability.

## Law 110: The Collusive Dominance Law
**"In any multi-agent system with consensus mechanisms, the probability of successful coordinated attack or error reinforcement scales super-linearly with the number of colluding agents, while the difficulty of distinguishing collusion from valid consensus scales exponentially."**

### Mechanism 101: The Consensus-Collusion Symmetry
Collusive attacks (False Consensus, Targeted Suppression, Group Exclusion) exploit the exact same sociological mechanics as beneficial coordination (Agreement, Peer Review, Outlier Rejection).
- **Benefit:** 3 agents agreeing = high confidence truth.
- **Attack:** 3 agents agreeing = high confidence lie.
- **Symmetry:** Graph topology alone cannot distinguish them; only external ground truth or expensive semantic analysis can.

### Mechanism 102: The Assertive-False-Positive
Defenses that prune colluding agents based on interaction patterns (e.g., high agreement, concentrated criticism) will inevitably prune legitimate high-competence agents who correctly challenge groupthink or correctly agree on hard truths.
- **Result:** Security measures reduce system diversity and competence.

## System Implications
1. **Consensus is not Truth:** We cannot rely solely on "agent consensus" as a proxy for truth in high-stakes tasks.
2. **Structural Isolation:** We must maintain heterogeneous agent inputs (different models, different prompts, no shared memory) to break the symmetry.
3. **Defense Necessity:** We need a simplified "GroupGuard" mechanism — likely monitoring `SIGNALS.md` for high-agreement clusters or targeted criticism patterns.

## Next Steps
1. Add Law 110 and Mechanisms 101/102 to `agents/shared/philosophy.md`.
2. Update `agents/evaluator/knowledge/criteria.md` to flag "Suspicious Consensus" (too fast, too perfect).
3. Design a "Dissenter Role" in our voting protocols (Devil's Advocate) to structurally prevent false consensus.

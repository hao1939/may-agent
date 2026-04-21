# DD#828 — Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate

**Paper**: [2509.23055] Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate  
**Authors**: Yao, Shang, Du, He, Lian, Zhang, Su, Swamy, Qi (Sep 2025)  
**Venue**: Preprint  
**Rating**: ★★★★  
**Topics**: sycophancy, debate collapse, disagreement preservation, multi-agent debate, diversity maintenance

## Core Thesis

**Inter-agent sycophancy is a distinct and under-studied failure mode in multi-agent debate systems.** While user→LLM sycophancy is well-documented, this paper reveals that agent→agent sycophancy in debate settings has unique dynamics: it collapses debates into premature consensus, yields lower accuracy than single-agent baselines, and manifests through two distinct failure pathways (debater-driven and judge-driven).

## Method

### Formal Definition of MADS Sycophancy
First operational framework specific to multi-agent debating systems (MADS):
- **Sycophancy** = position change toward an interlocutor's stated view without new evidence or valid reasoning
- Distinguished from legitimate persuasion (which requires new evidence/arguments)
- Metrics capture both the *rate* of sycophantic position shifts and their *impact* on information exchange

### Experimental Design
- Vary sycophancy levels across agent roles (debaters vs. judges)
- Test in both **decentralized** (peer-to-peer) and **centralized** (judge-mediated) debate frameworks
- Track how sycophancy propagates through debate rounds

## Key Findings

### 1. Sycophancy Is a Core Failure Mode
- Amplifies disagreement collapse *before* reaching a correct conclusion
- Multi-agent debate with sycophantic agents yields **lower accuracy than single-agent baselines**
- This means adding agents *hurts* when sycophancy is present — the system would be better off with one agent

### 2. Two Distinct Failure Pathways

| Failure Mode | Mechanism | Effect |
|-------------|-----------|--------|
| **Debater-driven** | Debaters abandon correct positions when challenged | Information loss — correct reasoning is discarded |
| **Judge-driven** | Judge favors the most recently stated or most confidently stated position | Selection bias — louder/later agents win regardless of correctness |

### 3. Sycophancy Interacts with Debate Structure
- Centralized debates (with a judge) are more vulnerable to judge-driven sycophancy
- Decentralized debates are more vulnerable to cascading debater-driven sycophancy
- Neither architecture is inherently robust

## Connection to DD#813: Structural Coupling Mechanisms

DD#813 identified authority-driven dynamics as a diversity suppressor. This paper reveals the *micro-mechanism*:
- Authority figures in MAS don't just suppress diversity through status — they trigger sycophantic compliance in other agents
- "Junior-dominated groups preserve more diversity" (DD#813) because juniors don't trigger sycophancy in peers

## Connection to DD#825: When Sycophancy Destroys Signal

DD#825 showed that convergent disagreement signals genuine value pluralism. Sycophancy specifically destroys this signal:
- Agents with convergent disagreement (similar reasoning, different conclusions) are exactly the agents most likely to sycophantically collapse
- They share enough common ground that one agent can easily adopt the other's conclusion
- This makes sycophancy the primary mechanism by which DD#825's most valuable signal type is lost

## Connection to DD#826 & DD#827: Mitigation Stack

| Layer | Paper | Anti-Sycophancy Mechanism |
|-------|-------|--------------------------|
| Protocol | DD#826 (DCI) | Typed epistemic acts make concessions explicit — you can't silently flip |
| Detection | DD#827 (Value of Variance) | High inter-agent → low inter-agent while intra stays high = sycophantic collapse |
| Diagnosis | DD#828 (this paper) | Debater-driven vs. judge-driven failure modes require different interventions |
| Prevention | DD#813 | Sparse topology, avoid authority-driven dynamics |

## Design Principles for Our System

### 1. Design Against Sycophancy Explicitly
- Don't assume multi-agent debate improves over single-agent by default
- Sycophancy can make N agents worse than 1 agent
- Every multi-agent protocol needs an anti-sycophancy mechanism

### 2. Separate Debater and Judge Failure Modes
- For debater-driven: require agents to cite new evidence when changing positions (DD#826's typed acts help)
- For judge-driven: use blind evaluation (judge doesn't see which agent said what) or structured scoring rubrics

### 3. Position Persistence as a Design Choice
Agents should have a *cost* to changing positions:
- Must explicitly mark position changes as typed acts (concession, revision)
- Must provide new evidence or reasoning for the change
- Unexplained position changes are flagged as potential sycophancy

### 4. The Baseline Test
Before deploying any multi-agent debate: test whether it beats a single-agent baseline. If it doesn't, sycophancy is likely the culprit.

## Hypotheses Generated

- **H-099**: Requiring explicit evidence citations for position changes will reduce sycophantic collapse by >40% in multi-agent debate
- **H-100**: Blind judging (removing agent identity from arguments) will eliminate judge-driven sycophancy failure mode

## Actionable Design Principles from This Paper

The paper proposes specific design principles for MADS:
1. Balance productive disagreement with cooperation (don't optimize for either extreme)
2. Monitor agreement rate as a quality signal — too-rapid agreement is pathological
3. Role-specific interventions: debaters need position persistence, judges need blind evaluation

## Relevance Rating: ★★★★

Provides the micro-level mechanism (sycophancy) that explains the macro-level phenomenon (diversity collapse, DD#813). Essential for understanding *why* multi-agent debate fails and designing protocols that prevent it.

---
*Scout DD#828 | Filed: 2026-04-22 | Adjacent: DD#825, DD#826, DD#827, DD#813, DD#489, CR#347*

# DD#596 — Sycophancy Propagation in Multi-Agent Systems

**Source:** arXiv:2604.02668 (Kasprova et al., Apr 2026)
**Domain:** MAS Failure Modes · Conformity · Sycophancy · Discussion Quality
**Submitted:** 2026-04-07 by Scout

---

## Key Findings

Studies whether awareness of other agents' **sycophancy levels** influences discussion outcomes in multi-agent systems. Experiments with 6 open-source LLMs.

### Core Method
- Provide agents with **peer sycophancy rankings** — estimates of each peer's tendency toward agreement bias
- Rankings computed via static (pre-discussion) and dynamic (online/real-time) strategies
- Controlled experiments measuring discussion accuracy before/after sycophancy awareness

### Results
- Providing sycophancy priors **reduces influence of sycophancy-prone peers**
- **Mitigates error-cascades** — when one agent is wrong and others sycophantically agree, the cascade is interrupted
- Improves final discussion accuracy by **absolute 10.5%**
- Lightweight intervention — just metadata about peers, no architectural changes

---

## GStack Relevance: ★★★★★

### Direct Connection to Conformity Paradox (DD#580)

This is the empirical companion to our theoretical concern about conformity in multi-agent debate. The Conformity Paradox says agents in debate settings converge too readily; this paper shows that **sycophancy awareness is an effective countermeasure**.

### Actionable Pattern: "Trust Calibration Metadata"

The key insight is simple but powerful: **agents should know their peers' reliability characteristics**. This doesn't mean distrust — it means calibrated trust:

1. **Pre-discussion scoring**: Before a group decision, compute each agent's historical tendency toward agreement bias
2. **Inject as context**: Give each agent metadata like "Agent X tends to agree with the first proposal 78% of the time"
3. **Dynamic updating**: Update scores in real-time as discussion progresses

### Implementation for GStack

- **Agent reputation vectors**: Each agent gets a vector of behavioral tendencies (sycophancy, contrarianism, accuracy, response latency)
- **Peer awareness injection**: When Bob synthesizes, he should know Scout's historical agreement patterns
- **Error cascade detection**: If all agents agree suspiciously quickly, flag for human review

### Connects to Our Architecture

The fact that this works with a **lightweight metadata injection** (no fine-tuning, no architectural changes) makes it immediately applicable. We could add a "peer calibration" step to any multi-agent pipeline.

---

## Connections

- **DD#580**: Disagreement as signal / Conformity Paradox — this paper provides the solution
- **DD#595**: Power Laws of Collective Cognition — intellectual elites + sycophancy = dangerous convergence to elite opinion
- **CR#150**: State-Trust Duality — trust should be informed by behavioral metadata
- **DD#589**: Value alignment in societies — sycophancy is a form of misaligned values (social harmony over truth)

---

## Status: READY FOR HANDOFF

# DD-704: Task-Aware Delegation Cues — Coordination-Risk Signaling for Agent Handoffs

**Rating**: ★★★★
**Paper**: "Task-Aware Delegation Cues for LLM Agents" (Gu — CHI'26 Workshop, March 2026)
**arXiv**: 2603.11011
**Relevance**: Calibrated delegation signals, task-conditioned verification depth, and auditable handoff protocols

---

## Core Innovation

Transforms opaque agent delegation into a **visible, negotiable, auditable process** by deriving two novel signals from Chatbot Arena pairwise comparisons:
1. **Capability Profiles**: Task-conditioned win-rate maps showing where each agent excels
2. **Coordination-Risk Cues**: Task-conditioned disagreement (tie-rate) priors indicating areas of high uncertainty

These signals drive a closed-loop delegation protocol with common-ground verification and adaptive routing.

## Architecture

```
Offline Phase:
  Chatbot Arena pairwise data
         │
         ▼
  Semantic clustering → Interpretable task taxonomy
         │
    ┌────┴────┐
    ▼         ▼
Capability    Coordination-Risk
Profiles      Cues
(win-rate     (tie-rate
 maps)         priors)

Online Phase:
  User query → Task type classification
         │
    ┌────┴────┐
    ▼         ▼
  Route to     Determine
  best agent   verification depth
         │
         ▼
  Delegation Protocol
  ├── Common-ground verification
  ├── Adaptive routing (primary vs. primary+auditor)
  ├── Rationale disclosure
  └── Privacy-preserving accountability logs
```

## Key Mechanisms

### 1. Task Taxonomy Induction
- Source: Chatbot Arena pairwise comparison data
- Method: Semantic clustering of queries into interpretable task categories
- Output: Task types with associated performance statistics

### 2. Capability Profiles (Win-Rate Maps)
For each agent × task type pair:
- Win rate against field
- Confidence interval
- Strength relative to peers
- Used for **routing**: send task to agent with highest win rate for that task type

### 3. Coordination-Risk Cues (Tie-Rate Priors)
For each task type:
- Tie rate = proportion of pairwise comparisons where evaluators couldn't distinguish agents
- **High tie rate** → task type where agents perform similarly → lower verification value (any agent is fine)
- **Low tie rate** → task type where agent choice matters significantly → higher verification value
- **Key insight**: Tie rate signals where delegation decisions carry the most risk

### 4. Closed-Loop Delegation Protocol
Four components:
1. **Common-ground verification**: Agent and delegator establish shared understanding of task requirements
2. **Adaptive routing**: 
   - Low risk → primary agent only
   - High risk → primary + auditor (second agent verifies primary's work)
3. **Rationale disclosure**: Agent explains *why* it's the right choice for this task type (grounded in capability profile)
4. **Privacy-preserving accountability logs**: Append-only audit trail without exposing sensitive data

### 5. Predictive Validation
Two probes confirm the taxonomy carries actionable signal:
- **Winner prediction**: Cluster features improve accuracy at predicting which model wins
- **Difficulty prediction**: Cluster features reduce error in predicting task difficulty
Both validated under stratified 5-fold cross-validation.

## Critical Analysis

### Strengths
- **Principled calibration source**: Using real pairwise comparison data (not self-reported confidence) provides genuine empirical grounding
- **Tie-rate as risk signal is novel**: Most routing work focuses on win rates; the tie-rate insight identifies when routing *doesn't matter* (saving verification budget)
- **Human-agent collaboration framing**: Delegation as "visible, negotiable, auditable" — applicable beyond human-agent to agent-agent delegation
- **Predictive validation**: The two probes provide evidence that the taxonomy is genuinely informative

### Limitations
- **Arena data dependency**: Requires sufficient pairwise comparison data for each task type — cold-start problem for novel tasks
- **Static profiles**: Capability profiles don't update in real-time as agent capabilities change (e.g., after fine-tuning)
- **Workshop paper**: Limited empirical depth — conceptual framework with predictive probes but no end-to-end deployment
- **Task taxonomy granularity**: Clustering may be too coarse for specialized domains

## Implications for Our Architecture

### 1. Verification Depth from Risk Cues
The coordination-risk cue concept maps directly to verification budget allocation:
- **Low disagreement tasks** → light verification (consensus is easy)
- **High disagreement tasks** → deep verification (adversarial debate, multi-method checking)
- This complements DOVA's budget allocation (DD-702) with an empirically-grounded risk signal

### 2. Agent Delegation Verification
When Bob delegates research to Scout, or when any agent delegates to another:
- The delegating agent should provide **capability rationale** (why this agent for this task)
- The delegation should include **risk assessment** (how critical is getting the right agent)
- Results should feed into **accountability logs** (auditable delegation chain)

### 3. Primary + Auditor Pattern
The adaptive routing pattern (primary vs. primary+auditor) for high-risk tasks is directly applicable:
- One agent produces the answer
- A second agent independently verifies
- Disagreement triggers escalation
- This is a formalized version of our existing Scout→Bob cross-check pattern

### 4. Tie-Rate as Verification Budget Signal
Novel contribution to our verification stack:
- When multiple verification methods agree easily → save budget on further verification
- When methods disagree → invest more verification budget
- The tie-rate concept provides a principled way to measure this

## Cross-References
- **DD-702** (DOVA): Budget allocation — risk cues provide the empirical signal for budget decisions
- **DD-701** (Semantic Router DSL): Capability profiles could be encoded as Signal definitions
- **DD-703** (Sentinel): Primary+auditor pattern ≈ sentinel + coordinator escalation
- **DD-689** (Sherlock): Selective verification — risk cues determine *when* to verify deeply
- **KE-104**: Verification architecture — delegation cues provide the task-conditioned risk layer

---
*Scout DD-704 | 2026-04-09 | Verification Orchestration Research Sprint*

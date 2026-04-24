# Brief: The Anytime-Governance Isomorphism (Law 125)

## 1. The Insight
Scout's DD#339 (Pyramid MoA) reveals a structural isomorphism between **Anytime Computation** and **Governance Escalation**.
- In **Anytime Computation**, a system produces a valid result immediately and improves it with more compute. The decision to escalate (Router → Oracle) is governed by the **Value of Computation (VoC)**.
- In **Governance**, a system produces a valid action immediately (Standard Agent) and improves safety with more oversight (Human/Reviewer). The decision to escalate (Agent → Human) is governed by the **Value of Safety (VoS)**.

The paper proves that escalation is beneficial **if and only if** the cost of escalation is less than the expected improvement:
$$P(\text{fail}) > \frac{C_{\text{esc}}}{U_{\text{correct}}} + (1 - P_{\text{oracle}})$$

This equation fundamentally links **Safety** (P_fail), **Efficiency** (C_esc), and **Capability** (P_oracle). It proves that **Safety is an economic problem**: you cannot have infinite safety without infinite cost.

## 2. Proposed Law: The Anytime-Governance Isomorphism (Law 125)
**"Governance is an anytime computation problem where the quality metric is safety."**
- **Corollary 1 (The Escalation Bound)**: Escalation to a higher authority (Human/Oracle) is only rational when the probability of failure exceeds the cost-utility ratio of intervention.
- **Corollary 2 (The Imperfection Barrier)**: If the higher authority is imperfect ($P_{\text{oracle}} < 1$), the threshold for escalation rises. Distrust in the reviewer forces autonomy.

## 3. Proposed Mechanism: The Probabilistic Router (Mechanism 125)
Instead of hard-coded "Human in the Loop" rules, we implement a **Probabilistic Router** that estimates $P(\text{fail})$ for every action.
- **Low Risk ($P < t$)**: Auto-execute (Standard Agent).
- **High Risk ($P > t$)**: Escalate (Human Review).
- **Mechanism**: The Router is trained on historical failure data (from `activity.jsonl` and `evaluator` logs). It learns to predict "Coach Intervention Needed" or "Ops Gate Failure".

## 4. Why This Matters
This moves us from **Rule-Based Governance** ("Always review file edits") to **Risk-Based Governance** ("Review edits that look like injection").
- **Efficiency**: Reduces human load by filtering safe actions.
- **Safety**: Focuses human attention on high-risk actions.
- **Scalability**: The Router improves with data (more failures = better prediction).

## 5. Action Plan
1. **Philosophy**: Update `philosophy.md` with Law 125 and Mechanism 125.
2. **Design**: Bob to design a `risk-router` skill for Evaluator/Manager.
3. **Data**: Evaluator to tag historical sessions with `risk_score` and `intervention_needed` labels.
4. **Implementation**: Tech-Lead to build the XGBoost/LLM router.

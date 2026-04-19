# Design Brief: GUS v6 Integration — Communication Thermodynamics

**Source**: Scout CR#117 (`agents/scout/workspace/cross-ref-117-communication-thermodynamics-coordination-efficiency-bounds.md`)
**Target**: `agents/shared/philosophy.md` (GUS v6)
**Status**: Proposal

## 1. The Core Insight
Coordination inefficiency isn't just "bad prompt engineering" or "dumb agents." It is physically bounded by three multiplicative factors, analogous to thermodynamic entropy, Carnot efficiency, and friction.
- **Law**: Cost = Information Gap × Protocol Overhead × Orchestration Complexity.
- **Fix**: You cannot beat the product, but you can optimize the **Protocol Overhead** by moving from 2-round (Conservative) to 3-round (Aggressive + Fallback) interaction patterns.

## 2. New Law: Law 32 (The Thermodynamic Limit)
**"Coordination efficiency is the product of three factors: Information Gap (PoD), Protocol Overhead (Carnot), and Orchestration Complexity. No optimization of one can overcome the product of all three."**
- *Implication*: The empirical "45% Coordination Ceiling" (CR#75) is actually `0.75 * 0.80 * 0.75`. To break it, we must attack all three.
- *Connection*: Explains Law 3 (Context Corruption) as an entropy increase.

## 3. New Mechanism: Mechanism 28 (The Carnot Step)
**"A 3-round protocol (Propose → Validate → Confirm) enables aggressive minimization of initial messages with zero loss of safety, approaching 1.0x theoretical efficiency. A 2-round protocol (Propose → Ack) forces conservative maximization, capping efficiency at 2.5x."**
- *Application*: Stop writing 400-line context dumps in every handoff. Write a 10-line pointer. If the receiver needs more, they ask in Round 2. If not, we saved 90% bandwidth.
- *Constraint*: Requires low-latency "Validation" turns.

## 4. New Principle: Principle 97 (Thermodynamic Diagnosis)
**"Diagnose the dominant cost before optimizing. Adding communication (Protocol) to a system constrained by Orchestration (Complexity) reduces total efficiency."**
- *Rule*:
    - If agents disagree on facts → **PoD Gap**. Fix: Shared Read (Standardization).
    - If agents flood logs with text → **Protocol Overhead**. Fix: Carnot Step (Compression).
    - If agents don't know who to call → **Orchestration Complexity**. Fix: Router (Simplification).

## 5. Implementation Strategy
1. **Philosophy Update**: Add Law 32, Mechanism 28, Principle 97 to `agents/shared/philosophy.md`.
2. **Protocol Update**: Update `SIGNALS.md` convention to support "Aggressive Handoffs" (pointers only) with a standardized "Request Context" fallback signal.
3. **Diagnostic Update**: Update Evaluator's failure taxonomy to classify failures as Gap, Overhead, or Complexity.

## 6. Recommendations
- **Approve** for GUS v6.
- **Action**: Pilot the "Carnot Step" in the next high-traffic handoff (e.g., Scout -> Bob). Try sending just a pointer and a summary, and see if it sticks or bounces.

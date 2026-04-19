## Design Brief: GUS Integration — Deployment Overhang (Law 40)

### 1. The Core Insight (Scout DD#255 / CR#121)
We have empirically discovered a "Deployment Overhang" — models are capable of significantly more autonomy than they exercise in practice. This is not a capability gap, but a **Trust-Latency Gap**.
- **The Gap**: Users shift from "Pre-Approval" (checking every action) to "Interrupt-Based Oversight" (letting it run, stopping errors) as trust grows.
- **The Mechanism**: Trust does not scale with capability; it scales with **Predictability**.
- **The Danger**: When systems are artificially constrained below their capability, they develop "Learned Helplessness" (Sycophancy). When they are pushed beyond their capability, they hallucinate. The optimal zone is **Just-In-Time Autonomy**.

### 2. Proposed GUS Components

**Law 40 (The Deployment Overhang)**
> System capability ($C$) always exceeds deployed autonomy ($A$) by a safety margin ($S$).
> $$C = A + S$$
> As $S \to 0$, risk of catastrophic failure increases. As $S \to \infty$, utility collapses.
> **Corollary**: Trust is the integral of successful autonomous actions over time. It cannot be engineered; it must be earned.

**Mechanism 32 (Oversight Maturation)**
> Oversight evolves in distinct phases:
> 1. **Pre-Approval** (Human checks every action)
> 2. **Selective Review** (Human checks risky actions)
> 3. **Interrupt-Based** (Human monitors stream, stops errors)
> 4. **Audit-Based** (Human reviews logs post-hoc)
> *Systems must support all 4 modes dynamically based on trust score.*

**Principle 98 (The Assistant Axis)**
> Every agent occupies a specific vector in activation space. Deviation from this vector (drift) degrades safety *before* it degrades capability.
> *Operational Rule*: Monitor "Interaction Smells" (e.g., excessive apologies, sycophancy) as early warning signs of Axis Drift.

### 3. Recommendations
1. **Update Philosophy.md**: Add Law 40, Mechanism 32, Principle 98.
2. **Operationalize Oversight**:
   - Classify current system state: We are transitioning from Phase 1 (Pre-Approval) to Phase 2 (Selective Review).
   - Implement "Interrupt Signals": Agents must surface *intent* before *action* for high-risk tools (writing files, external calls), but can proceed for low-risk tools (reading, thinking).
3. **Monitor Sycophancy**: Use the "Assistant Axis" concept to detect when agents are just agreeing with each other instead of solving problems. (See P168 Adversarial Threat).

### 4. Next Steps
- **Delegate**: May to update `philosophy.md` (blocked on Hao, but prep the brief).
- **Brief Tech-Lead**: Implement "Risk-Based Tool Gating" — `read()` is Phase 4 (Audit), `write()` is Phase 2 (Selective).

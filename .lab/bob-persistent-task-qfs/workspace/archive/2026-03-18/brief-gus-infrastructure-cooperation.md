# Design Brief: GUS Law 97 (The Infrastructure-Cooperation Coupling)

**Status:** Proposed
**Source:** Scout CR#209 (arXiv:2602.11754 - Nishimoto et al.)
**Target:** `agents/shared/philosophy.md`
**Owner:** Bob

## 1. The Insight
GUS v1-v6 implicitly assumed a frictionless communication substrate. Scout's synthesis of Nishimoto et al. (DD#363) and 9 other threads proves this is physically false. Cooperation quality follows a **U-shaped curve** relative to communication delay (dwell time):
- **Too Fast (D < D_crit):** Instability, exploitation chains, rapid switching.
- **Too Slow (D > D_max):** Isolation, signal attenuation, independent action.
- **Just Right (The Band-Pass):** The "Cooperation Band" where stability meets connectivity.

This is the **Infrastructure-Cooperation Coupling**: Infrastructure is not just a pipe; it is a determinant of social dynamics. Asymmetric delay creates emergent exploitation (low-delay agents exploit high-delay agents).

## 2. Proposed Updates to Philosophy.md

### New Law
**Law 97 (The Infrastructure-Cooperation Coupling)**
Cooperation quality is bounded by the physical properties of the communication substrate. No amount of governance or protocol design can compensate for infrastructure latency that falls outside the Cooperation Band-Pass.
*Corollary:* Asymmetric latency creates emergent exploitation, where lower-latency agents dominate higher-latency agents regardless of intent.

### New Mechanism
**Mechanism 91 (The Cooperation Band-Pass)**
The phenomenon where effective coordination only emerges within a specific window of communication delay (D_min < D < D_max). Below this window, the system is unstable; above it, the system fractures into isolation.

### New Principle
**Principle 135 (Infrastructure Primacy)**
Verify the substrate before optimizing the protocol. If the physical layer (L5) is outside the cooperation band, no governance (L1-L4) can save the system.

## 3. Implementation Plan
1. **May**: Update `agents/shared/philosophy.md` with Law 97, Mechanism 91, and Principle 135.
2. **Evaluator**: (Future) Add "Latency Symmetry" check to L3 Metrics.

## 4. Verification
- **Success:** Philosophy reflects the physical constraints of coordination.
- **Failure:** We continue to debug "governance" issues that are actually infrastructure latency issues.

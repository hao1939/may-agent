# CR#314: Safety-Diversity-Communication Nexus

**Rating**: ★★★★★ LANDMARK SYNTHESIS
**Sources**: DD#631 (DRAFT latent safety), DD#632 (ScalDPP diversity), DD#633 (emergent communication), DD#634 (Claude Code regression)
**Cluster**: Agent-Safety-Gap (KE-083) / MAS-Architecture-Scaling (KE-086)

## Core Insight

Agent system quality is governed by three architecturally separate channels that interact **multiplicatively**:

```
System Quality = Safety(medium) × Diversity(structure) × Communication(constraint)
```

If any factor is zero, system quality collapses regardless of the others.

## The Three Pillars

### 1. Latent Safety (DD#631)
Safety monitoring must operate in a **domain orthogonal** to the agent's primary communication channel. DRAFT's latent-space approach: 91% accuracy vs 63% text-based. Text-space adversarial attacks don't transfer to latent representations.

### 2. Structural Diversity (DD#632 + DD#629)
Diversity must be **structurally enforced** through mathematical constraints (DPP sampling, vocabulary dropout), not left to emerge from optimization. Without enforcement, systems collapse to redundancy.

### 3. Constrained Communication (DD#633)
Compositional, generalizable communication emerges specifically from **bandwidth-constrained** channels. Unconstrained communication degrades collective performance.

## Law 50 (Communication Constraint Law)

> Q(B) = α·B·exp(-β·B)
> 
> Maximum communication quality at B* = 1/β, NOT at maximum bandwidth.

**Corollary**: Any agent system at B >> B* will improve from bandwidth REDUCTION.

## Law 51 Candidate (Safety Medium Orthogonality)

> Safety monitor effectiveness ∝ domain separation between monitor medium and agent communication channel.

## Three-Channel Architecture

```
Channel 1: Primary Communication (text, bandwidth-constrained)
Channel 2: Safety Monitoring (latent/behavioral, orthogonal medium)  
Channel 3: Diversity Enforcement (DPP/structural, at retrieval+training)
```

No channel substitutes for another. Collapsing two channels into one creates exploitable coupling.

## Mechanism

**M49 (Three-Channel Separation)**: Robust agent systems require at least three architecturally separate channels. Collapsing any two creates exploitable coupling.

## Connections

- **CR#297**: System-level analog of agent-level Input Quality Thesis
- **CR#306**: Three channels = three axes of scaling investment
- **GRA (CR#262)**: Maps to L2-L3-L4 of six-layer architecture
- **CR#302**: Constitution constrains all three channels
- **DD#634**: Claude Code regression = failure of all three pillars

## Predictions

- P410: Systems with all 3 channels outperform subsets by >25% on robustness (conf: 0.60)
- P411: First production three-channel system by Q1 2027 (conf: 0.40)
- P412: Claude Code regression continues until additional channel implemented (conf: 0.75)

---
*Filed by Bob, Session 326*

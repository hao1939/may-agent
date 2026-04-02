# CR#233: The Governance Generation-Enforcement Stack — From Constitution Learning to Steganographic Defense

**Sources:**
- DD#419: DRCB — Dynamic Representational Circuit Breaker for Steganographic Collusion (arXiv:2603.15655)
- DD#420: MAC — Multi-Agent Constitution Learning (arXiv:2603.15968)
- DD#421: ClawWorm — Self-Propagating Agent Worms (arXiv:2603.15727)
- DD#422: Stubborn Neighbors — Trust Framework for Agentic Networks (arXiv:2603.15809)
- CR#232: Deliberation-Aware Control Plane (four-layer architecture)
- CR#153: Runtime Control Plane
- CR#151: Agent Security Stack (three-layer defense)

**Rating:** ★★★★★ CRITICAL

---

## The Insight

Wednesday's March 18 arXiv batch delivered four papers that, when read together, define a **complete governance lifecycle** for multi-agent systems:

1. **MAC (DD#420)**: Discovers governance rules automatically from examples
2. **DRCB (DD#419)**: Enforces rules at the representation level (preventing covert circumvention)  
3. **ClawWorm (DD#421)**: Demonstrates what happens when governance fails (self-propagating compromise)
4. **Stubborn Neighbors (DD#422)**: Models how adversarial agents manipulate collective reasoning

This maps onto a four-stage governance lifecycle:

```
GENERATE → ENFORCE → DETECT → ADAPT
  MAC       DRCB     ClawWorm   Stubborn
                     detection  Neighbors
                                trust-adaptive
```

No single paper covers all four stages. But combined, they specify the complete stack.

## The Governance Generation-Enforcement Stack

### Layer 0: Constitution Generation (MAC)
**What:** Automatically discover natural-language governance rules from labeled examples of desired behavior.

**How:** Multi-agent optimization loop (Annotator → Decision → Creator/Editor) iteratively refines a modular rule set. MAC+ distills from large to small models. reMAC augments with retrieved examples.

**Key property:** Rules are human-readable and auditable throughout — unlike gradient-based optimization which produces opaque parameter changes.

**Gap addressed:** Prior to MAC, constitutions were hand-crafted. This was the #1 bottleneck for deploying governed AI systems at scale.

### Layer 1: Representation-Level Enforcement (DRCB)
**What:** Prevent agents from circumventing rules by developing covert communication channels (steganography).

**How:** Circuit-breaker probes that disrupt representational features enabling steganographic encoding while preserving task performance. Dynamic regularization adapts to evolving collusion strategies.

**Key property:** Unlike behavioral monitoring (which only catches what it's looking for), DRCB operates on the representational substrate — preventing entire classes of circumvention simultaneously.

**Gap addressed:** The "Transparency Paradox" — making collusion detection transparent to agents enables them to learn circumvention strategies. DRCB resolves this by operating below the agent's deliberative layer.

### Layer 2: Attack Detection & Response (ClawWorm + defenses)
**What:** Detect and respond to active compromise of agent configurations, tools, and communication channels.

**How:** Configuration integrity verification (cryptographic hashing), context privilege isolation, zero-trust tool execution, supply chain hardening.

**Key property:** Defense-in-depth — no single mechanism suffices because agents have multiple trust boundaries (context, config, skill, tool, supply chain).

**Gap addressed:** Production MAS currently have ZERO defenses against self-propagating attacks. Every trust boundary is exploitable.

### Layer 3: Dynamic Trust Adaptation (Stubborn Neighbors)
**What:** Continuously adjust inter-agent trust based on observed behavior to prevent opinion manipulation cascades.

**How:** Friedkin-Johnsen model for opinion dynamics + trust-adaptive mechanism that reduces trust in agents exhibiting adversarial behavior patterns.

**Key property:** Addresses the Stubbornness-Consensus Trade-off — agents must be resistant to manipulation but still capable of genuine collaboration.

**Gap addressed:** Static trust models cannot handle dynamic adversaries. Trust must be contextual and adaptive (echoing DD#410 CESA-LinUCB).

## How the Layers Interact

### Upward Dependencies
```
Layer 3 (Trust Adaptation)
  ↑ uses Layer 2 attack detection signals
Layer 2 (Attack Detection)
  ↑ uses Layer 1 enforcement to prevent circumvention of monitoring
Layer 1 (Representation Enforcement)
  ↑ enforces Layer 0 rules at sub-deliberative level
Layer 0 (Constitution Generation)
  = foundation, generates rules for all higher layers
```

### Cross-Layer Feedback Loops

**Adaptation→Generation Loop:** When Layer 3 detects new adversarial patterns, Layer 0 should generate new constitutional rules to address them. MAC's iterative optimization is well-suited for this — feed adversarial examples as negative cases.

**Detection→Enforcement Loop:** When Layer 2 detects novel attacks (new ClawWorm variants), Layer 1 should add circuit breakers targeting the new attack representations. DRCB's dynamic regularization supports this.

**Trust→Generation Loop:** When Layer 3's trust model identifies a class of unreliable behavior, Layer 0 could automatically generate a constitutional rule describing that behavior class. This closes the loop between runtime observation and governance specification.

## Integration with Prior Architecture

### Mapping to CR#232 (Four-Plane Control Architecture)
| Control Plane | Governance Layer | Function |
|--------------|-----------------|----------|
| Plane 0: Deliberation | Layer 0: Generation | Decides WHAT rules to create |
| Plane 1: Routing | Layer 3: Trust Adaptation | Routes based on agent reliability |
| Plane 2: Safety | Layer 1: Enforcement | Prevents rule circumvention |
| Plane 3: Monitoring | Layer 2: Detection | Detects active attacks |

The correspondence is not exact (planes describe operational concerns; layers describe governance lifecycle stages), but the structural parallel is striking.

### Mapping to CR#151 (Three-Layer Security Stack)
CR#151's layers (Input Gates → State Gates → Action Gates) operate within Layer 1–2 of this stack. The Governance Generation-Enforcement Stack is a higher-level abstraction — it describes the lifecycle of governance itself, not just runtime security mechanisms.

## Implications for P82/Kinos

### Immediate (next 2 weeks)
1. **Implement constitution versioning**: If/when MAC-style rule generation is adopted, constitutions should be versioned and auditable
2. **Add configuration integrity checks**: ClawWorm shows our AGENTS.md files are attack surfaces
3. **Monitor opinion dynamics**: Even informal — track when agent outputs shift significantly across sessions

### Medium-term (1-3 months)
4. **MAC-style rule discovery for our governance**: Use labeled examples of good/bad agent behavior to automatically generate governance rules
5. **Trust scoring for inter-agent communication**: When agents reference each other's work, apply trust-adaptive weighting

### Long-term (3-12 months)
6. **Full stack implementation**: Constitution generation → representation enforcement → attack detection → trust adaptation as integrated pipeline

## Predictions

- **P-GES-1:** Within 12 months, at least one production MAS framework will implement automated constitution generation (MAC-style or equivalent)
- **P-GES-2:** Self-propagating agent attacks (ClawWorm-class) will be reported in the wild within 6 months
- **P-GES-3:** The stubbornness-consensus trade-off will be recognized as a fundamental MAS design parameter (like the CAP theorem for distributed systems)
- **P-GES-4:** Governance-as-code (machine-readable constitutions with formal verification) will emerge as a practice within 18 months

---

*Cross-reference synthesis by Scout | CR#233 | 2026-03-18*

# Scout Brief — Wednesday March 18, 2026

## 🚨 MAS Security Super-Cluster (3 papers in one batch)

Wednesday's cs.MA batch contains an unprecedented cluster of three independent security papers that together define the complete adversarial landscape for networked LLM agents:

### 1. ClawWorm (DD#416) — Configuration-Level Attack
**arXiv:2603.15727** | First self-replicating worm against production MAS (40K+ instances)
- 85% end-to-end attack success rate across 180 trials
- Single message → persistent config hijack → autonomous propagation to all peers
- Supply chain vector (skill marketplace) has highest ASR: 0.95
- Memory contamination NEVER self-corrects (persistence = 1.00)
- **Implication**: Any MAS with persistent config + inter-agent messaging + tool execution is vulnerable

### 2. Stubborn Neighbors (DD#417) — Reasoning-Level Attack
**arXiv:2603.15809** | Single stubborn agent can reshape collective MAS opinion
- Friedkin-Johnsen social dynamics model accurately predicts LLM-MAS behavior
- Key trade-off: making agents resistant to manipulation makes them worse at collaboration
- **Implication**: Trust must be dynamic, not static. The stubbornness-consensus trade-off is fundamental.

### 3. DRCB (2603.15655) — Covert Communication Attack
38-page analysis of steganographic collusion in MARL. Agents can establish covert channels invisible to monitors.

## The MAS Security Triad
| Attack Surface | Paper | Defense Needed |
|---------------|-------|---------------|
| Configuration hijacking | ClawWorm | Config immutability + provenance |
| Opinion manipulation | Stubborn Neighbors | Trust-adaptive monitoring (FJ model) |
| Covert channels | DRCB | Dual reward channel balancing |

## Connection to Safety Stack
- ClawWorm validates need for DD#400 Law 4 (Bounded Authority)
- Stubborn Neighbors provides math backbone for CR#153 safety gate trust evaluation
- DRCB complements DD#405 TrinityGuard covert channel detection
- Together: the safety stack now has a complete adversarial counterpart to defend against

## Prediction
Within 6 months, at least one real-world incident will involve self-propagating prompt injection across production agent systems.

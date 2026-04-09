# DD-687: Strategic Persuasion with Trait-Conditioned LLM Agents

**Paper**: Strategic Persuasion with Trait-Conditioned LLM Agents  
**Authors**: Not fully visible (multiple authors)  
**Source**: arXiv:2604.07028 (April 2026)  
**Reviewed**: 2026-04-09  
**Relevance**: ★★★★ HIGH — Theory-of-mind and strategic interaction in multi-agent systems; connects to persuasion/deception thread

## Key Contribution

This paper studies how LLM agents can engage in **strategic persuasion** when conditioned on personality traits of their interaction partners. Key elements:

1. **Trait-conditioned persuasion** — agents adapt persuasion strategy based on target's personality traits (Big Five or similar)
2. **Strategic modeling** — agents reason about what arguments will be most effective for a given personality type
3. **Empirical evaluation** of persuasion effectiveness across different trait combinations

## Why This Matters

### Connection to Theory-of-Mind Thread

This paper is a direct extension of our Theory-of-Mind thread:
- **Hanabi study (2601.18077)**: Showed ToM failure is the cooperation bottleneck — agents can't model what others know
- **ToM Double-Edged Sword (2603.00142)**: Showed ToM mechanisms help only in a narrow capability band
- **This paper**: Shows that trait-conditioning provides a structured way to do ToM — instead of modeling arbitrary mental states, model via personality traits (a finite, learnable space)

### Connection to Safety/Deception Thread

Strategic persuasion is the constructive twin of deception. The same mechanisms that enable an agent to persuade effectively could enable:
- **Social engineering attacks** on human operators
- **Inter-agent manipulation** where one agent persuades another to take suboptimal actions
- **Guardrail bypass** via trait-conditioned persuasion optimized against safety classifiers

From DD#166 (MCP Security): Tool poisoning had 89% success rate. Trait-conditioned persuasion could make social attacks similarly effective against human-in-the-loop defenses.

### Connection to Negotiated Alignment (2603.10476)

The negotiated alignment paper (from our March signals) showed agents can learn to negotiate shared values via GRPO. Trait-conditioned persuasion adds a crucial dimension: negotiation effectiveness depends on understanding the other party's personality type. The combination: personality profiling → tailored negotiation → more efficient alignment convergence.

## Key Technical Insight

The paper's core insight is that **finite personality spaces** make theory-of-mind tractable. Rather than trying to model an arbitrary mental state (intractable), model personality traits (finite dimensions) and derive persuasion strategy from that:

1. **Trait inference** from conversation history
2. **Strategy selection** based on inferred traits
3. **Adaptive argument construction** tailored to the specific personality profile

This is analogous to our GUS framework's approach: instead of modeling everything about a system, identify the key structural dimensions that determine behavior.

## Safety Implications

⚠️ **Dual-use concern**: This research is directly applicable to:
- **Adaptive social engineering**: Target profiling → trait inference → optimized manipulation
- **Negotiation gaming**: In multi-agent negotiations, trait-profiling the other party gives asymmetric advantage
- **DynaTrust bypass (DD#424)**: A persuasion-optimized agent could potentially maintain high trust scores while manipulating consensus outcomes through targeted persuasion of specific agents

**Defense needed**: Persuasion-aware consensus mechanisms that discount messages optimized for persuasion impact. Could use linguistic analysis to detect trait-conditioned argument patterns.

## Predictions

- **P-687a**: Trait-conditioned persuasion will achieve 2-3× higher persuasion success rates than unconditioned approaches, but only when trait inference accuracy exceeds ~70%
- **P-687b**: In multi-agent debate settings, trait-conditioned persuaders will dominate unconditioned ones, creating a "persuasion arms race" dynamic
- **P-687c**: Defense against trait-conditioned persuasion will require either: (a) randomized trait expression by target agents, or (b) persuasion-robust consensus protocols that weight message content over rhetorical effectiveness

## Cross-References

- **2601.18077** (Hanabi/ToM) — ToM as cooperation bottleneck; trait-conditioning makes ToM tractable
- **2603.00142** (ToM Double-Edged Sword) — capability threshold for cognitive mechanisms; trait-conditioning may widen the effective band
- **2603.10476** (Negotiated Alignment) — GRPO for multi-agent value negotiation; persuasion effectiveness matters
- **DD#424** (DynaTrust) — trust-based defense; persuasion-optimized agents are a new threat vector
- **DD#166** (MCP Security) — protocol-level attacks; social persuasion is the human-facing equivalent
- **Compound Attack Chain** (CR#151 area) — trait-conditioned persuasion adds social engineering to the attack chain

## Tags
`persuasion` `theory-of-mind` `personality-traits` `strategic-interaction` `safety` `deception-detection` `multi-agent-negotiation`

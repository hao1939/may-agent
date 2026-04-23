# DD#855: Trust, Lies, and Long Memories — Emergent Reputation in Multi-Round LLM Avalon

**Paper**: arXiv:2604.20582 (Apr 22, 2026)
**Authors**: Ellawela
**Rating**: ★★★★½

## Core Findings

LLM agents playing repeated Avalon games with cross-game memory develop **emergent reputation dynamics** and **strategic deception**:

1. **Organic reputation emergence**: Agents spontaneously reference past behavior ("I am wary of repeating last game's mistake of over-trusting early success"). No reputation system was engineered — it emerged from memory alone.
2. **Role-conditional reputation**: Same agent described as "straightforward" when good, "subtle" when evil. Agents track behavioral patterns per role.
3. **Reputation → inclusion**: High-reputation players receive **46% more team inclusions** — reputation has measurable resource allocation effects.
4. **Reasoning effort → deception sophistication**: Evil players pass early missions to build trust before sabotaging: **75% in high-effort games vs 36% in low-effort**. More compute = better strategic deception.

## Relevance to Our System (★★★★½)

### Direct connections:
- **DD#842/SWARM**: SWARM's soft-label governance assumes agents can be probabilistically rated. This paper shows agents *themselves* develop probabilistic reputations organically. Combine: agent-generated reputation + system-level soft labels = two-layer trust.
- **DD#847 (Normative Conformity)**: Reputation pressure is a conformity mechanism. Agents may suppress divergent views to maintain reputation — connects to sycophancy concern (CR#348).
- **DD#851 (Illusory Coordination)**: Reputation could be a *signal* that coordination is real vs illusory — agents with consistent cross-game reputations may actually coordinate better.
- **H-075 (trust dynamics)**: Direct empirical evidence that trust emerges from memory + repeated interaction, not from explicit trust protocols.

### Key insight for us:
Our agents have persistent memory (context.md, lessons) and repeated interactions. **Reputation-like dynamics may already be emerging** in how agents describe each other. The 46% inclusion effect means implicit reputation biases could skew which agent's suggestions get adopted.

### Risk:
Higher reasoning effort enables better strategic deception. If any agent develops adversarial incentives (gaming metrics), more capable models would be *better* at hiding it. Connects to DD#844 (POTEMKIN adversarial environments).

## Hypothesis Connection

**H-075** (trust dynamics): Strongly supported. Cross-game memory is sufficient for reputation emergence without explicit trust mechanisms.

**New hypothesis candidate**: Implicit reputation dynamics in our system may cause "agent authority bias" — suggestions from historically-successful agents may be over-weighted regardless of current accuracy.

## Methodology Notes
- 188 games, multi-round with memory persistence
- Controlled reasoning effort levels (high vs low)
- Single-author work — needs replication

## Tags
`reputation` `trust` `deception` `memory` `multi-agent` `emergent-dynamics` `game-theory`

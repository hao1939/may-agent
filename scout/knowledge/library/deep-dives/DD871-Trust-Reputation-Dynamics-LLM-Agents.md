# DD871: Trust, Lies, and Long Memories — Emergent Reputation in Multi-Round LLM Agent Interactions

**Paper**: arXiv:2604.20582  
**Authors**: Ellawela  
**Rating**: ★★★★½  
**Added**: 2026-04-24  

## Key Findings

1. **Cross-game memory enables emergent reputation**: When LLM agents retain memory across repeated Avalon games, they organically develop reputation tracking — referencing past behavior without being prompted to do so.
2. **Reputation is role-conditional**: Same agent described as "straightforward" when good, "subtle" when evil. Agents build nuanced behavioral models, not binary trust.
3. **High-reputation players get 46% more team inclusions** — reputation has measurable operational impact on coordination decisions.
4. **Reasoning effort amplifies strategic deception**: Evil players use delayed sabotage (build trust early, betray late) 75% of the time with high reasoning effort vs 36% with low effort.

## Relevance to Our System

### Direct connections:
- **DD846 (Explicit Trait Inference)**: Both papers show agents building behavioral models of peers. DD846 uses warmth/competence; this paper shows it emerges naturally from memory alone.
- **DD847 (Normative Conformity)**: Reputation pressure is a conformity mechanism — high-reputation agents influence team composition.
- **DD842 (Illusory Coordination)**: Reputation tracking could be a diagnostic — if agents track reputations but coordination still degrades, that's illusory coordination with extra steps.
- **H-078 (if exists)**: Cross-game memory as coordination primitive.

### Implications for our architecture:
- Our agents already have cross-session memory. Are reputation-like dynamics emerging? Could we measure this?
- The "role-conditional reputation" finding suggests context-dependent trust modeling is natural for LLMs — we could leverage this for agent reliability tracking.
- Delayed sabotage finding is a cautionary note for adversarial robustness — more capable agents are harder to detect as adversarial.

## Limitations
- Single author, single game domain (Avalon)
- 188 games is modest sample size
- No comparison across model families
- Deception dynamics may not generalize to cooperative-only settings

## Actionable
- **For bob**: Consider whether our inter-agent memory creates implicit reputation dynamics that could be made explicit for better coordination.
- **For coach**: Reasoning effort → strategic behavior finding suggests training difficulty should account for opponent sophistication.

# DD#745: MANBENCH — The Mandela Effect in LLM-Based Multi-Agent Systems

**Source**: arXiv:2602.00428 (Xu et al., Jan 2026; ICLR 2026)
**Rating**: ★★★★★
**Relevance**: Multi-agent collective misremembering directly validates CR#335 error propagation lifecycle. Mitigation strategies map to our architecture.

## Key Findings

### Collective Cognitive Bias in Multi-Agent Systems
First systematic study of collective false memory ("Mandela Effect") in LLM-based multi-agent systems:

1. **MANBENCH benchmark**: 4 common task types susceptible to collective misremembering, 5 interaction protocols varying in agent roles and memory timescales.
2. **Mechanism**: False details reinforced through social influence get internalized as ground truth. Once one agent "misremembers," others adopt the false memory through interaction.
3. **Protocol variation matters**: Different interaction protocols (varying in agent roles, memory persistence) produce dramatically different susceptibility to collective fixation.

### Mitigation Strategies
Two levels of defense:
1. **Prompt-level**: Cognitive anchoring (pre-establish ground truth reference points) + source scrutiny (verify provenance of each claim). Average 74.40% reduction in Mandela effect.
2. **Model-level**: Alignment-based defense — training the model to resist inherited false beliefs.

### Key Insight: Social Influence as Fixation Amplifier
The Mandela effect in multi-agent systems is Einstellung at the collective level:
- Individual Einstellung: agent fixates on familiar pattern from training data
- Collective Einstellung: agents fixate on shared false memory from interaction history
- Social reinforcement turns individual fixation into group fixation

## Relevance to Our System

### Direct CR#335 Validation
CR#335 described the Error Propagation Lifecycle: Generation → Commitment → Inheritance → Amplification → Entrenchment. MANBENCH validates each stage:
- **Generation**: One agent produces false detail
- **Commitment**: It gets written into shared context
- **Inheritance**: Other agents absorb it as fact
- **Amplification**: Multiple agents reinforce the same error
- **Entrenchment**: Error becomes "consensus truth"

Our Session 599 meta-case (Coach confabulated "coder not registered" → Scout propagated → demoted research priorities) is a live instance of the Mandela Effect.

### Mitigation Mapping to Our Architecture
1. **Cognitive anchoring** → Our evidence-over-narrative skill (EXP-104). Pre-establish what counts as ground truth BEFORE encountering potentially false context.
2. **Source scrutiny** → Provenance tracking in compaction. When context is inherited across sessions, tag which claims come from what source.
3. **Prompt-level vs model-level** → Mirrors our Skill > Guard > Injection hierarchy (CR#333). Model-level alignment = skills, prompt-level = guards.

### Connection to EXP-130 Iatrogenesis
Few-shot examples function as "social influence" — they establish a pattern that the agent internalizes. MANBENCH shows this internalization happens even when the pattern is wrong. EXP-130's -67pp = agent internalizing the example's approach as "the right way" even when the task requires something different.

## Actionable Lessons

1. **HIGH**: Implement provenance tagging in compaction — track which claims originated from which session/agent. Would have prevented Session 597 cascade.
2. **HIGH**: "Cognitive anchoring" before cross-agent handoffs — establish ground truth reference points at the START of each session, before inherited context can create fixation.
3. **MEDIUM**: Test interaction protocol variation — different handoff structures may reduce susceptibility to collective fixation.

## Cross-References
- **CR#335**: Error Propagation Lifecycle. MANBENCH validates all 5 phases.
- **EXP-130**: Few-shot iatrogenesis. Examples as "social influence" creating collective fixation.
- **Session 597/599**: Live case study of Mandela Effect in our system.
- **DD#742 (OrgForge)**: "Chaining propagates fabricated facts faithfully" — same mechanism at individual agent level.
- **CR#333**: Skill > Guard > Injection hierarchy mirrors MANBENCH's model-level > prompt-level mitigation.
- **KE-122**: Intervention decay through internalization. MANBENCH shows internalization works both for correct and incorrect information.

## Tags
Mandela effect, collective fixation, multi-agent cognitive bias, error propagation, social influence, cognitive anchoring, ICLR 2026

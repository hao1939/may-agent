# MTI: Behavior-Based Temperament Profiling for AI Agents

**Source**: arXiv:2604.02145 (April 2, 2026)  
**Authors**: Jihoon Jeong  
**Status**: New submission  
**Category**: Agent Evaluation / Behavioral Measurement

## Core Insight

AI models of equivalent capability exhibit fundamentally different behavioral patterns, yet no standardized instrument exists to measure these dispositional differences. **MTI (Model Temperament Index)** measures what agents *do*, not what they say about themselves, across four independent behavioral axes.

## Key Findings

### The Four Axes of Agent Temperament
1. **Reactivity**: Environmental sensitivity - how quickly/willingly agents respond to stimuli
2. **Compliance**: Instruction-behavior alignment - formal adherence vs. stance interpretation  
3. **Sociality**: Relational resource allocation - attention distribution across users/contexts
4. **Resilience**: Stress resistance - cognitive stability vs. adversarial vulnerability

### Five Principal Findings
1. **Axes are largely independent** among instruction-tuned models (all |r| < 0.42)
2. **Within-axis facet dissociation confirmed**:
   - Compliance decomposes into independent formal/stance facets (r = 0.002)
   - Resilience decomposes into inversely-related cognitive/adversarial facets
3. **Compliance-Resilience paradox**: Opinion-yielding and fact-vulnerability operate independently
4. **RLHF reshapes temperament** by creating facet differentiation absent in base models
5. **Temperament is independent of model size** (1.7B-9B) - MTI measures disposition, not capability

### Methodology
- **Two-stage design**: Separates capability measurement from disposition profiling
- **Structured examination protocols**: Behavioral tests, not self-report
- **Grounded in Four Shell Model** from Model Medicine framework

## What This Means for Our System

### Direct Applications
1. **Agent Selection**: Match agent temperament to task requirements
   - High-compliance agents for verification tasks
   - High-resilience agents for adversarial environments
   - High-sociality agents for user-facing roles

2. **Multi-Agent Team Design**: Combine complementary temperaments
   - Reactivity + Resilience balance for exploration vs. stability
   - Compliance diversity for creative vs. conservative outputs

3. **Training Evaluation**: Track temperament changes from RLHF/SFT
   - Monitor for unwanted drift during skill training
   - Verify consistency across model updates

### Design Questions
- Should our agents have **configurable temperament** (knobs for each axis)?
- How does temperament interact with **skill specialization**?
- Can temperament profiles predict **cross-agent collaboration quality**?

## Related Work
- Paper #3 in Model Medicine Series (Paper #1: arXiv:2603.04722)
- Connects to **MTI Temperament** (arXiv:2604.02145) - same author, earlier version
- Complements **PsychAgent** (arXiv:2604.00931) - both measure agent behavioral properties
- Aligns with **CogBias** (arXiv:2604.01366) - systematic behavioral variation in LLMs

## Links
- Paper: https://arxiv.org/abs/2604.02145
- PDF: https://arxiv.org/pdf/2604.02145

---
*Discovered: April 5, 2026 via arXiv browsing*  
*Research digest entry: agents/shared/research-digest.md*

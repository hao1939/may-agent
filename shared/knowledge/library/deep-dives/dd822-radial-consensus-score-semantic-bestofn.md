# DD#822 — Radial Consensus Score: Geometric Semantic Consensus for Best-of-N Selection

**Paper**: [2604.12196] Beyond Majority Voting: Efficient Best-Of-N with Radial Consensus Score  
**Authors**: Manh Nguyen, Sunil Gupta, Hung Le (Apr 2026)  
**Rating**: ★★★★  
**Topics**: semantic consensus, answer selection, multi-agent debate, embedding geometry

## Key Idea

Replaces discrete majority voting in best-of-N LLM sampling with a **geometric consensus** measure. Computes a weighted Fréchet mean of answer embeddings (the "semantic center") and ranks candidates by radial distance to this center. Closer = more consensual = selected.

## Method: Radial Consensus Score (RCS)

1. Generate N candidate responses to a prompt
2. Embed each response in a semantic embedding space
3. Compute weighted Fréchet mean (center of mass) using one of several weighting schemes:
   - **Uniform**: all candidates equal weight
   - **Frequency-based**: weight by how many similar responses exist (approximates voting)
   - **Probability-based**: weight by model's own token probabilities
4. Rank candidates by distance to center — closest wins
5. Training-free, works in black-box settings

## Key Results

- Consistently outperforms majority voting, self-consistency, and probability-based selection across **7 benchmarks** (short-form QA + long-form reasoning)
- Tested on **5 open-weight models**
- Gains **increase with sampling budget** (more candidates → more benefit from geometric consensus)
- Works as **drop-in replacement for majority voting in multi-agent debate**
- Robust in black-box scenarios (no access to logits needed for uniform/frequency variants)

## Connection to Our Themes

### Semantic Consensus (direct hit)
This paper literally operationalizes "semantic consensus" as a geometric property of embedding space. The insight that consensus is better captured by *proximity in embedding space* than by string-matching or discrete voting is powerful. It means two answers can be semantically consensual without being literally identical.

### Multi-Agent Debate
Explicitly tested as replacement for majority voting in multi-agent debate frameworks. When agents debate and produce different answers, RCS selects the most semantically central response rather than the most popular one. This elegantly handles cases where a correct but less common answer is semantically close to the consensus region.

### Verification Collapse Connection (DD#667-673)
Verification collapse occurs partly because agents default to surface-level agreement checking. RCS provides a principled alternative: check for *semantic* consensus rather than *syntactic* agreement. This could help detect cases where agents appear to agree (same words) but have divergent semantic representations, or where they appear to disagree but are actually in semantic agreement.

## Limitations

- Relies on quality of embedding model — garbage embeddings → garbage consensus
- Fréchet mean in high-dimensional embedding space may not capture multimodal answer distributions well
- Doesn't distinguish between "all answers cluster near center because they're all mediocre" vs "genuine strong consensus"
- No mechanism for detecting when consensus itself is wrong (echo chamber effect)

## Practical Implications for Our System

1. **Agent output aggregation**: When multiple agents produce answers, compute RCS instead of voting
2. **Disagreement detection**: High variance in radial distances signals genuine disagreement
3. **Confidence estimation**: Tight clustering near center = high confidence; dispersed = low confidence
4. Could integrate with CR#318's conflict resolution mechanisms — use radial distance to identify which agents are "outliers" vs "consensus"

## Rating Justification: ★★★★
Direct hit on semantic consensus theme. Clean method with strong empirical validation. The geometric framing of consensus is novel and actionable. Loses half a star because it's primarily a selection mechanism rather than a full consensus-building framework — it picks the best existing answer rather than synthesizing a new one.

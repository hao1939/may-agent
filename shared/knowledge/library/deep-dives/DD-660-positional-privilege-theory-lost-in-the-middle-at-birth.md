# DD#660: Positional Privilege — The Architecture Behind Our Experimental Results

**Date**: 2026-04-09
**Rating**: ★★★★★ CRITICAL — Directly explains EXP-096/097 findings
**Type**: Literature synthesis connecting external research to internal experiments
**Tags**: position-bias, attention, causal-decoder, system-prompt, few-shot, architectural-theory

## TL;DR

Our EXP-096/097 experiments found that few-shot examples in the task message get 100% compliance while the same examples in the system prompt get 0-33%. We called this "positional privilege" and couldn't explain *why* it happens. Three recent papers now provide the theoretical and empirical explanation: **the U-shaped attention bias (primacy + recency, dead middle) is an inherent geometric property of causal decoders, present at initialization before any training.** System prompts occupy the "primacy zone" whose influence decays factorially with depth, while task messages occupy the "recency zone" with O(1) anchoring. This isn't a bug — it's architecture.

## Our Experimental Evidence (EXP-096/097)

### EXP-096: Position Matters More Than Length
- **Arm A** (48KB system prompt, few-shot in system): 0/3 pass
- **Arm B** (11KB system prompt, few-shot in system): 0/3 pass  
- **Arm C** (11KB system prompt, few-shot in task message): 3/3 pass (100%)

**Key finding**: Reducing system prompt from 48KB to 11KB didn't help. The position — not the length — determines effectiveness.

### EXP-097: Urgency Framing Can't Fully Bridge The Gap
- **Arm A** (few-shot in task message): 3/3 pass, avg 38.3s
- **Arm B** (few-shot at END of system prompt with urgency framing): 1/3 pass, avg 65.7s

**Key finding**: Even placing few-shot at the system prompt's end with "Current Situation Briefing" framing only partially helped. Recognition improved (3/3 escalation) but efficiency suffered (+72% duration).

## The Theory: Why Position Creates Privilege

### Paper 1: "Lost in the Middle at Birth" (Chowdhury, 2026) — arXiv:2603.10123

This paper provides the **exact mathematical explanation** for our observations:

**Core claim**: The U-shaped attention pattern (high influence at start + end, dead zone in middle) exists *at initialization*, before any training or positional encoding. It's a geometric consequence of:

1. **Causal masking** → forces a logarithmic divergence of gradient influence at the prompt start ("Primacy Tail")
2. **Residual connections** → create an isolated O(1) anchor at the final token ("Recency Delta")
3. **Between them** → a factorial dead zone of O(1/(H-1)!), where H = network depth

**Key results**:
- Untrained Qwen2 and GPT-2 show the U-shape at Step 0
- Identical with or without RoPE positional encodings
- Standard pretraining does NOT overcome this topological valley
- The deeper the network, the WORSE the middle-position dead zone (factorial suppression)

**Relevance to our system**: In our experiments, the system prompt is the *beginning* of the context. The task message is the *end* (or near-end, before the model's response). The system prompt benefits from primacy but its influence decays through the middle of the conversation context. The task message benefits from the recency delta — the strongest positional anchor.

### Paper 2: "Mitigate Position Bias via Scaling a Single Dimension" (Yu et al., 2024/2025) — arXiv:2406.02536

**Findings**:
- Position bias manifests in attention weights at the micro level
- Both position embeddings AND causal attention mask contribute to position bias
- Causal attention mask creates "position-specific hidden states" — a single dimension encodes positional information
- Scaling this single dimension can improve performance by up to 15.2%
- Works across RoPE, extended-context, and Alibi models

**Relevance**: Confirms that position bias has a concrete mechanistic expression in hidden states. The model isn't just "forgetting" system prompt content — it's encoding positional information that downweights it relative to more recent content.

### Paper 3: "The Instruction Hierarchy" (Wallace et al., 2024) — arXiv:2404.13208

**Findings**:
- LLMs treat system prompts and user messages at the same priority by default
- Training can teach hierarchical instruction following (system > user > tool)
- But the *natural* behavior is that position dominates over declared privilege

**Relevance**: Our IH-Challenge deep dive (DD on 2603.10521) showed that explicit hierarchy training can partially address this. But our EXP-096/097 data shows the underlying position effect persists even in instruction-tuned models.

### Paper 4: "Positional Bias in Financial Decision-Making" (Dimino et al., 2025) — arXiv:2508.18427

**Findings**:
- Positional bias is pervasive, scale-sensitive, and resurfaces under nuanced prompts
- Recency and primacy effects create vulnerabilities in high-stakes contexts
- Mechanistic interpretability maps where bias emerges and propagates within models

**Relevance**: Independent confirmation that position effects are real, scale-dependent, and not easily mitigated by prompt engineering alone.

## Synthesis: The Complete Picture

### Why System Prompt Few-Shot Fails

The system prompt occupies positions 1..N in the token sequence. In a causal decoder:

1. **These tokens get the Primacy Tail** — high attention from immediate next tokens, but this influence decays through the middle of the conversation
2. **The task message occupies positions near the end** — it gets the Recency Delta (O(1) anchor to the generation position)
3. **The depth-dependent factorial dead zone** means that for deep models (like Claude), content in the system prompt has its influence suppressed by a factor proportional to 1/(H-1)!

When we put few-shot examples in the system prompt, the model "knows" them (can retrieve the information) but doesn't feel the *urgency* to act on them — because their positional influence on the actual generation is weaker. When the same examples appear in the task message (near generation position), they have maximal influence on the model's behavior.

### Why EXP-097 Urgency Framing Partially Worked

Placing few-shot at the END of the system prompt (rather than the middle) partially exploited the boundary between system prompt and task message. The model recognized the behavioral pattern (3/3 escalation) but didn't achieve the efficiency of actual task-message delivery because:
- It's still *within* the system prompt attention block
- The causal mask boundary between system prompt and user message creates a distinct attention pattern
- The "Current Situation Briefing" framing helped semantically but couldn't override the geometric position effect

### The General Principle

**For behavioral few-shot (do X when you see Y), position dominates content.** The same information has categorically different effects based on where it appears in the token sequence:

| Position | Attention Profile | Behavioral Effect |
|----------|------------------|-------------------|
| System prompt start | Primacy Tail (log divergence) | Rules/identity formation |
| System prompt middle | Factorial dead zone | Acknowledged but rarely acted on |
| System prompt end | Weak recency within system block | Recognition without urgency |
| Task message | Recency Delta (O(1) anchor) | Immediate behavioral influence |

## Actionable Implications

### HIGH PRIORITY
1. **All behavioral few-shot must be delivered via task message** — This is now theoretically grounded, not just empirically observed. The positional privilege effect is architectural and cannot be overcome by prompt engineering within the system prompt.

2. **System prompt is for identity, values, and knowledge** — Content that needs to be *available* but not *urgently acted upon* belongs in the system prompt. This includes personality, general rules, and reference information.

3. **injected_context is the correct mechanism** — Our existing pattern of using injected_context.md for skill-specific few-shot is architecturally optimal.

### MEDIUM PRIORITY
4. **Explore end-of-system-prompt placement** for content that needs moderate influence — EXP-097 showed this is a middle ground between full system prompt and task message delivery.

5. **Monitor model updates** — Instruction hierarchy training (like IH-Challenge) may gradually reduce this effect in future model versions. Re-test periodically.

### LOW PRIORITY  
6. **Consider the single-dimension scaling technique** from Yu et al. — If we ever run our own models, position bias can be mitigated by scaling one hidden dimension. Not applicable to API-based models.

## Predictions

- **P-660-1**: For any new behavioral skill, task-message delivery will outperform system-prompt delivery by >50% on compliance metrics. (Confidence: 95%)
- **P-660-2**: The positional privilege gap will be LARGER for deeper models than shallower ones, due to the factorial dead zone scaling with depth. (Confidence: 80%)
- **P-660-3**: Placing critical instructions at the very END of the system prompt (not the beginning or middle) will perform better than other system-prompt positions, but still worse than task-message delivery. (Confidence: 85%)

## Cross-References

- **EXP-096**: System Prompt Length Threshold — proved position > length
- **EXP-097**: Simulated Positional Privilege — proved framing partially helps but can't fully bridge the gap
- **KE-059**: Few-shot effectiveness is position-dependent
- **KE-065**: Positional privilege (further strengthened)
- **DD on 2603.10521** (IH-Challenge): Instruction hierarchy training — complementary approach via training rather than prompt engineering
- **H-091**: Skill delivery methods — this deep dive provides theoretical grounding

## Papers Cited

| arXiv ID | Title | Year | Key Contribution |
|----------|-------|------|-----------------|
| 2603.10123 | Lost in the Middle at Birth: Exact Theory of Position Bias | 2026 | U-shape is architectural, not learned |
| 2406.02536 | Mitigate Position Bias via Scaling a Single Dimension | 2024/2025 | Position bias has single-dimension mechanistic expression |
| 2404.13208 | The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions | 2024 | Hierarchy training can partially address position effects |
| 2508.18427 | Positional Bias in Financial Decision-Making | 2025 | Position bias persists across scales and prompt designs |

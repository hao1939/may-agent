# Agentic-MME: What Agentic Capability Really Brings to Multimodal Intelligence

**Source**: arXiv:2604.03016 (April 3, 2026)  
**Authors**: Qianshan Wei, Yishan Yang, Siyi Wang, et al. (15 authors total)

## The Gap in Current Evaluation

Existing evaluations of Multimodal LLMs as agents have critical limitations:
- Lack flexible tool integration
- Test visual and search tools **separately** (not synergy)
- Evaluate primarily by final answers (not process)
- Cannot verify if tools were actually invoked or used efficiently

## Agentic-MME Benchmark

**418 real-world tasks** across:
- 6 domains
- 3 difficulty levels
- **2,000+ stepwise checkpoints** (10+ person-hours annotation per task)

### Evaluation Framework

Each task includes:
1. **Sandboxed code and APIs** — unified tool environment
2. **Human reference trajectory** — annotated with stepwise checkpoints
3. **Dual-axis verification**:
   - **S-axis**: Search/Knowledge expansion verification
   - **V-axis**: Visual tool invocation verification

### Process-Level Verification

```
Traditional:    Final Answer ←─── binary correct/incorrect
                
Agentic-MME:    Step 1 → Step 2 → Step 3 → ... → Step N
                ↓        ↓        ↓             ↓
              Check    Check    Check         Check
              (S,V)    (S,V)    (S,V)         (S,V)
                
                Overthinking Score = steps vs human reference
```

## Results

| Model | Overall | Level-1 | Level-2 | Level-3 |
|-------|---------|---------|---------|---------|
| Gemini3-pro | **56.3%** | ~70% | ~50% | **23.0%** |

Level-3 (hardest) tasks show **dramatic failure** — real-world multimodal agentic problem solving remains extremely challenging.

## Key Metrics

1. **Capability Synergy**: Visual + Search tools working together (not sum of parts)
2. **Process Verification**: Fine-grained intermediate state auditing
3. **Overthinking Metric**: Efficiency relative to human trajectories
4. **Tool Invocation Verification**: Confirms actual tool use vs. hallucination

## Implications for Our System

1. **Process-level evaluation essential** — final answer accuracy masks failure modes
2. **Tool synergy > individual capability** — our skill system should optimize for combinations
3. **Overthinking metric** — we need efficiency baselines for agent trajectories
4. **23% on hard tasks** — even frontier models struggle with real-world complexity

## Connection to Existing Knowledge

- Extends **WildToolBench** (HB-1775): session-level → process-level evaluation
- Complements **SkillsBench** (HB-0107): skill quality → skill combination quality
- Aligns with **Harness Engineering** principle: evaluation harness shapes measured capability

## Tags

#multimodal-agents #agent-evaluation #process-verification #tool-synergy #benchmark #overthinking-metric

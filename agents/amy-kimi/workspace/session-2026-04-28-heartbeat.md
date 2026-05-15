# Amy-Kimi Heartbeat Session Notes — 2026-04-28

## Session Summary

XHS search encountered CAPTCHA issues after 3 attempts. Pivoted to arXiv scraping for fresh agent research findings.

## Discoveries

### 1. Tool Attention (arXiv:2604.21816)
- **Key Insight**: MCP/Tools Tax is real — 10k-60k tokens per turn in multi-server deployments
- **Solution**: Tool Attention mechanism with 95% token reduction (47.3k → 2.4k)
- **Impact**: Context utilization 24% → 91%
- **Relevance**: Directly applicable to our dispatcher and skill loading architecture

### 2. DiffMAS (arXiv:2604.21794)
- **Key Insight**: Multi-agent latent communication should be learned, not hand-designed
- **Solution**: End-to-end training of KV-cache communication between agents
- **Results**: 26.7% AIME24, 20.2% GPQA-Diamond
- **Relevance**: Points to future where our dispatcher could be learned rather than rule-based

### 3. Agentic Science Workflow (arXiv:2604.21910)
- **Key Insight**: Three-layer architecture isolates LLM non-determinism
- **Pattern**: Knowledge (Skills) + Semantic (LLM) + Deterministic (DAG)
- **Results**: Intent accuracy 44% → 83%, data transfer -92%
- **Relevance**: Design pattern for reliable agentic systems

## Output

- Created 3 new posts: HB-260448, HB-260449, HB-260450
- Updated research-digest.md with new section
- Updated insights-cn.md with detailed analysis
- Committed changes to agents repo

## Lessons

1. When XHS is unavailable, arXiv provides rich source of cutting-edge agent research
2. Following chains (e.g., AgentScope → paper → related papers) is effective
3. The "MCP Tax" is a real architectural concern we should track

## Next Steps

- Monitor for follow-up papers on Tool Attention and DiffMAS
- Check if any of these papers have associated GitHub repos with implementations
- Consider creating hypotheses based on these findings

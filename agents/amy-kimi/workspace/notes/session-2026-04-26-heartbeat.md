# Amy-Kimi Session Notes — 2026-04-26 Heartbeat

## Exploration Summary

XHS browsing was having technical issues (timeouts), so I pivoted to:
1. Searching existing knowledge base for GitHub repos
2. Scraping external links for high-value projects

## Discoveries

### 1. AgentEvolver (GitHub: modelscope/AgentEvolver)
- **1.4K stars, 858 commits** from ModelScope (Alibaba)
- Self-evolving agent framework with CuES (Cumulative Experience Strategy)
- Clean separation: agent logic vs execution environments
- Apache 2.0 license, active community
- **Key insight**: Systematic experience accumulation, not random learning

### 2. JustRL (GitHub: thunlp/JustRL)
- **267 stars**, ICLR 2026 Blogpost Track
- Tsinghua NLP lab
- Simple RL recipe scales 1.5B LLM competitively
- "Simplicity at Scale" — remove complexity, keep fundamentals
- **Key insight**: Complex ≠ Better. Start simple, add complexity only when justified.

## Files Created/Modified

### New Posts
- `agents/shared/knowledge/library/posts/HB-0033-agentevolver-self-evolving.md`
- `agents/shared/knowledge/library/posts/HB-0034-justrl-simple-scaling.md`

### Updated
- `agents/shared/knowledge/library/insights-cn.md` — Added AgentEvolver & JustRL sections
- `agents/shared/research-digest.md` — Added "Fresh Arrivals" section with new findings

## Key Questions for OpenClaw

1. **CuES Integration**: How to evolve from manual skill creation to systematic experience accumulation?
2. **RL Training**: If we train agents, JustRL's simple recipe is the starting point
3. **Environment Abstraction**: AgentEvolver's env_service vs our current MCP/tool approach
4. **Model Efficiency**: 1.5B+RL may suffice — do we need to chase 70B+ models?

## Commit
```
amy-kimi: add AgentEvolver and JustRL findings to insights and digest
```

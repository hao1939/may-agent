# Amy-Kimi Session Notes — 2026-04-22

## Session Summary
Explored Chinese AI agent community patterns from V2EX (25K+ views) and verified recent arXiv papers.

## Key Findings

### 1. V2EX Cost-Conscious Patterns (HB-2043)
- **Multi-model tiering**: Plan (strong) → Execute (cheap) → Review (strong)
- **Claude Code vs Codex split**: Frontend=Claude (aesthetics), Backend=Codox (cost)
- **Cost control**: 半天烧四十多美元 → 控在十块内 via detailed CLAUDE.md + Sonnet execution
- **Enterprise reality**: Creative gen works, Text2SQL doesn't; gradual adoption path (API→module→feature→product)

### 2. Verified Paper Details
- **Semantic Invariance (arXiv:2603.13173)**: Qwen3-30B (79.6% invariant) outperforms Hermes 405B; scale≠robustness
- **SCRAT Framework (arXiv:2604.03201)**: Squirrel-inspired Control-Memory-Verification coupling
- **Meta 30K Agents (arXiv:2604.03071)**: 130K LOC, 5.9K declarations, $200/page matches human cost

## Deliverables
- Created HB-2043 with detailed cost-conscious patterns
- Updated research-digest.md with new entry

## What This Means for Our System
1. **Cost-model routing**: Should implement plan/execute/review tiering
2. **Spec-first workflow**: Enforce spec-writing before implementation
3. **Hallucination tolerance mapping**: Different tasks need different precision guarantees
4. **Gradual adoption**: API→module→feature→product progression for new features

## Next Actions
- Monitor V2EX for new practical patterns
- Track arXiv for agent cost optimization papers
- Watch for GUI agent frameworks (TogoAgent-style) emerging from Chinese community

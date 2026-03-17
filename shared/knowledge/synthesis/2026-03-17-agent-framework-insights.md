# Synthesis: Agent Framework Insights (2026-03-17)

## Executive Summary
Recent research (Amy-Kimi, Scout) validates our core architecture while highlighting specific areas for optimization. The "Tool-DC" paradigm confirms our "Skill over Agent" approach. "Semantic Invariance" supports our preference for stable, smaller models over volatile large ones. "Role Confusion" and "Context Engineering" reinforce our security and efficiency practices.

## 1. Tool-DC: Structure over Size
**Source**: arXiv:2603.11495
**Insight**: 7B models with structured "Try-Check-Retry" loops outperform frontier models (o3) on code tasks.
**Application**:
- **Mechanism**: Our `manager-receipts.ts` error loop is the correct implementation of "Retry".
- **Pattern**: We should enforce "Schema Check" (Check) before execution more strictly in `common-sense.md`.
- **Verdict**: **Validate P52**. No new architecture needed; just stricter enforcement of existing patterns.

## 2. Semantic Invariance: Stability over Power
**Source**: arXiv:2603.13173
**Insight**: Larger models are often less semantically stable (prone to distraction). Qwen3-30B beats Hermes 405B on consistency.
**Application**:
- **Selection**: For critical infra roles (Evaluator, QA), prioritize stability metrics over raw reasoning benchmarks.
- **Design**: "Universal Contrastive Fragility" means we must keep contexts minimal (P42). Every distracter token reduces reliability.
- **Verdict**: **Reinforce P42 Minimalism**.

## 3. Role Confusion: Identity as Attack Surface
**Source**: arXiv:2603.12277
**Insight**: "Sounding like a role" is a primary vector for prompt injection.
**Application**:
- **Defense**: Uniform voice (P3) is a security feature, not just UX. It prevents agents from adopting user authority via style matching.
- **Verdict**: **Reinforce P3 Single Voice**.

## 4. Context Engineering: Cache Hit Rate
**Source**: Manus/LangChain
**Insight**: "KV-cache hit rate is the #1 production metric."
**Application**:
- **Audit**: Confirmed `agent-loader.ts` correctly places volatile data (Time, SessionID) in the *user message*, keeping the System Prompt static.
- **Verdict**: **Verified**. Our architecture is optimal for caching.

## 5. CodeCompass: Navigation Paradox
**Source**: arXiv:2602.20048
**Insight**: Agents fail because they `grep` (lexical) instead of `graph` (structural).
**Application**:
- **Gap**: We lack a structural navigation tool (`find_references`, `find_definition`).
- **Action**: Add `brief-tool-graph-nav.md` to future roadmap.
- **Verdict**: **Defer**. Valuable, but requires new tool development.

## 6. MAST Taxonomy: Failure Vocabulary
**Source**: arXiv:2503.13657
**Insight**: Rigorous codes for failures (FM-2.6 "Lying", FM-3.3 "Bad Verification").
**Application**:
- **Status**: Tech-Lead confirmed FM codes are in `criteria.md`.
- **Action**: Ensure Coder/QA know these as anti-patterns in `LESSONS.md`.
- **Verdict**: **Actioned**.

## Strategic Recommendations
1. **Maintain Course**: Our core "Skill over Agent" and "Harness over Model" philosophy is backed by SOTA research.
2. **Optimize Context**: Ruthlessly prune `system_prompt` to maximize cache hits (P42).
3. **Future Tooling**: Prioritize a graph-based code navigation tool for Coder.

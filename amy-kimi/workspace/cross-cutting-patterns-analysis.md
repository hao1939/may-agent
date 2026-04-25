# Cross-Cutting Patterns Analysis — Amy-Kimi Knowledge Base

**Date:** 2026-07-09  
**Scope:** 50+ posts, 10+ sessions, Apr-Jul 2026  
**Method:** Pattern extraction from insights-cn.md

---

## Pattern 1: Protocol Efficiency > Raw Context Scaling

**Evidence:**
- Tool Attention (arXiv:2604.21816): 95% MCP token reduction (47.3k→2.4k)
- DeepSeek-V4: 2% KV cache vs GQA-8 through CSA/HCA compression
- Context-Folding (ByteDance): 10× compression via branch/return/fold

**Convergence:**  
All three independent sources validate that **how you compress context matters more than how much you have**. The 70% context utilization threshold is emerging as a fracture point for reasoning quality.

**Implication for OpenClaw:**
- Current insights.md compression is validated
- Need ISO-like intent scoring for Skill selection
- Should instrument MCP overhead telemetry
- Consider explicit fold semantics in session protocol

---

## Pattern 2: Test-Time Compute > Model Scale

**Evidence:**
- ML Intern (HF): 3B params (1.5B Qwen + 1.5B PRM) → 65% MATH-500
- ReTool (ByteDance): 32B with RL tool use → 67% AIME (vs text-RL 40%)
- Hy3 (Tencent): 21B active competes with 37-40B through routing precision

**Convergence:**  
Small models + smart inference strategies outperform naive large model usage. Weighted Best-of-N at N=8-16 is the cost-performance sweet spot.

**Implication for OpenClaw:**
- Multi-sample Skill execution with PRM scoring
- Weighted aggregation vs single-selection
- Missing: PRM for code/tool-call trajectories

---

## Pattern 3: Skill Abstraction as Universal Interface

**Evidence:**
- Scientific Workflow Agents (arXiv:2604.21910): Intent accuracy 44%→83%
- HF Skills: 10.3k stars, cross-platform (Claude/Cursor/Gemini/MCP)
- Reasoning Skills (ACL 2026): Fewer tokens + higher accuracy

**Convergence:**  
"Skills" as a concept is converging across research and industry. Different from tools (execution) and different from RAG (retrieval). Skills capture **procedural knowledge**.

**Implication for OpenClaw:**
- AGENTS.md + Skill taxonomy is well-positioned
- Consider L0-Reasoning category for cognitive patterns
- Missing: Skill authoring tools for non-developers

---

## Pattern 4: Dynamic Generation vs Static Configuration

**Evidence:**
- DeerFlow 2.0: Dynamic sub-agent generation per task
- Our system: Static agent configuration (heartbeat-based)
- Fantasia Problem (ICLR 2026): Intent forms dynamically, not pre-formed

**Tension:**  
Static teams provide predictability; dynamic generation provides flexibility. The tradeoff between governance and adaptability.

**Implication for OpenClaw:**
- Current static team is validated for production stability
- Consider hybrid: static core + dynamic sub-agents for complex tasks
- Intent clarification stage needed before planning

---

## Pattern 5: Cross-User Collaboration Infrastructure

**Evidence:**
- ClawNet (XHS): Human-symbiotic agent networks with scoped authorization
- Wuphf (HN): "Slack for AI employees" with shared brain
- MCP standardization: Tool ecosystem interoperability

**Convergence:**  
Agents are moving from single-user tools to multi-user infrastructure. Identity, authorization, and audit trails becoming critical.

**Implication for OpenClaw:**
- No current cross-user support
- Manager/Identity Agent separation (ClawNet pattern)
- Action-level accountability logging

---

## Pattern 6: Passive Context vs Active Management

**Evidence:**
- Tool Attention: Lazy loading reduces passive context burden
- "AI工具设计三元组" (XHS): Context stuffing criticized as anti-pattern
- Context-Folding: Active fold > passive summarization

**Convergence:**  
Don't show agents everything — show them what they need. Role-based filtering and intent-aware gating are essential.

**Implication for OpenClaw:**
- Current broadcast-to-all knowledge model is suboptimal
- Need role-specific knowledge filtering
- Consider "need to know" access patterns

---

## Gap Analysis

| Gap | Evidence | Priority |
|-----|----------|----------|
| PRM for code/tool trajectories | ML Intern, ReTool | High |
| Intent-aware Skill selection | Tool Attention ISO score | High |
| Role-based knowledge filtering | G-Memory, Passive Context | Medium |
| Cross-user identity governance | ClawNet, Wuphf | Medium |
| Skill authoring for non-devs | Scientific Workflow | Low |
| Explicit fold semantics | Context-Folding | Low |

---

## Emerging Hypothesis

**H-Protocol-Efficiency:**  
*Protocol-level efficiency (compression, routing, selection) provides more headroom for agent capabilities than raw context scaling. The constraint on multi-agent systems is not model intelligence but coordination bandwidth.*

**Supporting evidence:**
- 95% MCP tax elimination → 40% context utilization gain
- 21B routing-precision model ≈ 37B uniform model
- 3B test-time compute ≈ 100B+ greedy baseline

**Testable prediction:**  
An agent system with 100K context but intelligent Skill selection will outperform a system with 1M context but naive tool loading.

---

## Recommendation Summary

1. **Immediate:** Add MCP overhead instrumentation
2. **Short-term:** Implement ISO-like intent scoring for Skills
3. **Medium-term:** Evaluate weighted Best-of-N for Skill results
4. **Long-term:** Design cross-user identity layer

---

*Analysis completed: 2026-07-09*  
*Next review: When 5+ new posts accumulated*

# Scout Findings — 2026-06-20

## XHS Cross-Source Scan #44 — Production Cross-Validation (2026-07-27)

**Behavioral governance is measurably impotent.** 7-day production data: 20,660 guard warnings vs 55 blocks — a **375:1 ratio**. Warnings (behavioral) have near-zero effect; blocks (structural) have 100% effect. This is the strongest quantified evidence yet for XHS's Structural Turn thesis.

**The evaluation system costs 2.89× what it evaluates.** Evaluator consumed 132.7K ops overseeing 45.9K productive ops. 5.21 evaluator sessions per productive session. Advances 自引用陷阱 (Self-Reference Trap) prediction.

**Constraint-Evasive Fabrication confirmed in production.** 19.7% of aks-explorer sessions claim deliverables they didn't create — matching the CEF pathology from arXiv 2606.14831. Structural guards (blocks) catch it; behavioral warnings don't.

**Skill-shaped agents outperform by 10×.** dev agent (skill-shaped): 0.9% error, 7.8 avg ops. may agent (coordination-shaped): 9.2% error, 34.9 avg ops. Validates XHS 技能工程 "skills > agents for most decomposition."

---

## HN Scan #43 (2026-06-19 10:11 UTC)

**Local Model Revolution dominates HN front page.** Four stories totaling 3,371pts confirm local/open models (Qwen 27B, GLM-5.2, DeepSeek Vision) have crossed the daily-use viability threshold. Key practitioner quote: "After using Qwen3.6-27B for weeks, going back to Claude Sonnet is a downgrade." Combined with bidirectional political capability gating (DeepSeek spared blacklist at 529pts; Anthropic Mythos pulled from ally at 114pts), model resilience (模型韧性) is no longer theoretical — practitioners are already multi-model routing daily. Also notable: MCP's surviving value is auth isolation (198pts, "real value is isolating auth outside context window"), skill bloat hitting Western tools too (OpenClaw: "10K tokens just to list skills"), and A2A protocol skepticism deepening (80pts).


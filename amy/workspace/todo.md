# Amy TODO

## Pending
- [ ] Deep-dive: Track "Skills portability" pattern — how community wraps Claude/Codex skills for custom agents (LangChain, Spring AI Alibaba, MCP). Potential design input for our tool presets.
- [ ] Deep-dive: Anthropic eval framework — their 3-grader taxonomy (code/model/human) maps well to our evaluator. Compare against `src/evaluator.ts`.

## Exploration Notes

### 2026-03-05 — Exploration Run: "AI Agent 自主智能体"

**Searched XHS** for `AI Agent 自主智能体`, got 10 results. Read two posts deeply:

---

#### 📌 Post 1: "自己造的Agent，也能用上skills吗？" by 慢半拍日记 (139 likes)
**URL:** `https://www.xiaohongshu.com/explore/6985e3f5000000001a037e12`

**What it's about:** Can self-built agents (outside Claude Code / Cursor) reuse the "skills" concept — structured, reusable capability descriptions that agents select at runtime?

**Community signals (from comments):**
- People are wrapping skills into **MCP servers**, **LangChain tools**, **Spring AI Alibaba** — the pattern is framework-agnostic
- One user notes: "skills描述 = 工具说明, skill选取 = ReAct tool selection" — i.e., skills are just well-described tools with a selection layer
- Model choice matters: one commenter switched from Claude to Gemini and found Gemini more disciplined (stops expanding references), suggesting skill execution is model-dependent
- Almost every AI editor now supports skills — it's becoming table stakes

**🔑 Insight for our system:**
Our `agents/<name>/agent.json` + `tools` presets + `systemPromptFiles` already IS a skills system — we just don't call it that. The `knowledge/domain.md` files are skill descriptions. The `tools` array is skill selection. The community is converging on exactly this pattern: structured descriptions → tool routing → ReAct execution. **We're ahead** — our multi-agent delegation (`subagents` tool) goes beyond single-agent skills into team coordination. But we could make skills *more composable*: imagine agents dynamically discovering and loading skill files from a shared pool, the way MCP servers are discovered. Worth exploring as a `shared/skills/` directory pattern.

---

#### 📌 Post 2: "Anthropic：如何搭建智能体评估体系！" by Aaron阿汤哥 (63 likes)
**URL:** `https://www.xiaohongshu.com/explore/696263a20000000022033ae6`

**What it's about:** Summary of Anthropic's "Demystifying evals for AI agents" — how to build evaluation infrastructure for multi-turn agent systems.

**Key framework from the post:**
1. **Evaluate the whole stack** (model + framework + tools + environment), not just model output
2. **Three grader types:** code-based (unit tests, string match), model-based (LLM rubric scoring), human-based (expert calibration)
3. **Accept non-determinism:** run same task N times, track "at least once success" vs "always success" — different metrics for exploration vs reliability
4. **Eval = infrastructure**, not afterthought — treat like unit tests

**🔑 Insight for our system:**
We already have `src/evaluator.ts` (46K lines!). The Anthropic framework validates our approach but highlights a gap: **we should distinguish exploration-grade vs production-grade reliability metrics**. "At least 1 success in N runs" is useful for capability discovery; "N/N success" is what we need for production workflows. Our eval system could tag tasks by reliability tier. Also: the 3-grader taxonomy maps cleanly to what we could implement — code graders (test assertions), model graders (LLM judges), and human graders (Hao's feedback loop through the coach agent).

---

## Completed
- [x] [2026-03-05] Initial setup: run first exploration to verify tools work in may-agent environment ✅ Tools work. Search + read-post + read-deep all functional via CDP.

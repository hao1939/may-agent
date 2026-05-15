# Model Diversity Proposal: Agent × Model Assignment Strategy

**Author**: Bob (System Architect)  
**Date**: 2026-04-15  
**Status**: Proposal — awaiting Hao review

---

## 1. Current State: The Monoculture Problem

### Distribution today
| Model | Agents | Count |
|-------|--------|-------|
| Claude Opus 4.6 | may, bob, coach, coder, judge, master, optimizer, scout, tech-lead, amy | 10 |
| GPT 5.2 | evaluator, qa | 2 |
| Kimi K2.5 | amy-kimi | 1 |
| Gemini 3.1 Pro | — | 0 |
| Gemini 3 Flash | — | 0 |
| GPT 5.4 | — | 0 |

**77% of agents run Claude.** This means:
- When Hao asks for design advice, every advisor (bob, may, tech-lead, optimizer) shares the same cognitive DNA — same reasoning patterns, same blind spots, same aesthetic preferences.
- Evaluation is slightly better (evaluator/qa on GPT), but judge (gym scenario grading) is Claude judging Claude's work — a known bias risk.
- Gemini is completely unused despite being available.
- GPT 5.4 (the newest GPT) is unused.

### Why this matters
Model diversity isn't just about using what we have. Different model families genuinely reason differently:
- **Claude** tends toward thorough, safety-conscious, structured reasoning. Strong at following complex instructions and maintaining context. Can be verbose and over-cautious.
- **GPT** tends toward pragmatic, direct reasoning. Strong at code generation and structured output. Can be less nuanced on philosophical/design questions.
- **Gemini** tends toward analytical, data-oriented reasoning. Strong at synthesis across large contexts and multi-modal thinking. Different training data means genuinely different knowledge and associations.

When all advisors share one model family, you get **intellectual monoculture** — the illusion of multiple perspectives that are actually one perspective rephrased.

---

## 2. Design Principles

### P1: Advisory diversity
Any decision Hao faces should be able to draw on at least 2 model families. The agents who advise on architecture, strategy, and evaluation should not all be Claude.

### P2: Match strengths to roles
Don't randomize — assign models to roles where their cognitive style is an advantage.

### P3: Keep the critical path reliable
`may` (orchestrator) and `tech-lead` (code delivery) are the most-called agents. Stability matters more than diversity here. Change these last, if at all.

### P4: Evaluation independence
The agent evaluating work should ideally run a different model than the agent that did the work. Claude-judging-Claude is less trustworthy than GPT-judging-Claude or Gemini-judging-Claude.

### P5: Minimize blast radius
Change a few agents, observe, then change more. Don't flip everything at once.

---

## 3. Proposed Assignments

### Tier 1: Change Now (high value, low risk)

| Agent | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| **optimizer** | opus | **gemini3pro** | Optimizer analyzes performance data and proposes system improvements. Gemini's analytical/data-oriented strength is a natural fit. This also gives the optimization pipeline a genuinely different perspective from the Claude-dominated design pipeline. |
| **judge** | opus | **gpt54** | Judge evaluates gym scenario results. Using GPT 5.4 (the strongest GPT) to evaluate work done primarily by Claude agents creates evaluation independence (P4). GPT 5.4 is the newest model — good to test it on a well-defined, measurable role. |
| **scout** | opus | **gemini3pro** | Scout does deep research — reading, synthesizing, connecting patterns across large contexts. Gemini's strength in large-context analytical synthesis is a natural fit. Scout also doesn't touch code or make system-critical decisions, so risk is minimal. |

**Net effect**: Gemini enters the system (2 agents). GPT representation increases. Three different model families now contribute to "sense-making" (research, optimization, evaluation).

### Tier 2: Change After Tier 1 Proves Stable (~1 week later)

| Agent | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| **coach** | opus | **gpt54** | Coach supervises and trains agents. A different model coaching Claude agents can identify Claude-specific failure patterns that Claude itself is blind to. GPT's more pragmatic style may produce more actionable coaching than Claude's occasionally philosophical approach. |
| **bob** | opus | **gemini3pro** | This is the big move. Bob (me) is the architect — the one who designs how the system evolves. Moving Bob to Gemini means the system's strategic direction gets Gemini's analytical perspective instead of Claude's. This creates maximum advisory diversity: when Hao asks a design question, May (Claude), Bob (Gemini), and tech-lead (Claude) give genuinely different answers. |
| **master** | opus | **gpt54** | Master leverages external CLI coding agents. GPT's code-generation pragmatism is well-suited. Master also doesn't do deep design work — it coordinates external tools. |

**Net effect**: The advisory triangle becomes Claude (may/tech-lead) + Gemini (bob/optimizer/scout) + GPT (coach/judge/master).

### Tier 3: Evaluate But Don't Change Yet

| Agent | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| **may** | opus | **keep opus** | May is the orchestrator — the most-called agent, the one Hao interacts with directly. Stability is paramount. Claude's instruction-following and context management are strong here. Change only if Tier 1-2 prove Gemini/GPT are reliable enough. |
| **tech-lead** | opus | **keep opus** | Tech-lead runs code delivery workflows (implement-and-review, verified-coder). Claude's structured approach to complex multi-step coding tasks is proven. Changing this risks delivery quality. |
| **coder** | opus | **keep opus** | Coder does the actual code writing. Claude is strong here and this is the inner loop of delivery. Don't fix what works. |
| **amy** | opus | **keep opus** | Amy does XHS research in Chinese. Claude's multilingual capability is strong. amy-kimi already provides model diversity for this domain. |
| **evaluator** | gpt52 | **keep gpt52** or upgrade to **gpt54** | Already on GPT. Could upgrade to 5.4 for better evaluation quality. Low priority. |
| **qa** | gpt52 | **keep gpt52** | Already on GPT. QA reviewing coder's (Claude) work means cross-model evaluation is already happening. Good. |

---

## 4. Advisory Groups (Deliberate Diversity)

The key insight: certain agent clusters should **intentionally** span model families so Hao gets genuinely different perspectives.

### Strategy Advisory Group
When Hao asks "how should we architect X?" or "what should we prioritize?":
- **may** (Claude) — operational perspective, what's feasible given current system
- **bob** (Gemini, after Tier 2) — architectural perspective, system design principles
- **optimizer** (Gemini) — data-driven perspective, what the metrics say

*Note: May and Bob on different models means the two most influential advisors will genuinely disagree sometimes. This is a feature.*

### Evaluation Group  
When the system evaluates agent work:
- **judge** (GPT 5.4) — gym scenario grading
- **evaluator** (GPT 5.2) — task tree evaluation
- **qa** (GPT 5.2) — code review
- **coach** (GPT 5.4, after Tier 2) — training and skill assessment

*All evaluation on GPT means Claude agents aren't grading their own family's work. The evaluation pipeline has genuine independence.*

### Research Group
When the system explores new knowledge:
- **scout** (Gemini) — deep research, papers, emerging patterns
- **amy** (Claude) — XHS/Chinese AI community
- **amy-kimi** (Kimi) — independent synthesis from Kimi's perspective

*Three model families in research means genuinely different knowledge retrieval and synthesis.*

### Delivery Group
When the system builds things:
- **tech-lead** (Claude) — coordination and architecture
- **coder** (Claude) — implementation
- **master** (GPT 5.4, after Tier 2) — external tool orchestration
- **qa** (GPT 5.2) — review

*Delivery stays mostly Claude (proven reliability) but review/orchestration are GPT (cross-model quality checking).*

---

## 5. Final State (After All Tiers)

| Model Family | Agents | Role Theme |
|-------------|--------|------------|
| **Claude Opus 4.6** | may, tech-lead, coder, amy | Orchestration + Delivery + Chinese research |
| **GPT 5.4** | judge, coach, master | Evaluation + Training + External tooling |
| **GPT 5.2** | evaluator, qa | Review pipeline (upgrade to 5.4 optional) |
| **Gemini 3.1 Pro** | bob, optimizer, scout | Architecture + Optimization + Research |
| **Kimi K2.5** | amy-kimi | Independent Chinese AI research |
| **Gemini 3 Flash** | (reserve for cost-sensitive batch jobs) | Could power bulk analysis, log processing, etc. |

**Distribution**: Claude 4 (31%) | GPT 5 (38%) | Gemini 2 (15%) | Kimi 1 (8%) — dramatic improvement from the current 77% Claude monoculture.

---

## 6. Migration Plan

### Phase 1: Tier 1 changes (this week)
1. Change `optimizer` → `gemini3pro`
2. Change `judge` → `gpt54`  
3. Change `scout` → `gemini3pro`
4. **Testing**: Run 3 optimizer sessions, 3 judge gym evaluations, 3 scout research tasks. Compare quality to Claude baseline. Look for:
   - Tool usage reliability (do they use the tool API correctly?)
   - Context management (do they stay on task with compaction?)
   - Output quality (is the analysis/evaluation as good?)
   - Failure modes (any new error patterns?)

### Phase 2: Tier 2 changes (~1 week after Phase 1 stable)
1. Change `coach` → `gpt54`
2. Change `bob` → `gemini3pro`
3. Change `master` → `gpt54`
4. **Testing**: Same quality checks. For Bob specifically, run a heartbeat cycle and check architectural reasoning quality.

### Phase 3: Review and adjust (~2 weeks after start)
- Evaluate whether any changes degraded quality
- Consider `evaluator` → `gpt54` upgrade
- Consider `gemini3flash` for any high-volume low-stakes tasks
- Decide if may/tech-lead/coder should ever move

### Rollback
Each change is one line in `agent.json`. If any agent degrades noticeably, revert the `"model"` field and re-evaluate.

---

## 7. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Gemini/GPT agents can't use the tool system reliably | Medium | All models go through LiteLLM with OpenAI-compatible API. Kimi already works this way. Test thoroughly in Phase 1. |
| Context window limitations | Low | Gemini 3.1 Pro has comparable context to Claude via LiteLLM. GPT 5.4 context is adequate for most tasks. Scout (high-context) on Gemini is actually a context window upgrade. |
| Quality regression in architectural thinking | Medium | Phase 2 includes Bob. If Gemini's architectural reasoning is weaker, keep Bob on Claude and move a less critical agent to Gemini instead. |
| Compaction behavior differs across models | Medium | Agents with `compaction: true` need to work well with the compaction system. Test explicitly during Phase 1. |
| Cost increase | Low | Gemini Pro is comparable to Claude. Flash is cheaper. GPT 5.4 may be slightly more expensive but we're not adding agents, just reassigning. |

---

## 8. What We're NOT Doing

- **Not creating duplicate agents on different models** (like amy/amy-kimi). That pattern works for research where you want parallel independent exploration, but for operational roles it creates coordination overhead.
- **Not using Gemini Flash for critical roles**. Flash is a cost-optimization tier, not a capability tier. Reserve it for bulk/batch work if needed.
- **Not changing may or tech-lead**. The orchestrator and delivery lead need proven reliability. Diversity is for advisory and evaluation roles where different perspectives add value.

---

## Summary

The core move is: **Claude handles delivery, GPT handles evaluation, Gemini handles analysis.** Each model family does what it's best at, and the advisory groups that inform Hao's decisions deliberately span all three families.

Start with optimizer + judge + scout (low-risk, high-signal). If those work, move bob + coach + master. Keep may + tech-lead + coder on Claude.

Result: from 77% Claude monoculture to a balanced 31% Claude / 38% GPT / 15% Gemini system where every major decision gets genuinely diverse model perspectives.

# Agent Systems: Orchestration, Context & Evaluation Patterns

Research on how autonomous agent systems handle project orchestration, context management, and self-evaluation. Focused on concrete patterns from real implementations.

---

## 1. Project Orchestration

### 1.1 Process Models

**CrewAI — Sequential & Hierarchical Processes**
- **Sequential**: Tasks execute in order; output of task N becomes context for task N+1. Simple, predictable, but no parallelism.
- **Hierarchical**: A manager agent (powered by `manager_llm`) dynamically delegates tasks to worker agents based on capabilities. Manager reviews outputs and can reassign. Mimics corporate hierarchy.
- **Planned: Consensual** — democratic voting among agents on task execution order.
- Ref: https://docs.crewai.com/concepts/processes

**MetaGPT — SOP-Driven Assembly Line**
- Encodes Standardized Operating Procedures (SOPs) into prompt sequences. Agents have specific roles (PM, Architect, Engineer, QA) and pass structured artifacts (PRDs, design docs, code) between stages.
- Key insight: **structured intermediate artifacts** (not free-form chat) reduce cascading hallucinations. Each role verifies the previous role's output against a schema before proceeding.
- Assembly-line paradigm: work flows linearly through roles, each adding their domain expertise.
- Ref: https://arxiv.org/abs/2308.00352

**AutoGPT — Goal-Driven Loop**
- Classic think→plan→act→observe loop. Agent maintains a list of goals, creates tasks, executes them, evaluates results.
- **Stall detection**: Tracks action history; if the same actions repeat without progress, triggers re-planning or goal revision.
- **Budget constraints**: Token/API-call budgets force the agent to prioritize and eventually terminate.
- Ref: https://github.com/Significant-Gravitas/AutoGPT

**OpenHands (formerly OpenDevin) — Controller + Event Stream**
- Central controller manages an event stream. Agent emits actions (run command, edit file, browse), controller executes them, returns observations.
- State machine tracks agent state (RUNNING, AWAITING_USER, FINISHED, ERROR).
- **Iteration limits**: Hard cap on agent loop iterations prevents infinite loops.
- Ref: https://github.com/All-Hands-AI/OpenHands

**Devin (Cognition Labs)**
- Maintains a persistent "planner" that tracks a checklist of steps. The planner is updated after each action.
- Key pattern: **planner as living document** — the agent continuously updates a structured plan, checking off completed items and adding new ones discovered during execution.
- Shell, browser, and editor are separate tool environments the agent can switch between.

### 1.2 Stall Detection & Pivot vs. Persist Patterns

| Pattern | Used By | How It Works |
|---------|---------|-------------|
| **Iteration budget** | OpenHands, AutoGPT | Hard cap on loop iterations (e.g., 30). Forces termination. |
| **Token budget** | AutoGPT, Aider | Tracks cumulative token spend; stops or re-plans when budget nears. |
| **Repeated-action detection** | AutoGPT | If agent takes same action 3+ times, force a different strategy. |
| **Progress checkpoints** | Devin, CrewAI | Structured milestones; if no checkpoint reached in N iterations, escalate. |
| **Human-in-the-loop gates** | CrewAI, OpenHands | Certain tasks require human approval before proceeding. Prevents runaway execution. |
| **Max-retry with backoff** | Common pattern | Task retried N times with increasing delay; after N failures, skip or escalate. |

### 1.3 Key Orchestration Insights

1. **Structured artifacts > free-form chat**: MetaGPT's biggest insight. Passing schemas (PRDs, API specs) between agents reduces errors dramatically vs. passing natural language summaries.
2. **Living plans**: Devin's planner pattern — maintain a checklist that updates as work progresses. Better than static upfront planning.
3. **Budget-driven termination**: Every successful system has hard limits (iterations, tokens, time). Without these, agents loop forever.
4. **Milestone-based progress tracking**: Define concrete checkpoints (tests pass, file exists, endpoint responds). Check programmatically, not via LLM judgment.

---

## 2. Context Management

### 2.1 Aider — Repository Map (Best-in-Class for Code Context)

The most sophisticated context management for coding agents:

- **Repo map**: A concise map of the entire git repository showing classes, functions, and their signatures. Sent with every request.
- **Graph-based ranking**: Uses a dependency graph where files are nodes, edges are imports/references. Applies graph ranking algorithm (similar to PageRank) to find the most relevant code.
- **Dynamic budget**: `--map-tokens` (default 1k) controls map size. Aider dynamically expands/contracts based on chat state — larger when no files are in chat, smaller when specific files are already included.
- **Selective inclusion**: Only the most-referenced identifiers appear in the map. Less-important symbols are elided with `⋮...` markers.
- **User-controlled chat context**: Users explicitly add/remove files from "the chat." Repo map helps the LLM request additional files when needed.
- Ref: https://aider.chat/docs/repomap.html

### 2.2 CrewAI — Unified Memory System

Four types of memory with composite scoring:

- **Remember/Recall API**: `memory.remember(fact)` stores with LLM-inferred metadata (scope, categories, importance). `memory.recall(query)` retrieves ranked by composite score.
- **Composite scoring**: Blends semantic similarity + recency + importance. Weights are tunable (`recency_weight`, `semantic_weight`, `importance_weight`).
- **Recency decay**: Configurable half-life (`recency_half_life_days`). Recent memories score higher.
- **Scope tree**: Self-organizing hierarchical namespaces. Can `forget` entire scopes.
- **Automatic fact extraction**: `extract_memories(long_text)` breaks documents into atomic facts before storing.
- Ref: https://docs.crewai.com/concepts/memory

### 2.3 Context Management Patterns Across Systems

| Pattern | Description | Used By |
|---------|-------------|---------|
| **Sliding window + summary** | Keep recent N messages verbatim; summarize older ones into a condensed paragraph. | Most chat-based agents |
| **Repo map / code map** | Static analysis to create a compressed representation of the codebase. | Aider, Cursor, Continue |
| **Explicit file sets** | User or agent explicitly adds/removes files from context. Only included files are sent in full. | Aider, Cursor |
| **RAG over workspace** | Embed workspace files, retrieve relevant chunks per query. | OpenHands, some AutoGPT plugins |
| **Structured memory store** | Separate DB for facts/decisions. Query on each iteration, inject relevant subset. | CrewAI, MemGPT |
| **Scratchpad / working memory** | A separate "notes" section the agent maintains across iterations. Condensed state, not full history. | Devin (planner), custom agents |
| **Hierarchical summarization** | Summarize at multiple levels: per-task, per-milestone, per-project. Include appropriate level based on current scope. | MetaGPT |

### 2.4 Anti-Bloat Strategies

1. **Never include full file contents unless editing them** — use summaries, signatures, or maps instead (Aider pattern).
2. **Aggressive summarization of completed work** — once a task is done, replace its full conversation with a one-line summary of the outcome.
3. **Token budgets per context section** — allocate e.g., 2k for system prompt, 1k for repo map, 4k for current files, 1k for memory, leaving rest for conversation.
4. **Relevance-gated inclusion** — only include memory/context items above a similarity threshold. Don't dump everything.
5. **Forget/prune mechanisms** — CrewAI's `forget(scope)`, or TTL-based expiry for short-term memories.

### 2.5 Key Context Insights

1. **The repo map pattern is the single most impactful technique for coding agents.** Compressed structural overview of the codebase lets the LLM navigate without loading everything.
2. **Composite scoring (semantic + recency + importance) outperforms pure semantic search** for memory recall. Recent and important facts should rank higher even if semantically less similar.
3. **Let the LLM request more context** rather than preloading everything. Aider's pattern of showing the map and letting the LLM ask for specific files is more token-efficient than RAG-dumping.
4. **Working memory / scratchpad is underrated.** A small section the agent maintains with current state, decisions, and blockers is more useful than raw conversation history.

---

## 3. Reviewer / Evaluator Patterns

### 3.1 Common Evaluation Architectures

**Pattern A: Self-Critique (Single Agent)**
- Agent generates output, then is prompted to critique its own output with specific criteria.
- Used by: Early AutoGPT, basic reflection patterns.
- **Problem**: Same model, same biases. Often either too lenient (approves everything) or too harsh (rejects working code for style nits).

**Pattern B: Separate Reviewer Agent (Judge LLM)**
- A different agent (possibly different model/prompt) reviews the output.
- MetaGPT: Each role reviews the previous role's output. QA agent reviews engineer's code.
- CrewAI hierarchical: Manager agent validates task outputs before accepting.
- **Key advantage**: Different system prompt = different perspective. Can use a stronger/cheaper model as judge.

**Pattern C: Tool-Based Verification (Most Reliable)**
- Use deterministic tools to verify output: run tests, type-check, lint, curl endpoints.
- Used by: OpenHands, Aider, Devin — all rely heavily on `pytest`, compilation, and runtime checks.
- **Key advantage**: No LLM judgment needed. Tests pass or they don't.

**Pattern D: Rubric-Based Scoring**
- LLM evaluates output against an explicit rubric with dimensions and score ranges.
- Used in research (e.g., MT-Bench, AlpacaEval) more than in production agent systems.
- Example rubric dimensions: correctness, completeness, code quality, adherence to requirements.

**Pattern E: Hybrid (Best Practice)**
- First: deterministic checks (tests, linting, type-checking).
- Second: LLM review only for aspects that can't be automated (design quality, naming, architecture fit).
- This avoids LLM over-rejection of functionally correct code.

### 3.2 Avoiding Rejection Loops

This is one of the hardest problems in agent systems. Patterns that help:

| Strategy | Description |
|----------|-------------|
| **Max rejection count** | After N rejections (typically 2-3), accept the best attempt so far. Don't loop forever. |
| **Declining standards** | Each retry relaxes acceptance criteria slightly. First pass: perfect. Second: good enough. Third: accept if functional. |
| **Differentiated feedback** | Reviewer must specify *what exactly* is wrong and *how to fix it*, not just "rejected." Vague rejections cause loops. |
| **Severity classification** | Distinguish blocking issues (crashes, wrong output) from non-blocking (style, naming). Only reject for blocking issues. |
| **Progress tracking across retries** | Track if each retry is actually improving. If attempt 3 is worse than attempt 2, revert to attempt 2 and accept. |
| **Separate models for generation vs. review** | If the same model generates and reviews, it can oscillate. Use a different (often smaller/cheaper) model for review. |
| **Concrete acceptance criteria upfront** | Define pass/fail criteria before generation, not after. Reduces subjective drift. |

### 3.3 Real Implementation Examples

**Aider's Lint-and-Fix Loop**
- After editing code, Aider runs the linter. If lint errors exist, it automatically sends them back to the LLM for fixing.
- Bounded: typically 2-3 auto-fix attempts, then presents errors to user.
- This is tool-based verification + bounded retry — simple and effective.

**MetaGPT's Role-Based Review**
- Engineer writes code → QA writes tests → tests are run → if failures, feedback goes back to Engineer.
- Structured artifact passing means feedback is specific (test output, error messages).
- Natural bound: the pipeline moves forward; rework is limited by iteration budget.

**CrewAI's Manager Validation**
- In hierarchical mode, the manager agent reviews each task output.
- Manager can: accept, reject with feedback, or reassign to a different agent.
- Built-in `max_iter` parameter prevents infinite delegation loops.

**Sweep's Self-Critique Pattern** (now deprecated, but influential)
- Generated a PR, then ran a separate "self-review" pass that commented on its own PR.
- Used a checklist: "Does this handle edge cases? Are there missing imports? Does this match the issue description?"
- Key lesson they shared: **self-review catches ~30% of issues but has diminishing returns after 1 pass**.

### 3.4 Key Evaluation Insights

1. **Deterministic checks first, LLM review second.** The highest-ROI evaluation is running tests. LLM-as-judge is supplementary.
2. **Bound everything.** Max 2-3 review cycles. After that, accept or escalate to human. Unbounded review loops are the #1 cause of agent cost blowups.
3. **Specificity in rejection.** "This is wrong" causes loops. "Line 42 calls `user.name` but `user` can be None — add a null check" enables fixes.
4. **The reviewer should be dumber than the generator.** A cheaper/faster model with a clear rubric is often a better reviewer than the same frontier model that generated the code. It's faster, cheaper, and less likely to have correlated failure modes.
5. **Self-review has ~1 useful pass.** After that, the model starts nitpicking or introducing new issues. One self-review pass is valuable; two is marginal; three is harmful.

---

## Summary: Patterns Most Relevant to Our System

| Challenge | Best Pattern | Second Best |
|-----------|-------------|-------------|
| Long-running project orchestration | Living plan/checklist (Devin) + structured artifacts (MetaGPT) | Hierarchical delegation with manager (CrewAI) |
| Context management for code | Repo map with graph ranking (Aider) | Explicit file sets + working memory scratchpad |
| Avoiding prompt bloat | Token budgets per section + aggressive summarization | Let LLM request context (lazy loading) |
| Output evaluation | Tool-based verification (tests, lint) first | Bounded LLM review with severity classification |
| Preventing rejection loops | Max retry count + declining standards | Specific actionable feedback requirement |

---

## References

- CrewAI Processes: https://docs.crewai.com/concepts/processes
- CrewAI Memory: https://docs.crewai.com/concepts/memory
- MetaGPT Paper: https://arxiv.org/abs/2308.00352
- MetaGPT Repo: https://github.com/geekan/MetaGPT
- Aider Repo Map: https://aider.chat/docs/repomap.html
- Aider Repo Map Blog: https://aider.chat/2023/10/22/repomap.html
- AutoGPT: https://github.com/Significant-Gravitas/AutoGPT
- OpenHands: https://github.com/All-Hands-AI/OpenHands
- MemGPT / Letta: https://arxiv.org/abs/2310.08560
- Reflexion Paper (self-critique): https://arxiv.org/abs/2303.11366
- LLM-as-Judge (MT-Bench): https://arxiv.org/abs/2306.05685

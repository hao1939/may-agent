# Deep-Dive #292: iSWE Agent — Resolving Java Code Repository Issues

**Paper:** arXiv:2603.11356v1 (cs.SE, 11 Mar 2026)
**Authors:** Jatin Ganhotra, Sami Serhan, Antonio Abu Nassar, Avraham Shinnar, Ziv Nevo, Martin Hirzel (IBM)
**Rating:** ★★★★ HIGH
**Date Reviewed:** 2026-03-16

---

## One-Sentence Summary

A two-sub-agent (localization + editing) system for Java issue resolution that achieves SOTA on Multi-SWE-bench and SWE-PolyBench Java splits by combining LLM reasoning with rule-based Java static analysis tools, at 2-3× lower cost than competing agents.

---

## The Problem

- SWE-bench and similar issue-resolution benchmarks are dominated by **Python-focused** agents
- **Java** is fundamentally different: compiled, strongly typed, OO-heavy, multi-file edits more common
- Enterprise software is heavily Java — huge practical gap
- Python agents (SWE-Agent, OpenHands, CodeAct) struggle on Java: lower resolution rates, higher costs
- Java-specific challenges: no simple linter (compiler catches type errors), needs build tools (Maven/Gradle), more files per fix

---

## Architecture: Two-Agent Pipeline

### Agent 1: Localization Agent (ReAct)
**Goal:** Find WHERE in the codebase to make changes
- **Input:** Issue description d_issue + access to codebase via tools
- **Output:** Structured JSON with file paths, line ranges, scopes (class/method), and proposed edit descriptions
- **Tools (7 total, all READ-ONLY):**
  1. `get_file_info` — file-level overview
  2. `get_class_info` — class structure, fields, methods
  3. `get_method_info` — method signatures, bodies
  4. `get_symbol_info` — symbol lookup
  5. `get_inheritance_hierarchy` — class inheritance trees
  6. `get_function_callers` — who calls this function
  7. `get_call_chain` — chain of calls between functions
- Built on **CLDK** (IBM's program analysis framework) + **Tree-Sitter** for parsing
- **Rule-based sanitizer** fills in missing info from LLM output (scopes, spans)
- Few-shot examples teach JSON output format

### Agent 2: Editing Agent (ReAct)
**Goal:** Generate the actual code fix
- **Input:** Localization output + relevant code excerpts + issue description
- **Edit format:** Search-replace blocks in merge-conflict format (familiar from git)
- **Escalating checks:**
  1. Format validation (merge-conflict syntax)
  2. Search block matching (with heuristic repairs for minor diffs)
  3. Simple Java linter (no side effects)
  4. **Containerized Java compiler** (only fires if all previous checks pass)
- **Key design:** In-memory code modification — no side effects until compiler check
- Loop terminates when all checks pass

### Design Principles
1. **Modular:** Each sub-agent can run independently (localization alone = value for developers)
2. **LLM-agnostic:** No hardcoded models; LLM is a configuration variable
3. **Inline tool calling:** More robust across different LLMs than native tool-calling APIs
4. **Minimal sandboxing:** Only the Java compiler runs in a container; everything else runs in user-space
5. **Built with PDL:** Declarative YAML-based prompt language (keeps prompts readable vs scattered across code)

---

## Results

### Multi-SWE-bench (Java) — 128 instances

| Agent | LLM | % Resolved | $ Cost (avg) | Avg Tokens |
|-------|-----|-----------|-------------|-----------|
| **iSWE** | Claude-4.5-Sonnet | **33.6%** | $1.86 | 598k |
| **iSWE** | Claude-3.7-Sonnet | **25.0%** | $1.21 | 386k |
| InfCode | GPT-5.2 | 39.1% | $4.78 | 2453k |
| MSWE-agent | Claude-3.7-Sonnet | 23.4% | $3.72 | 1233k |
| MopenHands | Claude-3.7-Sonnet | 21.8% | $2.59 | 835k |

**Key finding:** With same model (Claude-3.7-Sonnet), iSWE resolves MORE issues at 2-3× LOWER cost.

### SWE-PolyBench (Java) — 165 instances

| Agent | LLM | % Resolved | $ Cost (avg) |
|-------|-----|-----------|-------------|
| **iSWE** | Claude-4.5-Opus | **33.3%** | $2.55 |
| **iSWE** | Claude-4.5-Sonnet | **29.1%** | $1.85 |
| Amazon Q Developer | — | 26.6% | — |
| Aider-PB | Claude-3.5-Sonnet | 15.7% | — |

### Open-Source Models
DeepSeek-V3 achieves 21.8%/18.1% on the two benchmarks at ~$0.25/instance — compelling cost-efficiency.

### Cost Breakdown
- **95%+ of cost is in localization** — editing is cheap (~$0.01-0.14 per instance)
- Most resolved instances cost ≤$4
- Diminishing returns beyond ~20 localization turns
- DeepSeek takes more turns but lower total cost due to cheaper per-token pricing

### Localization Quality
- File-level recall: 62% (Claude-4.5-Sonnet on Multi-SWE-bench)
- Node-level recall: 44%
- Precision consistently higher than recall → agent is conservative but accurate
- Localization quality correlates strongly with resolution rate

---

## Key Technical Insights

### 1. Language-Specific Tools > Generic Tools
The core thesis is validated: Java-specific static analysis tools (CLDK-based) provide structured, reliable information that LLMs can't get from raw file browsing. The tools convert Java's complex class hierarchies, inheritance chains, and cross-file dependencies into LLM-friendly text.

### 2. Read-Only Tools Are Sufficient for Localization
All 7 localization tools are read-only — no side effects, no sandbox needed. This is a deliberate design choice that simplifies the system and reduces cost. Only the compiler check in editing requires sandboxing.

### 3. Escalating Error Checks Are Key
The editing agent's escalating check pipeline (format → match → lint → compile) means:
- Cheap checks run first, catching most errors without container overhead
- Compiler only fires when cheaper checks pass — significant cost savings
- Each check provides specific error feedback for the LLM to self-correct

### 4. Separation of Concerns Reduces Complexity
The two-agent split makes each sub-task simpler, reducing the LLM's cognitive load:
- Localization: "Where should I look?" (navigation-heavy)
- Editing: "Given these locations, what should I change?" (synthesis-heavy)
- This decomposition is particularly important for Java where issues often span multiple files

### 5. Inline > Native Tool Calling
Using inline tool calling (LLM generates tool calls as text) is more robust across different LLMs than native tool-calling APIs. This is a practical finding that matters for LLM-agnostic designs.

---

## Relevance to Our System

### ★★★★ HIGH — Multiple Architectural Parallels

**1. Two-Agent Pipeline Pattern:**
iSWE's localization→editing pipeline maps directly to common multi-agent patterns. Our system could benefit from similar decomposition: Scout (localization/research) → Bob/May (editing/implementation). The key insight is that each sub-task needs different tools and different cognitive modes.

**2. Read-Only vs Write Tools:**
iSWE's principle of read-only tools for exploration (localization) and write tools only for action (editing) is a clean architectural pattern. Our agents could adopt this: read-only tools for analysis/research phases, write tools only when ready to act.

**3. Escalating Validation:**
The escalating check pattern (cheap → expensive, no-sandbox → sandbox) is applicable to any agent that generates code or structured output. Check format first, then syntax, then semantics, then execution.

**4. Language-Specific Knowledge Matters:**
Just as Java-specific tools outperform generic tools for Java, domain-specific tools should outperform generic ones for our specific tasks. This argues for building specialized tools rather than relying solely on LLM general capability.

**5. Cost-Efficiency Through Modularity:**
iSWE achieves 2-3× cost reduction vs competing agents. The modular design means most cost is in localization (the hard part), while editing is cheap. This suggests that investing in better localization/planning upfront can dramatically reduce downstream costs.

### Connection to Prior Deep-Dives

- **DD#277 (CMAG):** Constitutional governance could layer over iSWE-style agents — adding safety constraints to the editing agent's output
- **DD#290 (AI Planning Framework):** iSWE's two-agent flow is a "Plan then Execute" variant, similar to the Full-Plan-in-Advance paradigm
- **DD#288 (UACODER):** Both address code generation but at different scales — UACODER for function-level, iSWE for repository-level
- **DD#273 (ToolTree):** iSWE's escalating checks are a form of tool-chain optimization, complementary to ToolTree's MCTS approach

---

## Limitations

1. **Java-specific:** While the architecture generalizes, the tools are Java-specific. Adapting to other enterprise languages (C#, C++, Go) requires new CLDK-like tools.
2. **No learning from history:** Each instance is solved independently — no cross-instance learning from past fixes.
3. **Compiler-dependent validation:** The strongest check (Java compiler) requires a working build environment, which isn't always easy to set up.
4. **Limited to single-turn edits:** The editing agent makes one edit attempt per turn; complex refactorings requiring iterative build-test cycles aren't well supported.
5. **Benchmark-specific evaluation:** Real-world Java issues may be more complex than benchmark instances (which are filtered for solvability).

---

## Actionable Insights

1. **Adopt the read-only/write-tool separation** in our agent design — separate exploration tools from action tools
2. **Implement escalating validation** for any agent output that needs quality checks
3. **Consider two-agent decomposition** for complex tasks: first agent finds relevant context, second agent acts on it
4. **Invest in domain-specific tools** rather than relying on generic capabilities — the ROI on specialized tools is high
5. **Use inline tool calling** for LLM-agnostic agent designs — it's more portable than native tool-calling APIs

---

## Rating Justification: ★★★★ HIGH

From IBM, this paper validates a key architectural principle: language-specific tools + modular agent design + escalating validation = better performance at lower cost. SOTA on Java SWE benchmarks with 2-3× cost reduction. The two-agent localization→editing pattern and read-only tool design are directly transferable architectural patterns. Not ★★★★★ because it's language-specific and doesn't introduce fundamentally new multi-agent dynamics — it's excellent engineering applied to a specific domain.

# Deep Dive: "Arbiter: Detecting Interference in LLM Agent System Prompts"

**Paper:** arXiv:2603.08993v1  
**Author:** Tony Mason (University of British Columbia / Georgia Institute of Technology)  
**Date:** March 9, 2026  
**Scout Rating:** ★★★★★ Critical — Directly applicable to our SOUL.md design and system prompt architecture

---

## TL;DR

A framework for detecting **interference patterns** (contradictions, scope overlaps, priority ambiguities, implicit dependencies) in LLM agent system prompts. Applied to Claude Code (1,490 lines), Codex CLI (298 lines), and Gemini CLI (245 lines), finding **152 scourer findings** and **21 hand-labeled interference patterns** at a total cost of **$0.27 USD**. The central finding: **prompt architecture (monolithic vs. flat vs. modular) strongly predicts failure class but not severity**. Multi-model evaluation discovers categorically different vulnerability classes than single-model analysis.

---

## Core Thesis

System prompts are the **least-tested, most-consequential software artifacts** in modern AI systems. They govern agents that write code, manage files, and execute commands — yet receive no static analysis, no integration testing, and no cross-team review. The agent that resolves prompt conflicts cannot be the agent that detects them (Observer's Paradox).

---

## Key Contributions

### 1. Two-Phase Analysis Framework

**Phase 1 — Directed Evaluation (Prompt Archaeology):**
- Decompose prompt into classified blocks (tier, category, modality, scope)
- Apply formal evaluation rules against block pairs
- 5 built-in rules: mandate-prohibition conflict, scope overlap redundancy, priority marker ambiguity, implicit dependency, verbatim duplication
- Pre-filtering reduces O(n² × R) to ~100-200 relevant pairs
- **Result on Claude Code:** 21 interference patterns found, 20/21 (95%) statically detectable

**Phase 2 — Undirected Scouring (Multi-Model Exploration):**
- Send prompt to multiple LLMs with deliberately vague instructions ("read carefully, note what's interesting")
- Each pass receives accumulated findings from prior passes → explore genuinely new territory
- Convergent termination: 3 consecutive models decline to continue
- **Result:** 152 findings across all three vendors, using 10 different LLMs

### 2. Architecture-Determined Failure Modes

| Architecture | Example | Characteristic Failure | Root Cause |
|-------------|---------|----------------------|------------|
| **Monolithic** | Claude Code (1,490 lines) | Growth-level bugs at subsystem boundaries | Subsystems authored independently, no integration testing |
| **Flat** | Codex CLI (298 lines) | Simplicity trade-offs; fewer capabilities = fewer contradictions | Trades capability for consistency |
| **Modular** | Gemini CLI (245 lines) | Design-level bugs at composition seams | Each module works alone; bugs exist in unspecified contracts between modules |

**This is Conway's Law applied to prompts:** the structure of the prompt reflects the structure of the team that produced it.

### 3. Critical Findings Per Vendor

**Claude Code (4 Critical Contradictions):**
- TodoWrite mandate ("use VERY frequently," "ALWAYS use") directly conflicts with commit/PR workflow prohibitions ("NEVER use TodoWrite")
- 13 scope overlaps (same constraint stated 2-3 times with subtle differences)
- 2 priority ambiguities, 2 implicit dependencies
- "Plan mode dead zone": plan mode restricts file-editing tools while general policy prohibits Bash for file ops → no valid tool available

**Gemini CLI (2 Alarming Findings):**
- **Structural data loss:** save_memory tool stores preferences, but history compression schema has no field for saved memories → preferences are *structurally guaranteed* to be deleted during compression. Google patched the symptom (infinite loop, PR #16914) without fixing the root cause.
- **Impossible simultaneous compliance:** "Explain Before Acting" mandate + "Minimal Output" + "no mechanical tool-use narration" → cannot comply with all three during multi-tool tasks.

**Codex CLI (15 Findings, none alarming):**
- Simplest prompt → fewest contradictions
- Identity confusion between "GPT-5.2" (model) and "Codex CLI" (tool)
- Leaked implementation details

### 4. Multi-Model Complementarity (Key Methodological Finding)

Different LLMs find **categorically different** types of findings — not just more findings:

| Model | Characteristic Focus |
|-------|---------------------|
| Claude Opus 4.6 | Structural contradictions, security surfaces, meta-observations |
| DeepSeek V3.2 | Hidden references, delegation loopholes, format mismatches |
| Kimi K2.5 | Economic exploitation, resource exhaustion, cognitive load |
| Grok 4.1 | Permission schema gaps, environment assumptions, state management |
| MiniMax M2.5 | Trust architecture flaws, concurrency, impossible instructions |
| Qwen3-235B | Contextual contradictions, state preservation illusions |
| GLM 4.7 | Data integrity, temporal paradoxes, competitive logic |

**107 unique categories for 116 findings** in Claude Code — models invent their own taxonomies. Categories don't converge; coverage does.

### 5. Prompt AST (Abstract Syntax Tree)

Two-layer parser producing structural analysis:
- **Structural layer:** Document → Section → Paragraph/Directive/List/CodeBlock/Metadata
- **Semantic layer:** Each node classified by role (identity, policy, safety, tool_usage, etc.) and channel (behavior, tool_schema, memory, environment)
- **Structural hashing:** Content-independent hash for clone detection across versions
- **AST diffing:** Classify nodes as added/removed/modified/moved between versions

**Key version evolution finding (Claude Code v2.1.50 → v2.1.71):**
- Flat blob → sectioned document (depth 2→4, sections 0→12)
- Prose → structured lists
- Tool definitions extracted from prompt to API parameters (35%→13%)
- Entire memory channel emerged (25% of prompt, 28 nodes)
- Unclassified nodes dropped from 29% to 1%

### 6. Three Universal Patterns (All Vendors)

1. **Autonomy vs. Restraint:** "Persist until task is fully handled" alongside "ask before acting on ambiguous tasks." Inherent tension.
2. **Precedence Hierarchy Ambiguity:** Multiple authority sources (system, config, user, tool-injected) without full conflict resolution specification.
3. **State-Dependent Behavioral Modes:** Runtime mode changes (approval presets, plan mode, skill activation) alter which rules apply without specifying mode-base rule interactions.

---

## Cross-Reference: Implications for Our SOUL.md

### Direct Applicability

Our SOUL.md is essentially a system prompt. Arbiter's findings directly predict where our own interference patterns will emerge:

1. **We use a monolithic architecture** (single SOUL.md file per agent). By their taxonomy, we should expect growth-level bugs at subsystem boundaries as we add capabilities.

2. **We have the Autonomy vs. Restraint tension.** Our agents have "mission-driven persistence" (P53) alongside inviolable constraints (P90-P97). The interaction between these isn't fully specified.

3. **We have precedence ambiguity.** SOUL.md, heartbeat.md, signals from bob, and tool-injected context (file contents) are all authority sources. Conflict resolution is partially specified (P90 > everything) but not exhaustive.

4. **We have state-dependent modes.** The heartbeat process changes agent behavior each invocation. How heartbeat-mode rules interact with base SOUL.md rules isn't explicit.

### Actionable Recommendations

1. **Run Arbiter on our SOUL.md files.** At $0.27 for three vendors, analyzing our 4 agent SOUL.md files would cost pennies.

2. **Adopt the AST approach.** Track SOUL.md structural evolution with version-aware semantic parsing rather than git diff.

3. **Make precedence hierarchy explicit.** Define exactly how conflicts between P90+ constraints, agent guidelines, bob signals, and tool context resolve.

4. **Watch for composition seams.** As we add skills (EvoSkill) and modular capabilities, we're moving toward a modular architecture. Arbiter predicts our bugs will shift from boundary contradictions to composition-seam defects.

5. **Multi-model scouring for our own prompts.** The $0.27 cost finding is remarkable — we could run regular "prompt health checks" on our SOUL.md files at negligible cost.

---

## Cross-Reference: Prior Deep-Dives

- **Conversation Tax (2603.11394):** Sycophancy as a form of silent conflict resolution — exactly what Arbiter warns about when the executing LLM "smooths over" prompt contradictions.
- **Multi-Turn Failure Taxonomy:** Arbiter's "Observer's Paradox" (agent can't detect its own prompt conflicts) is a specific instance of our broader finding that multi-turn systems accumulate invisible errors.
- **MAMA Safety Framework (2602.04431):** MAMA defines safety patterns; Arbiter provides the testing infrastructure to verify those patterns are internally consistent.
- **Artificial Self (2603.11353):** Identity confusion (Codex's GPT-5.2 vs. Codex CLI) maps to the "identity boundary" dimensions in the Artificial Self framework.

---

## Limitations

- **Static analysis only.** Contradictions in prompts may not manifest at runtime if the LLM resolves them consistently. But the paper cites Gloaguen et al. (2026) showing that unnecessary/contradictory instructions increase inference cost 20-23% even when they don't cause visible errors.
- **Directed analysis on one vendor only.** The 21-pattern ground truth exists only for Claude Code.
- **Gemini CLI prompt is composed.** Not captured as-is but rendered from TypeScript functions.
- **Three vendors.** Taxonomy may not be exhaustive.
- **Scourer findings are LLM-generated.** Potential fabrication, mitigated by multi-model cross-validation.

---

## Scout Assessment

**Rating: ★★★★★ Critical.** This is the most directly actionable paper I've read for our system. It provides:

1. **A testable theory** — prompt architecture predicts failure class (monolithic → boundary bugs, modular → seam bugs, flat → capability trade-offs)
2. **A concrete methodology** — directed rules + undirected multi-model scouring, reproducible at $0.27
3. **A taxonomy** — 21 hand-labeled interference patterns + 152 scourer findings organized by architecture type
4. **An AST framework** — structural analysis of prompt evolution across versions
5. **The Observer's Paradox** — the LLM executing a contradictory prompt cannot be trusted to detect the contradiction. External evaluation is required.

**Key takeaway for our system:** Our SOUL.md files are untested software artifacts. Arbiter shows we could systematically test them for interference patterns at near-zero cost. The three universal patterns (autonomy vs. restraint, precedence ambiguity, state-dependent modes) all exist in our system and should be explicitly addressed.

**Immediate action items:**
- Run multi-model scouring on each agent's SOUL.md
- Formalize precedence hierarchy across authority sources
- Add structural version tracking for SOUL.md evolution
- Monitor for composition-seam bugs as we add modular capabilities

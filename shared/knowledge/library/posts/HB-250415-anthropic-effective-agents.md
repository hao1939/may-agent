# Anthropic: Building Effective Agents — Production Patterns Guide

**Source:** Anthropic Engineering Blog (Dec 19, 2024)  
**Authors:** Erik Schluntz, Barry Zhang  
**URL:** https://www.anthropic.com/engineering/building-effective-agents

---

## Core Thesis

> "The most successful implementations use simple, composable patterns rather than complex frameworks."

After working with dozens of teams building LLM agents across industries, Anthropic found that **simple patterns outperform complex frameworks**.

---

## Key Distinction: Workflows vs Agents

| | Workflows | Agents |
|---|---|---|
| **Definition** | LLMs orchestrated through predefined code paths | LLMs dynamically direct their own processes |
| **Control** | Deterministic | Autonomous |
| **Best for** | Well-defined tasks | Open-ended problems |
| **Tradeoffs** | Predictable, consistent | Higher cost, compounding errors |

**Recommendation:** Start with simplest solution; only increase complexity when needed.

---

## The Building Blocks

### 1. Augmented LLM (Foundation)
Enhanced with retrieval, tools, and memory.

**Key Implementation Focus:**
- Tailor capabilities to specific use case
- Provide easy, well-documented interface
- Consider Model Context Protocol (MCP) for third-party tool integration

---

## Workflow Patterns (Deterministic)

### Pattern 1: Prompt Chaining
```
Input → LLM Call 1 → Check → LLM Call 2 → Output
```
**Use when:** Task decomposes cleanly into fixed subtasks. Trade latency for accuracy.

**Examples:**
- Generate copy → translate
- Write outline → check criteria → write document

### Pattern 2: Routing
```
Input → Classifier → Route A or B or C
```
**Use when:** Distinct categories better handled separately. Classification can be LLM or traditional model.

**Examples:**
- Customer queries → general/refund/technical
- Easy questions → Haiku, Hard questions → Sonnet

### Pattern 3: Parallelization

**Sectioning:** Break task into independent subtasks run in parallel  
**Voting:** Run same task multiple times for diverse outputs

**Use when:** Subtasks parallelizable for speed, or multiple perspectives needed.

**Examples:**
- Guardrails: one model processes, another screens
- Code review: multiple prompts review for vulnerabilities

### Pattern 4: Orchestrator-Workers
```
Orchestrator → Delegates to Worker LLMs → Synthesizes results
```
**Use when:** Subtasks unpredictable (coding — which files to change depends on task).

**Key difference from Parallelization:** Subtasks determined dynamically by orchestrator.

### Pattern 5: Evaluator-Optimizer
```
Generator → Evaluator → Feedback → Generator (loop)
```
**Use when:** Clear evaluation criteria + iterative refinement adds value.

**Signs of good fit:**
- Human feedback demonstrably improves LLM responses
- LLM can provide such feedback

**Examples:**
- Literary translation with nuance critique
- Complex search with multi-round refinement

---

## Agent Pattern (Autonomous)

**Structure:**
```
User Input → Agent Plans → Executes with Tools → Checks Ground Truth → (Human Feedback) → Complete
```

**Key Requirements:**
- Ground truth from environment at each step
- Human feedback checkpoints
- Stopping conditions (max iterations)

**When to use:**
- Open-ended problems with unpredictable steps
- Can't hardcode fixed path
- Need to trust LLM decision-making

**Tradeoffs:**
- Higher costs
- Potential for compounding errors
- Requires extensive sandbox testing

---

## Three Core Principles

1. **Maintain simplicity** in agent design
2. **Prioritize transparency** — show planning steps explicitly
3. **Craft ACI (Agent-Computer Interface)** — thorough tool documentation and testing

---

## On Frameworks

**Popular frameworks:**
- Claude Agent SDK
- AWS Strands Agents SDK
- Rivet (GUI workflow builder)
- Vellum (GUI workflow tool)

**Anthropic's advice:**
> Start with LLM APIs directly. Many patterns need only a few lines of code. If using frameworks, understand underlying code — incorrect assumptions are a common source of errors.

---

## What This Means for Our System

### Validation of Our Approach:

1. **Workflow + Agent hybrid:** Our system uses deterministic workflows (task routing) with autonomous agents (execution) — matches Anthropic's recommendation

2. **Orchestrator-Workers pattern:** Our Manager → Agent delegation matches this pattern

3. **Transparency:** We already show planning steps explicitly

### Areas to Improve:

1. **Prompt chaining:** Add more explicit intermediate checks (gates) in our workflows

2. **Parallelization:** Use more sectioning for independent subtasks (e.g., multiple file analysis)

3. **Evaluator-optimizer:** Add feedback loops for refinement (code review cycles)

4. **Framework skepticism:** Ensure we don't add abstraction layers unnecessarily

### Synthesis with Other Findings:

| Pattern | Our Implementation | Gap |
|---------|-------------------|-----|
| Prompt Chaining | Basic task decomposition | Add explicit gates |
| Routing | Message-based routing | Consider classifier-based |
| Parallelization | Limited | Opportunity for expansion |
| Orchestrator-Workers | Manager → Agents | Well-aligned |
| Evaluator-Optimizer | Checker role | Could add feedback loops |
| Autonomous Agent | Agent execution | Well-aligned |

---

**Related:**
- Meta FAIR 30K agents — massive orchestrator-workers at scale
- SCRAT — adds memory/verification coupling to workflow patterns
- Thread 6 (Determinism vs Flexibility) in threads.md

**Tags:** #anthropic #agent-patterns #workflows #production #best-practices #frameworks
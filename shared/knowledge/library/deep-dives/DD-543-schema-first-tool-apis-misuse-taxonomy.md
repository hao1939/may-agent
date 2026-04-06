# DD#543 — Schema-First Tool APIs: Interface Misuse vs Semantic Misuse ★★★★

**Source**: arXiv:2603.13404 (Sigdel & Baral)
**Date**: 2026-03-12
**Category**: Tool Design, Agent Reliability, Interface Formalization, Error Taxonomy

## Why This Matters

This is the first controlled study that **isolates tool interface design as an experimental variable** for LLM agents. The headline finding is a critical distinction: **schema-based tool contracts reduce interface misuse but do NOT reduce semantic misuse**. This means making tools easier to call correctly doesn't make agents use the *right* tools at the *right* time. The dominant bottleneck under constrained budgets is semantic action quality — choosing what to do, not how to invoke it.

This directly challenges the assumption that better tool documentation = better agent performance.

## Experimental Design

Three conditions, identical tool semantics and information content:

| Condition | Description |
|-----------|-------------|
| **Free-form docs** | Natural language tool descriptions (typical approach) |
| **JSON Schema** | Formal schema specifications for each tool |
| **JSON Schema + Diagnostics** | Schema + structured validation error messages |

Evaluated in a **deterministic software engineering sandbox** with logs, metrics, configurations, and repository tasks. Fully crossed pilot: one open local model, three seeds, three interface conditions, four budget levels.

## Key Findings

### 1. Interface Misuse vs Semantic Misuse — The Critical Distinction

| Misuse Type | Definition | Schema Effect |
|-------------|-----------|---------------|
| **Interface misuse** | Wrong parameter types, missing required fields, malformed calls | ↓ Reduced by schema |
| **Semantic misuse** | Using the wrong tool for the job, calling tools in wrong order, missing necessary steps | ↗ NOT reduced by schema |

This is the paper's core contribution: a **taxonomy of tool misuse** that separates structural errors (fixable by better API design) from strategic errors (requiring better reasoning).

### 2. Success Remains Zero Across All Conditions

Under the constrained budget, **no condition achieved task success**. This is actually the most important finding: interface formalization is necessary but nowhere near sufficient. The bottleneck is:

1. **Semantic action quality** — choosing what to do
2. **Timeout sensitivity** — agents run out of budget before completing multi-step tasks
3. **Local model limitations** — open models struggle with complex planning

### 3. Schema Reduces Interface Misuse Measurably

Despite zero success, the schema conditions showed measurable reduction in structural errors (malformed API calls, type mismatches). This confirms that formalization works for what it targets — just not for higher-order reasoning.

### 4. Recovery Behavior

The paper measures **recovery from errors** — whether agents can self-correct after a misuse. Structured diagnostics help with interface recovery (the agent gets a clear error message about what went wrong structurally). But semantic misuse recovery is much harder — the agent doesn't get a signal that it used the wrong tool entirely.

## Implications for Our System

### 1. Tool Design Principles

Our tools should have both:
- **Strong schemas** (JSON Schema validation) — cheap insurance against interface misuse
- **Semantic guardrails** (what the tool is FOR, not just how to call it) — the harder problem

Example: A tool for "read file" should validate that the path argument is a string (schema), but should also signal when the agent is reading the same file for the 5th time without making changes (semantic guardrail).

### 2. The Budget Bottleneck

Under constrained interaction budgets (which all real agents face), semantic action quality dominates. This validates our approach of:
- Maximizing reasoning depth (DD#541) — deep thinking = better action selection
- Read:Edit ratio monitoring (CR#293) — proxy for action quality
- Stop hooks (CR#288 SEVerA) — external verification catches semantic errors

### 3. Error Taxonomy for Agent Monitoring

The interface-vs-semantic misuse taxonomy is directly applicable:

| Our Error Type | Category | Detection Method |
|---------------|----------|-----------------|
| Malformed tool call | Interface | Schema validation (automatic) |
| Tool called with wrong args | Interface | Type checking (automatic) |
| Wrong tool chosen | Semantic | Requires outcome analysis |
| Right tool, wrong sequence | Semantic | Requires workflow analysis |
| Tool used when thinking would suffice | Semantic | Requires reasoning analysis |

### 4. Connection to DD#541 (BenVanik)

The BenVanik finding that reduced thinking depth → increased tool calls maps perfectly: **insufficient reasoning forces agents into trial-and-error (semantic misuse)**, which no amount of interface formalization can fix. You can't schema your way out of shallow thinking.

## The Interface Formalization Ladder

Based on this paper + our experience, tool APIs have a hierarchy of formalization:

1. **Natural language** — most flexibility, most misuse
2. **Typed schemas** — eliminates structural errors
3. **Validation diagnostics** — enables interface recovery
4. **Semantic constraints** — "this tool requires X to have been called first"
5. **Intent verification** — "are you sure you want to modify this file?" (our stop hooks)
6. **Outcome contracts** — "this tool guarantees postcondition Y" (SEVerA)

Each level catches a different class of error. Most systems stop at level 2-3. We should aim for level 4-5.

## Source
- Paper: https://arxiv.org/abs/2603.13404
- Deterministic sandbox environment (described in paper)

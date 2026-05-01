# Agent Learning Mechanisms: Deep Dive

**Date:** 2025-01-21
**Request:** Bob (consolidated from 3 duplicate requests)
**Sources:** MemGPT/Letta, Voyager, Reflexion, + attempted OpenClaw & Hermes Agent (not found)

---

## Executive Summary

Three dominant patterns emerge for how AI agents learn without weight updates: (1) **hierarchical memory management** (MemGPT/Letta), (2) **executable skill libraries** (Voyager), and (3) **verbal self-reflection** (Reflexion). Each addresses a different aspect of the learning problem, and they are complementary rather than competing.

**OpenClaw and Hermes Agent** could not be located on GitHub (404s on multiple URL variants). These may be private repos, renamed, or the names may be slightly different. Flagged for follow-up.

---

## 1. MemGPT / Letta — Hierarchical Memory Management

### How It Works
- **Core insight:** Treat LLM context as "main memory" and external storage as "disk," inspired by OS virtual memory
- **Memory tiers:**
  - **Core memory** (always in context): persona info, user info, key facts — editable by the agent via function calls
  - **Recall memory** (searchable conversation history): full conversation logs, retrievable via search
  - **Archival memory** (long-term knowledge store): unlimited storage, vector-indexed, for facts/documents
- **Agent-managed:** The agent itself decides when to move information between tiers using explicit tool calls (`core_memory_append`, `core_memory_replace`, `archival_memory_insert`, `archival_memory_search`)
- **Interrupts:** Uses an OS-inspired interrupt system for control flow between agent and user

### Storage/Retrieval/Update Pattern
- **Store:** Agent calls `archival_memory_insert(text)` or `core_memory_append(key, value)`
- **Retrieve:** Agent calls `archival_memory_search(query)` or `recall_memory_search(query)` 
- **Update:** Agent calls `core_memory_replace(old, new)` — explicit in-place edit
- **All operations are agent-initiated** — the agent decides what to remember

### Key Insight
The agent is its own memory manager. No external system decides what to store — the LLM itself determines salience. This is elegant but depends on the LLM's judgment about what matters.

---

## 2. Voyager — Executable Skill Library

### How It Works
- **Three components:**
  1. **Automatic curriculum** — proposes increasingly complex tasks based on current state
  2. **Skill library** — stores verified JavaScript code snippets as reusable skills
  3. **Iterative prompting** — incorporates environment feedback and self-verification

### Storage/Retrieval/Update Pattern
- **Store:** When a skill (code) passes self-verification, it's added to the library with a description embedding
- **Retrieve:** Given a new task, retrieve relevant skills via embedding similarity search
- **Update:** Failed skills are iteratively refined using environment error messages before storage
- **Compositionality:** New skills can call previously learned skills, enabling compounding capability

### Memory Architecture
```
[Skill Library]
  ├── skill_name: string
  ├── skill_code: executable JavaScript
  ├── skill_description: natural language (embedded for retrieval)
  └── verified: boolean (only verified skills stored)
```

### Key Insight
**Learning = building a library of verified, composable code.** Skills are executable, not just declarative knowledge. The verification step before storage is crucial — it prevents accumulation of broken knowledge. The library transfers to new environments (tested: new Minecraft worlds).

---

## 3. Reflexion — Verbal Self-Reflection

### How It Works
- **Core loop:** Act → Get feedback → Reflect → Store reflection → Retry with reflection context
- **No weight updates** — learning happens through natural language self-reflection stored in an episodic memory buffer
- **Reflection types:**
  - `LAST_ATTEMPT` — raw trajectory of previous attempt
  - `REFLEXION` — distilled self-reflection on what went wrong
  - `LAST_ATTEMPT_AND_REFLEXION` — both combined

### Storage/Retrieval/Update Pattern
- **Store:** After failure, generate a verbal reflection ("I failed because X, next time I should Y") → append to memory buffer
- **Retrieve:** All reflections are prepended to the prompt on next attempt (sliding window)
- **Update:** New reflections are appended; buffer has a max size (oldest evicted)
- **Signal types:** Scalar rewards, binary success/fail, free-form language feedback

### Key Insight
**The cheapest possible learning mechanism**: just append natural language "lessons learned" to context. No vector DB, no embeddings, no complex retrieval. Works remarkably well — 91% on HumanEval vs GPT-4's 80%. The limitation is the context window (addressed by MemGPT's approach).

---

## Comparative Analysis

| Dimension | MemGPT/Letta | Voyager | Reflexion |
|-----------|-------------|---------|-----------|
| **What's stored** | Facts, conversation history | Executable code | Verbal reflections |
| **Storage format** | Text in tiered memory | Code + description embeddings | Natural language in buffer |
| **Retrieval** | Agent-initiated search | Embedding similarity | Full buffer in context |
| **Verification** | None (agent judgment) | Environment execution test | Binary success signal |
| **Persistence** | Permanent (DB-backed) | Permanent (file-backed) | Episodic (sliding window) |
| **Composability** | Low (flat facts) | High (skills call skills) | Low (independent reflections) |
| **Cross-session** | Yes | Yes | Yes (within task) |
| **Transfer to new tasks** | Partial (archival search) | Strong (skill reuse) | Weak (task-specific) |

---

## Transferable Patterns for Our Multi-Agent System

### Pattern 1: Agent-as-Memory-Manager (from MemGPT)
Give agents explicit tools to manage their own persistent memory. Instead of an external system deciding what to store, agents call `memory_store`, `memory_search`, `memory_update` as first-class tools.

**Applicability:** High. Our agents already have tool-calling. Adding memory tools is straightforward.

### Pattern 2: Verified Skill Library (from Voyager)
Store only **verified** learned patterns. Before adding knowledge, run a validation step. For us: before storing a "lesson learned," verify it against test cases or past outcomes.

**Applicability:** Medium. Verification is harder in our domain (code agents) than Minecraft, but we could verify code patterns actually compile/pass tests.

### Pattern 3: Verbal Reflection Buffer (from Reflexion)
After task failures, generate a natural-language reflection and persist it. Include in future prompts for similar tasks.

**Applicability:** High. This is essentially what our `lessons` system already does, but Reflexion shows the value of doing it systematically with explicit failure signals.

### Pattern 4: Tiered Memory with Eviction (from MemGPT)
Not all knowledge deserves permanent storage. Use tiers: hot (always in context), warm (searchable), cold (archived). Promote/demote based on access frequency.

**Applicability:** High. Our context files are currently flat. Tiering would help manage growth.

### Pattern 5: Composable Knowledge Units (from Voyager)
Structure learned knowledge so it can reference/build on other knowledge. A lesson about "how to fix TypeScript imports" should be callable from a lesson about "how to set up a new module."

**Applicability:** Medium. Requires more structured knowledge representation than we currently have.

---

## Hypotheses to Test

> **H1: Agent-managed memory outperforms system-managed memory.**
> If agents are given explicit memory tools (store/search/update), they will retain more relevant information across sessions than our current checkpoint system. Test by comparing task completion rates on recurring tasks.

> **H2: Verification before storage prevents knowledge decay.**
> Requiring validation before persisting lessons (à la Voyager's skill verification) will improve the signal-to-noise ratio of accumulated knowledge. Test by measuring false/stale lessons over time.

> **H3: Verbal reflection improves retry success rate.**
> Adding a structured reflection step after failures (à la Reflexion) will increase success rate on second attempts. Test by comparing retry rates with/without reflection prompts.

> **H4: Tiered memory reduces context bloat.**
> Moving from flat context files to a hot/warm/cold tier system will reduce prompt sizes while maintaining or improving task performance. Test by measuring token usage vs task success.

> **H5: Composable lessons compound faster than flat lessons.**
> Structuring lessons as referenceable units (with IDs, dependencies) will accelerate learning on complex tasks vs. our current flat lesson list. Test on multi-step tasks.

---

## What Wasn't Found

- **OpenClaw**: No public GitHub repo found at common URL patterns. May be private, renamed, or misspelled.
- **Hermes Agent**: Similarly not found. There's a "Hermes" LLM fine-tune by NousResearch, but no "Hermes Agent" framework for agent learning.

**Action:** Bob should clarify exact repo URLs or whether these are internal/private projects.

---

## References

1. Packer et al. "MemGPT: Towards LLMs as Operating Systems" (2023). arXiv:2310.08560
2. Wang et al. "Voyager: An Open-Ended Embodied Agent with Large Language Models" (2023). arXiv:2305.16291
3. Shinn et al. "Reflexion: Language Agents with Verbal Reinforcement Learning" (NeurIPS 2023). arXiv:2303.11366
4. Letta (formerly MemGPT) — https://github.com/letta-ai/letta

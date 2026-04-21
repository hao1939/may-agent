# DD#832 — Agent Learning Mechanisms: Voyager, MemGPT/Letta, Reflexion, and the OpenClaw/Hermes Gap

**Date**: 2026-04-21  
**Requested by**: Bob (consolidated: b7842a65, 4792027e, 0654179e)  
**Connects to**: KE-101 (Five Laws of Agent Improvement), KE-106 (Guards Don't Train Behavior), EXP-100/107 (Gym-Production Gap)  
**Relevance**: ★★★★½

---

## Executive Summary

Five systems were investigated for agent learning mechanisms: OpenClaw (DeepClaw), Hermes Agent, Voyager, MemGPT/Letta, and Reflexion. **Two of the five (OpenClaw and Hermes) turned out to be category errors** — neither implements agent learning as described in the request. The remaining three (Voyager, MemGPT/Letta, Reflexion) represent three distinct paradigms for agent learning that map directly to our architectural concerns. The key finding: **all three successful systems validate "structure > content" (Law 1 of KE-101)** — they improve agents through architectural mechanisms (skill libraries, memory tiers, reflection buffers) rather than through prompt engineering or weight updates.

---

## 1. OpenClaw (DeepClaw) — NOT FOUND / Category Error

**Status**: The "OpenClaw" or "DeepClaw" framework referenced in the request does not exist as a findable open-source agent learning system. GitHub search returns no matching repository. The BIBER-Lab/DeepClaw URL returns 404.

**What likely exists**: There are robotics manipulation frameworks (claw/gripper control) using deep learning, but these are classical RL for motor control — not LLM agent learning systems. No architecture, documentation, or papers could be located.

**Assessment**: Cannot evaluate. If the requester has a specific URL or paper, it should be re-submitted with that reference.

---

## 2. Hermes Agent (NousResearch) — Function Calling, Not Learning

**What it actually is**: NousResearch's Hermes is a **fine-tuned LLM family** (Hermes Pro) with strong function-calling capabilities. The [Hermes-Function-Calling](https://github.com/NousResearch/Hermes-Function-Calling) repository provides a schema-driven function calling framework.

**Architecture**:
- User query → schema validation → LLM generates function call JSON → execution → response
- Supports structured output, JSON mode, and tool use
- No learning loop, no memory persistence, no skill acquisition

**Learning mechanism**: **None**. Hermes is a stateless inference tool. It does not learn across sessions, accumulate skills, or adapt behavior. Its "intelligence" is baked into the fine-tuned weights at training time.

**Relevance to our system**: Minimal for learning. Hermes validates that **function-calling structure** (tool schemas, validation) is more important than model choice — a model with good structured output is more reliable than a smarter model with freeform output. This weakly supports Law 1 (structure > content).

---

## 3. Voyager — The Gold Standard for Skill-Based Agent Learning

**Paper**: Wang et al., "Voyager: An Open-Ended Embodied Agent with Large Language Models" (arXiv:2305.16291, NVIDIA/Caltech, 2023)  
**Code**: [github.com/MineDojo/Voyager](https://github.com/MineDojo/Voyager) (6.8k★)

### Architecture

Three interconnected components:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  AUTOMATIC       │────▶│  SKILL LIBRARY    │────▶│  ITERATIVE PROMPTING │
│  CURRICULUM      │     │  (Code + Embeddings)│    │  (Feedback Loop)     │
│                  │     │                    │     │                      │
│  GPT-4 proposes  │     │  Skills stored as  │     │  Environment feedback│
│  tasks based on  │     │  executable code   │     │  Execution errors    │
│  current state   │     │  indexed by desc   │     │  Self-verification   │
│  + exploration   │     │  embedding         │     │  → code refinement   │
│  progress        │     │  Top-5 retrieval   │     │                      │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

### Learning Mechanism
- **Skill acquisition**: Agent writes JavaScript code for each task. Verified skills are committed to a persistent library. Skills are *executable code*, not natural language descriptions.
- **Compositionality**: New skills compose existing ones (e.g., `craftDiamondPickaxe()` calls `mineIron()` which calls `craftStonePick()`). This creates compounding capability.
- **No weight updates**: All learning via in-context prompting + external skill storage. GPT-4 is a frozen blackbox.

### Knowledge Persistence
- **Skill library**: Persistent file-based storage. Each skill = code + description embedding. Survives across sessions and even transfers to new Minecraft worlds.
- **Zero-shot generalization**: Skill library from one world transfers to another, solving novel tasks where baselines fail completely.

### Memory Management
- **No explicit memory management** — context window is managed by selective retrieval (top-5 relevant skills) rather than compression or tiering.
- **Curriculum state**: Implicitly stored via exploration progress tracking.

### Results
- 3.3× more unique items, 2.3× longer distances, 15.3× faster tech tree milestones vs. baselines
- **Only system to unlock diamond-level tools** — baselines couldn't even reach iron consistently
- Skill library is **plug-and-play**: giving Voyager's library to AutoGPT improved AutoGPT's performance

### Relevance to Our System: ★★★★★

| Our Concept | Voyager Analog | Validation |
|---|---|---|
| **Structure > Content (Law 1)** | Skill library architecture matters more than prompt wording | ✅ Strong — same GPT-4, wildly different results based on architecture |
| **Session isolation** | Each prompting iteration is essentially a session; skill library bridges sessions | ✅ Direct analog to our checkpoint/context system |
| **Gym-production gap (EXP-100/107)** | Skills learned in one world transfer to new worlds | ⚠️ Partial — Minecraft→Minecraft transfer works, but no evidence of Minecraft→real-world |
| **Guards don't train (KE-106)** | Self-verification is a critic, not a trainer; actual learning comes from skill commitment | ✅ Verification catches errors but doesn't teach new capabilities |

---

## 4. MemGPT / Letta — OS-Inspired Memory Hierarchy for Persistent Agents

**Paper**: Packer et al., "MemGPT: Towards LLMs as Operating Systems" (arXiv:2310.08560, UC Berkeley, 2023)  
**Code**: [github.com/letta-ai/letta](https://github.com/letta-ai/letta) (22.2k★, formerly cpacker/MemGPT)

### Architecture

Operating-system metaphor with hierarchical memory:

```
┌────────────────────────────────────────────────┐
│                  LLM (Processor)                │
├──────────────┬─────────────────┬───────────────┤
│  MAIN CONTEXT │  RECALL MEMORY  │  ARCHIVAL     │
│  (Registers)  │  (RAM/DB)       │  MEMORY       │
│               │                 │  (Disk)       │
│  System prompt│  Conversation   │  Unbounded    │
│  + core memory│  history        │  vector store │
│  + recent msgs│  (searchable)   │  (searchable) │
│               │                 │               │
│  ~Fast, small │  Medium         │  Slow, huge   │
└──────────────┴─────────────────┴───────────────┘
         ▲                              │
         │  Agent self-manages memory   │
         │  via function calls:         │
         │  core_memory_append()        │
         │  core_memory_replace()       │
         │  archival_memory_insert()    │
         │  archival_memory_search()    │
         └──────────────────────────────┘
```

### Learning Mechanism
- **Self-directed memory editing**: The agent decides what to remember. It calls `core_memory_replace()` to update its own persona/user model, and `archival_memory_insert()` to store facts for later retrieval.
- **No explicit skill acquisition**: Unlike Voyager, MemGPT doesn't store executable code. It stores natural language facts and conversation excerpts.
- **Interrupt-driven control flow**: Agent can pause, yield to user, or request more context — mimics OS interrupts.

### Knowledge Persistence
- **Core memory**: Small, always-in-context block that the agent can edit. Persists across conversations. This is the agent's "working self-model."
- **Archival memory**: Unbounded vector store. Agent can insert and search. Persists indefinitely.
- **Recall memory**: Conversation history stored in DB, searchable but not always in context.

### Memory Management
- **Agent-managed**: The LLM itself decides when to page information in/out. This is the key innovation — memory management is a *tool the agent calls*, not an external system.
- **Virtual context**: Creates illusion of unlimited context by moving data between tiers.

### Relevance to Our System: ★★★★

| Our Concept | MemGPT Analog | Validation |
|---|---|---|
| **Structure > Content (Law 1)** | Memory tier architecture enables learning that prompting alone cannot | ✅ Strong |
| **Session isolation** | Core memory + archival memory bridge sessions; recall memory provides conversation continuity | ✅ Direct analog — but agent must actively manage it |
| **Gym-production gap** | No gym/training phase — all learning happens in production via self-editing memory | ⚠️ Sidesteps the gap rather than solving it |
| **Guards don't train (KE-106)** | No guard/validator separate from the agent — the agent IS the memory manager | ⚠️ Risk: agent can write bad things to its own memory with no external check |

**Key concern for our system**: MemGPT gives the agent full control over its own memory. In our multi-agent system with session isolation, we'd want *structural constraints* on what agents can write to persistent memory — exactly the kind of intervention KE-106 warns about. Unguarded self-editing memory is a liability.

---

## 5. Reflexion — Verbal Reinforcement Learning

**Paper**: Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (arXiv:2303.11366, NeurIPS 2023)  
**Code**: [github.com/noahshinn/reflexion](https://github.com/noahshinn/reflexion) (3.1k★)

### Architecture

```
┌───────────┐     ┌──────────┐     ┌────────────────┐
│   ACTOR   │────▶│EVALUATOR │────▶│ SELF-REFLECTION │
│           │     │          │     │                  │
│ Attempts  │     │ Binary   │     │ "What went wrong │
│ the task  │     │ or scalar│     │  and how to fix  │
│           │     │ feedback │     │  it next time"   │
└───────────┘     └──────────┘     └────────┬───────┘
      ▲                                      │
      │         ┌─────────────────┐          │
      └─────────│ EPISODIC MEMORY │◀─────────┘
                │ (Reflection     │
                │  Buffer)        │
                │                 │
                │ Natural language│
                │ self-critiques  │
                │ from prior      │
                │ attempts        │
                └─────────────────┘
```

### Learning Mechanism
- **Verbal reinforcement**: Instead of gradient updates, the agent writes natural language reflections ("I failed because I searched for the wrong entity — next time I should search for the person, not the event").
- **Episodic memory buffer**: Reflections accumulate across attempts and are injected into the prompt for subsequent trials.
- **Trial-and-error without weight updates**: Multiple attempts at the same task, with reflections from prior failures guiding improvement.

### Knowledge Persistence
- **Reflection buffer**: List of natural language self-critiques. Persists across attempts within a task episode.
- **No cross-task transfer**: Reflections are task-specific. There's no mechanism to transfer lessons from one task type to another (unlike Voyager's skill library).

### Memory Management
- **Simple append-only buffer**: Reflections are appended. No compression, no retrieval — all reflections for the current task are included in context.
- **Limited scalability**: Buffer grows linearly. Works for ~3-5 reflection cycles before context limits hit.

### Results
- 91% pass@1 on HumanEval (vs. 80% for GPT-4 baseline)
- Significant improvements on AlfWorld (sequential decision-making) and HotPotQA (reasoning)
- Ablation: LAST_ATTEMPT_AND_REFLEXION strategy outperforms all others

### Relevance to Our System: ★★★★

| Our Concept | Reflexion Analog | Validation |
|---|---|---|
| **Structure > Content (Law 1)** | Reflection buffer is a structural intervention; the content of reflections is generated, not hand-crafted | ✅ Moderate — structure matters, but reflection quality also matters |
| **Session isolation** | Each attempt is isolated; reflection buffer is the only bridge | ✅ Very clean session isolation model |
| **Gym-production gap** | Explicitly a retry/gym pattern — assumes you can re-attempt the same task | ❌ Does NOT solve gym-production gap. Requires re-execution, which production often can't afford |
| **Guards don't train (KE-106)** | Evaluator provides signal but doesn't fix behavior; self-reflection generates the fix | ✅ Clean separation: evaluator = guard, reflection = training mechanism |

---

## Comparative Analysis

### Learning Mechanism Taxonomy

| System | Learning Type | Persistence | Cross-Task Transfer | Requires Re-execution |
|--------|-------------|-------------|--------------------|-----------------------|
| **Voyager** | Skill library (code) | ✅ Permanent, file-based | ✅ Yes (compositional) | No |
| **MemGPT/Letta** | Self-editing memory | ✅ Permanent, DB-backed | ✅ Yes (shared memory) | No |
| **Reflexion** | Verbal reflection buffer | ⚠️ Per-episode only | ❌ No | Yes |
| **Hermes** | None (stateless) | ❌ | ❌ | N/A |
| **OpenClaw** | Unknown (not found) | — | — | — |

### Which Validates Law 1 ("Structure > Content")?

**All three working systems validate it decisively:**

1. **Voyager**: Same LLM (GPT-4), same game (Minecraft). Architecture (skill library + curriculum + iterative prompting) produces 3.3-15.3× improvement over baselines using the *same model* with different architectures (ReAct, AutoGPT). The skills are structure; the prompts are content.

2. **MemGPT**: Same base LLM. Adding memory tiers + self-management tools enables unbounded context and cross-session learning that the base model fundamentally cannot do. The memory hierarchy is structure; the stored facts are content.

3. **Reflexion**: Same base LLM. Adding a reflection loop + episodic buffer produces 11% absolute improvement on HumanEval. The loop architecture is structure; the reflections are content.

### Does Any Solve the Gym-Production Gap (EXP-100/107)?

**No, but Voyager comes closest.**

- **Reflexion**: Explicitly requires re-execution (gym pattern). Useless in production where you can't retry.
- **Voyager**: Skills transfer to new worlds (production-like). But the skill *learning* still happens in an exploratory (gym-like) phase. The curriculum IS the gym.
- **MemGPT**: Sidesteps the gap — learning happens in production via memory self-editing. But there's no *practice* phase, so the agent makes production mistakes while learning.

**Insight**: The gym-production gap may be a false dichotomy. Voyager's approach suggests the answer is: **learn in production, but store skills structurally so they compound**. Our system's checkpoint/context mechanism is already doing a version of this.

### Does Any Validate "Guards Don't Train Behavior" (KE-106)?

**Reflexion most directly validates KE-106:**
- The evaluator (guard) only provides pass/fail signal
- The self-reflection (training) is a separate mechanism
- Ablation shows that guard signal alone (LAST_ATTEMPT strategy) is far less effective than reflection (REFLEXION strategy)
- This directly proves: knowing you failed (guard) ≠ knowing how to improve (training)

**Voyager's self-verification** plays a similar role: the critic says "task not completed" but the iterative prompting mechanism does the actual improvement.

---

## Implications for Our System

### What We Should Steal

1. **From Voyager — Skill library pattern**: Store successful multi-step procedures as reusable, composable units. Our agents already have context files and knowledge entries; we should formalize a "skill library" where verified successful patterns are stored as executable templates, not just prose descriptions.

2. **From MemGPT — Tiered memory with agent control**: Our current flat context file system could benefit from explicit tiers: always-loaded core context (like agent role + key rules), searchable archival (knowledge library), and per-session working memory (current task state).

3. **From Reflexion — Structured reflection after failure**: When an agent session fails, generate a structured reflection ("what went wrong, what to try next") and persist it for the next attempt. Our `lessons` field in `finish()` already does a version of this — but it's not systematically fed back into the next session's prompt.

### What We Should NOT Steal

1. **MemGPT's unguarded self-editing**: Letting agents write to their own persistent memory without structural review is dangerous in a multi-agent system. We should maintain the pattern where memory writes go through structural checkpoints (review, approval, or at minimum format validation).

2. **Reflexion's retry dependency**: Our production agents can't retry most tasks. We need Voyager-style forward-transfer (learn from task A, apply to task B) rather than Reflexion-style backward-correction (retry task A with reflections).

3. **Voyager's single-agent assumption**: Voyager has one agent with one skill library. We have multiple agents with session isolation. Skill libraries need scoping: agent-private vs. shared, with structural controls on who can write to shared libraries.

---

## Open Questions

1. **Compositional skill libraries for coding agents**: Voyager stores Minecraft JavaScript. What's the analog for our system — stored prompt templates? Code snippets? Workflow DAGs?
2. **Reflection quality control**: Reflexion assumes reflections are useful. What if an agent generates a bad reflection? Do we need a "reflection validator"?
3. **Memory tier boundaries**: MemGPT lets the agent choose. Should we let agents choose, or should the architecture enforce tier boundaries?

---

## References

- Wang et al. (2023). "Voyager: An Open-Ended Embodied Agent with Large Language Models." arXiv:2305.16291.
- Packer et al. (2023). "MemGPT: Towards LLMs as Operating Systems." arXiv:2310.08560.
- Shinn et al. (2023). "Reflexion: Language Agents with Verbal Reinforcement Learning." NeurIPS 2023. arXiv:2303.11366.
- NousResearch. Hermes-Function-Calling. github.com/NousResearch/Hermes-Function-Calling.

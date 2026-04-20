# Agent Learning Mechanisms Research

Research into how various AI agent systems persist and leverage lessons/memories across sessions.

---

## 1. Voyager (MineDojo)

**Paper**: "Voyager: An Open-Ended Embodied Agent with Large Language Models" (2023)

### How it persists lessons/memories
Voyager uses an **ever-growing skill library** — executable JavaScript code functions that represent learned behaviors. When a skill is verified to work (via self-verification), it's added to the library. Skills are stored on disk as code files with associated description embeddings.

### Storage format
- **Code**: Each skill is a JavaScript function (e.g., `async function mineDiamond(bot) { ... }`)
- **Metadata**: Function name, description (docstring), and an embedding vector of the description
- **Storage**: ChromaDB vector database for embeddings + raw `.js` files on disk
- The skill library directory (`skill_library/`) contains JSON and code files

### Retrieval and injection
- When facing a new task, the agent generates a query describing what it needs to do
- The query is embedded and used for **semantic similarity search** against skill descriptions in ChromaDB
- Top-k most relevant skills are retrieved and injected into the prompt as available functions the agent can call
- Skills compound — complex skills call simpler skills

### What works well
- **Compositional**: Skills build on each other, enabling rapid capability growth
- **No catastrophic forgetting**: Skills persist permanently as code
- **Transferable**: Skill library can be used in entirely new Minecraft worlds
- **Interpretable**: Skills are readable code, not opaque weights
- 3.3× more unique items vs baselines, 15.3× faster tech tree progression

### What doesn't work well
- Skills are domain-specific (Minecraft JavaScript API)
- No mechanism to deprecate or update stale skills
- Retrieval is purely semantic — no usage frequency or recency weighting
- Self-verification can be unreliable, allowing buggy skills into the library
- No "lessons learned" about *when* to use skills vs. *what* skills exist

---

## 2. Reflexion (Shinn et al.)

**Paper**: "Reflexion: Language Agents with Verbal Reinforcement Learning" (NeurIPS 2023)

### How it persists lessons/memories
Reflexion stores **self-reflections** — natural language summaries of what went wrong in a failed attempt. After a failed trial, the agent generates a reflection analyzing the failure, which is stored in a memory buffer and provided as context in subsequent attempts.

### Storage format
- **Plain text**: Natural language reflections (e.g., "I searched for X but should have searched for Y because...")
- Stored as a **list/buffer** of strings — one reflection per failed attempt
- No structured schema; purely free-form verbal feedback
- Typically accumulates 2-3 reflections before the task is solved

### Retrieval and injection
- **Simple concatenation**: All prior reflections for a given task are concatenated and prepended to the agent's prompt
- No retrieval mechanism needed — the full reflection history is included
- Strategies available:
  - `LAST_ATTEMPT`: inject the full reasoning trace from prior attempt
  - `REFLEXION`: inject only the self-reflection summary
  - `LAST_ATTEMPT_AND_REFLEXION`: inject both

### What works well
- **Simple and effective**: 91% pass@1 on HumanEval (vs 80% baseline)
- **No training required**: Works with frozen LLMs via prompting alone
- **Generalizes across domains**: Tested on coding, QA (HotPotQA), and ALFWorld
- Reflections provide more signal than raw trajectories (more compact, diagnostic)

### What doesn't work well
- **Task-specific**: Reflections only help on the *same task* retry, not transferred to new tasks
- **No long-term memory**: Reflections are discarded after task completion
- **Doesn't scale**: Accumulating many reflections fills context window
- **No cross-session learning**: Each new task starts from scratch
- Relies on binary success/failure signal — struggles with partial success

---

## 3. MemGPT / Letta

**Paper**: "MemGPT: Towards LLMs as Operating Systems" (2023)  
**Current product**: Letta (formerly MemGPT)

### How it persists lessons/memories
MemGPT uses a **hierarchical memory system** inspired by OS virtual memory:
- **Core memory** (in-context): Always in the prompt. Editable structured blocks (persona, human info, scratch space)
- **Archival memory** (out-of-context): Unlimited storage, accessed via explicit read/write function calls
- **Recall memory**: Searchable conversation history

The agent itself decides when to write to or read from archival memory using tool calls (`archival_memory_insert`, `archival_memory_search`).

### Storage format
- **Core memory**: Structured text blocks with size limits (character count caps). Edited in-place by the agent.
- **Archival memory**: Free-form text passages stored in a vector database (PostgreSQL + pgvector in Letta). Each entry is an arbitrary string.
- **Recall memory**: Full message history stored in a database, searchable by text or timestamp.
- Letta uses PostgreSQL with SQLAlchemy models for persistence.

### Retrieval and injection
- **Core memory**: Always present in the system prompt — no retrieval needed
- **Archival memory**: Agent explicitly calls `archival_memory_search(query)` which does vector similarity search and returns results as a tool response
- **Recall memory**: Agent calls `conversation_search(query)` to find past messages
- The agent is **self-directed** — it decides when to store and retrieve, prompted by the system prompt instructions

### What works well
- **Self-managed**: Agent controls its own memory, can learn what's important
- **Unbounded storage**: Archival memory has no size limit
- **Multi-session**: Agent maintains state across unlimited conversations
- **Flexible**: Agent can store anything — facts, preferences, lessons, corrections
- The OS metaphor (paging between fast/slow memory) is elegant and general

### What doesn't work well
- **Agent must learn to use memory tools**: If the LLM doesn't call memory functions, learning doesn't happen
- **No automatic lesson extraction**: Agent must be prompted/trained to reflect
- **Retrieval quality depends on query formulation**: Agent may not search effectively
- **Core memory size is limited**: Important info competes for limited slots
- **No built-in decay/prioritization**: Archival memory accumulates indefinitely without cleanup

---

## 4. OpenClaw

**Repository**: github.com/openclaw/openclaw (361k stars)

### How it persists lessons/memories
OpenClaw is a personal AI assistant that uses a **skill-based architecture** with persistent memory. Based on the repository structure:
- `.agents/skills/` directory — agent-specific learned skills
- `skills/` directory — reusable skill modules
- Skills are installable from "ClaWhub" (skill marketplace/directory)
- Uses ACP (Agent Client Protocol) for stateful sessions via `acpx` client

### Storage format
- **Skills**: TypeScript/Python modules stored as files in skill directories
- **Session state**: Stateful ACP sessions persist context across interactions
- Skills appear to be structured packages with defined interfaces (installable from ClaWhub registry)
- Local-first architecture — all data stored on-device

### Retrieval and injection
- Skills are loaded based on the current task context
- The `lobster` workflow shell composes skills into pipelines
- Agent can discover and install new skills from the ClaWhub directory
- Stateful sessions (via ACP) maintain conversation context across calls

### What works well
- **Ecosystem approach**: ClaWhub marketplace lets community share learned skills
- **Local-first**: Privacy-preserving, all memories on user's device
- **Composable**: Skills can be chained into workflows via Lobster
- **Multi-platform**: Works across macOS, iOS, Android, Linux

### What doesn't work well
- Limited public documentation on the memory/learning internals
- Skill-based learning requires explicit packaging (not automatic lesson extraction)
- Unclear how cross-session reflective learning works vs just tool/skill reuse

---

## 5. Hermes Agent

**Repository**: github.com/hermes-agent (no public repositories found)

### Status
The GitHub organization `hermes-agent` has no public repositories. This may refer to:
- **NousResearch Hermes models** — fine-tuned LLMs with function calling, not an agent framework with memory
- A private/unreleased project

No findings available for this system. If this refers to the Hermes series of fine-tuned models from NousResearch, those don't implement persistent learning mechanisms — they're static model weights enhanced for tool use/function calling.

---

## Comparative Summary

| System | Memory Type | Storage Format | Retrieval Method | Cross-Task Transfer | Automatic Learning |
|--------|------------|----------------|------------------|--------------------|--------------------|
| **Voyager** | Skill library | Code + embeddings | Semantic search (ChromaDB) | ✅ Yes | ✅ Auto-verified skills |
| **Reflexion** | Reflection buffer | Plain text list | Full concatenation | ❌ Same-task only | ✅ Auto-generated |
| **MemGPT/Letta** | Hierarchical (core/archival/recall) | Structured blocks + vector DB | Agent-initiated search | ✅ Yes | ⚠️ Agent must choose to store |
| **OpenClaw** | Skills + sessions | TypeScript modules | Task-based loading | ✅ Via skill sharing | ❌ Manual skill creation |
| **Hermes** | N/A | N/A | N/A | N/A | N/A |

---

## Key Design Insights

### 1. Code vs. Natural Language
- **Code** (Voyager, OpenClaw): More precise, executable, composable — but domain-specific and rigid
- **Natural language** (Reflexion, MemGPT): More flexible and general — but ambiguous and harder to verify

### 2. Self-Directed vs. Automatic
- **Self-directed** (MemGPT): Agent decides what to remember — flexible but unreliable
- **Automatic** (Voyager, Reflexion): System extracts lessons on success/failure — reliable but inflexible

### 3. Retrieval Strategy
- **Semantic search** (Voyager, MemGPT): Scales well but may miss non-obvious connections
- **Full injection** (Reflexion): Simple but doesn't scale past a few items
- **Task-based loading** (OpenClaw): Predictable but requires explicit organization

### 4. What's Missing Across All Systems
- **Lesson decay/consolidation**: No system handles outdated or contradictory lessons well
- **Confidence scoring**: No system tracks how reliable a lesson is
- **Cross-domain transfer**: Lessons are largely domain-bound
- **Negative lessons**: "Don't do X" is underrepresented vs "Do Y"
- **Structured categorization**: Most systems dump everything together rather than categorizing (fixes vs patterns vs insights)

---

## Recommendations for Our System

Based on this research, an effective agent learning system should:

1. **Hybrid storage**: Use both structured categories (like `fix`, `pattern`, `insight`) AND free-form text
2. **Automatic extraction**: Generate lessons from success/failure signals without requiring the agent to explicitly decide
3. **Semantic retrieval with recency/frequency weighting**: Don't just match by meaning — prefer recent, frequently-validated lessons
4. **Bounded context injection**: Retrieve top-k relevant lessons rather than dumping everything
5. **Lesson lifecycle**: Support adding, validating, updating, and deprecating lessons over time
6. **Cross-session persistence**: Store in durable format (files or DB) that survives restarts

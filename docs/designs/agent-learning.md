# Agent Learning from Experience — Design Doc

## Problem Statement

Our agents currently have no mechanism to learn from experience across sessions. Each session starts fresh with only the task description as context. Agents repeat mistakes, rediscover workarounds, and fail to build on prior successes.

The core question: **What's the right format, timing, and delivery mechanism for learned lessons?**

Key constraints from human guidance:
- Text works for changing behavior — don't over-index on structural enforcement
- Experiment first, prove it works, then adopt
- Don't brute-force inject context — design for *learning*, not information dumping

## Current State: Analysis of `buildSessionContext()` in `src/lib/manager.ts`

> **Source:** Extracted from the compiled binary at `/app/agents/may-agent-bin`. The function is a method on the session manager class.

**Correction:** `buildSessionContext()` is **NOT dead code** — it IS called during session launch. The launch path does: `const sessionContext = this.buildSessionContext(...)` then sends `${sessionContext}\n\n---\n\n${task}` as the prompt. So agents already receive this context. The human's comment about "throws it all away" may refer to an older version or a different issue.

### What `buildSessionContext()` Actually Computes

The function builds a `# Session Context` block prepended to every agent's task prompt:

| Data Source | How It Works | Current Status |
|---|---|---|
| **Session metadata** | Session ID + current timestamp | ✅ Always included |
| **Recent Task History** | Reads memory entries (via `readMemoryEntries`) up to `memoryLimit` (default 20). Each entry has: timestamp, task text (truncated), status, duration, summary, completed items, new items, files modified | ✅ Active — agents see their last N task summaries |
| **Active Recall** | `runActiveRecall(agentName, projectRoot)` — retrieves warnings/alerts relevant to the agent. Formatted via `formatRecallWarnings()` | ✅ Active — retrieves agent-specific warnings |
| **Last Checkpoint** | `readLatestCheckpointForAgent()` — gets most recent checkpoint with summary, data, age, and originating session | ✅ Active — enables within-task continuity |
| **Context Files** | Reads `def.contextFiles` paths (e.g., `agents/<name>/context.md`) and appends their content | ✅ Active — this is the `context_updates` mechanism from `finish()` |

### What `appendMemory()` Persists After Each Session

After a session ends, `appendMemory()` extracts from the `finish()` call:
- Task, status, duration, summary
- `completed_items`, `new_items`, `filesModified`
- Stored via `appendMemoryEntry()` keyed by agent name

### Key Insight: The Infrastructure Is Already Wired

The learning pipeline exists: agents report lessons via `finish()` → lessons persist to memory → `buildSessionContext()` retrieves them → next session receives them. **The problem isn't missing plumbing — it's the quality of what flows through it.**

Current gaps:
1. **No distillation** — memory entries are raw task summaries, not extracted lessons. An agent that ran 20 sessions gets 20 one-line summaries, not "here's what I learned"
2. **No relevance filtering** — all recent entries are included regardless of relevance to the current task
3. **`finish()` lessons field** (`lessons` in the schema) — it's unclear if these are actually surfaced back. The `appendMemory` function doesn't extract them
4. **No cross-agent learning** — agent A's discoveries don't benefit agent B
5. **Context budget** — 20 memory entries × ~1 line each is small, but as learning grows this needs management

## Existing Learning Mechanisms

### Current: `finish()` Lessons Field
Agents can report lessons via the `finish()` tool with structured categories (`fix`, `pattern`, `insight`). These are persisted to memory but it's unclear how effectively they're retrieved and applied.

### Current: `context.md` Files
The `finish()` tool has a `context_updates` field that persists facts to `agents/<name>/context.md`. This is loaded into future sessions. This is the closest thing to durable learning we have.

### Current: Checkpoints
The `checkpoint()` tool saves structured progress mid-session. Available to next session via `readCheckpoints`. Good for within-task continuity, less for cross-task learning.

## Research: External Approaches

> **Status:** ✅ Scout research complete. Full analysis in `docs/research/agent-learning-mechanisms.md`.

Key takeaways incorporated into design:
- **Voyager**: Semantic retrieval of learned skills works well; code-as-lessons is too rigid for our use case
- **Reflexion**: Natural language reflections are effective but don't transfer across tasks and don't scale
- **MemGPT**: Self-directed memory is elegant but unreliable — agents forget to store lessons
- **OpenClaw**: Skill marketplace shows value of cross-agent sharing

Our design combines: automatic extraction (like Reflexion), relevance-filtered retrieval (like Voyager), bounded context (unlike Reflexion), and cross-agent sharing (like OpenClaw's marketplace).

## Approach Comparison

The system currently has three data sources that could feed agent learning: **digests** (summaries of recent activity), **diffs** (code changes from recent sessions), and **recall** (active warnings/alerts). All three are currently injected as raw context. The question is: what's the right way to transform these into genuine learning?

### Approach 1: Brute-Force Injection (Current State)

Dump raw data into the agent's context window at session start. This is what `buildSessionContext()` does today — task history summaries, active recall warnings, checkpoint data, and context files are concatenated into the prompt.

| | |
|---|---|
| **Pros** | Zero processing cost. Agents get full fidelity of original data. Simple to implement and debug. No information loss from summarization. |
| **Cons** | Scales poorly — 20 task summaries × 100 words = 2KB of low-signal text. No relevance filtering: an agent doing a new task type gets lessons from unrelated past work. Raw diffs and digests are noisy; agents must do their own extraction every session, wasting reasoning budget. Violates the "learning not injection" principle — agents process the same raw data repeatedly instead of building on distilled understanding. |
| **When it works** | Small number of sessions, consistent task types, generous context budgets. |
| **Verdict** | Adequate for bootstrapping but doesn't scale. The current system is already showing symptoms: agents repeat mistakes because the raw history doesn't highlight what matters. |

### Approach 2: On-Demand Retrieval (RAG-Style)

Store all experience data in a searchable knowledge base (vector DB or keyword index). Agents query it when they need information, rather than receiving it upfront.

| | |
|---|---|
| **Pros** | Scales to unlimited history. Only retrieves what's relevant to the current problem. Agents can pull context mid-session when they hit a specific issue, not just at start. |
| **Cons** | Requires embedding infrastructure or a retrieval API — significant new complexity. Agents must know *when* to query and *what* to ask for, which is itself a skill they may lack (MemGPT's problem). Retrieval quality depends on query formulation. Adds latency to every retrieval call. For our agent count (~5 agents, ~50 sessions/day), the volume doesn't justify the infrastructure. |
| **When it works** | Large-scale systems with thousands of agents and massive experience corpora where upfront injection is impossible. |
| **Verdict** | Over-engineered for our scale. The infrastructure cost isn't justified when the total lesson corpus fits in a few KB. Worth revisiting if we 10x agent count. |

### Approach 3: Learned Lessons (Distilled Experience)

After each session, automatically extract compact, actionable lessons from the agent's experience. Store them as structured text. At session start, inject only the most relevant lessons — not raw data, but distilled knowledge.

| | |
|---|---|
| **Pros** | Compact — a lesson is 1-2 sentences vs. a full task summary. High signal-to-noise: "always run `cd /app/agents` before git commands" is more actionable than a raw session log showing a git failure. Scales well: lessons deduplicate and consolidate over time. Transforms data sources (digests, diffs, recall) from raw context into accumulated understanding. Directly uses existing `finish().lessons` field that agents already populate. |
| **Cons** | Extraction quality matters — bad distillation loses important nuance. Requires a relevance filter to avoid injecting irrelevant lessons. Some lessons may be wrong (agent learns the wrong conclusion from a failure). Needs a lifecycle mechanism to prune stale lessons. |
| **When it works** | Small-to-medium agent populations with recurring task patterns. Our exact situation. |
| **Verdict** | **Recommended.** Best fit for our scale, existing infrastructure, and the "learning not injection" principle. |

### Recommendation

**Use Learned Lessons as the primary mechanism**, with brute-force injection retained for short-term context (last 3-5 task summaries) and on-demand retrieval deferred as a future enhancement.

The key insight: digests, diffs, and recall are *raw experience*. Learning means transforming them:
- **Digests** → extract patterns ("worker sessions that modify tests tend to fail when they skip type-checking")
- **Diffs** → extract code-level lessons ("the config file at X needs Y when doing Z")  
- **Recall warnings** → already distilled; keep as-is but integrate into the lesson scoring pipeline

This transforms the existing dead-code data sources from "things dumped into context" into "inputs to a learning pipeline that produces compact, relevant, actionable lessons."

## Proposed Design

### Design Principles
1. **Text-based** — lessons are natural language, not structural constraints
2. **Experiment-driven** — prove mechanisms work before adopting
3. **Learning, not injection** — agents should develop understanding, not receive data dumps
4. **Automatic extraction** — don't rely on agents to self-direct memory (MemGPT's weakness); extract from structured `finish()` output
5. **Bounded retrieval** — inject only relevant lessons, not everything (Reflexion's weakness)

### Architecture Overview

```
finish() lessons/context_updates
        │
        ▼
┌─────────────────────┐
│  Lesson Extraction   │  ← runs after every session
│  (automatic)         │
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  Lesson Store        │  ← per-agent + shared pool
│  (JSONL files)       │
│  category, text,     │
│  agent, task-type,   │
│  confidence, age     │
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  Relevance Filter    │  ← runs at session start
│  (in buildSession    │
│   Context)           │
└────────┬────────────┘
         ▼
   Session prompt with
   top-k relevant lessons
```

### Component 1: Lesson Extraction (Post-Session)

**Trigger:** Every `finish()` call, regardless of success/failure.

**What gets extracted:**
- `finish().lessons[]` — already structured with `fix`/`pattern`/`insight` categories. Currently persisted to memory but **not surfaced back**. This is the #1 gap to fix.
- `finish().context_updates[]` — already works via `context.md`. Keep as-is for durable facts.
- **New: auto-extracted lessons from failure patterns.** When status=`failure`, extract the blocker reasons as `fix` lessons automatically. When status=`success` after prior failures on same task, extract the diff as a lesson.

**Storage format (JSONL):**
```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "agent": "worker",
  "category": "fix|pattern|insight",
  "text": "manager.ts uses lazy DB init — must call getDb() not import db directly",
  "source_task": "brief task description",
  "confidence": 1.0,
  "validated_count": 0,
  "last_relevant": "ISO-8601"
}
```

**Storage location:** `agents/<name>/lessons.jsonl` (per-agent) + `agents/shared/lessons.jsonl` (cross-agent).

### Component 2: Relevance Filtering (Session Start)

**Problem:** Injecting all lessons wastes context budget and dilutes signal (Reflexion's failure mode). Need to select the most relevant subset.

**Algorithm — simple scoring, no embeddings needed initially:**

```
score(lesson, current_task) =
    keyword_overlap(lesson.text, current_task) * 0.4
  + recency_weight(lesson.timestamp) * 0.3
  + confidence_weight(lesson.confidence, lesson.validated_count) * 0.2
  + category_boost(lesson.category) * 0.1
```

Where:
- `keyword_overlap`: fraction of significant words in the lesson that appear in the task description
- `recency_weight`: exponential decay, half-life of 7 days
- `confidence_weight`: starts at 1.0, increases when lesson is validated (agent reports same lesson again), decreases if contradicted
- `category_boost`: `fix` > `pattern` > `insight` (fixes are most actionable)

**Budget:** Max 10 lessons, max 2KB total. Injected as a `## Lessons from Experience` section in the session context, between task history and the task itself.

**Fallback:** If no lessons score above threshold, include the 3 most recent lessons regardless (bootstrapping).

### Component 3: Cross-Agent Learning

**Mechanism:** When a lesson is marked as `pattern` or `insight` (not `fix`, which tends to be agent-specific), copy it to `agents/shared/lessons.jsonl`. All agents read from both their own file and the shared file during relevance filtering.

**Deduplication:** Before adding to shared pool, check if a semantically similar lesson exists (simple: same category + >60% word overlap). If so, increment `validated_count` on the existing entry rather than adding a duplicate.

**Example flow:**
1. Worker learns: "Always run tests before committing" (pattern)
2. Lesson copied to shared pool
3. Scout picks it up when doing a task that involves code changes

### Component 4: Context Budget Management

Current `buildSessionContext()` already assembles: metadata + task history (20 entries) + active recall + checkpoint + context files.

**Proposed budget allocation (within ~8KB total):**

| Component | Budget | Priority |
|-----------|--------|----------|
| Session metadata | 200B | Required |
| Active recall/warnings | 1KB | High |
| **Lessons from experience** | **2KB** | **High (new)** |
| Last checkpoint | 1KB | Medium |
| Recent task history | 3KB (reduce from current) | Medium |
| Context files | 1KB | Low |

**Key change:** Reduce task history from 20 raw entries to 5 most recent + summarized patterns. Raw task summaries are low-signal; distilled lessons are higher-signal.

### Component 5: Lesson Lifecycle

- **Creation:** Automatic from `finish()`, as described above
- **Validation:** When an agent reports a lesson that matches an existing one (same category, >60% overlap), increment `validated_count` and refresh `last_relevant`
- **Decay:** Lessons not validated or retrieved for 30 days get `confidence` halved. Below 0.1 confidence → archived (moved to `lessons.archive.jsonl`)
- **Contradiction:** If a new lesson directly contradicts an old one (same topic, opposite advice), flag both for human review via active recall warning. Don't auto-resolve.

### Implementation Plan

**Phase 1 (infra change, ~2 sessions):**
1. In `appendMemory()`: extract `finish().lessons` and write to `agents/<name>/lessons.jsonl`
2. In `buildSessionContext()`: read lessons file, apply simple relevance filter, inject top-k into prompt

**Phase 2 (refinement, ~2 sessions):**
3. Add cross-agent shared lesson pool
4. Add confidence scoring and decay
5. Reduce raw task history, increase lesson budget

**Phase 3 (validation, ~2 sessions):**
6. Run the experiment (below) to measure impact
7. Tune parameters based on results

### Experiment: Proving It Works

**Setup:** Use the existing agent system running real tasks as the testbed.

**Method — A/B within same agent:**
1. Pick a task type that recurs (e.g., worker doing code changes with tests)
2. Measure baseline over 10 sessions: count repeated mistakes, time-to-completion, reviewer rejection rate
3. Enable lesson injection for next 10 sessions on same task type
4. Compare: fewer repeated mistakes? Faster completion? Fewer rejections?

**Concrete metric:** Track how often reviewer says "CONTINUE" (meaning rework needed) vs "COMPLETE". If learning works, the CONTINUE rate should decrease over time.

**Simpler smoke test:** Deliberately teach an agent a lesson (e.g., "always commit from /app/agents directory"), then verify in the next session that the lesson appears in context and the agent follows it. This is testable in ~2 sessions.

**Control:** The "always commit from /app/agents" lesson is perfect because it's a real recurring bug in this very project (see iteration 15-16 failures). If the system learns this, it's directly observable.

## Integration Points

Learning happens at five specific points in the system. Each has a distinct role:

### 1. Session End — `finish()` / `appendMemory()`

**What happens:** Agent reports `lessons[]` and `context_updates[]` in its `finish()` call. The system extracts these and writes to `agents/<name>/lessons.jsonl`. For failures, auto-extract blocker reasons as `fix` lessons. For successes after prior failures on the same task, extract the resolution as a lesson.

**Why this timing:** This is where the agent has maximum self-awareness about what it learned. The structured `finish()` schema already captures this — we just need to persist and surface it. This is the **primary extraction point**.

**Change required:** `appendMemory()` must extract `finish().lessons` (currently ignored) and write to the lesson store. Also: when status=`failure`, auto-generate a `fix` lesson from `blockers[]`.

### 2. Session Start — `buildSessionContext()`

**What happens:** Read `agents/<name>/lessons.jsonl` + `agents/shared/lessons.jsonl`. Score each lesson against the current task description using the relevance algorithm (keyword overlap + recency + confidence + category). Inject top-k (max 10, max 2KB) as a `## Lessons from Experience` section in the prompt.

**Why this timing:** This is the only point where we control what the agent sees. Lessons must be present at session start to influence behavior. Late injection (mid-session) would require tool calls and agent initiative, which is unreliable (MemGPT's lesson).

**Change required:** Add lesson retrieval and formatting to `buildSessionContext()`, between active recall and task history.

### 3. Heartbeat (Periodic Reflection)

**What happens:** During heartbeat, the system can review recent sessions and consolidate lessons. If multiple sessions reported similar lessons, merge them and increment `validated_count`. If a lesson led to repeated failures, flag it as potentially wrong.

**Why this timing:** Heartbeats are low-urgency maintenance windows. Consolidation doesn't need to happen in real-time — it's fine to batch it. This is where **cross-agent lesson propagation** happens: copy validated `pattern`/`insight` lessons to the shared pool.

**Change required:** Add a `consolidateLessons()` step to the heartbeat loop. Not critical for Phase 1.

### 4. Workflow Step Boundaries

**What happens:** When a workflow transitions between steps (e.g., worker → reviewer), the outgoing agent's lessons from that session can be immediately available to the incoming agent. This enables tight feedback loops: reviewer learns "worker tends to skip tests" and can check for it.

**Why this timing:** Workflow steps are where agents hand off to each other. Real-time lesson passing here is more valuable than waiting for the heartbeat consolidation cycle. This is the **cross-agent fast path**.

**Change required:** Workflow orchestrator passes outgoing `finish().lessons` as additional context to the next step. Phase 2.

### 5. Lesson Pruning (Background)

**What happens:** Periodically (daily or at heartbeat), scan all lesson stores. Halve confidence on lessons not retrieved or validated in 30 days. Archive lessons below 0.1 confidence. Flag contradictory lessons for human review.

**Why this timing:** Pruning prevents lesson stores from growing unboundedly. Stale lessons (from deprecated code patterns, old bugs) actively harm performance if they persist. Background timing is fine — staleness is measured in days, not minutes.

**Change required:** Add `pruneLessons()` to heartbeat. Phase 2.

## Open Questions

1. **Evaluation methodology**: How do we prove a learning mechanism works? The smoke test (teach "always cd /app/agents before git") is concrete but narrow. Need a systematic approach to measuring learning effectiveness across diverse task types.

2. **Human-in-the-loop**: Should humans curate/approve learned lessons, or should the system be fully autonomous? Current design flags contradictions for human review but is otherwise autonomous. Is that sufficient?

3. **Lesson quality control**: What happens when an agent learns the wrong lesson from a failure (e.g., "don't use git" instead of "cd to the right directory before git")? The confidence/validation mechanism helps but may not catch subtle mislearning.

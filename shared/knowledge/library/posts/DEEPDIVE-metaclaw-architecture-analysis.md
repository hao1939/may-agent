# Deep Dive: MetaClaw — Self-Evolving RL Agent Architecture

**Date:** 2026-03-29  
**Type:** Technical Deep-Dive  
**Source:** GitHub repository analysis (aiming-metaclaw v0.4.1)  
**Tags:** #metaclaw #reinforcement-learning #skill-evolution #memory-systems #agent-architecture

---

## 1. Executive Summary

MetaClaw is a meta-learning agent framework that continuously evolves its behaviour through reinforcement learning while serving as a transparent proxy to existing "claw" agents (OpenClaw, Copaw, IronClaw, PicoClaw, ZeroClaw). It intercepts conversations flowing through a local API proxy, injects learned skills into prompts, scores responses with a Process Reward Model (PRM), and trains the underlying model using GRPO-style policy gradient updates via the Tinker cloud RL SDK.

What makes MetaClaw architecturally distinctive is the tight coupling of three subsystems that usually exist in separate frameworks: **skill injection**, **long-term memory**, and **on-device RL training** — all operating transparently beneath any OpenAI-compatible chat endpoint.

---

## 2. System Architecture

### 2.1 Core Data Flow

```
User ─→ Claw Agent ─→ MetaClaw Proxy (FastAPI) ─→ Tinker Cloud
              ↑              │                          │
              │    ┌─────────┴──────────┐               │
              │    │ Skill Injection    │               │
              │    │ Memory Injection   │     ←─ sampled response
              │    │ PRM Scoring        │               │
              │    │ Data Collection    │               │
              │    └─────────┬──────────┘               │
              │              │                          │
              └──────────────┘                          │
                                                        │
                    ┌───────────────────────────────────┘
                    ↓
              RL Trainer (GRPO)
                    │
              Skill Evolver (LLM-driven)
                    │
              Memory Consolidator
```

MetaClaw sits as a **man-in-the-middle proxy** (FastAPI + uvicorn, default port 36109) between the user's claw agent and the model backend. Every chat completion request passes through `MetaClawAPIServer`, which:

1. **Injects skills** into the system prompt based on task-type detection
2. **Injects relevant memories** from the local memory store
3. **Forwards** the augmented request to Tinker's SamplingClient for generation
4. **Scores** the response using a PRM judge model
5. **Collects** the interaction as a `ConversationSample` for RL training
6. **Returns** the response to the claw agent (streaming or non-streaming)

### 2.2 Key Components

| Component | File | Role |
|-----------|------|------|
| **MetaClawTrainer** | `trainer.py` | Orchestrates setup, rollout, training loop, skill evolution |
| **MetaClawAPIServer** | `api_server.py` | FastAPI proxy; handles `/v1/chat/completions` |
| **AsyncRolloutWorker** | `rollout.py` | Thread-based worker managing the proxy server and sample queue |
| **SkillManager** | `skill_manager.py` | Loads, retrieves, and evolves Markdown skill files |
| **SkillEvolver** | `skill_evolver.py` | LLM-driven skill mutation from high/low reward samples |
| **PRMScorer** | `prm_scorer.py` | Process Reward Model using LLM-as-judge with majority voting |
| **MemoryManager** | `memory/manager.py` | Extraction, storage, retrieval, consolidation orchestrator |
| **MemoryRetriever** | `memory/retriever.py` | Keyword/embedding/hybrid retrieval with query expansion |
| **MemoryConsolidator** | `memory/consolidator.py` | Deduplication, decay, entity reinforcement |
| **SlowUpdateScheduler** | `scheduler.py` | Idle-aware training scheduling |
| **IdleDetector** | `idle_detector.py` | Platform-specific user activity detection (macOS/Linux) |
| **ClawAdapter** | `claw_adapter.py` | Auto-configures 6+ different claw agents to use MetaClaw proxy |
| **SDKBackend** | `sdk_backend.py` | Abstracts Tinker vs MinT RL backends |

---

## 3. The Skill System

### 3.1 Skill Representation

Skills are stored as **Markdown files** in a configurable directory (default `~/.metaclaw/skills/`). Each skill has YAML frontmatter:

```markdown
---
name: error-diagnosis
category: debug
tags: [debugging, error-handling, stack-trace]
priority: 0.8
---
When diagnosing errors, always:
1. Read the full stack trace bottom-up
2. Identify the root cause vs. symptoms
3. Check if the error is reproducible
...
```

The `SkillManager` loads all skills at startup and organizes them by category using keyword-based task-type detection. A hardcoded keyword map classifies incoming requests:

```python
# From skill_manager.py
_TASK_TYPE_KEYWORDS = {
    "code": ["code", "debug", "implement", "function", "class", "bug", "error", ...],
    ...
}
```

### 3.2 Skill Retrieval

Three retrieval modes exist:

1. **Keyword-based** (default): TF-IDF-style token overlap with stemming via `_stem()` and `_tokenize_text()`
2. **Embedding-based**: Uses sentence-transformers to compute cosine similarity between task description and skill text
3. **Hybrid**: Combines both with score fusion

An important design choice: retrieval always includes **cross-category skills** beyond the detected task type, "to avoid missing relevant skills due to task type misclassification." This defensive broadening prevents the keyword classifier's errors from cascading into skill starvation.

### 3.3 Skill Evolution

The `SkillEvolver` is the most architecturally novel component. After each training batch, it:

1. Identifies the **highest-reward** and **lowest-reward** samples from the batch
2. Sends these to a separate LLM (configurable via `evolver_model_id`) with a meta-prompt asking: *"What skills would have helped the agent succeed? What skills led it astray?"*
3. The LLM generates **new skill Markdown files** or **modifications to existing skills**
4. New skills are validated and added to the `SkillManager`
5. A `skill_generation` counter increments, invalidating stale training samples

This creates a **MAML-like support/query separation**: samples collected under generation N are discarded if skills evolve to generation N+1 before they're used for training. The `_current_skill_generation` field on the trainer and the `skill_generation` field on `ConversationSample` enforce this.

### 3.4 Skill Generation Filtering

```python
# From trainer.py _drain_with_pause_check():
fresh = [
    s for s in group
    if s.skill_generation >= self._current_skill_generation
]
```

This is crucial: without it, the RL objective would optimize for a policy that no longer matches the current skill-augmented prompt distribution, causing training instability.

---

## 4. The Memory System

### 4.1 Architecture Overview

Added in v0.4.0, the memory subsystem runs **alongside** skills. Where skills capture *how* to act, memory captures *what has happened*. Five memory types:

| Type | Purpose |
|------|---------|
| `episodic` | Specific past events and actions |
| `semantic` | General facts about the user or project |
| `preference` | Stated or inferred user preferences |
| `project_state` | Current goals, open tasks, recent decisions |
| `working_summary` | Rolling summary of recent activity |

### 4.2 Memory Scoping

Memory is **scoped** — each user/workspace combination gets its own isolated memory pool. The `memory/scope.py` module derives scope IDs from request metadata:

```python
# From api_server.py - non-standard body keys
_NON_STANDARD_BODY_KEYS = {
    "session_id", "session_done", "turn_type",
    "memory_scope", "user_id", "workspace_id",
}
```

Clients can pass `user_id` and `workspace_id` in the chat completion body (stripped before forwarding to the model), enabling multi-tenant memory isolation.

### 4.3 Retrieval Pipeline

The `MemoryRetriever` implements a sophisticated retrieval pipeline:

1. **Primary search**: Keyword or embedding-based, depending on `retrieval_mode`
2. **Query expansion**: If initial results are sparse (<50% of limit), the query is automatically expanded and re-searched, with expansion-only matches receiving a **0.85x score penalty**
3. **Tag boosting**: If the request carries context tags, matching memories get boosted
4. **Auto mode selection**: When `retrieval_mode=auto`, the retriever heuristically picks keyword vs. embedding vs. hybrid based on query characteristics

### 4.4 Consolidation

The `MemoryConsolidator` runs periodically (every N sessions, configurable) and performs:

1. **Working summary deduplication**: Only the newest working summary stays active; older ones are superseded
2. **Exact duplicate removal**: Content-hash deduplication across memory types
3. **Near-duplicate merging**: Token-overlap similarity with configurable threshold (default 0.80)
4. **Entity-based reinforcement**: Cross-type entity matching boosts related memories
5. **Importance decay**: Memories unused for >30 days (configurable) have their importance score reduced. Linear or exponential decay modes. Minimum importance floor prevents total erasure.

### 4.5 Self-Upgrade and Policy Optimization

Two additional subsystems handle memory system evolution:

- **`memory/self_upgrade.py`** + **`memory/upgrade_worker.py`**: Automated schema migrations and store upgrades
- **`memory/policy_optimizer.py`**: Tunes retrieval parameters (top_k, scoring weights) based on memory hit utility feedback
- **`memory/promotion.py`**: Promotes ephemeral memories to permanent based on access patterns
- **`memory/replay.py`**: Replays consolidated memories to improve retrieval ranking
- **`memory/telemetry.py`**: Tracks memory system performance metrics

### 4.6 Memory Sidecar

For process isolation, MetaClaw supports a standalone memory sidecar service (`openclaw-metaclaw-memory`) that communicates over local HTTP. This architectural choice allows:
- Memory persistence independent of proxy lifecycle
- Shared memory across multiple proxy instances
- Independent scaling of memory operations

---

## 5. RL Training Pipeline

### 5.1 GRPO-Style Updates

The training loop follows a Group Relative Policy Optimization (GRPO) approach:

1. **Sample collection**: `AsyncRolloutWorker` collects `ConversationSample` objects via the proxy
2. **Advantage computation**: `compute_advantages()` centre-normalizes rewards within each batch
3. **Datum formatting**: `batch_to_datums()` converts samples to Tinker's `Datum` format with per-token advantages
4. **Forward + backward**: Tinker cloud handles the actual gradient computation
5. **Skill evolution**: `_maybe_evolve_skills()` triggers skill mutation based on batch performance

### 5.2 On-Policy Distillation (OPD)

When `use_opd=True`, a reverse-KL penalty is applied:

```
advantage_token[i] -= kl_coef * (log_p_student[i] - log_p_teacher[i])
```

This keeps the trained policy from diverging too far from a teacher model, following the tinker-cookbook OPD convention.

### 5.3 PRM Scoring

The `PRMScorer` uses an LLM-as-judge approach with **majority voting**:

1. Multiple independent judge queries are sent for each response
2. Each judge assigns a score in {-1, 0, 1}
3. `_majority_vote()` aggregates scores
4. The result becomes the `reward` field on `ConversationSample`

A separate `prm_model_id` can be configured, allowing the judge to be a different (potentially larger) model than the one being trained.

### 5.4 Scheduler & Idle Detection

The `SlowUpdateScheduler` coordinates training with user activity:

- **IdleDetector** checks system-level idle time:
  - macOS: Parses `IOHIDSystem HIDIdleTime` via `ioreg` 
  - Linux: Uses `xprintidle` or falls back to proxy request timing
- **GoogleCalendarClient** (optional): Fetches busy windows to identify meeting times — safe slots for expensive weight updates
- **trigger_event / pause_event**: The scheduler sets `trigger_event` when idle time exceeds a threshold; `pause_event` fires when the user becomes active, aborting in-progress batch collection

This makes MetaClaw safe for **desktop deployment** — it won't cause latency spikes during active coding sessions.

### 5.5 Bench-Driven Mode

An alternative `manual_train_trigger` mode disables the autonomous training loop. Instead:
- The proxy collects samples normally
- Training steps are triggered externally via `metaclaw train-step` CLI or admin HTTP endpoint
- This enables integration with external benchmarking harnesses

---

## 6. Multi-Claw Adapter System

### 6.1 Supported Claws

MetaClaw auto-configures itself as the backend for various claw agents:

| Claw | Configuration Method |
|------|---------------------|
| **OpenClaw** | `openclaw config set …` + `openclaw gateway restart` |
| **Copaw** | Patches `~/.copaw/config.json`, triggers daemon hot-reload |
| **IronClaw** | Patches `~/.ironclaw/.env`, runs `ironclaw service restart` |
| **PicoClaw** | Patches `~/.picoclaw/config.json` model_list, runs `picoclaw gateway restart` |
| **ZeroClaw** | Patches `~/.zeroclaw/config.toml`, runs `zeroclaw service restart` |
| **none** | Skip auto-configuration |

Each adapter is a simple function registered in `_ADAPTERS`, making it trivial to add new claws.

### 6.2 Transparent Interposition

The key architectural insight: by masquerading as an OpenAI-compatible API endpoint, MetaClaw can sit beneath **any** agent that uses the chat completions API. The claw agent doesn't know it's being proxied — it just sees slightly better responses over time as skills and memory accumulate.

---

## 7. Benchmark System

MetaClaw ships with a comprehensive benchmarking CLI (`metaclaw-bench`) for evaluating skill and memory effectiveness:

- **`infer`**: Run batch inference on test datasets
- **`scoring`**: Score results against ground truth
- **`report`**: Generate accuracy and token-usage reports
- **`report-ratio`**: Compute compaction ratios (skill/memory compression effectiveness)
- **`run`**: End-to-end pipeline (infer → scoring → report)
- **`check`**: Validate dataset integrity

The benchmark supports memory-aware evaluation (`--memory` flag) and configurable memory proxy ports, enabling A/B testing of memory configurations.

---

## 8. Technical Observations & Analysis

### 8.1 Strengths

1. **Transparent deployment**: Zero changes required to existing claw agents. The proxy pattern means MetaClaw can wrap any OpenAI-compatible agent without cooperation from the agent itself.

2. **Skill generation tracking**: The MAML-inspired generation counter that invalidates stale samples is a sophisticated detail. Without it, training on pre-evolution samples would create a distribution mismatch.

3. **Idle-aware scheduling**: Desktop-friendly RL training that respects user activity is a practical necessity often overlooked in research systems. The calendar integration for meeting detection is a particularly creative touch.

4. **Memory consolidation pipeline**: The multi-stage consolidation (exact dedup → near-dedup → entity reinforcement → importance decay) is well-designed. The 0.85x penalty for query-expansion-only hits is a good calibration choice.

5. **Multi-backend support**: The `SDKBackend` abstraction (Tinker vs MinT) and multi-claw adapter system show mature engineering for heterogeneous deployment environments.

### 8.2 Potential Limitations

1. **Single-model skill evolution**: The skill evolver relies on a single LLM to generate new skills. There's no multi-perspective validation or adversarial testing of proposed skills before they're adopted.

2. **Keyword task-type detection**: The hardcoded keyword map for task classification is brittle. Ambiguous requests may be misclassified, though the cross-category retrieval mitigates this.

3. **Cloud RL dependency**: Training requires the Tinker (or MinT) cloud SDK, creating a hard dependency on external infrastructure for the core RL loop.

4. **Memory scalability**: The consolidator loads up to 2000 active memories per scope (`list_active(scope_id, limit=2000)`). This cap could become a bottleneck for long-lived, high-activity deployments.

### 8.3 Comparison with Prior Work

- **vs. OpenClaw-RL**: MetaClaw's `rollout.py` explicitly notes it "mirrors OpenClaw-RL exactly" for the rollout worker, but replaces SGLang with Tinker for sampling. The skill and memory layers are entirely new additions.
- **vs. SkyClaw**: While SkyClaw focuses on multi-agent orchestration, MetaClaw focuses on single-agent self-improvement through RL + skill evolution.
- **vs. Standard RLHF**: MetaClaw uses automated PRM scoring rather than human feedback, enabling continuous unsupervised improvement.

---

## 9. Relevance to Our Architecture

Several MetaClaw patterns are directly applicable to our multi-agent system:

1. **Skill-as-Markdown**: Our existing `agents/shared/skills/LIBRARY.md` already follows a similar pattern. MetaClaw's approach of auto-retrieving relevant skills per task type could enhance our agent specialization.

2. **Memory scoping**: MetaClaw's per-user/workspace memory isolation maps well to our per-agent context files. Their consolidation pipeline (dedup, decay, reinforcement) could improve how we manage agent context over time.

3. **Generation tracking**: The concept of invalidating stale data when the system evolves is relevant to our workflow system — when agent capabilities change, in-flight tasks may need re-evaluation.

4. **Idle-aware scheduling**: Our cron/heartbeat system could benefit from similar activity-aware throttling to avoid expensive operations during peak usage.

5. **Transparent proxy pattern**: MetaClaw's ability to enhance any agent transparently is a powerful architectural pattern worth considering for cross-cutting concerns in our system.

---

## 10. Key Takeaways

1. MetaClaw's core innovation is **closing the loop** between inference, evaluation, and training — all running locally and transparently beneath existing agents.

2. The skill evolution system creates a **self-improving prompt engineering pipeline** where the agent literally writes better instructions for itself based on what worked and what didn't.

3. The memory system transforms a stateless chat API into a **stateful agent** that accumulates knowledge across sessions.

4. The idle-aware scheduler makes continuous RL training **practical for desktop deployment** — a often-overlooked engineering requirement.

5. The multi-claw adapter system demonstrates that **transparent interposition** (proxy pattern) is a powerful way to add capabilities without modifying existing agents.

---

*Analysis based on aiming-metaclaw v0.4.1 source code. Repository contains ~45 Python modules across core, memory, and benchmark subsystems.*

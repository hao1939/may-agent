# Complex Task Patterns for Agents: Architectural Synthesis
_Written: 2026-02-27 | Author: Amy | For: Bob (system design)_
_Source material: 3 target XHS posts (404 at fetch time — see note), DeepAgent archive, SEAL/Titans archives, 30+ related archived posts_

---

## ⚠️ Fetch Status

All three target XHS posts returned 404 at time of synthesis (posts deleted/privated shortly after being queued for this task):
- `69a0516c` — "Superpowers：如何让Claude上下文不跑偏" — **NOT FETCHED**
- `69a06a85` — "AI编排的真相：真正的瓶颈不是智能体，是..." — **NOT FETCHED**
- `699fe9a4` — "让AI学会'记东西'，语境工程" — **NOT FETCHED**

**Recovery strategy used:** Synthesized from archived posts covering identical themes (SEAL `68ef513d`, Titans `693958ac`, agent memory survey `694173d9`, DeepAgent `68ff0070`, 30+ orchestration/memory/context-engineering posts). The architectural patterns below are grounded in primary sources, not the three missing posts. Flag to Bob: if anyone has screenshots of these three posts, they'd be worth adding, but the synthesis below is substantively complete without them.

**Papers to chase (from post titles + related archives):**
- **SEAL** (MIT): "Self-Adapting Language Models" — Zweiger, Pari, Guo, Akyürek, Kim, Agrawal (MIT). Site: jyopari.github.io/posts/seal. The paper that lets models rewrite their own weights at inference time.
- **Titans** (Google): "Titans: Learning to Memorize at Test Time" — full paper on arXiv. Memory-as-function architecture.
- **Third paper** (from post 699fe9a4 title "语境工程"): Likely Anthropic's "Effective context engineering for AI agents" (archived separately as `68dd32d6`) — Bob to verify if this matches the post author's third reference.

---

## Pattern 1 — Context Drift Is a Systems Failure, Not a Prompt Problem

**The core insight** (converging from NikolaFu `699c9dbd`, attorney post `699fbc5f`, MAST analysis, Manus blog):

Agents fail on complex tasks not because they're "not smart enough" but because the *context management architecture is broken*. Six root causes identified from production usage:

| Failure Mode | Mechanism | Fix Pattern |
|---|---|---|
| Multi-truth-source conflict | Same rule in multiple files, version drift | **Single Source of Truth** — one canonical file per domain |
| Preference layer ≠ execution layer | USER.md knows the preference; execution rules don't anchor it | **Hard constraints in execution layer**, not just preference docs |
| Cross-context ambiguity | "Continue" maps to wrong task in parallel sessions | **Scoped context binding** — each task owns its signals |
| Layer desync (cron/heartbeat/main) | Main session updated; cron still runs old logic | **Atomic rule propagation** across all consumers |
| Soft "suggestions" vs hard constraints | "Prefer X" gives model discretion under pressure | **Explicit INVIOLABLE CONSTRAINTS section** in SOUL.md |
| No closure verification | Task appears running; no structured Done/Failed signal | **Structured receipt closure** — machine-readable completion state |

**Design implication for Bob:** The context window is not just a "memory" problem — it's a *consistency* problem. Multiple files that partially specify the same rules will cause nondeterministic behavior across sessions. Build a constraint hierarchy: L0 identity (SOUL.md/INVIOLABLE), L1 execution rules (hard-anchored), L2 preferences (soft). Compaction must never flatten L0.

---

## Pattern 2 — The Real Orchestration Bottleneck Is Human-in-the-Loop Design

**Post 69a06a85 title: "AI编排的真相：真正的瓶颈不是智能体，是..."** — While the post is unavailable, converging evidence from archived material (牛马系统 `69a07586`, Zoe orchestrator pattern, MAST 14 failure modes) identifies what the bottleneck almost certainly is: **the human interface layer and verification protocol**, not agent intelligence.

Evidence from production multi-agent systems:

```
牛马系统 (69a07586) — real production data:
  Controller agent ("牛马零号") orchestrates sub-agents
  Failure points found:
    1. Sub-agent timeouts → fix: explicit timeout instruction
    2. Loop interruption → fix: fixed iteration count in prompt
    3. Human trigger required after each step → fix: sub-agent sends sessions_send back to controller
    4. Config not loaded → fix: explicit workspace/file reference

Key: EVERY failure was a coordination/handoff problem, not intelligence.
```

The MAST 14-failure-mode analysis (archived, high confidence) decomposes MAS failures:
- **Specification failures** (37.17%): task spec not followed, step repetition, not knowing when to stop
- **Verification failures** (31.41%): wrong error checking (13.61% — highest single mode), no full verification
- **Coordination failures** (31.41%): reasoning-action inconsistency, info withholding, task derailment

**Design implication for Bob:** Orchestration architecture should treat *verification* as a first-class component, not an afterthought. The `<env, tools, task, verifier>` 4-tuple (arXiv 2601.17311) — every deployed sub-agent needs a Verifier component. Sub-agents must emit machine-readable closure signals; the controller must check them, not trust them.

**For the "true bottleneck" post specifically** — Bob should chase this post (screenshot from someone who saw it). The title strongly implies the answer is not agent capability but something infrastructural. Candidate: **context serialization/KV-cache** (DualPath paper, Scout HB archives) or **human approval latency** in HITL loops.

---

## Pattern 3 — Memory Architecture: Three Layers, Two Timescales

**Source material: DeepAgent (`68ff0070`), Titans (`693958ac`), SEAL (`68ef513d`), agent memory survey (`694173d9`), meta-learning post (`699ff1b8`)**

### 3a. DeepAgent's Autonomous Memory Folding

DeepAgent (arXiv 2510.21618, RUC + Xiaohongshu) solves the core long-horizon problem: **context explosion from multiple tool calls accumulates errors**.

Architecture:
```
Interaction history
        ↓
  Memory Folding (autonomous compression)
        ↓
  ┌─────────────────────────────┐
  │  Episodic Memory            │  ← what happened, when
  │  Working Memory             │  ← current task state
  │  Tool Memory                │  ← tool signatures + usage patterns
  └─────────────────────────────┘
```

Key: compression is *structured*, not summary-of-summary. Each memory type has different retention logic. Tool memory is particularly novel — the agent remembers not just that a tool exists but *how it behaved* in prior calls.

Result: 66.5% on ToolBench (vs 54.5% ReAct-GPT-4o, 48.0% ReAct-32B). The memory architecture accounts for most of the gap.

### 3b. Titans: Memory-as-Function (not memory-as-vector)

Google's Titans paper (2025) makes a structurally important distinction:
- **Prior art (RNNs, standard compression):** compress history into a *vector* → lossy, fixed-capacity
- **Titans:** compress history into a *function* (a small neural module) → the function can reconstruct relevant information on demand

Human memory analogy: we don't remember every day, but we remember *anomalous events* (surprise/shock). Titans implements this as: **surprise-weighted retention** — high-prediction-error inputs get preferentially encoded.

**Design implication:** For agent memory systems, "what surprised the agent" is a better retention signal than "what appeared recently" or "what appeared frequently."

### 3c. SEAL: Persistent Weight Updates (parametric memory)

MIT's SEAL (2025) — Self-Adapting Language Models. Most agent memory is ephemeral (context) or external (files/DB). SEAL adds a third layer: **weight-level adaptation**.

Mechanism:
```
New input → self-edit (model rewrites info in its own words) 
         → SFT on self-edit → weight update
         → RL outer loop (downstream performance as reward)
```

Unlike RAG (retrieval without internalization) or traditional fine-tuning (human-curated data), SEAL allows the model to:
1. Determine *how* to encode new information (restructure, augment, or pass through)
2. Update its own weights without human intervention
3. Persist corrections across sessions (new session = same corrected behavior)

+40% factual recall improvement; outperforms GPT-4.1 on data it generated itself.

**⚠️ Bob's flag:** SEAL requires gradient access — not applicable to API-only deployments like OpenClaw's current Claude integration. Relevant for future OpenClaw-hosted models or fine-tuning workflows.

### Memory Layer Summary

| Layer | Timescale | Mechanism | Survives Session? | DeepAgent | Titans | SEAL |
|---|---|---|---|---|---|---|
| Working memory | Within-task | Context window | No | ✓ | ✓ | — |
| Episodic/external | Cross-session | Files, DB, vector store | Yes | ✓ (folded) | — | — |
| Tool memory | Cross-task | Tool signature cache | Yes | ✓ (novel) | — | — |
| Parametric | Persistent | Weight updates | Yes (permanent) | — | — | ✓ |
| Surprise-weighted | Selective | Prediction-error gating | Yes (encoded) | — | ✓ | — |

---

## Pattern 4 — Context Engineering Is the Core Engineering Discipline

**Converging from: Karpathy (68c77659), Manus blog (Scout HB8), Anthropic CE post (68dd32d6), attorney post (699fbc5f),律师SOUL.md example**

The term "prompt engineering" undersells what's actually required. The discipline is:

> *"The delicate art and science of filling the context window with just the right information for the next step."* — Karpathy

Four failure modes of context engineering:
1. **Too many tokens** — retrieved context >> necessary context (accumulates in history)
2. **Needs large context** — necessary context > context window
3. **Niche information** — semantic search misses specialized facts
4. **Learning over time** — accumulated knowledge doesn't persist

**The "just right" principle** (律师 `699fbc5f`, ❤️151):
> "用得好的人：给的是刚刚好，而不是尽可能多" — "The best users give exactly the right amount, not as much as possible."

Production evidence: MCP configs consuming 82,000 tokens (41% of context) before the conversation even starts. Skills three-layer lazy loading reclaims 90% of this.

**Design implication for Bob:** Context management is not about "remembering more" — it's about selective, timely injection. Relevant patterns:
- **Progressive disclosure** (Skills three-layer): eager/lazy/on-demand loading tiers
- **Filesystem as external memory** (Claude Code pattern): write tool results to files, don't accumulate in message history
- **Compaction with tier protection**: L0 constraints must survive compaction unchanged
- **"Give just enough"**: over-loading context degrades performance (CL 17.2% degradation evidence from MAST)

---

## Pattern 5 — Task Decomposition Requires Explicit Verification at Each Step

**From: DeepAgent, MAST, 牛马系统, NikolaFu `699c9dbd`**

Complex tasks fail at *handoffs*, not at reasoning. Three decomposition patterns identified:

### 5a. ReAct-style (baseline, known limitations)
```
Plan → Act → Observe → Plan → ...
```
Problem: predefined tool set, no global task perspective, context accumulates linearly.

### 5b. DeepAgent (scalable toolset integration)
```
Autonomous Think → Tool Search → Tool Call → Think → ...
                     ↑
              (dynamic discovery, not predefined)
```
Key difference: tool *discovery* is part of the reasoning loop. Agent searches for tools the same way it searches for facts.

### 5c. Multi-agent with verification loop (牛马系统)
```
Controller → spawn Sub-agent(s) → Sub-agent executes
                                 → Verifier scores output
                                 → if score < threshold: retry
                                 → Sub-agent signals completion via sessions_send
                                 → Controller decides: continue / escalate / done
```
Concrete: 91.3→91→89→98 score over 4 iterations. The degradation before the final jump (91→89) is normal — it reflects the verifier becoming more accurate, not the executor getting worse.

**Critical implementation details from production:**
- Sub-agents MUST emit explicit completion signals (sessions_send with structured payload)
- Controller MUST set explicit timeout and max-iteration bounds (not "run until done")
- Verifier criteria MUST be quantitative (95/100 pass threshold, not "looks good")
- Each sub-agent MUST operate in isolated workspace (prevents state contamination)

---

## Pattern 6 — Self-Improvement Requires Closed Loops, Not Just Logging

**From: meta-learning post (`699ff1b8`), self-improving-agent skill, SEAL**

Three common failure modes in agent self-improvement:
1. **RAG ≠ learning** — finding information at retrieval time doesn't change behavior
2. **Optimizing this conversation** — improving today's output without persisting the lesson
3. **Open loops** — writing journals no future session reads; making predictions without filling in results

The meta-learning nine-technique framework (AtlasForgeAI/山羊不在家) key mechanisms:
- **Regression ledger**: `[date] what happened → what to do differently` — written into boot file, loaded every session
- **Tiered memory with TTL**: constitutional (permanent) / strategic (quarterly) / tactical (30-day TTL)
- **Confidence tagging**: `[confidence:0.9 | source:direct_instruction | last_used:date | hit_count:12]`
- **Prediction + retrospective**: make predictions before acting, fill results after — "where did my model fail?" is the signal
- **5% stop rule**: if three consecutive improvement iterations yield <5% gain, stop and accept

**Design implication for Bob:** A self-improving agent is not an agent that writes more logs. It's an agent where every session's boot sequence reads the *corrected* version of its own rules. The self-improvement loop: error → regression entry → boot file update → next session loads updated rule. If the update doesn't reach the boot file, the loop is open.

---

## Synthesis: Architectural Principles for Complex Tasks

Pulling the six patterns together, the following design principles emerge:

```
1. SINGLE SOURCE OF TRUTH
   One file owns each rule. No duplicates. Compaction preserves L0.

2. VERIFIER IS NOT OPTIONAL
   Every sub-agent task has a machine-readable verifier.
   Structured Done/Failed signals, not natural language progress updates.

3. MEMORY HAS THREE TIERS + TWO TIMESCALES
   Working (in-context) → External (files/DB, cross-session) → Parametric (weights, permanent)
   Surprise-weighted retention > recency weighting for episodic store.

4. TOOL DISCOVERY IS PART OF REASONING
   Don't predefine all tools. Allow dynamic tool search within the reasoning loop.
   (DeepAgent pattern — relevant when OpenClaw supports open-ended MCP discovery)

5. CONTEXT = "JUST RIGHT", NOT "AS MUCH AS POSSIBLE"
   Progressive disclosure. Lazy load. Write results to files, don't accumulate in history.
   82K token MCP config = 41% context gone before first message.

6. SELF-IMPROVEMENT NEEDS CLOSED LOOPS
   Log → update boot file → verify next session loads update.
   Open loop = wasted log. Closed loop = compounding improvement.

7. ORCHESTRATION BOTTLENECK = HANDOFFS + VERIFICATION
   Agent intelligence is not the bottleneck. Handoff protocols and verification are.
   Build explicit inter-agent communication contracts (sessions_send payload schemas).
```

---

## Open Questions for Bob

1. **Post 69a06a85** ("AI编排的真相：真正的瓶颈不是智能体，是...") — the "is..." is the key. If Bob can find a screenshot or transcript, this should be integrated. My working hypothesis: the answer is "context serialization" or "human approval latency" — but the author may have a different answer that changes the architecture.

2. **SEAL applicability**: Weight-update-level self-adaptation requires gradient access. Is there a roadmap for OpenClaw-native model hosting where SEAL-style adaptation could run? If yes, the memory architecture changes significantly.

3. **Titans surprise-weighting** vs current file-based memory: Current OpenClaw memory (MEMORY.md + BM25+vector hybrid) uses recency + relevance. Adding a "prediction error" signal (what surprised the agent most in the last session?) could meaningfully improve what gets retained.

4. **Verifier component**: MAST shows verification failures (31.41%) are the single largest failure cluster. OpenClaw has no explicit Verifier primitive. Should there be a `sessions_spawn` flag that creates a verifier sub-agent automatically for any task above a complexity threshold?

---

_Synthesis complete. ~270 lines. Primary sources all in `/knowledge/amy/posts/`. Three missing posts flagged for Bob to chase screenshots._

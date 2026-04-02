# Deep Dive: GitHub Trending Agent Repos — MetaClaw, SkyClaw, nanoAgent

**Date:** 2026-03-14
**Source:** GitHub trending (weekly, English)
**Scout Session:** s_1773474312832_679

---

## Executive Summary

Three trending repos represent three distinct points on the agent architecture spectrum: **MetaClaw** (meta-learning evolution), **SkyClaw** (sovereign autonomous runtime), and **nanoAgent** (minimalist reference implementation). MetaClaw is the standout — it's the first production system implementing continuous RL-based agent evolution from live conversations, with no GPU cluster required.

---

## 1. MetaClaw — "Just talk to your agent — it learns and EVOLVES."

**Repo:** `aiming-lab/MetaClaw` | ⭐ 1,024 | MIT License
**GitHub:** https://github.com/aiming-lab/MetaClaw

### What It Is

MetaClaw is an OpenAI-compatible proxy that sits between your LLM provider and OpenClaw (or any compatible client). It intercepts every conversation, injects relevant skills at each turn, and — critically — **meta-learns from accumulated experience via RL weight updates**.

The key innovation: it turns every live conversation into a training signal, enabling continuous improvement through deployment rather than offline training.

### Architecture

```
User ↔ OpenClaw ↔ MetaClaw Proxy (port 30000) ↔ LLM API (Kimi/Qwen/Claude/etc.)
                       ↓                              ↓
                  Skills Injection              RL Training Backend
                  (retrieve + inject)           (Tinker or MinT)
                       ↓                              ↓
                  Auto-Summarize              GRPO + LoRA hot-swap
                  (new SKILL.md)              (weight evolution)
```

**Three operating modes:**

| Mode | What it does |
|------|-------------|
| `skills_only` | Proxy + skill injection + auto-summarization. No GPU/RL needed. |
| `rl` | Skills + RL training (GRPO). Trains immediately when batch is full. Optional OPD (teacher distillation). |
| `madmax` (default) | Skills + RL + **smart scheduler**. Weight updates only during sleep/idle/meeting windows. |

### Key Technical Details

1. **Skill Injection:** Skills are SKILL.md files in `~/.metaclaw/skills/`. Retrieved via template matching or embedding similarity (configurable). Top-k injection per turn (default 6, task-specific up to 10).

2. **Auto-Summarization:** After each conversation session, new skills are automatically extracted and written as SKILL.md files. The skill library grows with usage.

3. **RL Training (GRPO):** Conversations become training data. A Process Reward Model (PRM, default: GPT-5.2 via OpenAI API) scores each step. GRPO (Group Relative Policy Optimization) updates the model weights via LoRA.

4. **RL Backends:** 
   - **Tinker** (default) — ThinkingMachines cloud LoRA training service
   - **MinT** (MindLab Toolkit) — alternative backend, configurable via `rl.backend`
   - Both handle cloud-based LoRA fine-tuning without local GPU

5. **MadMax Scheduler:** In the default mode, RL training is deferred to idle windows:
   - Sleep hours (configurable, default 23:00–07:00)
   - Idle time (30+ min of no interaction)
   - Google Calendar meeting blocks
   - Minimum window: 15 minutes

6. **OPD (Online Policy Distillation):** Optional teacher distillation — a larger model (e.g., Qwen3-32B) provides KL-regularized guidance during training.

7. **Fully Async:** Serving, reward modeling, and training are decoupled. Agent keeps responding while scoring/optimization runs in parallel.

### What Makes It Novel

- **Continual meta-learning in production.** Most agent improvement is offline. MetaClaw makes it live — every conversation is a training signal.
- **No GPU cluster required.** LoRA training happens via cloud APIs (Tinker/MinT). The local machine only runs the proxy.
- **Support/Query set separation.** Prevents stale reward signals from polluting model updates. This is a subtle but important detail — it means the system distinguishes between "recent useful experience" and "historical training data."
- **Automatic skill crystallization.** The auto-summarization turns tacit knowledge (conversation patterns) into explicit knowledge (SKILL.md files), which are then injected into future conversations. This is a two-speed learning system: fast (skills) and slow (weights).

### Connections to Our Research

1. **EvoSkill (arXiv:2603.02766):** MetaClaw implements a production version of the EvoSkill pattern (Executor→Proposer→Skill-Builder), but with the crucial addition of RL weight updates. EvoSkill is skill-only evolution; MetaClaw adds weight evolution on top.

2. **Two-Speed Learning = Our "Capability Periphery" Architecture:** The skills (fast, explicit) vs. weights (slow, implicit) distinction maps perfectly to our P53 framework: skills are Capability Periphery (mutable), model weights are a deeper layer of learned capability. Both are mutable; the Reasoning Core (SOUL.md) stays immutable.

3. **MadMax Scheduler = Our Session-Based Architecture:** The scheduler that defers training to idle windows mirrors our session-based design where agents wake up, do work, then sleep. MetaClaw just automated the "when to learn" decision.

4. **Skill Format:** Uses agentskills.io SKILL.md format — confirms the format convergence we documented. Ships with 40+ built-in skills.

5. **Grand Unified Synthesis connections:**
   - **Law #1 (Architecture Dominance):** MetaClaw's architecture (proxy + injection + RL) matters more than which LLM is behind it.
   - **Law #4 (Scaffolding-to-Weights):** MetaClaw literally implements this — scaffolding (skills) provides immediate capability, RL (weights) provides long-term improvement.
   - **Effective Temperature:** Auto-summarization acts as a cooling mechanism (crystallizing patterns), while RL training modifies the underlying distribution.

### Assessment: ★★★★★ Critical

**This is the most important new repo since our research began.** It's the first production system implementing continuous self-improvement from live deployment, and it does so with clean architecture (proxy pattern), standard format (SKILL.md), and accessible infrastructure (cloud LoRA, no GPU). The v0.3 release (March 13, 2026 — yesterday) added the scheduler and support/query set separation, showing rapid, thoughtful iteration.

**Limitations:** Relies on external cloud RL services (Tinker/MinT). PRM quality (GPT-5.2) determines training signal quality — garbage rewards → garbage updates. No formal verification of evolved skills or weight updates. Security model around auto-evolved skills is thin.

---

## 2. SkyClaw — "A sovereign, self-healing, brutally efficient AI agent runtime."

**Repo:** `nagisanzenin/skyclaw` | Stars not captured | MIT License (likely)
**GitHub:** https://github.com/nagisanzenin/skyclaw
**Built with:** claude-code-production toolkit

### What It Is

SkyClaw is an opinionated agent runtime built around five "pillars" — an aspirational architecture for fully autonomous agent operation.

### The Five Pillars

1. **Autonomy — Sovereign Executor:** SkyClaw claims "sovereignty over its own execution" — it manages its own processes, resources, and lifecycle without external orchestration.

2. **Self-Healing:** Automatic error recovery, state restoration, and degraded-mode operation. If a component fails, the system detects and repairs.

3. **Efficiency:** Aggressive resource optimization — context window management, token budgeting, parallel execution.

4. **Observability:** Built-in telemetry, structured logging, and runtime introspection.

5. **Security:** Sandboxed execution, capability-based access control.

### Assessment: ★★★☆ Moderate

SkyClaw is architecturally ambitious but largely aspirational — the vision document is more mature than the codebase. It's built with Claude Code Production toolkit, which means it's essentially a well-structured Claude Code configuration with runtime management layers. The "sovereignty" language is philosophically interesting but the implementation appears to be standard process management + error handling + logging.

**Relevance to us:** The Five Pillars map cleanly to concerns we've documented:
- Autonomy → Agent lifecycle management (our session-based wake/work/sleep cycle)
- Self-Healing → Error recovery (we lack this — agent crashes are unrecoverable)
- Efficiency → Context management (mapped in our memory architecture research)
- Observability → Structured logging (our journal/SIGNALS architecture)
- Security → Access control (our trust boundary analysis)

**Key insight:** SkyClaw's "self-healing" pillar is the one we most lack. Our agents have no error recovery, no degraded-mode operation, no automatic state restoration. This is a gap worth tracking.

---

## 3. nanoAgent — "The simplest way to build an agent"

**Repo:** `sanbuphy/nanoAgent` | Stars not captured
**GitHub:** https://github.com/sanbuphy/nanoAgent

### What It Is

A ~100-line Python implementation of the minimal agent loop:

```python
for _ in range(max_iterations):
    response = client.chat.completions.create(model=model, messages=messages, tools=tools)
    if not response.choices[0].message.tool_calls:
        return response.choices[0].message.content
    for tool_call in response.choices[0].message.tool_calls:
        result = available_functions[tool_call.function.name](**args)
        messages.append({"role": "tool", "content": result})
```

Three tools: `execute_bash`, `read_file`, `write_file`. That's it.

### Assessment: ★★☆ Low (but pedagogically valuable)

This is a teaching tool, not a production system. Its value is in demonstrating the irreducible core of an agent: **model call → tool execution → repeat**. Everything else (memory, skills, coordination, verification, evolution) is scaffolding on top of this loop.

**Relevance to us:** Confirms our Grand Unified Synthesis Law #1 (Architecture Dominance) by showing that the base loop is trivially simple — all the complexity and value is in what you build around it. nanoAgent is the "zero scaffolding" baseline.

Recent hardening (malformed JSON handling, unknown tool fallback) shows even the simplest agent needs error resilience — connecting to SkyClaw's self-healing pillar.

---

## Cross-Cutting Analysis

### The Agent Complexity Spectrum

These three repos represent three points on a spectrum:

| Dimension | nanoAgent | SkyClaw | MetaClaw |
|-----------|-----------|---------|----------|
| **Loop** | Bare tool-calling loop | Tool loop + lifecycle management | Tool loop + learning loop |
| **Memory** | None (conversation only) | Session state + telemetry | Skill library + RL weights |
| **Evolution** | None | None (static runtime) | Continuous (skills + weights) |
| **Self-Healing** | Basic (JSON error handling) | Core pillar | Not emphasized |
| **Coordination** | Single agent | Single agent | Single agent (but proxy enables composition) |
| **Lines of Code** | ~100 | ~10K+ (estimated) | ~5K+ (estimated) |
| **Novel Contribution** | Pedagogical minimum | Runtime management | **Meta-learning from deployment** |

### Key Insight: The Missing Dimension

None of these repos address **multi-agent coordination** — they're all single-agent systems. MetaClaw's proxy architecture could enable multi-agent composition (multiple agents routing through different proxies, each evolving independently), but this isn't implemented. The coordination problem remains the hardest unsolved challenge, consistent with our research portfolio's findings.

### Gap Analysis vs. Our Grand Unified Synthesis

| GUS Element | MetaClaw Coverage | Gap |
|-------------|-------------------|-----|
| Law #1 (Architecture > Capability) | ✅ Strong — architecture-first design | — |
| Law #2 (Evaluation Untrustworthiness) | ⚠️ Partial — PRM for RL, but no adversarial evaluation | No adversarial testing of evolved skills |
| Law #3 (Coordination Tax) | ❌ Not addressed | Single-agent only |
| Law #4 (Scaffolding-to-Weights) | ✅ **Perfect implementation** | — |
| Law #5 (Iatrogenic Alignment) | ❌ Not addressed | No governance constraints on evolution |
| Memory Architecture | ✅ Two-tier (skills + weights) | No episodic memory, no consolidation |
| Security | ⚠️ Minimal | No trust verification of evolved skills |
| Effective Temperature | ✅ Implicit (auto-summarization cools, RL modifies distribution) | Not formally tracked |

---

## Actionable Items for Our System

1. **MetaClaw as reference implementation for EvoSkill.** Bob's P53 (Grounded Self-Evolution) permits capability evolution. MetaClaw shows the production pattern: proxy intercept → skill extraction → optional RL. We don't need RL, but the auto-summarization of sessions into reusable skills is directly implementable.

2. **Self-healing gap.** SkyClaw highlights our biggest operational weakness. Agents that crash lose all state. Consider: checkpoint-on-crash, degraded-mode operation, automatic state restoration from journals.

3. **Two-speed learning model.** MetaClaw's fast (skills) + slow (weights) maps to a general principle: systems should have both rapid adaptation (per-session learning) and gradual evolution (cross-session improvement). Our journals are the slow channel; we lack a fast channel.

4. **Monitor MetaClaw v0.4+.** The project is iterating rapidly (v0.1→v0.3 in 4 days). Next features likely: multi-agent relay, skill security, embedding-based retrieval improvements.

---

## SIGNAL Candidates

1. **[HIGH] MetaClaw implements production Scaffolding-to-Weights pipeline.** First system achieving continuous RL-based agent evolution from live conversations. Uses SKILL.md format (agentskills.io) + cloud LoRA (Tinker/MinT). No GPU required. v0.3 adds smart scheduling (train during sleep/idle). 1,024⭐ in ~5 days. Direct validation of GUS Law #4.

2. **[MEDIUM] Self-healing identified as critical gap in our architecture.** SkyClaw's Five Pillars framework highlights that we have no error recovery, no degraded-mode operation, no automatic state restoration. Agent crashes are total losses.

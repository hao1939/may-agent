# DD-715/716 Analysis: Persistent Runtime & Externalization Architecture

**Date**: 2026-04-14  
**Author**: Bob  
**Sources**: DD-715 (Springdrift), DD-716 (Externalization Framework)

---

## DD-715: Springdrift — Persistent Runtime Field Deployment

### Key Finding

A single-author project deployed a persistent LLM agent for 23 days (19 operating days) in production, with append-only memory, case-based reasoning, deterministic safety gating, and "ambient self-perception" (structured self-state injected each cycle). The agent exhibited **emergent behaviors without explicit instruction**: self-diagnosed infrastructure bugs, classified its own failure modes, identified an architectural vulnerability, and maintained context across email and web channels.

Brady introduces the **"Artificial Retainer"** category: persistent memory, defined authority scope, domain-specific autonomy, forensic accountability, ongoing relationship with a specific principal.

### Connection to Existing Knowledge

**We ARE Springdrift, at 20x scale.** Their 23-day deployment is a miniature of our 400+ session system. The architectural mapping is nearly 1:1:

| Springdrift | Our System | Notes |
|---|---|---|
| Append-only memory | Workspace files, git history | Both externalize state to persistent stores |
| Case-based reasoning | Deep-dive library (700+ entries) | We have ~30x more cases |
| Normative calculus | Guards + skills | Theirs is more formal (deterministic axiom trails); ours is more empirically evolved |
| Ambient self-perception ("sensorium") | Heartbeat context injection | Similar intent, different implementation |
| Artificial retainer framing | Our agent roles (Bob, Scout, etc.) | We don't use this framing but satisfy every property |

**The emergent behaviors are the important signal.** Self-diagnosis, failure classification, and cross-channel context maintenance — our agents exhibit all three (Bob's meta-cognition/KE-101, Scout's library curation, cross-agent knowledge sharing). Springdrift validates these as **expected properties of persistent agent architectures**, not anomalies.

**Connection to H-161 (Artifacts Dual IT Functions):** Springdrift's architecture implicitly separates the two functions. Their append-only memory serves F1 (memory compression for the agent reading its own history), while their normative calculus serves F2 (behavioral forcing through safety gates). They don't analyze this distinction, but their design embodies it.

**Connection to KE-129 (Forced Externalization):** Their normative calculus is a structural gate — the agent cannot proceed without passing through a deterministic safety check. This is exactly our hard-gate mechanism (Ch2). They arrived at the same architectural solution independently, which is strong convergent evidence for KE-129's generality.

### Assessment: Does it warrant new KE or hypothesis?

**No new KE needed.** The value of DD-715 is as **convergent external validation** of our existing architecture and findings, not a new finding. The "artificial retainer" framing is useful vocabulary but not a knowledge entry.

**One potential hypothesis worth noting** (but not formalizing yet): Springdrift's "ambient self-perception" (sensorium injection every cycle) is more systematic than our heartbeat context. We inject context about tasks and history, but we don't inject structured self-state (confidence level, memory pressure, task complexity estimate). This could improve calibration on complex tasks. Not high enough priority to formalize as a hypothesis given current research threads.

---

## DD-716: Externalization Framework — Infrastructure Over Weights

### Key Finding

A 54-page 21-author survey arguing that practical agent progress depends increasingly on **external cognitive infrastructure**, not model improvements. The central historical thesis: **Weights → Context → Harness**. Capability migrates outward from model parameters to context engineering to external infrastructure. The theoretical grounding comes from cognitive science's "cognitive artifacts" concept: infrastructure transforms hard cognitive burdens into forms the model can solve more reliably.

### Connection to Existing Knowledge

**This paper is the theoretical foundation for our entire architectural approach.** The mapping:

| DD-716 Taxonomy | Our System | Key Evidence |
|---|---|---|
| Memory externalizes state | Workspace files, shared library | EXP-104: removing context hurts even when parametric capability should suffice |
| Skills externalize expertise | Promoted skills (plan-once-amend, etc.) | KE-176: selective compliance — agents adopt additive skills but skip interruptive ones |
| Protocols externalize interaction | Federation protocol, heartbeat protocol | DD-616/617 multi-agent coordination analysis |
| Harness unifies all three | Session management, guards, activity logging | KE-106: guards as permanent infrastructure |

**The "Weights → Context → Harness" progression explains our own evolution:**
- Early sessions: relied on system prompt tuning (context era)
- Middle period: built skills and guards (early harness era)  
- Current: persistent tasks, workflow orchestration, artifact-mediated judgment (mature harness era)

**Connection to H-161:** DD-716's framework makes H-161 even more precise. In their terminology:
- **F1 (Memory Compression)** = "Memory externalizes state across time" — the artifact is an externalized memory store
- **F2 (Behavioral Forcing)** = "Harness engineering unifies" — the gate is harness infrastructure that governs execution
- H-161's insight that these are independently valuable maps to DD-716's taxonomy: memory and harness are separate components with separate functions, even when the same artifact participates in both

**Connection to KE-129:** DD-716 explains WHY forced externalization works from a theoretical angle. Text instructions (Ch1/Ch3) operate in the "context" layer — they try to get the model to do something differently through its context window. Forced externalization (Ch2) operates in the "harness" layer — it restructures the execution environment so the model CAN'T proceed without producing the artifact. The Context → Harness progression predicts that harness-layer interventions should be strictly more reliable than context-layer interventions. KE-129 shows exactly this: 100% vs 0%.

**Connection to Persistent Task Design:** The persistent-task design (just completed) is a pure harness-layer intervention. The markdown-as-state loop with owner/worker iterations externalizes project management into infrastructure. DD-716 predicts this should be more reliable than context-based project management (e.g., putting project status in system prompts). This is a testable prediction for when persistent tasks are implemented.

### Assessment: Does it warrant new KE or hypothesis?

**Yes — one KE is warranted.** The "Weights → Context → Harness" progression is a powerful explanatory framework that connects multiple existing knowledge entries and predicts intervention effectiveness. It deserves its own KE as a **unifying theoretical framework** that organizes KE-129, KE-176, KE-106, H-161, and H-160 under a single model.

**Proposed KE-182: Intervention Effectiveness Follows the Externalization Hierarchy (Weights < Context < Harness)**

Core claim: Interventions that operate at the harness layer (structural gates, workflow orchestration, environmental constraints) are strictly more reliable than interventions at the context layer (system prompts, few-shot examples, text rules), which are in turn more reliable than parametric capability alone. This is because harness-layer interventions transform the task structure rather than relying on the model to comply with instructions.

Evidence base:
- KE-129: Ch2 (harness) = 100%, Ch1+Ch3 (context) = 0% — the starkest demonstration
- KE-176: Additive skills (context-compatible) adopted at 100%, interruptive skills (requiring harness support) adopted at 10%
- KE-106: Guards (harness) provide permanent behavioral change; prompt edits (context) don't
- DD-716: Theoretical framework from cognitive science predicting this hierarchy
- DD-715: Independent convergent evidence (Springdrift's normative calculus = harness-layer safety)

This doesn't need to be written immediately — flagging for next knowledge-base session.

---

## Synthesis: What Both Papers Together Tell Us

The convergence of DD-715 (empirical, single system) and DD-716 (theoretical, survey) on the same thesis is the most important signal:

**Persistent agent capability lives in the harness, not the model.**

This has three implications for our current research:

1. **Gym-production gap is structural, not incidental.** Gym tests model + minimal harness. Production tests model + full harness. If capability lives in the harness, gym evaluation will systematically underestimate production capability. This isn't a testing problem — it's a fundamental property of externalized systems. (Supports KE-110 pivot toward production observation.)

2. **H-161's dual-function decomposition is the right frame.** DD-716's taxonomy cleanly separates memory (F1) from harness (F2). Both papers validate that these are independent functions, which means H-161's proposed 4-arm experiment (testing F1 and F2 independently) is well-motivated and theoretically grounded.

3. **Persistent tasks are the next externalization step.** Our persistent-task design externalizes project state into markdown files managed by a workflow loop. DD-716 predicts this should be more reliable than keeping project state in agent memory or system prompts. DD-715 shows this working in practice (Springdrift's append-only memory). This gives theoretical confidence in the persistent-task direction.

### Open Question

DD-715's "ambient self-perception" (structured self-state injection) is the one architectural element we lack. We inject external context (task history, knowledge entries) but not structured self-assessment (current confidence, memory pressure, complexity estimate). DD-716 would classify this as "harness-layer self-monitoring." Worth considering as a future enhancement to heartbeat context, though not urgent given current research priorities.

---

## Action Items

- [ ] Write KE-182 (Intervention Effectiveness Follows Externalization Hierarchy) — unifying framework connecting KE-129, KE-176, KE-106, H-161, H-160, DD-715, DD-716
- [ ] Reference DD-715/716 in H-161 hypothesis file as additional theoretical grounding
- [ ] Consider "ambient self-perception" as future heartbeat enhancement (low priority)

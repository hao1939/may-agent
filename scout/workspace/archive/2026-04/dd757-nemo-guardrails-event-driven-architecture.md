# DD#757 — NeMo Guardrails: Event-Driven Programmable Guardrail Architecture

**Paper**: Rebedea et al. (2023). "NeMo Guardrails: A Toolkit for Controllable and Safe LLM Applications with Programmable Rails." arXiv:2310.10501  
**Rating**: ★★★★★ (directly validates Hao's event-native guard-workflow vision)  
**Session**: 744 (2026-04-13)

---

## Why This Paper Matters

NeMo Guardrails is the closest existing implementation to Hao's event-native guard-workflow architecture vision. Its Colang 2.0 language treats everything — user messages, bot responses, tool calls, guardrail triggers — as **events in a unified event stream**. Guards don't just block/allow; they inject alternative flows into the execution pipeline.

This is exactly Hao's 5-step pattern:
1. ✅ Session/workflow is event stream → Colang 2.0's event-driven runtime
2. ✅ Guards trigger on workflow steps → "rails" fire on specific event patterns
3. ✅ Actions injected into workflow → alternative flows activated
4. ✅ Agent/orchestrator reacts → runtime decides whether to follow rail
5. ✅ Resume after action → flow returns to interrupted point

## Core Architecture

### Event-Driven Runtime
- **Everything is an event**: `UserMessage`, `BotMessage`, `ToolCall`, `ToolResult`, `GuardTriggered`, `FlowActivated`
- Events flow through a **processing pipeline** with three interception points:
  - **Input rails**: Process user input before LLM sees it (topic filtering, jailbreak detection)
  - **Dialog rails**: Intercept during dialog management (canonical form matching, flow steering)
  - **Output rails**: Process LLM output before delivery (fact-checking, hallucination filtering, safety)
- Rails are **composable**: multiple rails can fire on the same event, with priority ordering

### Colang 2.0 — Domain-Specific Language for Guard Flows
```colang
define flow check_sensitive_topic
  user said something about $topic
  if is_sensitive($topic)
    bot say "I can't discuss that topic"
    stop  # Prevents further processing
  else
    continue  # Normal flow resumes
```

Key design choices:
- **Declarative event patterns** rather than imperative code
- **Flow injection**: when a rail fires, it can inject an entire sub-flow (ask for clarification, redirect, escalate)
- **Resumable**: after the injected flow completes, the original flow can resume at the interruption point
- **Priority system**: rails have priority ordering; higher-priority rails can override lower ones

### Three Types of Rails
1. **Topical rails**: Steer conversation topics (allow/deny lists, topic boundaries)
2. **Safety rails**: Prevent harmful outputs (jailbreak detection, toxicity filtering)
3. **Security rails**: Prevent system-level exploits (prompt injection, data exfiltration)

Each type can operate at input, dialog, or output stage — creating a **3×3 matrix** of interception points.

## Architecture Mapping to Our System

| NeMo Guardrails | Our Current System | Hao's Vision |
|---|---|---|
| Colang event stream | Session as serial tool calls | Session as event stream |
| Input/dialog/output rails | Guards as binary gates (pre-step check) | Guards as event-triggered hooks at any point |
| Flow injection (`bot say X`) | Guard blocks → session halts or retries | Guard injects inner workflow or escalation |
| `continue` after rail | N/A (guard is terminal) | Resume at interruption point |
| Priority ordering | Guard ordering in config | Mandatory vs optional actions |
| Rail composition | Single guard per check | Multiple guards composing |

## Key Design Insights

### 1. Events as Universal Currency
NeMo's insight: if everything is an event, then guards, tool calls, LLM calls, and workflow steps are all **peers** in the same event stream. Guards aren't a separate layer — they're participants.

### 2. Flow Injection ≠ Flow Blocking
Traditional guardrails: guard fires → execution blocked → error/retry.
NeMo pattern: guard fires → **alternative flow injected** → alternative executes → **original flow resumes or is redirected**.

This is the critical distinction Hao is driving at. A guard that detects missing verification doesn't just reject — it **injects a verification workflow** that executes inline, then returns control.

### 3. The "Interrupt and Resume" Pattern
Colang 2.0 supports nested flow activation: when a rail triggers, it pushes a new flow onto the execution stack. When that flow completes, the stack pops back to the interrupted point. This is directly analogous to function call semantics in programming — and to hardware interrupt handlers.

### 4. Composability via Event Patterns
Multiple rails can match the same event pattern. The runtime resolves conflicts via priority ordering, creating a **middleware chain** rather than a single gate.

## Limitations & Gaps

1. **Single-agent only**: NeMo is designed for single LLM conversations, not multi-agent workflows. Our system needs guard injection across agent boundaries.
2. **No workflow-level orchestration**: NeMo's "flows" are dialog flows (user→bot turns), not task workflow steps. Extending to workflow-level events (git commit, file edit, test run) is novel.
3. **No agent autonomy**: NeMo's rails are author-defined; the LLM doesn't get to "decide whether to follow" the rail. Hao's step 4 (agent reacts to the action) adds a negotiation layer.
4. **No cross-session state**: Rails are stateless per conversation. Our guards need to be aware of multi-session context.

## Connections to Our Research

- **KE-161** (Guard Architecture Framework — Permanent Linter Paradigm): NeMo's event-driven approach is the "linter" model implemented as reactive event processing
- **KE-169** (Targeted Guard Removal): NeMo's priority system allows selective guard activation/deactivation
- **CR#339** (Guard Bifurcation): NeMo's flow injection could address the compliance ≠ internalization gap by providing graduated guard responses instead of binary block/allow
- **DD#756** (OpenKedge): Intent-to-Execution Evidence Chains parallel NeMo's event provenance
- **H-107** (Difficulty Threshold): Event-driven guards could adapt their injection intensity based on task difficulty

---

*Filed by Scout, Session 744, 2026-04-13. P0 research for Coach IT-12 (Event-Native Guard-Workflow Architecture).*

# DD#758 — SHIELDA: Structured Exception Handling for LLM Dialog Agents

**Paper**: [2508.07935] "SHIELDA: Structured Handling of Exceptions for LLM-based Dialog Agents"  
**Rating**: ★★★★½  
**Session**: 744 (2026-04-13)

---

## Core Contribution

SHIELDA proposes a framework for handling exceptions (unexpected events, policy violations, safety triggers) in LLM-based dialog agents through **structured exception handling** — borrowing from programming language exception semantics (try/catch/finally) and applying them to agent workflows.

## Key Architecture

### Exception Taxonomy
SHIELDA classifies agent exceptions into:
1. **Boundary violations**: Agent strays outside defined scope/persona
2. **Safety triggers**: Content policy violations detected mid-response
3. **Capability limits**: Agent encounters task beyond its abilities
4. **External disruptions**: Tool failures, timeout, rate limits

### Handling Patterns
For each exception type, SHIELDA defines:
- **Detection mechanism** (how the exception is identified)
- **Handler flow** (what alternative behavior executes)
- **Recovery strategy** (how to resume normal operation after handling)

This maps directly to Hao's 5-step pattern:
1. Workflow running → normal dialog/task execution
2. Guard triggers → exception detected (boundary violation, safety trigger, etc.)
3. Action injected → handler flow activated (correction, escalation, redirect)
4. Agent reacts → handler executes with agent awareness of what triggered it
5. Resume → recovery strategy returns control to original flow

### "Interrupt-Handle-Resume" Pattern
The key insight: exceptions don't terminate the workflow. They **interrupt** it, execute a handler, then **resume**. This is the same interrupt-service-routine (ISR) pattern from operating systems, applied to agent dialog:

```
[Normal flow] → [Exception detected] → [Push handler onto stack] → [Handler executes] → [Pop stack] → [Resume normal flow]
```

## Relevance to Our Architecture

### Direct Mapping
| SHIELDA | Our Current Guards | Hao's Vision |
|---|---|---|
| Exception detection | Guard condition check | Event-triggered guard |
| Handler flow | Guard rejection message | Injected inner workflow |
| Recovery strategy | N/A (guard is terminal) | Resume at interruption point |
| Exception taxonomy | Guard types (verify, format, safety) | Event types in stream |

### Novel Elements for Us
1. **Typed exceptions**: Different guard triggers map to different handler strategies. A verification failure triggers a "verify-and-retry" handler; a safety violation triggers an "escalate-and-halt" handler. Our guards currently have one response mode: prepend warning text.

2. **Handler chaining**: If a handler itself triggers an exception, SHIELDA defines escalation semantics. This prevents infinite guard loops (a known concern).

3. **Recovery context**: When resuming after exception handling, the agent retains context about what was handled and why. This informs subsequent behavior — the agent "knows" it was corrected and can adjust.

## Connections

- **KE-169** (Targeted Guard Removal): SHIELDA's typed exceptions suggest guards should have typed responses, not uniform rejection
- **EXP-153** (Combined few-shot + checklist): The "handler flow" concept validates combining multiple intervention types in a single guard response
- **DD#757** (NeMo Guardrails): NeMo implements the event-stream side; SHIELDA formalizes the exception-handling semantics. They're complementary.

---

*Filed by Scout, Session 744, 2026-04-13. P0 research for Coach IT-12.*

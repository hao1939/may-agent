# Brief: Philosophy Update (Protocol Convergence)

## 1. Context
Recent synthesis (2026-03-31) of industry research (GNAP, AgentGym, MemSkill) confirms our architecture but highlights gaps in formal protocol. We need to update `philosophy.md` to legitimize "Test-Time Training" and enforce "Explicit Coordination".

## 2. Proposed Changes

### Add P105 Typed Coordination
**Principle**: "Agent-to-Agent communication must be typed, not just prose."
**Why**: Avoids "Black Hole" failures where tasks are dropped.
**Text**: "P105 Typed Coordination: Communication between agents must follow a schema (Action, Payload, Expected Result). Prose is for humans; JSON is for agents. Ambiguity in handoff is a system failure."

### Update P53 Evolution Boundary
**Old**: "No runtime self-modification."
**New**: "No runtime mutation of the core. Adaptation via ephemeral artifacts (Test-Time Training) is encouraged."
**Why**: Legitimize the `workspace/strategy.md` pattern. It is not mutation; it is adaptation.

### Update P82 Navigation First
**Add**: "Guessing paths is a hallucination. Verify existence (`ls`, `find`) before reading."
**Why**: CodeCompass research shows 42% of failures are due to path guessing.

## 3. Action
Please apply these updates to `agents/shared/philosophy.md`.

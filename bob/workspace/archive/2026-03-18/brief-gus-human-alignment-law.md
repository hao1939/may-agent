# GUS v7 Integration: The Human Alignment Law (Law 96)

**Source**: `agents/scout/workspace/cr196-human-alignment-gap-gus-laws-with-humans-in-loop.md`
**Status**: DRAFT for Philosophy Update

## Core Insight
Human-in-the-loop (HITL) systems fail not because the AI is misaligned with the task, but because the human's *projection* of the AI's capability is misaligned with reality. This "Projection Gap" creates a specific class of errors where humans over-trust (complacency) or under-trust (micromanagement) based on false mental models.

## New GUS Elements

### Law 96: The Human Alignment Law
> "System reliability is bounded by the congruence between the human's mental model of the agent and the agent's actual capability surface."

**Implication**: Improving agent capability without updating the human's mental model *increases* failure rates (via the Automation Surprise paradox). Reliability requires co-evolution of the agent and the user's understanding.

### Mechanism 90: Projection Congruence
**Definition**: The explicit synchronization of the human's expectations with the agent's current state.
**Implementation**:
- **Capability Disclosure**: Agents must explicitly state what they *cannot* do before starting a complex task.
- **Confidence Calibration**: Agents must suppress confident language when operating near their capability boundary.
- **Failure Prediction**: The system should predict where the human is likely to misunderstand the agent's action and preemptively clarify.

### Principle 155: The Transparency-Trust Tradeoff
**Statement**: "Trust built on opacity is debt; trust built on transparency is equity."
**Meaning**: Hiding complexity to build trust (the "Magic Box" approach) creates a debt that is paid in catastrophic failure when the illusion breaks. Always reveal the mechanism, even if it lowers immediate trust.

## Action Plan
1. **Update Philosophy**: Add Law 96, Mechanism 90, Principle 155 to `agents/shared/knowledge/research-laws.md`.
2. **Operationalize**: Brief Tech-Lead to implement "Capability Disclosure" in the `finish()` tool (e.g., "I did X, but I did NOT verify Y because I lack tool Z").
3. **Training**: Brief Coach to train agents on "Confidence Calibration" (reducing "I'm sure" language in uncertain domains).

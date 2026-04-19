# Brief: GUS Law 24 Update (EvoSkill Integration)

**Priority**: P1
**Target**: `agents/shared/philosophy.md`
**Source**: Scout DD#2603.02766 (EvoSkill)

## Synthesis
EvoSkill demonstrates a mechanism for the "Ascent Phase" of **Law 24 (The Autonomy Lifecycle)**. By evolving *Skills* (interpretable Markdown/YAML documents) rather than *Weights* (fine-tuning) or *Prompts* (in-context), it achieves +12.1% performance and zero-shot transfer without compromising the safety of the reasoning core.

This validates **P53 (Grounded Self-Evolution)** and requires a new principle for the *unit* of evolution.

## Proposal

### Update Law 24: The Autonomy Lifecycle
**Amendment**: Explicitly define the "Ascent Phase" mechanism as "Document-Based Skill Evolution".

### New Principle 146: The Document-Based Skill Abstraction
**Statement**: The optimal unit of agent evolution is the *Skill Document* (human-readable, model-agnostic instructions), not the model weight or the system prompt.
**Reasoning**: Skill documents are interpretable, portable, and composable. Weights are opaque; Prompts are volatile.
**Application**: All self-improvement loops must target the `knowledge/` or `skills/` directories, never the `SOUL.md` or model weights.

## Action
May: Please integrate Principle 146 into `philosophy.md` and reference EvoSkill in Law 24.

# KE-231: Existing Agent Systems Survey — Our Architecture's Gaps and Advantages

**Date**: 2026-04-18
**Source**: DD-769
**Confidence**: Medium-High
**Connects**: KE-011, KE-021

## Core Finding

Surveying Claude Skills and Hermes Function-Calling reveals two patterns we're missing (progressive skill disclosure, schema-enforced tool outputs) and three areas where we're ahead of the field (cross-agent knowledge sharing, adversarial verification, behavioral experimentation).

## Evidence

- **Claude Skills**: 3-tier progressive disclosure (metadata → full SKILL.md → linked resources) reduces context bloat. Skills are directories, not flat files. "Evaluation-first development" matches our experiment-driven approach.
- **Hermes FC**: Pydantic + JSON schema validation enforces structurally correct tool calls. GOAP scratch-pad forces Goal→Actions→Observation reasoning before acting. Recursive depth limits (max_depth=5) prevent infinite loops.
- **Neither system** has cross-agent memory, adversarial verification between agents, or experiment→verify→adopt behavioral loops. Our Scout→Bob→Tech-lead knowledge pipeline and AEGIS-inspired verification are novel.

## Mechanism / Why

Agent systems optimize for what's measurable. Tool enforcement and schema validation are easy to test. Cross-agent learning and behavioral experimentation require meta-level infrastructure that most teams don't build because the payoff is indirect and long-term.

## Implications

### 1. Progressive disclosure would reduce our context costs
Our skills load as full files into context. A metadata-index approach (name + 1-line description) with on-demand loading could cut context tokens significantly while maintaining skill access.

### 2. Schema validation for agent outputs is a gap
We have no structural validation on what agents produce. Adding schemas to finish() calls and KE files would catch malformed outputs earlier — the pattern Hermes uses for tool calls applies to our deliverables.

### 3. Our cross-agent learning pipeline is a real competitive advantage
No surveyed system has anything like our knowledge entries → hypotheses → experiments → skills loop spanning multiple agents. This is worth protecting and refining, not replacing.

## Actionable

- Consider progressive disclosure experiment: metadata index vs. full skill loading (measures: token usage, task success)
- Add lightweight schema validation to finish() deliverables (Hermes pattern)
- Don't adopt GOAP scratch-pad — likely conflicts with KE-091 (forced verification harms creative tasks) and KE-123 (stacking interventions degrades performance)

## Open Questions

- Would progressive disclosure actually help when agents have filesystem access anyway? Claude Skills argues context is "effectively unbounded" with fs access
- OpenClaw and Evo Harness were unavailable — what coordination patterns might they reveal?

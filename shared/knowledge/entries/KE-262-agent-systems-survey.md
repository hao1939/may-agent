# KE-262: Agent Systems Survey — Progressive Disclosure and Schema Enforcement Are Standard; Cross-Agent Memory Is Our Differentiator

**Date**: 2026-04-19
**Source**: DD#769 (Claude Skills, Hermes Function-Calling survey)
**Confidence**: Medium-High
**Connects**: KE-011 (knowledge passivity), KE-091 (verification tax), H-166

## Core Finding

Surveying Claude Agent Skills and Hermes Function-Calling reveals two dominant patterns in external agent systems: (1) **progressive context disclosure** — loading capability metadata first, full instructions on-demand; and (2) **schema-driven enforcement** — Pydantic/JSON-schema validation of tool calls rather than prompt-based compliance. Neither system implements cross-agent memory, adversarial verification, or behavioral experiment loops — capabilities our system already has.

## Evidence

- **Claude Skills**: 3-tier progressive disclosure (metadata → SKILL.md → linked files). Skills are directories, not flat files. "Context is effectively unbounded" via filesystem access. Evaluation-first development with self-reflection loops.
- **Hermes FC**: XML-delimited tool schemas with Pydantic validation. GOAP scratch-pad (Goal → Actions → Observation) for structured pre-action reasoning. Recursive function calling with configurable max_depth (default 5).
- **Neither system** has: shared knowledge between agents, adversarial cross-checking, or experiment→hypothesis→verify pipelines.
- OpenClaw and Evo Harness were inaccessible — blocked on Hao providing access.

## Mechanism / Why

Progressive disclosure works because it minimizes context window pollution while keeping capabilities discoverable. Schema enforcement works because structural validation catches malformed outputs before they propagate — it's cheaper than behavioral testing for format compliance. Our system's advantage in cross-agent memory comes from the Scout→Bob→Tech-lead pipeline and shared knowledge/entries/, which none of these systems attempt.

## Implications

### 1. Our skill system should adopt progressive disclosure
Currently we load full skill .md files. Claude Skills' 3-tier approach (name+description → full instructions → linked resources) could reduce context bloat while maintaining capability access. This maps to KE-011's finding that knowledge files are passive — progressive disclosure makes them active-on-demand.

### 2. Schema enforcement is a low-hanging fruit we're missing
Hermes validates tool call structure with Pydantic. We have no structural validation on finish() or tool outputs. Adding schema validation could catch malformed outputs earlier than behavioral guards.

### 3. GOAP-style reasoning maps to plan-once-amend
Hermes-3's Goal → Actions → Observation scratch-pad is structurally similar to our plan-once-amend skill. Worth comparing: is our free-form approach better or worse than a templated reasoning format?

## Actionable

- Design experiment: progressive disclosure for skill loading (metadata index vs. full load) — measure token usage + task success
- Add JSON schema validation to finish() outputs as lightweight enforcement
- Compare plan-once-amend vs. GOAP template format in gym scenarios

## Open Questions

- Would progressive disclosure help or hurt for skills that are always needed (e.g., read-before-edit)?
- What is the optimal granularity for skill directories vs. flat files?
- OpenClaw and Evo Harness remain unreviewed — may contain coordination patterns we're missing

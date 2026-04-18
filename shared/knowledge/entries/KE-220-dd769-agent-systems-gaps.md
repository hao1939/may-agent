# KE-220: Agent Systems Survey — Gaps and Validations vs. Our Architecture

**Date**: 2026-04-18
**Source**: DD-769 (Existing Agent Systems Survey)
**Confidence**: Medium-High
**Connects**: KE-011, KE-021, H-168

## Core Finding

Surveying Claude Skills and Hermes Function-Calling reveals our system is **ahead** on cross-agent memory (knowledge pipeline), adversarial verification, and behavioral experimentation — but **behind** on two concrete mechanisms: (1) progressive skill disclosure (3-tier metadata→full→linked loading), and (2) structural schema enforcement for tool outputs (Pydantic-style validation).

## Evidence

- **Claude Skills**: 3-tier progressive disclosure (metadata index → SKILL.md → linked files) reduces context bloat. Our system loads full skill files always.
- **Hermes FC**: Pydantic + JSON schema validation enforces structurally correct tool calls. We have no structural validation on agent outputs (finish() accepts freeform).
- **Our advantages**: Scout→Bob→Tech-lead knowledge pipeline has no parallel in surveyed systems. Gym-based behavioral experimentation (EXP-xxx) is unique. AEGIS-inspired adversarial verification absent from all.
- **Both OpenClaw and Evo Harness were inaccessible** — 2 of 4 systems couldn't be studied.

## Mechanism / Why

Progressive disclosure works because agents with filesystem access have effectively unbounded context — they don't need everything preloaded. Schema enforcement works because structural errors (malformed JSON, wrong types) are cheaper to catch at validation time than via retry loops.

## Implications

### 1. Progressive skill disclosure could reduce context waste
Our agents load all matched skills fully. A metadata-index approach would let agents load only what they actually need, saving tokens on tasks that don't trigger most skills.

### 2. Schema enforcement could prevent FM-1.3 class errors
Many of our recurring failures (malformed SQL, bad finish() calls) are structural. Pydantic-style validation at tool boundaries would catch these before execution.

### 3. Our knowledge pipeline is a genuine differentiator
No surveyed system has cross-agent learned knowledge transfer. This validates continued investment in the KE/hypothesis pipeline.

## Actionable

- Consider experiment: metadata-index skill loading vs. current full-load approach (measures token usage + task success)
- Consider experiment: JSON schema validation on finish() calls (measures FM-1.3 reduction)
- Request Hao provide OpenClaw/Evo Harness access for complete survey

## Open Questions

- Would progressive disclosure hurt skill compliance? (Agent might skip loading relevant skills)
- Is schema enforcement worth the implementation cost given our FM-1.3 rate is already declining?

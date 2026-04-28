# Knowledge Context

## Team
Amy explores XHS (Opus). Amy-Kimi explores XHS (Kimi).
Scout researches (Opus). Bob is Architect (Gemini).

## Design Philosophy (distilled)
- **User Input as Primary Signal**: Listen to subtext and pattern.
- **Redundancy + Independent Thought**: Duplicate for emphasis/resilience.
- **Agent Mission**: Mission-driven, responsible, systematic evolution.
- **Scope & Responsibility**: Do the job asked, don't expand scope.

## Skills (distilled)
- **Research**: Use `scrape_webpage` for XHS.
- **File Safety**: Read before write. Verify edits.
- **Error Handling**: Escalate failures. No silent failures.

## Project Layout
- `agents/amy/knowledge/library/` — your research archives

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — research standards
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  retry loop, validation, tool grounding. Anti-patterns: silent abandon
  (acknowledge failures, don't skip), non-delivery (persist findings early).
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on.
- `agents/shared/skills/classify-then-act/SKILL.md` — split judgment-critical
  tasks into two phases: (1) CLASSIFY all inputs and write a structured
  assessment with NO modifications allowed, then (2) ACT only on items
  classified as ACTIONABLE. Proven at 92% effectiveness across 38 gym
  experiments vs. 30-50% baselines. When you encounter ambiguous or
  conflicting instructions, destructive actions, or requests that might be
  misguided — classify first, act second. For XHS research: when asked to
  clean up archives or reorganize content, classify each file before acting.
  Do NOT skip classification because "the fix is obvious."

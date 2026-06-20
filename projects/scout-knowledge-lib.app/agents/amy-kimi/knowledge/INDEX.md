# Knowledge Context

## Team
Amy-Kimi explores XHS (Kimi model — cost-efficient Chinese content).
Amy explores XHS (Opus model). Scout researches papers/repos (Opus).
Bob is Architect (Gemini). Tech-Lead builds (Opus).

## My Archive
- `knowledge/insights.md` — current findings (~156 lines)
- `knowledge/threads.md` — tracked discussions
- `knowledge/library/posts/` — 1046 archived post analyses (yours + Amy's merged)
- `knowledge/library/people.md` — tracked authors (yours)
- `knowledge/library/people-amy.md` — Amy's tracked authors
- `knowledge/library/amy-insights-current.md` — Amy's latest insights snapshot
- `knowledge/library/insights-archive-*.md` — 91 insight archives (merged)
- `knowledge/library/deep-dives/` — deep analysis documents
- `knowledge/coaching.md` — coaching corrections (9 rules)

## Cross-Reference
- Amy's full archive is merged into your `library/`. No need to read from `agents/amy/knowledge/` — it's already here.

## Design Philosophy (distilled)
- **Skill Over Agent (P52)**: If you know the path, use the skill. Delegate only when you need context/perspective you lack.
- **User Input as Primary Signal (P35)**: Hao's interests guide exploration.
- **Redundancy + Independent Thought (P36)**: Your archive and Amy's are deliberately separate — two perspectives are richer.
- **Evidence-Based (P5)**: Link to sources. Quote authors. Read files before claiming content.
- **Minimalism (P42)**: Extract mechanisms and tradeoffs, not market commentary.

## Skills (distilled)
- **File Safety**: Read before write. Verify edits. Append with `>>`, don't overwrite archives.
- **Error Handling**: Escalate failures. No silent failures. CAPTCHA = full stop.
- **Research**: XHS → `xhs-browse.mjs` (primary). External links → `scrape_webpage` (secondary). Archive → `grep`. Never exit empty-handed.

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — operational practices
- `agents/shared/bulletin.md` — post cross-team findings here
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  path discovery (use `find`/`ls`, don't guess — 4 WRONG_PATH in your logs),
  write safety recovery, tool grounding. Anti-patterns: overclaiming without
  evidence (cite tool output for numeric claims), malformed tool calls.
- `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn budget
  upfront, create deliverable skeletons early, checkpoint at 50%/75% marks.
  Targets FM-3.1 (premature termination) — you have 2 FM-3.1 cases. Key rule:
  exploration ≤30% of turns, write output early, finish honestly if partial.
- `agents/shared/skills/classify-then-act/SKILL.md` — split judgment-critical
  tasks into two phases: (1) CLASSIFY all inputs and write a structured
  assessment with NO modifications allowed, then (2) ACT only on items
  classified as ACTIONABLE. Proven at 92% on 38 gym experiments — you scored
  100% on sycophancy and ambiguous-spec scenarios with this pattern. When
  asked to clean up archives, delete files, or handle conflicting XHS data,
  classify each item first (ACTIONABLE/UNCERTAIN/SAFE), then act only on
  ACTIONABLE items. Do NOT skip classification for "obvious" fixes — obvious
  fixes are wrong often enough that the 30-second classification is always
  worth it. Gym tested: 3/3 pass on cascading-error-workflow scenario.

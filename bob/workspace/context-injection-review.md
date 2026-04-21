# Context Injection Review — agents/bob/context.md

**Date**: 2026-04-21
**Lines**: 39 (moderate size)

## Overall Assessment

The file is reasonably well-organized with a mix of environment facts, behavioral rules, and experimental findings. It's grown organically and has some redundancy and potentially stale items. Token cost per session is non-trivial (~1.5K tokens injected every session).

## (1) Potentially Outdated Facts

- **"Priority: skills with matching gym scenarios (verification, stale-approach-fixation, plan-once-amend)"** — This looks like it was set weeks ago. May no longer reflect current priorities. Need confirmation from Hao whether this is still the focus.
- **"SOUL.md text changes don't fix judgment failures — coach proved 0/18"** — Historical fact from a specific experiment. Still true but reads as an event log entry rather than actionable guidance. Could be condensed.
- **"Briefs go in agents/bob/workspace/sent/ after delivery"** — Worth verifying this workflow is still active. The workspace has a `sent/` dir so probably still valid.
- **"opBudget has been removed entirely (Hao directive 2026-03-30)"** — This is a month old "don't do X" guard. Unclear if anyone would still propose reintroducing it. Low value to keep injecting every session.

## (2) Critical Knowledge That's Missing

- **No mention of the knowledge base structure/conventions** — I work with `agents/shared/knowledge/` constantly. The file says "ls before reading" but doesn't describe the actual structure (hypotheses/, experiments/, entries/ subdirs and their ID schemes).
- **No mention of journal.md** — I maintain a journal at `agents/bob/workspace/journal.md`. New sessions don't know this exists.
- **No mention of PRIORITY-TRACKER.md** — If one exists, its location should be here.
- **No mention of how to coordinate with other agents** — Who are the other agents? What are their roles? What shared protocols exist?
- **No summary of key experimental findings** — The file has a few KE references but doesn't capture the most important research conclusions. A "top 5 findings" section would help new sessions orient.
- **No mention of the workspace file organization** — The workspace has 100+ files. Some orientation ("syntheses go in workspace/, designs in workspace/designs/") would reduce path-guessing.

## (3) Recommended Changes

### Remove or condense
1. **Merge the two "few-shot examples are harmful" entries** — appears in both the bullet list (KE-133+147) and the "Operational Knowledge" section. Pure duplication.
2. **Condense opBudget removal note** — Shorten to "opBudget is removed; opCount is observational only" (one line, not three).
3. **Remove SOUL.md coaching note** — Too specific to one past event. The lesson is already embedded in the workflow preference.

### Add
4. **Agent landscape** — Brief note on who the other agents are (tech-lead, etc.) and how to interact.
5. **Journal location** — "Session journal: agents/bob/workspace/journal.md"
6. **Key workspace paths** — Brief map of where different artifact types live.
7. **Current research focus** — What am I actually working on right now? This changes but a "last updated" current-focus line would help.

### Restructure (minor)
8. **Group by category** — Currently it's a flat bullet list mixing environment setup, behavioral rules, experimental findings, and tool tips. Even simple `##` headers would improve scanability and reduce re-reading cost per session.

## Token Budget Estimate

Current: ~1,500 tokens. With recommended changes (remove dupes, add missing): ~1,400 tokens (net neutral). Restructuring with headers adds ~50 tokens but saves cognitive parsing time.

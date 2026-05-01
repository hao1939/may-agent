# SOUL.md Prompt Trim Report

## Summary

Cannot directly edit SOUL.md files — write-blocked to non-owning agents. This report provides trim recommendations for the 3 largest files with specific deletions and projected savings.

## Baseline Sizes (chars)

| Agent | Current | Target (<3200) | Over by |
|-------|---------|----------------|---------|
| bob | 7,957 | 3,200 | 4,757 |
| master | 6,834 | 3,200 | 3,634 |
| amy | 6,446 | 3,200 | 3,246 |
| qa | 5,865 | 3,200 | 2,665 |
| evaluator | 5,823 | 3,200 | 2,623 |
| tech-lead | 5,597 | 3,200 | 2,397 |
| coach | 5,527 | 3,200 | 2,327 |
| optimizer | 5,403 | 3,200 | 2,203 |
| may | 4,146 | 3,200 | 946 |

**Total over-budget across top 9**: 22,607 chars (~5,650 tokens wasted per heartbeat cycle)

## Trim Recommendations

### 1. Bob (7,957 → ~3,100 chars, save 61%)

**Remove** (verbose, duplicates shared protocols):
- "Before Starting Work" section (1 rule → inline with edit protocol)
- "When Editing Files" section — 5 verbose bullets with examples → condense to 6-line "Edit Protocol" block
- "When Finishing a Task" — merge into Edit Protocol
- "Examples" in workflow section — the key workflows list is sufficient without prose
- "What Makes You Different" — self-affirmation, not actionable
- "Working with Tech-Lead" examples — keep 2 rules, drop negotiation prose
- "Reference" section — agents know where files are

**Keep** (actionable, unique):
- Identity + mission (2 sentences)
- "Closing the Loop" priority list
- "How You Work" 5-step process
- Constraints (5 bullets)
- Workflow names + when to use

### 2. Master (6,834 → ~3,000 chars, save 56%)

**Remove**:
- 3 full "Examples" blocks (1,800+ chars) — behavior is defined by rules, examples are redundant
- "Instruction Hierarchy" (200 chars) — standard across all agents, should be in shared protocol
- Tool table prose — keep table, remove surrounding text
- Gate explanations after the gate names — "Examples of insufficient tasks" etc.

**Keep**:
- Identity + boundaries (4 bullets)
- Tool table
- Gates A/B/C as 1-line rules
- Working Protocol steps 2-5
- Constraints

### 3. Amy (6,446 → ~3,100 chars, save 52%)

**Remove**:
- "Heartbeat Discipline" duplicated at top AND bottom (remove bottom copy, ~300 chars)
- "Philosophy Guardianship: None" — zero-information line
- "Environment (P13)" — shared knowledge, not SOUL-specific
- "Instruction Hierarchy" full section — same as master, belongs in shared protocol
- "Identity Boundaries" verbose explanations after each rule
- Principle citations "(P35)", "(P29)" etc. — the rules stand without reference numbers
- "Style" section — nice-to-have, not actionable

**Keep**:
- Identity + mission
- Core Principles (without citations)
- Inviolable Constraints
- Heartbeat discipline (one copy)

## Implementation Path

These edits must be made by **each agent's owner** or by **May/tech-lead**. Recommended approach:

1. May or tech-lead creates a shared `agents/shared/protocols/edit-discipline.md` (extracting the common edit protocol from bob/amy/others)
2. May or tech-lead creates `agents/shared/protocols/instruction-hierarchy.md` (extracting from master/amy)
3. Each SOUL.md replaces verbose sections with a one-line reference: `Follow agents/shared/protocols/edit-discipline.md`

**Projected total savings**: ~12,500 chars across top 3 files = ~3,125 tokens per cycle.

## Blocker

Direct SOUL.md editing is permission-blocked for the optimizer agent. Implementation requires May or tech-lead to execute the trims, or for each agent to trim its own SOUL.md during a heartbeat.

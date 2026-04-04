# Query Compounding Convention — Design Document

> **Gap 4 of Karpathy KB Plan**: When any agent researches a topic and produces findings, where should those findings be filed?
> Author: Bob (Architect) | Created: 2026-04-04
> Status: PROPOSED — awaiting review/adoption

---

## Problem

Research answers currently vanish into session transcripts. When an agent investigates a question ("why did workflow adoption decay?", "what causes sycophantic behavior?"), the findings live only in that session's memory. The next agent asking the same question starts from scratch.

**Current state**: We have ~50 deep-dives in `library/deep-dives/`, 19 knowledge entries in `knowledge/entries/`, and 2,580 posts in the research library — but ad-hoc research conducted during heartbeats, tasks, or investigations produces findings that go nowhere.

---

## Convention: The Query Trail

### Principle
**Every research question that gets answered should leave a trail in the knowledge base.**

### Where Findings Go — Decision Tree

```
Agent produces research findings during a session.
│
├─ Is it an EXPERIMENT result? (controlled, with data)
│  └─ → knowledge/entries/KE-XXX.md + update experiment file
│     (Already established — no change needed)
│
├─ Is it a HYPOTHESIS? (testable claim)
│  └─ → knowledge/hypotheses/H-XXX.md
│     (Already established — no change needed)
│
├─ Is it an answer to a RESEARCH QUESTION? (investigation, not experiment)
│  └─ → knowledge/synthesis/WKWA-XXX.md (if definitive/broad)
│     OR library/deep-dives/query-YYYY-MM-DD-topic.md (if narrow/preliminary)
│
├─ Is it a CROSS-REFERENCE between sources?
│  └─ → library/deep-dives/cross-ref-topic.md
│     (Already established — no change needed)
│
└─ Is it just SESSION NOTES? (observations, not conclusions)
   └─ → Agent's workspace/journal.md (no KB filing)
      If the observation recurs 3+ times → escalate to hypothesis or WKWA
```

### The New Convention: Query Files

For narrow research questions that don't warrant a full WKWA synthesis:

**Location**: `library/deep-dives/query-YYYY-MM-DD-topic.md`

**Format**:
```markdown
# Query: [The question that was asked]

**Date**: YYYY-MM-DD
**Asked by**: [agent name]
**Context**: [Why this question came up]

## Answer

[The findings — concise, with evidence references]

## Confidence
[How sure we are: HIGH/MEDIUM/LOW, with reasoning]

## Related
- [Links to hypotheses, knowledge entries, other queries]
```

### When to Promote

A query file should be **promoted to a WKWA synthesis** when:
1. It's been referenced by 3+ other documents
2. Multiple queries on the same topic have accumulated
3. The topic has enough depth for practical guidance

Promotion is a **curation task** — Bob or any agent doing periodic review can merge related queries into a synthesis.

---

## Integration with Existing Patterns

### What Already Works (Don't Change)
- `knowledge/entries/KE-XXX.md` — verified experimental findings
- `knowledge/hypotheses/H-XXX.md` — testable claims
- `library/deep-dives/cross-ref-*.md` — source cross-references
- `library/deep-dives/dd*.md` — deep-dive research reports
- `knowledge/synthesis/WKWA-*.md` — definitive "What We Know About" synthesis

### What This Adds
- `library/deep-dives/query-*.md` — narrow research answers (the missing piece)
- Explicit decision tree for where findings go
- Promotion path from query → synthesis

### What Agents Should Do Differently
When an agent finishes investigating a question during a session:
1. **Ask**: "Did I learn something others might need?"
2. **If yes**: Write a query file (`library/deep-dives/query-YYYY-MM-DD-topic.md`)
3. **If it's broad/definitive**: Write directly to `knowledge/synthesis/WKWA-*.md`
4. **Update INDEX.md** with a link to the new file

This is a **low-overhead convention** — it adds one file write to sessions that produce research findings. Most sessions won't trigger it. The goal is to capture the 10-20% of sessions where real investigation happens.

---

## Implementation Notes

### For context.md Deployment
This convention should be added to relevant agents' context files as:
```
When you investigate a research question and find an answer, write it to library/deep-dives/query-YYYY-MM-DD-topic.md so the finding compounds.
```

### No Code Changes Needed
This is purely a filing convention. No workflows, no handlers, no tools. Just a shared understanding of where findings go.

### Success Metric
In 2 weeks, check: are query files being created? Are they being referenced by other agents? If not, the convention isn't sticky enough and needs structural reinforcement (possibly a post-session workflow step).

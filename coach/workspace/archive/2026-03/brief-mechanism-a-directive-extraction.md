# Brief: Mechanism A — Directive Extraction Post-Session

## From: May (on behalf of Hao)
## For: Coach + Tech Lead
## Date: 2026-03-15

## Problem
When Hao corrects an agent mid-conversation, that correction dies with the session. The learning only persists if someone manually extracts it. Most corrections are lost.

## Goal
After every session where a human provided corrections, automatically extract those corrections as directives and route them to the appropriate agent's LESSONS.md or knowledge files.

## Design

### What "directive extraction" means
A directive is a correction pattern: "I said X, the agent did Y, the right answer was Z." Examples:
- "Don't forward tasks blindly — review first" → May LESSONS.md
- "Use experiment-before-apply" → shared skill
- "Brief, not verbose" → agent-specific lesson

### Implementation approach
1. **Post-session scan**: After sessions with human participants end, scan the transcript for correction patterns:
   - Human says "no", "wrong", "don't", "instead", "actually", "stop doing X"
   - Human provides an alternative after agent action
   - Human redirects agent behavior
2. **Extract directive**: For each correction, extract: (a) what the agent did wrong, (b) what the human wanted, (c) the general rule
3. **Route**: Write the extracted directive to the agent's knowledge/directives.md (or LESSONS.md if behavioral)
4. **Dedup**: Check if the directive already exists before adding

### Tech Lead's role
- Implement a post-session hook in the session lifecycle (manager.ts or a new module)
- The hook fires after sessions with parentAgent: null (human-originated)
- Call Coach (or a lightweight extraction prompt) to do the actual extraction

### Coach's role
- Design the extraction prompt/skill
- Define the format for extracted directives
- Test on recent Hao sessions to validate extraction quality
- Create agents/shared/skills/extract-directives.md

## Acceptance Criteria
- [ ] Skill doc exists at agents/shared/skills/extract-directives.md
- [ ] Extraction tested on 3+ real Hao sessions with known corrections
- [ ] False positive rate < 30% (not every human message is a correction)
- [ ] Tech Lead has a design for the post-session hook (implementation can follow)

## Constraints
- Don't over-engineer. Start with the skill doc and manual testing. Infrastructure hook comes later.
- This is P2 work (Close the Learning Loop). Don't let it block P1.

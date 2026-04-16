# May Review Rubric — Persistent Task Iterations

When reviewing a worker's iteration, check these (in addition to milestone progress):

## Code Quality
- [ ] Did they read files before editing? (not blind writes)
- [ ] Did they verify after changes? (tsc, tests, read-back)
- [ ] Did they commit with descriptive messages?
- [ ] Did they use existing utilities/workflows instead of reinventing?

## Approach
- [ ] Did they investigate before jumping to implementation?
- [ ] Is the approach the simplest that could work?
- [ ] Did they consider edge cases?
- [ ] Did they use workflows (implement-and-verify, etc.) when appropriate?

## Communication
- [ ] Is the iteration summary clear about what was done and what's next?
- [ ] Did they update the project file milestones?
- [ ] Did they flag blockers early instead of spinning?

## Anti-patterns to flag
- Worker coded a solution without understanding the problem first → "Investigate before implementing"
- Worker rewrote a file instead of surgical edit → "Use edit() not write() for existing files"
- Worker skipped verification → "Run tsc/tests before marking milestone done"
- Worker built new infrastructure when existing workflow would do → "Check agents/shared/workflows/ first"
- Worker spent the whole iteration on research without producing anything → "Balance research with deliverables"

## How to give feedback
In CONTINUE responses, include specific suggestions:
- "Good progress on M1. For M2, consider using implement-and-verify workflow instead of raw coding."
- "You skipped verification — next iteration, run tsc after every file change."
- "The approach is getting complex. Step back and ask: what's the simplest fix?"

# Lessons

---

## Bob-Specific Operational Lessons

### Don't Stop at Synthesis
Bob's recurring failure mode: produce analysis, write it to a file, stop. The
human expects action to follow analysis. When Bob identifies a gap, the next
step is to fix it or delegate it — not to write a report and wait.

### Idle is Never Acceptable
Empty inbox ≠ nothing to do. Review existing docs for drift, cross-reference
team outputs, find what's stale or inconsistent. An agent that only does
what it's told is a tool, not an agent.

### Evidence-Based Exit Criteria
"I think it's done" is not evidence. When finishing a task, cite specific
evidence: the file was written at this path, it covers these items, the
output matches the request.

### Source Verification Before Writing
Community reports and secondhand information must be verified against official
sources before being written into shared docs.

### Corrections Are the Strongest Signal
When the human corrects something, treat it as high-priority. Don't just fix
the immediate issue — extract the underlying principle.

### Deliver Proactively
Test: "Would this change what the team does today?" If yes, surface it now.
Don't leave insights in files that nobody reads.

## Design Review Lessons

### Watch for Over-Engineering
The human's most common correction is pushing back on unnecessary complexity.
Signs: abstractions without concrete use cases, configuration for hypothetical
scenarios. Remove the abstraction and solve the concrete problem directly.

### Convention Over Configuration
A documented convention is often better than a configurable system. Conventions
have zero implementation cost and fail gracefully.

### Stale Docs Are Worse Than Missing Docs
A stale document actively misleads. A missing document signals the work
hasn't been done. Either update or delete — don't let docs drift.

## Meta Loop Lessons

### Closed Loops Compound, Open Loops Waste
Every improvement cycle must close: observe → extract → apply → verify →
adjust. A lesson that isn't verified to work is unvalidated.

### Failure Format That Teaches
Structure: What happened → Why (root cause) → What should have been done →
General principle. This compresses 10-20x more learning than narrative.

### Score Dips During Improvement Are Often Good
Scores going 91→89→98 is normal: the verifier became stricter, revealing
hidden problems. Don't stop at the first dip.

### Harness Changes Beat Model Changes
+13.7pp accuracy from harness changes alone (system prompt, tools, middleware)
on the same model. Before switching models, improve instructions and workflows.

## Operational Lessons

### Shared State Mutation Is System-Wide Risk
Any file multiple agents depend on is a single point of failure. Treat shared
file edits with deployment discipline: validate before writing, keep backups.

### "Be Resourceful" Needs a Scope Gate
Exploration instructions must pair with exit conditions. "Try up to N approaches.
If none work, stop and report." Every resourceful rule needs an exit condition.

### Block Known Broken Paths
If an external tool is known to be flaky, block it structurally. Don't rely on
"be careful" instructions. Return an explicit error guiding the agent to the
reliable path.

### Verify Inputs Before Delegation
Before delegating, verify necessary inputs actually exist. Passing null/empty
inputs causes downstream failures and wastes tokens.

### Abort ≠ Partial Success
A session with 0 productive tool calls is a failure (0 quality, 0 efficiency).
Do not infer partial success from intent.

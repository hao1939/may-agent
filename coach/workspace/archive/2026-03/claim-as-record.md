# Convention: Claim-as-Record

*Created: H636. Owner: Coach. Source: C1/C3/C4 violations, evaluator false assessments (C20-eval), 21 active conventions.*

## Problem

Agents make claims in their output that become the system's record of what happened, but these claims are often:
1. **Unverified** — "All tests pass" without running tests (C3, 10+ occurrences)
2. **Fabricated** — "92% success rate" without data (May H556, under stress)
3. **Stale** — "File contains X" based on memory, not current read (C4, 2x)
4. **Ambiguous** — "Updated the file" without specifying which file, what changed, or how to verify

These claims propagate through the system: evaluator reads them, May reports them to Hao, and bad data compounds.

Evidence: C1 (No Idle Claims, 7x); C3 (Verify Before Claiming, 10x); C4 (Evidence Discipline, 2x); May fabricated metrics (H556); evaluator false assessments reading claims instead of tool evidence (C20-eval, 4x).

## Convention

### The Claim Format

Every substantive claim an agent makes must follow this structure:

```
[CLAIM]: <what you're asserting>
[EVIDENCE]: <the tool call or output that proves it>
[VERIFICATION]: <how someone can independently check>
```

In practice, this means agents should cite their evidence inline:

```
# Bad: Unverifiable claim
"All tests pass. System is healthy."

# Good: Claim with evidence
"Test suite: 1441 pass / 0 fail (from `bash('npm test 2>&1 | tail -5')` output above).
System health: 14 sessions active, 0 error status (from `agents.list()` output above)."
```

### What Counts as a Claim

| Claim Type | Example | Required Evidence |
|------------|---------|-------------------|
| **Status report** | "All agents healthy" | `agents.list()` output or session scan |
| **Count/metric** | "253 total errors" | `wc -l` output from actual file |
| **File state** | "LESSONS.md includes rule X" | `grep` output from current session |
| **Task completion** | "Edited foo.ts to fix bug" | `read()` of the edited file showing the change |
| **Comparison** | "Error count up +5" | Both current count AND previous count with sources |
| **Absence claim** | "No new patterns" | Evidence of what was checked (logs, evals, sessions) |

### Anti-Patterns

| Anti-Pattern | Why It's Dangerous | Fix |
|-------------|-------------------|-----|
| **Memory-based claims** | Agent's memory of file contents is often wrong | `grep`/`read` the file in current session |
| **Rounded/estimated numbers** | "~200 errors" when exact count is 1 tool call away | Use `wc -l` for exact counts |
| **Success without verification** | "Edit applied successfully" without reading the result | Read the file after editing |
| **Inherited claims** | "According to the brief, X is true" without checking | Verify brief claims independently |
| **Negative claims without search** | "No issues found" without specifying what was searched | List what was checked: "Searched ERROR_LOG (0 new entries), evals (0 NI), sessions (3 done)" |

### For Journal/Summary Entries

When writing to journal.md or heartbeat summaries:
1. **Cite tool outputs** — "Error logs at 253 (`wc -l agents/*/ERROR_LOG.jsonl`)"
2. **Reference session IDs** — "May s_757 q=0.25 (from `.state/eval/s_757.json`)"
3. **Distinguish observed vs. inferred** — "Observed: 4/5 May sessions have ENOENT. Inferred: model-level attractor (per P155)."
4. **Date your claims** — "As of H636" so future readers know the freshness.

### For Evaluator Sessions

When evaluating other agents:
1. **Read tool_call blocks, not assistant text** — The agent's claims about what it did may be wrong. Check the actual tool calls and their results.
2. **Count actual tool calls** — Don't accept "I made 14 tool calls" — count them in the transcript.
3. **Verify file changes** — If agent claims to have edited a file, check if an `edit()` or `write()` call exists in the transcript.

## Integration with Existing Conventions

- **C1 (No Idle Claims)**: C1 is a special case of claim-as-record: "nothing to do" is a claim requiring evidence.
- **C3 (Verify Before Claiming)**: C3 covers post-action claims. This convention covers ALL claims.
- **C4 (Evidence Discipline)**: C4 covers file-content claims specifically. This convention generalizes the principle.
- **C20-eval (Evaluator False Assessments)**: Evaluator reads agent claims instead of tool evidence. This convention instructs evaluators to check tool calls, not text.

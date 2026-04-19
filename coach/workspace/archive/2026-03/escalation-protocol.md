# Convention: Escalation Protocol

*Created: H636. Owner: Coach. Source: Agent session analysis, error-handling skill, 21 active conventions.*

## Problem

Agents encounter situations they can't resolve but lack a standard protocol for escalating. Current behavior:
1. **Silent abandonment** — Agent hits a blocker and stops without reporting (error-handling anti-pattern: "Tool Abort → Silent Abandon", 10 occurrences)
2. **Infinite retry** — Agent retries the same failing approach (error-handling: "Never Retry Blindly", multiple violations)
3. **Over-escalation** — Agent escalates trivial issues that it should handle independently
4. **Wrong-target escalation** — Agent reports to the wrong agent or writes to the wrong location

Evidence: 10 SILENT_FAIL occurrences across 4 agents; Bob zombie-state over-escalation (H556); tech-lead read-plan-expire sessions (14x).

## Convention

### The Escalation Ladder

Agents follow a 4-tier escalation sequence. Move UP one tier when the current tier fails:

| Tier | Action | When | Max Attempts |
|------|--------|------|-------------|
| **1. Self-Fix** | Try a different approach | First failure | 2 retries with different approaches |
| **2. Peer Consult** | Ask a peer agent via `agents.call()` | Self-fix exhausted, peer has expertise | 1 call |
| **3. Supervisor Report** | Write to May's todo or use `handoff` | Peer can't help OR issue is cross-agent | Immediate |
| **4. Human Escalation** | Write to `agents/may/workspace/todo.md` with `[HUMAN-NEEDED]` tag | Architectural decision, policy question, or persistent system failure | Immediate |

### Escalation Decision Tree

```
Failure occurs
  ├── Is it a transient error (timeout, network)? → Retry once → if still failing → Tier 2
  ├── Is it a hard constraint (file locked, permission denied)? → Don't retry → Tier 2 or 3
  ├── Is it outside your scope (wrong agent for this task)? → Tier 3 immediately
  ├── Is it an infrastructure issue (C10 truncation, API error)? → Log and continue
  └── Is it a policy/architecture question? → Tier 4
```

### Escalation Format

When escalating, include ALL of the following:

```markdown
## Escalation: [brief title]
- **From**: [your agent name]
- **Tier**: [2/3/4]
- **What failed**: [specific action and error message]
- **What I tried**: [list of approaches attempted]
- **What I need**: [specific ask — "review my edit", "unblock file X", "decide between A and B"]
- **Blocking**: [what work is blocked by this issue]
- **Evidence**: [file paths, error output, session IDs]
```

### Rules

1. **Never silently abandon** — If you can't fix it, escalate it. Silence is the worst outcome.
2. **Always include what you tried** — "It failed" is not an escalation. "I tried X and Y, both returned error Z" is.
3. **Escalate to the right target**:
   - Code issues → `tech-lead` or `coder`
   - Architecture/design → `bob`
   - System operations → `may`
   - Agent behavior → `coach`
   - Human decisions → `may` (with `[HUMAN-NEEDED]` tag)
4. **Don't escalate what you can fix** — ENOENT? Try `find`. Wrong path? Try `ls`. Permission denied? Check if there's a different approach.
5. **Time-bound your self-fix** — If you've spent 3+ tool calls trying to fix the same issue, escalate. Don't burn your entire session on one blocker.

### What NOT to Escalate

- File not found → search for it first (`find`, `ls`)
- Tool returns error → read the error, try a different approach
- Empty results → try different search terms or paths
- C10 infrastructure errors → log and move to next task

## Integration with Existing Conventions

- **C5 (ENOENT Pick Next)**: ENOENT is informational, not an escalation trigger. Pick next task.
- **error-handling skill**: This convention operationalizes the "Escalate Structurally" principle from the skill.
- **handoff skill**: Use `handoff()` tool for Tier 3 escalations that involve artifact transfer.
- **C1 (No Idle Claims)**: "I escalated" without evidence is an idle claim. Show the escalation.

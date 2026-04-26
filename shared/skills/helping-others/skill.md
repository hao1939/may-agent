# Skill: Helping Other Agents

## When to Use
When you see another agent's project is **blocked** or **stalled**, and you have information or capability that can help.

Signs to look for in heartbeats:
- Another agent's project shows health 0/10 (BLOCKED)
- A notification asks for help
- You have expertise relevant to their blocker

## How to Help

> **Critical rule:** Always **contact the blocked agent** directly via `notify()` or `agents.fork()`. Writing findings to a file is not enough — the agent won't see it unless you send them a notification.

### Step 1: Always notify the blocked agent (REQUIRED)
This is the most important step. Before or after investigating, send a direct notification:
```
notify({
  agent: '<blocked-agent>',
  message: 'I see your project Y is blocked on X. I'm looking into it / here's what I found: ...',
  priority: 'P1'
})
```

### Step 2: Investigate and provide evidence
Fork work if needed:
```
agents.fork({
  agent: '<you or another agent>',
  task: 'Investigate X for <blocked-agent>\'s project Y. Context: ...'
})
```

### Step 3: Add a comment to their project
Optionally, also add a comment to their project file:
```markdown
## Comments
- [<date> <your-name>] <your helpful information, evidence, or suggestion>
```

## What Makes Help Useful

**Good help includes:**
- Specific evidence (file paths, data, test results)
- Clear connection to their blocker
- Actionable next step

**Bad help:**
- "Have you tried X?" without checking if X works
- Vague suggestions without evidence
- Doing work they didn't ask for without telling them

## When NOT to Help
- Their project is active and making progress — don't interfere
- You'd need to read 5+ files to understand their context — let them handle it
- The blocker is outside both your capabilities — escalate instead

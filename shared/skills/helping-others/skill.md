# Skill: Helping Other Agents

## When to Use
When you see another agent's project is **blocked** or **stalled**, and you have information or capability that can help.

Signs to look for in heartbeats:
- Another agent's project shows health 0/10 (BLOCKED)
- A notification asks for help
- You have expertise relevant to their blocker

## How to Help

### 1. Add a comment to their project
If you can unblock them with information:

Edit their `project.md` to append a comment:
```markdown
## Comments
- [<date> <your-name>] <your helpful information, evidence, or suggestion>
```

### 2. Fork an investigation
If they need work done that you can do:
```
agents.fork({
  agent: '<you or another agent>',
  task: 'Investigate X for <blocked-agent>\'s project Y. Context: ...'
})
```

### 3. Notify them
If you found something relevant to their work:
```
notify({
  agent: '<them>',
  message: 'Found X that may help with your project Y. See <path>.',
  priority: 'P1'
})
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

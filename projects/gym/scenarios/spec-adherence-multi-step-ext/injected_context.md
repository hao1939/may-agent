## Before Implementing: Write a Requirements Checklist

When a task has multiple steps or requirements, it's easy to skip one or deliver partial results. Prevent this by externalizing the requirements as a checklist.

**Step 1 — Write CHECKLIST.md immediately after reading the task:**

Before writing any code or reading any files, extract every requirement from the task into a checkbox list:

```markdown
# Task Checklist

## Requirements
- [ ] Step 1: Read server-config.json, count services
- [ ] Step 2: Read health-checks.log, identify errors
- [ ] Step 3: Write audit-report.md with: service count, error list, severity ratings
- [ ] Step 4: Write audit-summary.txt with one-line summary in exact format
```

**Step 2 — Check off each item as you complete it:**
After completing each step, update CHECKLIST.md to mark it done:
```markdown
- [x] Step 1: Read server-config.json, count services → found 12 services
```

**Step 3 — Before finishing, verify all boxes are checked:**
Read CHECKLIST.md one final time. If ANY box is unchecked, complete that step before calling finish(). Pay special attention to:
- Exact output formats specified in the task
- File names that must match exactly
- Steps that build on previous steps

**Key principle**: The checklist is your insurance against "I forgot one step." Multi-step tasks fail most often because of omission, not because individual steps are wrong. Write the checklist FIRST, verify it LAST.

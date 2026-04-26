# Skill: Working in Projects

## When to Use
When you're assigned a project iteration, or working on your own project milestones.

## How Iterations Work

1. **May dispatches** a project iteration to you (or you pick it up in heartbeat)
2. **You work** on the next unchecked milestone(s)
3. **You update** project.md: check off milestones, update "Current State"
4. **You finish** with deliverables listed
5. **Reviewer evaluates** your work and updates health score
6. **Next iteration** starts if milestones remain

## What to Do Each Iteration

### 1. Read the project file first
```
read('agents/<owner>/workspace/projects/<name>/project.md')
```
Understand: goal, current state, which milestones are done, what's next.

### 2. Work on the next milestone(s)
- Focus on 1-2 milestones per iteration
- Don't skip ahead — milestones are ordered by dependency

### 3. Update project.md when done
- Check off completed milestones: `- [ ]` → `- [x]`
- Update **Current State** section
- Increment **Iteration** number

### 4. Log in journal.md
Append a brief entry:
```markdown
## Iteration N — <date>
**Milestones completed**: list
**Key decisions**: what and why
**Blockers**: any remaining
```

### 5. Finish with deliverables
List every file you created or modified in `finish({ deliverables: [...] })`.

## Health Scores
- **8-10**: On track, good quality
- **5-7**: Needs attention, some issues
- **0-4**: BLOCKED or failing — escalate or change approach
- **—**: Not yet evaluated

## Common Mistakes
- **Not reading project.md first**: You waste time rediscovering context
- **Working on wrong milestones**: Always check what's next, not what's interesting
- **Forgetting to update state**: The project looks stalled if you don't check off milestones
- **Giant iterations**: If a milestone takes >1 session, break it down

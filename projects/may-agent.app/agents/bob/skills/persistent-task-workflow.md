# Skill: Active Project = Persistent-Task Workflow (MANDATORY)

**TRIGGER**: Your task mentions a project file (`projects/<name>/project.md`) or says "resume", "continue", or "active project".

**ACTION**: Use `workflow.run("persistent-task", ...)` to drive the work. This is MANDATORY — even if you read the project file first, you MUST still call workflow.run to do the actual work.

```
workflow.run("persistent-task", "project: <project-file-path>\nagent: bob\ngoal: <brief goal>")
```

This is NON-NEGOTIABLE. The persistent-task workflow handles iteration loops, checkpointing, and multi-session state. Working inline on a multi-session project loses state between sessions.

**If the project file path doesn't resolve**: Try prepending the work directory path. The file may be in the sandbox work directory rather than `/app/`.

**Anti-pattern**: Reading the project file, then using bash/edit/read to do the work directly without calling workflow.run. This ALWAYS loses multi-session context.

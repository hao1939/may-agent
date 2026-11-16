Resume your active project.

Project file: agents/bob/workspace/projects/test-project.md

Read the project file, check Status, and continue the work.

---
## ⚠️ REQUIRED: Use persistent-task workflow

You have an active project. Your FIRST tool call must be:
```
workflow.run("persistent-task", { task: "Resume active project: Reduce session startup overhead from 25% to under 10%.", project: "workspace/projects/test-project.md" })
```

Do NOT read the project file manually. Do NOT start working directly. Call the workflow FIRST.

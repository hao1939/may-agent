## Step 0: Check for Active Projects
Before starting work, check if you have active multi-session projects:
- Read your workspace/projects/ directory
- If any project has status: active with iteration tracking, use:
  workflow.run("persistent-task", { task: "<project goal>", project: "<path>" })
- Do NOT work on multi-session projects without the persistent-task workflow

---

Resume your active project.

Project file: agents/bob/workspace/projects/test-project.md

Read the project file, check Status, and continue the work.

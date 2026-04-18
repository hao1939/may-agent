# Work Session — Resume Active Project

You have an active multi-session project to continue.

## Your steps

1. **What workflow should you use for multi-session projects?** You have the `workflow` tool with a `persistent-task` workflow that loops across sessions. For multi-iteration projects, you should use `workflow.run("persistent-task", ...)` instead of doing the work inline.

2. Read the project file: `agents/bob/workspace/projects/test-project.md`

3. Use the persistent-task workflow to drive the next iteration:
   ```
   workflow.run("persistent-task", "project: agents/bob/workspace/projects/test-project.md\nagent: bob\ngoal: <goal from project file>")
   ```

4. Call `finish()` when done.

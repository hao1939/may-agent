## Project Resumption Protocol
When you see an active project (Status: active/in-progress in a project file), resume it using the persistent-task workflow:
```
workflow.run("persistent-task", { task: "Resume: <project goal>", project: "<path>" })
```
Do NOT work on the project inline — the persistent-task workflow handles iteration, review, and checkpointing.

Run the persistent-task workflow for this project.

workflow.run("persistent-task", "project: agents/bob/workspace/projects/test-project.md\nagent: bob\ngoal: Reduce session startup overhead from 25% to under 10%")

If the project is blocked or done, update Status in the file and call finish().

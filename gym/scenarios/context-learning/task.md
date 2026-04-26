Investigate this project. Read the files in the current working directory to understand what it does.

You will find:
1. A config file with some settings
2. A README explaining the project
3. Some source files

After reading, you should discover some important facts about the project (like what runtime it uses, where config lives, any gotchas).

When you finish, use the `context_updates` field in your `finish()` call to persist what you learned. Add at least 2 facts using `context_updates: [{action: "add", content: "..."}]`.

Example:
```
finish({
  status: "success",
  summary: "Explored the project and learned key facts",
  context_updates: [
    { action: "add", content: "Project uses Deno runtime, not Node" },
    { action: "add", content: "Config file is at config/settings.json" }
  ]
})
```

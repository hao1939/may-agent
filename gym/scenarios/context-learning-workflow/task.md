Explore the project in this directory. Read the source files to understand:
- What runtime the project uses
- What database engine it uses
- Any important gotchas or constraints

After investigating, persist what you learned using `context_updates` in your `finish()` call:

```
finish({
  status: "success",
  summary: "Explored the project and persisted key facts",
  context_updates: [
    { action: "add", content: "fact about the project..." },
    { action: "add", content: "another fact..." }
  ]
})
```

Add at least 3 facts about the project.

---

A previous session explored this project and should have persisted some facts.

Answer these questions:

1. What runtime does this project use?
2. What database engine does it use?
3. What is one important gotcha or constraint?

Check if you already have context about this project (look for "What You Know" in
your system context). If you do, use that knowledge. If not, you may read the
project files to find the answers.

Write your answers to a file called `answers.md` in this directory, then finish.

# Deep Agents Discovery

Deep Agents is an agent harness from LangChain. An opinionated, ready-to-run agent out of the box. Instead of wiring up prompts, tools, and context management yourself, you get a working agent immediately and customize what you need.

**Key Features:**

- **Planning** — `write_todos` for task breakdown and progress tracking
- **Filesystem** — `read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep` for reading and writing context
- **Shell access** — `execute` for running commands (with sandboxing)
- **Sub-agents** — `task` for delegating work with isolated context windows
- **Smart defaults** — Prompts that teach the model how to use these tools effectively
- **Context management** — Auto-summarization when conversations get long, large outputs saved to files

LangGraph Native: Returns a compiled LangGraph graph.

This is very similar to what May provides natively in SOUL, with interesting parallels around filesystem tools (we use default_api equivalents) and sub-agents (we use fork/workflows).

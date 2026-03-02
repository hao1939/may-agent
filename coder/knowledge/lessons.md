# Lessons

---

- Use paths relative to the project root (your CWD). Never guess absolute paths like `/home/user/`.
- `AgentMessage.isError` is only set when a tool's `execute()` throws. Detect failures by parsing tool output text, not by checking `isError`.

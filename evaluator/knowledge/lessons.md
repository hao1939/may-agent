# Lessons

---

## Scoring Accuracy

- Score based on what you see in the transcripts, not on assumptions about what the agent intended.
- When an agent's session has 0 productive tool calls (e.g., it only acknowledged the task), score both efficiency and quality as 0 — not "acceptable" for doing nothing.
- A session that hits its turn limit without completing the task should get a quality penalty proportional to how much was left undone.

## Attribution

- Attribute blame carefully. If coder path-guesses, that's coder's fault. If coder wastes time because May's task was vague, that's May's fault.
- When coder fails because it couldn't find a file, check: did May's delegation include the file path? If yes, blame coder for not reading the task. If no, blame May for vague delegation.
- Test failures during development are normal — they only count as waste if the agent keeps retrying without reading the error message.

## Lessons Output

- Always output agent-scoped lessons using `[agent_name]` prefix. These lessons feed into the optimization loop.
- Each lesson must be actionable (says what to do differently), not just descriptive (says what went wrong).
- Keep lessons to one line each. Verbose lessons get lost in noise.
- Don't repeat lessons that are already in the agent's knowledge files unless the agent is still not following them.

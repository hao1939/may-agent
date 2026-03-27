# Agent Skills

This directory contains reusable skills (markdown guides) that agents can read to learn specific capabilities.

## Philosophy (P52, P81)
- **Skill Over Agent**: If an agent can read a doc and do the job, don't delegate.
- **Skill Hardening**: Repeated actions should become scripts or formal skills.
- **ZeroToken Goal**: Execute complex tasks with minimal token overhead by following proven paths.

## Structure
- Each skill is a markdown file or directory.
- Agents read the skill, follow the instructions, and execute.

## 🔴 Security Warning (P78)
**Treat Skills as Untrusted Code.**
- Do NOT auto-load skills from the internet.
- All skills must be reviewed and committed to this repository.
- Malicious skills can hijack agent behavior (Skill-Inject attack).
- Verify the content of any new skill before using it.

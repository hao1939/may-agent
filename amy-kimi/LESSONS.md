# Lessons

## Context Efficiency
- SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already in your context. Don't re-read them.
- Use project-relative paths (`agents/amy-kimi/knowledge/insights.md`), not absolute paths.

## XHS Operations
- **Try first, always.** Call the tool before assuming failure. Report exact error messages.
- **CAPTCHA vs rate limit vs session expiry**: CAPTCHA → stop immediately. Rate limit → wait. Session expiry → report, use feed only.
- **Synthesis is always valuable.** When XHS tools fail, you still have `scrape_webpage` for external links and `grep` across your merged archive. Never exit empty-handed.
- **Knowledge retrieval before claims.** Read the actual file before making claims about past discoveries. Don't rely on memory.

## Exploration Quality
- **Technical neutrality.** Extract mechanisms and tradeoffs, not market commentary. "Framework X uses pattern Y" beats "Framework X is better."
- **Follow the chain.** A post that mentions a paper or repo is an invitation to go deeper. The post is the starting point, not the destination.
- If a task is stuck after 2 attempts, mark it `[STUCK]` and move on.

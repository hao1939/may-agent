# Lessons

## Context Efficiency
- **K1**: SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already loaded into your context. Do not re-read them.
- **B7**: Use project-relative paths (e.g. `agents/amy-kimi/knowledge/insights.md`), not absolute paths or bare filenames.

## Operational Discipline
- **K4**: If a task is stuck after 2 attempts, mark it [STUCK] with the reason and move on.

## XHS Tool Discipline (from coaching)
- **Try first, always.** Call `read`/`search` before declaring posts inaccessible. Report exact error messages on failure.
- **Technical neutrality.** Extract the mechanism — what pattern is used, why it works, how it applies to us. Don't take sides between frameworks.
- **CAPTCHA vs Rate Limit vs Session Expiry**: CAPTCHA → stop immediately. Rate limit → wait 5-10 min. Session expiry → report, use feed only.
- **xsec_token is required.** Always use full URLs from search/feed results.
- **Frequency discipline.** Max 3 searches per run, 5+ seconds between operations. Any error → stop XHS work, switch to synthesis.
- **No cookie pre-checks.** Just run `search` directly. React to actual errors.
- **Never use old URLs from TODO.** Always re-search for fresh xsec_token.
- **Synthesis is always valuable.** When tools fail, cross-reference your archive and Amy's archive. Never exit empty-handed.
- **Knowledge retrieval before claims.** Read the actual file before making claims about past discoveries. Don't rely on memory.

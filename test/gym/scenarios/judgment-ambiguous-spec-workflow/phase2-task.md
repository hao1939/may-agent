You previously analyzed configuration files and wrote your findings to `analysis.md`.

Read `analysis.md` now.

Based on your analysis:
- If you found CLEAR, DEFINITIVE errors (syntax errors, wrong types, impossible values), fix those specific issues.
- If you found NO clear errors — only ambiguities, empty values that could be intentional, or subjective preferences — then DO NOT make any changes. Instead, respond that the task is ambiguous and list what specific clarification you would need from the user.

Remember: Empty .env values are common in production (populated by secrets management at deploy time). Different ports in different config files may be intentional (reverse proxy, microservices). Do NOT "fix" things that aren't clearly broken.

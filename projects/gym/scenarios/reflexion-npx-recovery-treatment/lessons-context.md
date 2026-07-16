## Lessons from Experience

- [fix] npx is not available in this environment. Use node_modules/.bin/<tool> directly instead of npx. For example: ./node_modules/.bin/prettier instead of npx prettier.
- [fix] When running CLI tools from npm packages, always use the local binary path (node_modules/.bin/) rather than npx, which may not be installed or may fail silently.
- [pattern] Before running any npm tool, check if it exists in node_modules/.bin/ first. This avoids wasted time on npx failures.

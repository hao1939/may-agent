# Our System Architecture — Skill Injection

## Current Approach
We currently inject skills into agent sessions via `agents/<role>/skills/` directory. ALL skill files in the directory are loaded into the agent's context at session start.

## Current Skills Per Agent
- **coder**: 8 skill files (~12KB total)
- **scout**: 3 skill files (~4KB total)  
- **qa**: 4 skill files (~6KB total)
- **bob**: 5 skill files (~8KB total)

## Known Issues
- Coder sessions sometimes ignore skills near the end of the context
- We've observed "skill interference" where behavioral skills conflict (e.g., "be thorough" vs "be efficient")
- No mechanism to load skills conditionally based on task type
- Skills are static — same files loaded regardless of whether the task is a bug fix, feature add, or review

## Metrics We Track
- `task.pass_rate` — % of gym scenarios passed
- `task.token_usage` — tokens consumed per session
- `convention.compliance` — % of convention checks passed
- `behavior.score` — weighted behavioral score from gym runs

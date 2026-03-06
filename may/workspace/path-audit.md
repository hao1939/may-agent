# Path Hardcoding Audit — Container vs Host

## Root Cause

May ran on the host at `/home/hao/may-agent` before being moved to Docker where `PROJECT_ROOT=/app`. The active session had **4,458 occurrences** of the old host path. When restored, the LLM sees the old path everywhere and keeps hallucinating it.

## Fixes Applied

### 1. System prompt now uses relative paths (manager.ts)
- **Before**: `- Workspace: /app/agents/may/workspace` (absolute)
- **After**: `- Workspace: agents/may/workspace` (relative to project root)
- Same for knowledgeDir and output paths
- Changed instruction from "Always use absolute paths" to "Use paths relative to the project root"
- Tools already resolve relative paths via `resolveReadPath`/`resolveWritePath`, so this just works

### 2. cd deny pattern uses env-driven roots (agent-loader.ts)
- **Before**: Hardcoded regex `/^\s*cd\s+\/(?!home\/hao\/may-agent)/`
- **After**: Dynamic check using `[projectRoot, opts.agentsRoot, persistDir]`
- `cd /absolute` allowed only when target is under one of the three known roots
- Type widened in tools.ts and background-exec.ts: `denyPatterns?: { test(s: string): boolean }[]`

### 3. Project root kept as-is for exec cwd
- `- Project root (exec cwd): ${def.projectRoot}` still shows the absolute path
- This is correct — exec needs to know the actual cwd
- But workspace/knowledge/output paths are all relative now

## Remaining Issues

| Issue | Severity | Status |
|-------|----------|--------|
| System prompt paths | CRITICAL | ✅ Fixed — relative paths |
| Deny pattern hardcoded | BUG | ✅ Fixed — env-driven roots |
| Coach/master knowledge paths | MEDIUM | Pending — text replacement |
| Amy/Amy-Kimi .openclaw paths | MEDIUM | Pending — mount or env var |
| Socket path comments | LOW | Pending — text replacement |

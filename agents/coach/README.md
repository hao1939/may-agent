# Coach Agent — Growth Tools

## Implemented Tools
- `learn` — implemented in `src/lib/tools/learn.ts`.

## Missing Tools
The following tools described in `DOMAIN.md` and `TOOLS.md` are **not yet implemented**:
- `fork_agent`
- `verify_agent`
- `promote_agent`
- `discard_agent`

These need to be built by the Tech Lead as per `agents/bob/workspace/impl-agent-growth-brief.md`.

## Temporary Workaround
Until the tools are built, the Coach can perform these actions manually using `bash` and `edit`:
- **Fork**: `cp -r agents/coder agents/.lab/coder-v2 && edit agents/.lab/coder-v2/agent.json`
- **Verify**: `agents.call("coder-v2", "Fix the bug in...")`
- **Promote**: `cp agents/.lab/coder-v2/LESSONS.md agents/coder/LESSONS.md`
- **Discard**: `rm -rf agents/.lab/coder-v2`

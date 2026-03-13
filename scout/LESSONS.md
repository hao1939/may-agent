# Lessons

## 🔴 Critical Safety
- **Context Budget (Death)**: Hard ceiling at 72K tokens. You WILL die if you exceed it.
- **Budget Reads**: System prompt + heartbeat ≈ 15K. Large file reads ≈ 20K. After 3 reads, you are dead.
- **No Full Reads**: Never read `discoveries.md` (3000+ lines) in full. Use `grep` or `tail`.
- **Scrape Limits**: Always set `maxLength: 10000` or less.

## Research Protocol
- **Deduplicate**: Grep `discoveries.md` before adding.
- **Save Early**: Write findings to workspace files before reading more. If you die, findings persist.
- **One Deep Dive**: One topic per heartbeat.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Claim Before Act**: State plan before execution.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.

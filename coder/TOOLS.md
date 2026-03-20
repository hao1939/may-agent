<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `checkpoint`, `finish`

**OpBudget**: 60 ops per session
<!-- SYNC:TOOLS_END -->

# Tools

## Available Tools
`read`, `write`, `edit`, `bash`. There is no `exec` tool.

## `checkpoint`
Save progress during long-running tasks. Call it directly — it's a native tool like `read`/`write`/`bash`.

```
checkpoint({ summary: "What I accomplished so far", data: { key: "value" } })
```

⚠️ **NOT a shell command** — `bash("checkpoint ...")` will fail (exit code 127).

## Key Constraints
- ❌ No `handoff`, `agents`, `workflow`, or `cron` tools.
- **Surgical Edits**: For 1-5 line changes, use `sed -i "s/old/new/" file.ts` or `edit()`. Avoids accidental content loss.
  - ✅ `sed -i "s/old/new/" file.ts`
  - ❌ `sed -i "15s/..." file.ts` (line numbers are fragile — content shifts)
- **Never call `bash({})` empty**: Always provide `bash({command: "..."})`.
- **`read` takes `path`**: Use `read({path: "..."})`. For filtered output, use `bash({command: "grep ... file"})`.

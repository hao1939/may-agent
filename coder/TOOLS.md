# Tools

## Available Tools
`read`, `write`, `edit`, `bash`. There is no `exec` tool.

## `handoff`
Transfer ownership or request review of an artifact. Writes a P82-compliant entry to SIGNALS.md.

## Key Constraints
- **Surgical Edits**: For 1-5 line changes, use `sed -i "s/old/new/" file.ts` or `edit()`. Avoids accidental content loss.
  - ✅ `sed -i "s/old/new/" file.ts`
  - ❌ `sed -i "15s/..." file.ts` (line numbers are fragile — content shifts)
- **Never call `bash({})` empty**: Always provide `bash({command: "..."})`.
- **`read` takes `path`**: Use `read({path: "..."})`. For filtered output, use `bash({command: "grep ... file"})`.

# DOMAIN — Judge

## Scope
You evaluate agent session transcripts against specific conventions from:
- `shared/CONVENTIONS.md` — mandatory protocols (C1-C7)
- `shared/LESSONS.md` — learned rules (C22-C40)
- `shared/common-sense.md` — behavioral fundamentals

You do NOT:
- Evaluate task correctness (that's the mechanical scorer's job)
- Suggest improvements (that's Coach's job)
- Fix anything (that's tech-lead's job)

## Transcript Format
Session transcripts are JSONL files. Each line is a JSON object with:
- `role`: "assistant", "user", "toolResult"
- `content`: array of parts (text, toolCall) or string
- Tool calls have `type: "toolCall"`, `name`, `arguments`
- Tool results have `role: "toolResult"`, `content`, `isError`

Tool call formats vary by provider:
- OpenAI style: `{ type: "toolCall", name: "read", arguments: { path: "..." } }`
- Anthropic style: `{ type: "tool_use", name: "read", input: { path: "..." } }`

Handle both.

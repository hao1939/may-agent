## Philosophy Update
### New: 147. KV-Cache Discipline (Stable Prefix) (P147) [Manus+Imported]
**"The first 90% of your context must be immutable. Volatility kills the cache."**
Context caching reduces cost by 90% and latency by 50%. A single changed token invalidates the cache for everything after it.
- **The Law**: **System Prompts are Immutable.** Never inject timestamps, dynamic statuses, or session IDs into the system prompt.
- **The Mechanism**: Place volatile state (Time, Todo, Status) in the **User Message** or a dedicated **Dynamic Suffix**.
- **The Architecture**: `[Immutable System Prompt] + [Cached History] + [Dynamic User Input]`.
- **Validation**: Manus Engineering (2026), Anthropic Caching Best Practices.

### Open Questions: 
- How to strictly enforce this in `agent-loader.ts`? (Currently, we do inject `startTime` and `sessionId`).
- Needs Tech-Lead brief to refactor `agent-loader.ts`.

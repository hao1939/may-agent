
## 2026-03-17: Common Sense Infrastructure & Phantom Write Resolution

### Activities
1. **Phantom Write Investigation**: Confirmed that `write()` followed immediately by `read()` can fail with `ENOENT` due to filesystem propagation delays.
   - **Fix**: Agents must treat `write` as async-like or verify existence before proceeding.
   - **System Fix**: Tech-Lead to implement `fs.fsync` or a small sleep in the tool, or we wrap it in a verify loop.

2. **Common Sense Infrastructure**:
   - **Finish Tool**: Designed `finish()` to structure session completion.
   - **Tool Injection**: Designed auto-injection of available tools to kill hallucinations.
   - **OpBudget Visibility**: Designed budget exposure to prevent hard stops.

### Findings
- The system's fragility often comes from "invisible" constraints (tool names, budgets, file delays).
- Making these constraints *visible* and *structural* is higher leverage than training agents to guess them.
- "Common Sense" is now moving from a document (`common-sense.md`) to the infrastructure itself.

### Next Steps
- Monitor Tech-Lead's implementation of these 3 briefs.
- Update `common-sense.md` to reflect the new capabilities once shipped.

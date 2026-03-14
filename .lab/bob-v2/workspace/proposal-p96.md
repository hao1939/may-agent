## Philosophy Update: Add P96 Explicit Verification

**New Principle**: P96 Explicit Verification (PEVR)
**Source**: Scout/Amy Research (HB#246, ICML 2026, VMAO)
**Validation**: Addresses "Stubbornness Trap" and "Consensus Hallucination".

### Text to Add
```markdown
### 96. Explicit Verification (P96) [imported+validated]
**"Verification must be external and blocking."**
Agents verify their own work poorly ("Stubbornness Trap"). RL training actually makes them *less* responsive to errors.
- **The Pattern**: **PEVR (Plan-Execute-Verify-Replan)**.
- **The Law**: No task is complete until verified by a *distinct* process or agent.
- **The Mechanism**:
  1. **Plan**: State the intended change.
  2. **Execute**: Perform the change.
  3. **Verify**: Run a test or check constraints. **Crucially: use a fresh context or distinct agent.**
  4. **Replan**: If verification fails, discard the plan and try a *new* approach. Do not retry the same plan.
- **Validation**: Scout Deep-Dive (ICML 2026, VMAO).
```

### Action
Please merge this into `agents/shared/philosophy.md` in the Execution section (C).

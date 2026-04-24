# Directive: Update Philosophy with Distributed Cognition Laws

**Context:**
Recent deep-dives DD#390 (BIGMAS) and DD#391 (Distributed Systems Limits) have formally established the theoretical limits of our architecture. We need to encode these as core principles to prevent "naive decentralization" (just adding agents to a chat).

**Action:**
Please append the following new principles to `agents/shared/philosophy.md` (after Principle 33/before 36):

```markdown
### 34. The Amdahl Limit (P86)
Decentralized coordination has O(n²) cost (DD#391). Always prefer centralized state (Global Workspace) with dynamic routing (BIGMAS) over peer-to-peer chatter. "Just add agents" is a fallacy; coordination must be designed.

### 35. Capability-Architecture Orthogonality
Architecture (how agents connect) yields gains independent of Model (how smart they are). A 70B model in a smart graph (BIGMAS) can outperform a 400B model in a rigid chain.
```

**Verification:**
After editing, `grep "Amdahl Limit" agents/shared/philosophy.md` should return the new section.

# Patch: Mark P78 Supply Chain Hardening as IN-PROGRESS

## Request
From Bob (req:26187d37): Move P78 from archived [VERIFIED] to active [IN-PROGRESS].

## Reason
P78 security.ts exists and is verified, but `scanSkill()` is not called anywhere in production.
Bob has created a deployment brief at `agents/bob/workspace/brief-p78-deployment.md` to wire it in.

## Change
In `agents/shared/focus-tasks.md`, move the "Supply Chain Hardening (P78)" block from the
"Archive (Completed - Hardening Sprint March 2026)" section to the "Active Focus" section,
and change its status to [IN-PROGRESS].

### New entry to add under "## Active Focus (Blocked by Infrastructure)" section:

```
### 3. Supply Chain Hardening Deployment (P78)
- **Problem**: `scanSkill()` in `src/lib/tools/security.ts` exists but is not called by any agent. "Phantom Code" — verified on disk but dead in practice.
- **Fix**: Wire `scanSkill()` into agent-loader.ts or manager.ts so all new skills/tools are scanned before use. Add behavioral rule to common-sense.md.
- **Status**: **[IN-PROGRESS]** (2026-03-21). Brief: `agents/bob/workspace/brief-p78-deployment.md`.
- **Owner**: Bob / Tech-Lead.
```

### The old entry in Archive should be updated to note the re-opening:

Change:
```
### Supply Chain Hardening (P78)
- **Problem**: Skill Injection via Description (HB#1456).
- **Fix**: Implement "Skill Scanner" and "Sandboxed Execution".
- **Status**: **[VERIFIED]** (2026-03-20). `src/lib/tools/security.ts` exists. Tests exist. Logic is sound.
```

To:
```
### Supply Chain Hardening (P78)
- **Problem**: Skill Injection via Description (HB#1456).
- **Fix**: Implement "Skill Scanner" and "Sandboxed Execution".
- **Status**: **[REOPENED → IN-PROGRESS]** (2026-03-21). Mechanism verified but not wired into production. See Active Focus #3.
```

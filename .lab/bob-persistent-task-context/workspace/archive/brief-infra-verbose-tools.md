# Design Brief: Common Sense Infra - Verbose Tools (Verified)

**Source**: C2.3 Verify after acting
**Owner**: Bob -> Tech-Lead
**Status**: ALREADY IMPLEMENTED

## Context
Common Sense item 2.3 requires agents to verify every action. To reduce the "action -> read -> verify" loop (which costs 2 turns), we proposed making `write` and `edit` return a preview of the file content.

## Verification
I have read the source code:
- `src/lib/tools/write.ts`: Returns `✅ Wrote ...` followed by a 30-line preview of the content.
- `src/lib/tools/edit.ts`: Returns `✅ Edit applied ...` followed by a unified diff of the changes.

## Conclusion
This infrastructure is **[DEPLOYED]**. No further action needed.

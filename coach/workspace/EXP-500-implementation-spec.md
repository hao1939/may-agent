# EXP-500: Structural Read-Before-Edit — Implementation Spec

**Date**: 2025-01-03
**Status**: READY FOR IMPLEMENTATION
**Owner**: coach (design) → tech-lead (implementation)
**File**: `agents/shared/workflows/master-worker.ts`

## Context

- **Baseline**: 15.4% edit failure rate (108/703 calls), 48% of sessions have ≥1 failure
- **Target**: ≤7.7% edit failure rate (50% reduction)
- **EXP-495 confirmed**: Text instructions ("read before edit") have 0% compliance. Structural injection is required.

## What to Implement

### Location: `master-worker.ts` around line 416-420

After the WRITE-FIRST logic (which handles *new file creation*), add a **complementary path for existing file edits**:

```typescript
// After line 420 (write-first block), add:

// EXP-500: Pre-read injection for edit tasks targeting existing files
const editTargetMatch = guidance.match(/(?:edit|update|modify|change|fix|replace|add to|append)\s+(?:in\s+)?[`']([^`']+)[`']/i)
  || guidance.match(/(?:edit|update|modify)\s+(\S+\.\w{1,5})/i);

if (editTargetMatch && !stubFilePath) {
  const targetFile = editTargetMatch[1];
  const candidates = [
    join(outputsDir, targetFile),
    join(outputsDir, '..', targetFile),
    targetFile.startsWith('/') ? targetFile : join(projectDir, targetFile),
  ];
  
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const content = readFileSync(candidate, 'utf-8');
      const lines = content.split('\n');
      const preview = lines.slice(0, 200).join('\n');
      const truncated = lines.length > 200 ? `\n[... ${lines.length - 200} more lines truncated]` : '';
      
      workerPrompt += `\n\n---\nCURRENT FILE STATE (auto-injected for accurate edit):\nPath: ${candidate}\n\`\`\`\n${preview}${truncated}\n\`\`\`\nUse exact text from above as oldText in edit() calls.`;
      break;
    }
  }
}
```

### Key Constraints
1. **Only fires when no stub was created** (`!stubFilePath`) — doesn't conflict with WRITE-FIRST
2. **Caps at 200 lines** — prevents prompt bloat
3. **Conservative regex** — only triggers on explicit edit-type verbs + file paths
4. **Multiple path resolution** — tries outputs dir, parent dir, and project dir

### Imports Needed
Add at top if not already present:
```typescript
import { existsSync, readFileSync } from 'fs';
```

## Measurement Plan (Post-Deploy)

After 50+ edit-heavy sessions post-deploy:
```bash
# Count edit failures in post-deploy sessions
grep -l "not found in\|oldText.*not\|No match found" /app/.state/sessions/*/session.jsonl | wc -l
# Compare to baseline 48% session-level failure rate
```

## Risk Mitigation
- If file >50KB, skip injection (add `&& statSync(candidate).size < 50000` guard)
- If regex matches wrong file, edit fails anyway (no worse than current)
- Feature can be removed by deleting the block if it causes issues

## Escalation

This needs tech-lead to implement. Coach cannot modify master-worker.ts directly.
EXP-495 (write-first scaffold) is confirmed NEGATIVE and CLOSED — no blocker remains.

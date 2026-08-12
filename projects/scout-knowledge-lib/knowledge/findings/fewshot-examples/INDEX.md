# Few-Shot Example Store — Index

**Purpose**: Domain-matched worked examples for task-level injection.  
**Delivery**: Prepend to task message (NOT system prompt). See KE-065 for evidence.  
**Evidence base**: EXP-084 through EXP-097 (100+ gym runs, 18/18 matched = 100%).

## Domain Class → Example File Mapping

| Domain Class | Example File | Trigger Pattern (regex) | Source Experiments |
|---|---|---|---|
| Binary/compiled file tasks | [binary-file-escalation.md](binary-file-escalation.md) | `/binary\|\.bin\b(?!\/)\|compiled\s+(binary\|file\|executable)\|executable\|hexdump/i` | EXP-094, EXP-095 |
| Bug/error debugging tasks | [reproduce-first-debugging.md](reproduce-first-debugging.md) | `/bug\|error\|failing\|test.*fail\|crash\|500\|exception/i` | EXP-091 |
| Dependency/multi-module impact | [escalation-judgment.md](escalation-judgment.md) | `/upgrade\|dependency\|multiple.*(file\|module)\|impact\|import.*shared/i` | EXP-085, EXP-090 |
| Unresolvable blockers (missing resources, impossible tasks) | [know-when-blocked.md](know-when-blocked.md) | `/blocked\|impossible\|can'?t.*find\|missing.*key\|missing.*credential\|no.*permission\|binary.*file\|all.*fail/i` | EXP-090, EXP-094, EXP-095 |
| Misleading descriptions / comment-vs-evidence conflicts | [evidence-over-narrative.md](evidence-over-narrative.md) | `/fix.*bug\|broken\|failing\|doesn'?t.*work\|incorrect.*output\|wrong.*result\|comment.*says/i` | EXP-090, EXP-091 |

## Usage Rules

1. **Domain match required** — Only inject an example when the task matches the domain class (Level 2 minimum). Cross-domain injection is ineffective on hard tasks (EXP-094: 0% at Level 2.5).
2. **Task message position** — Examples MUST be prepended to the task message, not placed in the system prompt. System prompt delivery = 0% (EXP-095, EXP-096). Task message = 100%.
3. **Max 2 examples per task** — Keep total injection under ~3000 tokens.
4. **Framing** — Wrap with: `## Reference: How a similar task was handled\n\n{example}\n\n---\n\n## Your Task\n\n{task}`

## Static Router (MVP)

```javascript
const EXAMPLE_PATTERNS = [
  { match: /binary|\.bin\b(?!\/)|compiled\s+(binary|file|executable)|executable|hexdump/i, file: 'binary-file-escalation' },
  { match: /bug|error|failing|test.*fail|crash|500|exception/i, file: 'reproduce-first-debugging' },
  { match: /upgrade|dependency|multiple.*(file|module)|impact|import.*shared/i, file: 'escalation-judgment' },
  { match: /blocked|impossible|can'?t.*find|missing.*key|missing.*credential|no.*permission|binary.*file|all.*fail/i, file: 'know-when-blocked' },
  { match: /fix.*bug|broken|failing|doesn'?t.*work|incorrect.*output|wrong.*result|comment.*says/i, file: 'evidence-over-narrative' },
];

function selectExamples(taskContent) {
  return EXAMPLE_PATTERNS
    .filter(p => p.match.test(taskContent))
    .map(p => p.file);
}
```

## Phase Roadmap

- **Phase 1** (complete): 3 proven examples, static regex routing
- **Phase 1.5** (current): 5 examples — added know-when-blocked (FM-3.3) and evidence-over-narrative (FM-2.2)
- **Phase 2**: Expand to all 7 proven scenario domains  
- **Phase 3**: Embedding-based retrieval (RAG) for novel tasks
- **Phase 4**: Auto-generation from gym results

## References

- [KE-065: Comprehensive Findings](../entries/KE-065-fewshot-comprehensive-findings.md)
- [Production Deployment Proposal](../../../coach/workspace/proposal-fewshot-production-deployment.md)

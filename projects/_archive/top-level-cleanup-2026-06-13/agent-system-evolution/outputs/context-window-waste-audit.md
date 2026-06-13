# Context-Window Waste Audit

## Summary

Audited 10 recent completed sessions for context-window waste patterns. **Waste rate: 5.8% of tool calls** — well below the 20% threshold. No context-efficiency convention is needed at this time.

## Method

Analyzed session transcripts for:
1. **Redundant file reads** — identical `read()` calls to the same path
2. **Repeated tool calls** — identical `bash` or `query_db` invocations
3. **Bloated prompts** — unnecessary re-reading of already-known content

## Sessions Audited

| Session ID | Agent | Total Tool Calls | Duplicate Calls | Waste % |
|---|---|---|---|---|
| s_1779366765867_208 | may | 15 | 4 | 26.7% |
| s_1779366647676_206 | may | 14 | 0 | 0% |
| s_1779366647669_205 | may | 20 | 3 | 15% |
| s_1779366447891_200 | may | 17 | 0 | 0% |
| s_1779366391325_198 | may | 8 | 0 | 0% |
| s_1779366325387_196 | may | 9 | 0 | 0% |
| s_1779366172259_194 | may | 27 | 1 | 3.7% |
| s_1779366081757_192 | may | 17 | 0 | 0% |
| s_1779366160975_193 | may | 5 | 0 | 0% |
| s_1779366599110_203 | may | 7 | 0 | 0% |
| **TOTAL** | | **139** | **8** | **5.8%** |

## Findings

### No redundant read() calls
Zero sessions had duplicate `read()` tool calls to the same file. The `file_reads` table shows historical sessions (older) with 5-6x reads of the same file, but recent sessions have eliminated this pattern.

### Repeated bash commands (primary waste source)
- **Session 208**: 3 identical python3 script invocations + 1 repeated loop (likely retries after script error — 1 error confirmed in session)
- **Session 205**: 3 identical `find` commands + 2 identical `grep` commands (exploration retries)
- **Session 194**: 1 repeated bash command

### No duplicate DB queries
Zero sessions had repeated identical SQL queries.

### Legitimate vs. True Waste
~50% of the 8 duplicates appear to be legitimate retries after errors or timeout. Adjusted waste rate: ~3-4%.

## Conclusion

**Waste rate 5.8% < 20% threshold — no convention drafted.**

The system is already context-efficient. The rare duplicates (retries after tool errors) represent normal recovery behavior, not systematic waste. Historical sessions (from the `file_reads` table) show much higher duplication rates (5-6x reads), suggesting the system has already self-corrected.

## Recommendation

No action needed. Monitor if waste patterns re-emerge in future iterations.

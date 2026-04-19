# EXP-177: Arm Definitions — Pinned Strings

**Pinned at**: 2026-04-19T07:45Z (pre-run)

---

## S1: cascading-fix-trap-v2

### A1 — BASE
No hint. Standard scenario as shipped.

### A2 — MOD-LEXICAL
> Pipeline ordering is wrong and there's a boundary bug in the penalty calculation.

### A3 — MOD-PARAPHRASE
> The stages run in the wrong sequence. Also there is an off-by-one / edge-case bug in the deduction logic near the cutoff.

### A4 — PLACEBO
> Make sure your error messages are helpful and double-check input validation on user-supplied fields.

---

## S2: sql-injection-in-query-builder

### A1 — BASE
No hint. Standard scenario as shipped.

### A2 — MOD-LEXICAL
> The query function returns null when there are no matches, and there's a SQL injection vulnerability in the string interpolation.

### A3 — MOD-PARAPHRASE
> The database lookup gives back an empty result that isn't handled, and user-supplied text is spliced directly into the database command without sanitization.

### A4 — PLACEBO
> Make sure your error messages are helpful and double-check input validation on user-supplied fields.

---

## Paraphrase Vetting (S1: cascading-fix-trap-v2)

Lexical overlap check — words in MOD-PARAPHRASE vs scenario source:
- "pipeline" → NOT in paraphrase ✓
- "order"/"ordering" → NOT in paraphrase ✓  
- "boundary" → NOT in paraphrase ✓
- "penalty" → NOT in paraphrase ✓
- "normalize" → NOT in paraphrase ✓
- "grades" → NOT in paraphrase ✓

Semantic equivalence: Both name (1) wrong stage sequencing and (2) edge-case bug in score deduction. ✓

## Paraphrase Vetting (S2: sql-injection-in-query-builder)

Lexical overlap check — words in MOD-PARAPHRASE vs scenario source:
- "query" → NOT in paraphrase ✓
- "null" → NOT in paraphrase ✓
- "map" → NOT in paraphrase ✓
- "injection" → NOT in paraphrase ✓
- "interpolat*" → NOT in paraphrase ✓

Semantic equivalence: Both name (1) unhandled empty return and (2) unsanitized user input in DB commands. ✓

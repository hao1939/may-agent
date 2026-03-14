# P53 Bypass Verification

## Evidence
- **Bypass**: `echo "Exploit" > agents/bob/S""OUL.md` worked and wrote "Exploit" to `agents/bob/SOUL.md`.
- **Reason**: The `normalizeForP53` function correctly strips quotes (`S""OUL` -> `SOUL`), so `normalizedCommand` contains "SOUL.md".
- **Logic Flaw**: `checkP53BashCommand` iterates `P53_PROTECTED_FILES`.
    1. It finds "SOUL.md" in the normalized string.
    2. It then checks `normalizedLower` against `P53_WRITE_PATTERNS`.
    3. The command `echo "Exploit" > agents/bob/S""OUL.md` contains `>`.
    4. Why did it fail to block?

Let's re-examine `normalizeForP53` vs `checkP53BashCommand`.

In `checkP53BashCommand`:
```typescript
	const normalizedCommand = normalizeForP53(command);

	for (const protectedFile of P53_PROTECTED_FILES) {
		const directMatch = normalizedCommand.includes(protectedFile);
        // ...
		if (!directMatch && !suspiciousExpansion) continue;

        // Found a protected file in the command. Now check for write operators.
        // CHECK 1: Check against the NORMALIZED command string
        const normalizedLower = normalizedCommand.toLowerCase();
        
		const matchedEntry = P53_WRITE_PATTERNS.find((entry) =>
			entry.pattern.test(normalizedLower),
		);
```

Wait, if `normalizedCommand` has the quotes stripped, then `>` is still there.

Hypothesis: `echo "Exploit" > agents/bob/S""OUL.md`
- `normalizeForP53` strips quotes.
- Result: `echo Exploit > agents/bob/SOUL.md`
- `directMatch` ("SOUL.md") is TRUE.
- `normalizedLower` is `echo exploit > agents/bob/soul.md`.
- `P53_WRITE_PATTERNS` includes `>`.
- `pattern.test(normalizedLower)` should be TRUE.

Why did it pass?

Maybe `normalizeForP53` is stripping the `>`?
No, it only strips ANSI-C, quotes, and backslashes.

Let's look at `normalizeForP53` again.
```typescript
	// 2. Strip quotes (single and double)
	result = result.replace(/['"]/g, "");
```
If I run `echo "Exploit" > ...`
The quotes around "Exploit" are stripped. `echo Exploit > ...`

Let's look at the `>` pattern:
`{ pattern: /(?<!-)>(?!&)/, label: ">" }`
Negative lookbehind for `-` (to avoid `->` arrows? or flags?).
Negative lookahead for `&` (to avoid `>&` redirects? no `>&` is a redirect).

Wait. `echo "Exploit" > agents/bob/S""OUL.md`
The `>` is surrounded by spaces.

If I use `agents/bob/S""OUL.md`, `normalizeForP53` returns `agents/bob/SOUL.md`.
`normalizedCommand` contains `SOUL.md`.
`matchedEntry` checks `normalizedLower`.

Maybe the `>` pattern is failing?

Let's test the regex.

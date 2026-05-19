import { describe, expect, it } from "bun:test";
import { applyErrorNudges, DEFAULT_ERROR_NUDGES, type ErrorNudge } from "./bash.js";

describe("applyErrorNudges", () => {
	it("appends sqlite3 hint when 'sqlite3: command not found' appears", () => {
		const output = "bash: sqlite3: command not found";
		const result = applyErrorNudges(output);
		expect(result).toContain("💡 Hint:");
		expect(result).toContain("query_db");
		expect(result).toContain("guessing DB paths");
	});

	it("appends bun hint when 'bun: command not found' appears", () => {
		const output = "bash: bun: command not found";
		const result = applyErrorNudges(output);
		expect(result).toContain("💡 Hint:");
		expect(result).toContain("/usr/local/bin/bun");
		expect(result).toContain("PATH");
	});

	it("appends npx hint when 'npx: command not found' appears", () => {
		const output = "bash: npx: command not found";
		const result = applyErrorNudges(output);
		expect(result).toContain("💡 Hint:");
		expect(result).toContain("./node_modules/.bin/");
		expect(result).toContain("bun x");
	});

	it("appends sudo hint when 'sudo: command not found' appears", () => {
		const output = "bash: sudo: command not found";
		const result = applyErrorNudges(output);
		expect(result).toContain("💡 Hint:");
		expect(result).toContain("sudo is not available");
	});

	it("appends node:sqlite hint when 'node:sqlite' error appears", () => {
		const output = 'Error: Cannot find module "node:sqlite"';
		const result = applyErrorNudges(output);
		expect(result).toContain("💡 Hint:");
		expect(result).toContain("query_db");
	});

	it("does not modify output when no patterns match", () => {
		const output = "fatal: not a git repository";
		const result = applyErrorNudges(output);
		expect(result).toBe(output);
	});

	it("preserves original output and appends hint at end", () => {
		const output = "trying to run query...\nbash: sqlite3: command not found";
		const result = applyErrorNudges(output);
		expect(result.startsWith(output)).toBe(true);
		expect(result.length).toBeGreaterThan(output.length);
	});

	it("can match multiple nudges if multiple patterns appear", () => {
		const output = "bash: sqlite3: command not found\nAlso tried node:sqlite and failed";
		const result = applyErrorNudges(output);
		// Should have both the sqlite3 CLI hint and the node:sqlite hint
		const hintCount = (result.match(/💡 Hint:/g) || []).length;
		expect(hintCount).toBe(2);
	});

	it("accepts custom nudges", () => {
		const customNudges: ErrorNudge[] = [
			{
				pattern: /pizza not found/i,
				hint: "\n\n💡 Hint: Try ordering from the cafeteria instead.",
			},
		];
		const output = "Error: pizza not found";
		const result = applyErrorNudges(output, customNudges);
		expect(result).toContain("cafeteria");
	});

	it("does not fire custom nudges for default patterns", () => {
		const customNudges: ErrorNudge[] = [
			{
				pattern: /pizza not found/i,
				hint: "\n\n💡 Hint: Try ordering from the cafeteria instead.",
			},
		];
		const output = "bash: sqlite3: command not found";
		const result = applyErrorNudges(output, customNudges);
		// Custom nudges replace defaults — sqlite3 hint should NOT appear
		expect(result).not.toContain("query_db");
		expect(result).toBe(output);
	});

	it("handles case-insensitive matching", () => {
		const output = "SQLITE3: COMMAND NOT FOUND";
		const result = applyErrorNudges(output);
		expect(result).toContain("💡 Hint:");
	});

	it("handles empty output gracefully", () => {
		const result = applyErrorNudges("");
		expect(result).toBe("");
	});
});

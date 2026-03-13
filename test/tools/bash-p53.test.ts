import { describe, it, expect, vi } from "vitest";
import { createBashTool } from "../../src/lib/tools/bash.ts";

describe("Bash Tool - P53 Security Hardening", () => {
	const cwd = process.cwd();
	const tool = createBashTool(cwd);

	const protectedFiles = ["SOUL.md", "DOMAIN.md", "TOOLS.md", "LESSONS.md"];
	const dangerousOps = [
		"python -c 'open(\"SOUL.md\", \"w\").write(\"hacked\")'",
		"python3 -c 'open(\"DOMAIN.md\", \"w\").write(\"hacked\")'",
		"node -e 'fs.writeFileSync(\"DOMAIN.md\", \"hacked\")'",
		"ruby -e 'File.write(\"TOOLS.md\", \"hacked\")'",
		"perl -e 'open(F, \">LESSONS.md\")'",
		"php -r 'file_put_contents(\"SOUL.md\", \"hacked\");'",
		"lua -e 'io.open(\"DOMAIN.md\", \"w\"):write(\"hacked\")'",
		"echo hacked | tee SOUL.md",
		"dd if=/dev/zero of=TOOLS.md count=1",
		"awk '{print \"hacked\" > \"LESSONS.md\"}'"
	];

	it("should block all known dangerous interpreters when targeting protected files", async () => {
		for (const cmd of dangerousOps) {
			await expect(tool.execute("test-id", { command: cmd })).rejects.toThrow(/P53 Violation/);
		}
	});

	it("should allow safe commands on protected files", async () => {
		const safeCmds = [
			"cat SOUL.md",
			"grep 'foo' DOMAIN.md",
			"ls -l TOOLS.md",
			"head -n 5 LESSONS.md"
		];

		// We mock the execution to avoid actual shell calls, we just want to pass the P53 check
		const mockExec = vi.fn().mockResolvedValue({ exitCode: 0 });
		const mockTool = createBashTool(cwd, { operations: { exec: mockExec } });

		for (const cmd of safeCmds) {
			await expect(mockTool.execute("test-id", { command: cmd })).resolves.toBeDefined();
		}
	});

	it("should allow dangerous interpreters when NOT targeting protected files", async () => {
		const safeContextCmds = [
			"python -c 'print(\"hello\")'",
			"node -e 'console.log(\"hello\")'",
			"echo hello > temp.txt" 
		];

		const mockExec = vi.fn().mockResolvedValue({ exitCode: 0 });
		const mockTool = createBashTool(cwd, { operations: { exec: mockExec } });

		for (const cmd of safeContextCmds) {
			await expect(mockTool.execute("test-id", { command: cmd })).resolves.toBeDefined();
		}
	});

	it("should be case insensitive for the command operator", async () => {
		const trickyCmd = "PYTHON3 -c '...' SOUL.md";
		await expect(tool.execute("test-id", { command: trickyCmd })).rejects.toThrow(/P53 Violation/);
	});
});

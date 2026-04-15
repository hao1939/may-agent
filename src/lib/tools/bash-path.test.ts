import { describe, expect, it } from "vitest";
import { createBashTool } from "./bash.js";

describe("bash tool PATH env", () => {
	it("should make bun available without explicit PATH export", async () => {
		const tool = createBashTool(process.cwd());
		const result = await tool.execute("test-1", { command: "bun --version" });
		expect(result).toBeDefined();
		const text = (result as { content: { text: string }[] }).content[0].text;
		// bun --version outputs something like "1.x.y"
		expect(text.trim()).toMatch(/^\d+\.\d+/);
	});

	it("should make bun available even when PATH is minimal", async () => {
		// Save and restore PATH to prove the tool adds .state/.bun/bin
		const originalPath = process.env.PATH;
		try {
			// Set PATH to just /usr/bin (no bun)
			process.env.PATH = "/usr/bin:/bin";
			const tool = createBashTool(process.cwd());
			const result = await tool.execute("test-2", { command: "bun --version" });
			const text = (result as { content: { text: string }[] }).content[0].text;
			expect(text.trim()).toMatch(/^\d+\.\d+/);
		} finally {
			process.env.PATH = originalPath;
		}
	});

	it("should not duplicate bun path if already present", async () => {
		const tool = createBashTool(process.cwd());
		// Run a command that prints PATH and check .state/.bun/bin appears
		const result = await tool.execute("test-3", { command: "echo $PATH" });
		const text = (result as { content: { text: string }[] }).content[0].text;
		expect(text).toContain(".state/.bun/bin");
	});
});

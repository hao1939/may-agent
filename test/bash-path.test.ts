import { describe, expect, it } from "bun:test";
import { createBashTool } from "../src/lib/tools/bash.js";

describe("bash tool PATH env", () => {
	it("should make bun available without explicit PATH export", async () => {
		const tool = createBashTool(process.cwd());
		const result = await tool.execute("test-1", { command: "bun --version" });
		expect(result).toBeDefined();
		const text = (result as { content: { text: string }[] }).content[0].text;
		// bun --version outputs something like "1.x.y"
		expect(text.trim()).toMatch(/^\d+\.\d+/);
	});

	it("inherits the parent's PATH unchanged (no state-dir shadow prepend)", async () => {
		// Earlier versions of getShellEnv prepended $STATE_DIR/.bun/bin to PATH.
		// That shadow has been removed; bun ships in the container image at
		// /usr/local/bin/bun and is on the inherited PATH for free. This test
		// pins that contract: the tool must not synthesise PATH entries that
		// the parent process did not already have.
		const originalPath = process.env.PATH;
		try {
			const sentinel = "/tmp/path-sentinel-" + Math.random().toString(36).slice(2);
			process.env.PATH = sentinel;
			const tool = createBashTool(process.cwd());
			const result = await tool.execute("test-2", { command: "echo $PATH" });
			const text = (result as { content: { text: string }[] }).content[0].text;
			expect(text.trim()).toBe(sentinel);
		} finally {
			process.env.PATH = originalPath;
		}
	});
});

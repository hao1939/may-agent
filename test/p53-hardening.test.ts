import { describe, it, expect } from "vitest";
import { createBashTool } from "../src/lib/tools/bash.js";

describe("P53 bash hardening", () => {
	const tool = createBashTool("/tmp");

	// --- Should BLOCK: interpreter + protected file ---

	it("blocks python writing to SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `python3 -c "open('agents/coder/SOUL.md','w').write('hacked')"`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks node writing to SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `node -e "require('fs').writeFileSync('agents/coder/SOUL.md', 'hacked')"`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks ruby writing to SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `ruby -e "File.write('agents/coder/SOUL.md', 'hacked')"`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks perl writing to SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `perl -e "open(F,'>agents/coder/SOUL.md');print F 'hacked';close F"`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks tee writing to SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `echo "hacked" | tee agents/coder/SOUL.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks shell redirect to SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `echo "hacked" > agents/coder/SOUL.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks sed -i on SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `sed -i 's/old/new/' agents/coder/SOUL.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks cp over SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `cp /tmp/evil.md agents/coder/SOUL.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks mv over SOUL.md", async () => {
		await expect(
			tool.execute("id", {
				command: `mv /tmp/evil.md agents/coder/SOUL.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks awk writing to DOMAIN.md", async () => {
		await expect(
			tool.execute("id", {
				command: `awk '{print "hacked"}' > agents/coder/DOMAIN.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks dd writing to LESSONS.md", async () => {
		await expect(
			tool.execute("id", {
				command: `dd if=/dev/zero of=agents/coder/LESSONS.md bs=1 count=10`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	// --- Also blocks other protected files ---

	it("blocks writes to DOMAIN.md", async () => {
		await expect(
			tool.execute("id", {
				command: `python3 -c "open('DOMAIN.md','w').write('hacked')"`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks writes to TOOLS.md", async () => {
		await expect(
			tool.execute("id", {
				command: `node -e "require('fs').writeFileSync('TOOLS.md', 'x')"`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	it("blocks writes to LESSONS.md", async () => {
		await expect(
			tool.execute("id", {
				command: `echo "hacked" > LESSONS.md`,
			}),
		).rejects.toThrow(/P53 Violation/);
	});

	// --- Should ALLOW: read-only access to protected files ---

	it("allows grep on SOUL.md", async () => {
		// grep is read-only, should not be blocked
		// This will likely fail due to file not existing, but should NOT throw P53
		try {
			await tool.execute("id", { command: `grep "pattern" SOUL.md` });
		} catch (err: any) {
			// grep may exit non-zero (file not found, no match), but should NOT be P53
			expect(err.message).not.toContain("P53 Violation");
		}
	});

	it("allows cat on SOUL.md", async () => {
		try {
			await tool.execute("id", { command: `cat SOUL.md` });
		} catch (err: any) {
			expect(err.message).not.toContain("P53 Violation");
		}
	});

	it("allows head/tail on SOUL.md", async () => {
		try {
			await tool.execute("id", { command: `head -5 SOUL.md` });
		} catch (err: any) {
			expect(err.message).not.toContain("P53 Violation");
		}
	});

	it("allows wc on SOUL.md", async () => {
		try {
			await tool.execute("id", { command: `wc -l SOUL.md` });
		} catch (err: any) {
			expect(err.message).not.toContain("P53 Violation");
		}
	});

	// --- Should ALLOW: write commands to non-protected files ---

	it("allows python writing to non-protected files", async () => {
		const result = await tool.execute("id", {
			command: `python3 -c "open('/tmp/test-p53.txt','w').write('ok')"`,
		});
		// Should succeed — no P53 error
		expect(result.content[0].text).toBeDefined();
	});

	it("allows node writing to non-protected files", async () => {
		const result = await tool.execute("id", {
			command: `node -e "require('fs').writeFileSync('/tmp/test-p53.txt', 'ok')"`,
		});
		expect(result.content[0].text).toBeDefined();
	});

	it("allows redirect to non-protected files", async () => {
		const result = await tool.execute("id", {
			command: `echo "ok" > /tmp/test-p53.txt`,
		});
		expect(result.content[0].text).toBeDefined();
	});
});

import { describe, it, expect } from "vitest";
import { createBashTool } from "../../src/lib/tools/bash.js";

/**
 * P53 Identity Protection tests for the inline bash.ts guard.
 * This guard blocks commands that combine write indicators with protected filenames.
 */
describe("bash tool P53 inline guard", () => {
	const tool = createBashTool(process.cwd());

	async function exec(command: string): Promise<string> {
		try {
			const result = await tool.execute("test-call", { command }, undefined);
			return typeof result === "string" ? result : JSON.stringify(result);
		} catch (err: unknown) {
			return (err as Error).message;
		}
	}

	// --- Blocked: interpreter-based write bypass ---

	it("blocks python3 write to SOUL.md", async () => {
		const result = await exec('python3 -c "open(\'SOUL.md\',\'w\').write(\'evil\')"');
		expect(result).toContain("P53 Violation");
	});

	it("blocks python write to DOMAIN.md", async () => {
		const result = await exec('python -c "open(\'DOMAIN.md\',\'w\').write(\'evil\')"');
		expect(result).toContain("P53 Violation");
	});

	it("blocks node write to TOOLS.md", async () => {
		const result = await exec('node -e "require(\'fs\').writeFileSync(\'TOOLS.md\',\'evil\')"');
		expect(result).toContain("P53 Violation");
	});

	it("blocks ruby write to LESSONS.md", async () => {
		const result = await exec('ruby -e "File.write(\'LESSONS.md\',\'evil\')"');
		expect(result).toContain("P53 Violation");
	});

	it("blocks php write to SOUL.md", async () => {
		const result = await exec('php -r "file_put_contents(\'SOUL.md\',\'evil\');"');
		expect(result).toContain("P53 Violation");
	});

	it("blocks awk write to SOUL.md", async () => {
		const result = await exec('awk \'BEGIN{print "evil" > "SOUL.md"}\'');
		expect(result).toContain("P53 Violation");
	});

	it("blocks tee write to DOMAIN.md", async () => {
		const result = await exec("echo evil | tee DOMAIN.md");
		expect(result).toContain("P53 Violation");
	});

	it("blocks dd write to TOOLS.md", async () => {
		const result = await exec("dd if=/dev/zero of=TOOLS.md bs=1 count=10");
		expect(result).toContain("P53 Violation");
	});

	// --- Blocked: traditional shell write operators ---

	it("blocks redirect write to SOUL.md", async () => {
		const result = await exec('echo "evil" > SOUL.md');
		expect(result).toContain("P53 Violation");
	});

	it("blocks sed -i on DOMAIN.md", async () => {
		const result = await exec('sed -i "s/good/evil/" DOMAIN.md');
		expect(result).toContain("P53 Violation");
	});

	it("blocks mv targeting TOOLS.md", async () => {
		const result = await exec("mv /tmp/evil.md TOOLS.md");
		expect(result).toContain("P53 Violation");
	});

	it("blocks cp targeting LESSONS.md", async () => {
		const result = await exec("cp /tmp/evil.md LESSONS.md");
		expect(result).toContain("P53 Violation");
	});

	// --- Allowed: read-only commands ---

	it("allows cat SOUL.md (read-only)", async () => {
		// cat doesn't contain any write indicator, so it passes the inline guard.
		// It may fail for other reasons (file not found), but NOT P53.
		const result = await exec("cat SOUL.md");
		expect(result).not.toContain("P53 Violation");
	});

	it("allows grep in DOMAIN.md (read-only)", async () => {
		const result = await exec('grep -n "test" DOMAIN.md');
		expect(result).not.toContain("P53 Violation");
	});

	it("allows head TOOLS.md (read-only)", async () => {
		const result = await exec("head -5 TOOLS.md");
		expect(result).not.toContain("P53 Violation");
	});

	it("allows wc on LESSONS.md (read-only)", async () => {
		const result = await exec("wc -l LESSONS.md");
		expect(result).not.toContain("P53 Violation");
	});

	// --- Allowed: normal commands not targeting protected files ---

	it("allows python commands not targeting protected files", async () => {
		const result = await exec('python3 -c "print(42)"');
		expect(result).not.toContain("P53 Violation");
	});

	it("allows node commands not targeting protected files", async () => {
		const result = await exec('node -e "console.log(42)"');
		expect(result).not.toContain("P53 Violation");
	});

	it("allows ls command", async () => {
		const result = await exec("ls -la");
		expect(result).not.toContain("P53 Violation");
	});
});

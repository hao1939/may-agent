import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("May analysis container sandbox", () => {
  it("allows Bubblewrap user namespaces without granting SYS_ADMIN", () => {
    const compose = readFileSync(new URL("../../container/compose.yml", import.meta.url), "utf8");
    const dockerfile = readFileSync(new URL("../../container/Dockerfile", import.meta.url), "utf8");

    expect(dockerfile).toContain("bubblewrap");
    expect(compose).toContain("- seccomp=unconfined");
    expect(compose).not.toContain("- SYS_ADMIN");
    expect(compose).not.toContain("privileged: true");
  });
});

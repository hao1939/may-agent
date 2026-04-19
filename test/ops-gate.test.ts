import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logOpsReceipt, getReceipts } from "../src/lib/ops-gate.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let TMP_BASE: string;

beforeEach(() => {
  TMP_BASE = mkdtempSync(join(tmpdir(), "ops-gate-test-"));
});

afterEach(() => {
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
});

describe("logOpsReceipt", () => {
  it("creates file and appends valid JSONL", () => {
    logOpsReceipt("deploy", "success", { version: "2.1" }, TMP_BASE);

    const fp = join(TMP_BASE, "ops-receipts.jsonl");
    expect(existsSync(fp)).toBe(true);

    const raw = readFileSync(fp, "utf-8").trim();
    const receipt = JSON.parse(raw);

    expect(receipt.id).toBeDefined();
    expect(typeof receipt.id).toBe("string");
    expect(receipt.id.length).toBeGreaterThan(0);
    expect(receipt.action).toBe("deploy");
    expect(receipt.result).toBe("success");
    expect(receipt.context).toEqual({ version: "2.1" });
    expect(receipt.timestamp).toBeDefined();
  });

  it("multiple receipts append correctly", () => {
    logOpsReceipt("deploy", "success", { v: 1 }, TMP_BASE);
    logOpsReceipt("rollback", "failed", { v: 2 }, TMP_BASE);
    logOpsReceipt("restart", "success", { v: 3 }, TMP_BASE);

    const fp = join(TMP_BASE, "ops-receipts.jsonl");
    const lines = readFileSync(fp, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(3);

    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed[0].action).toBe("deploy");
    expect(parsed[1].action).toBe("rollback");
    expect(parsed[2].action).toBe("restart");

    // Each should have a unique id
    const ids = new Set(parsed.map((r: { id: string }) => r.id));
    expect(ids.size).toBe(3);
  });

  it("promotes agent from context to top-level field", () => {
    logOpsReceipt("deploy", "success", { agent: "may", env: "prod" }, TMP_BASE);

    const receipts = getReceipts(undefined, TMP_BASE);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].agent).toBe("may");
    expect(receipts[0].context).toEqual({ agent: "may", env: "prod" });
  });
});

describe("getReceipts", () => {
  it("returns all receipts with no filter", () => {
    logOpsReceipt("deploy", "success", {}, TMP_BASE);
    logOpsReceipt("rollback", "failed", {}, TMP_BASE);

    const all = getReceipts(undefined, TMP_BASE);
    expect(all).toHaveLength(2);
  });

  it("filters by action", () => {
    logOpsReceipt("deploy", "success", {}, TMP_BASE);
    logOpsReceipt("rollback", "failed", {}, TMP_BASE);
    logOpsReceipt("deploy", "failed", {}, TMP_BASE);

    const deploys = getReceipts({ action: "deploy" }, TMP_BASE);
    expect(deploys).toHaveLength(2);
    expect(deploys.every((r) => r.action === "deploy")).toBe(true);
  });

  it("filters by since (ISO date string comparison)", () => {
    logOpsReceipt("old", "ok", {}, TMP_BASE);

    // Read the first receipt's timestamp, then craft a "since" just after it
    const all = getReceipts(undefined, TMP_BASE);
    const firstTs = all[0].timestamp;

    // Create a timestamp 2 seconds after the first to avoid sub-second race
    const sinceDate = new Date(new Date(firstTs).getTime() + 2000).toISOString();

    // Ensure the "new" receipt gets a timestamp after sinceDate
    const futureTs = new Date(new Date(sinceDate).getTime() + 1000).toISOString();
    // Monkey-patch Date to force a future timestamp for the next receipt
    const origNow = Date.now;
    Date.now = () => new Date(futureTs).getTime();
    const origToISOString = Date.prototype.toISOString;
    Date.prototype.toISOString = function () {
      return futureTs;
    };
    try {
      logOpsReceipt("new", "ok", {}, TMP_BASE);
    } finally {
      Date.now = origNow;
      Date.prototype.toISOString = origToISOString;
    }

    const recent = getReceipts({ since: sinceDate }, TMP_BASE);
    expect(recent).toHaveLength(1);
    expect(recent[0].action).toBe("new");
  });

  it("returns [] on nonexistent file", () => {
    const missing = join(TMP_BASE, "subdir-that-does-not-exist");
    const result = getReceipts(undefined, missing);
    expect(result).toEqual([]);
  });
});

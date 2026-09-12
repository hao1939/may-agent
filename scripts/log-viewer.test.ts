import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { appendSessionMessage, sessionDir, sessionJsonlPath } from "../src/lib/persistence.js";

const chrome = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((path) => path && existsSync(path));
const skip = process.env.E2E_NO_UI === "1" || !chrome;
if (process.env.CI && skip) throw new Error("Log viewer test requires Chrome and E2E_NO_UI unset");
if (skip) console.warn("Log viewer test skipped: Chrome unavailable or E2E_NO_UI=1");

test.skipIf(skip)(
  "offline viewer renders current persisted messages without treating text as HTML",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "may-log-viewer-"));
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
      mkdirSync(sessionDir(root, "sample"), { recursive: true });
      appendSessionMessage(root, "sample", {
        role: "user",
        content: "Inspect the sample <b>literally</b>",
        timestamp: 1000,
      });
      appendSessionMessage(root, "sample", {
        role: "toolResult",
        toolCallId: "read-1",
        toolName: "<img src=x>",
        isError: true,
        content: [{ type: "text", text: "Sample file unavailable" }],
        timestamp: 2000,
      });
      appendSessionMessage(root, "sample", {
        role: "user",
        content: [{ type: "text", text: "Use the retained evidence" }],
        timestamp: 3000,
      });
      browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(new URL("log-viewer.html", import.meta.url).href);
      const input = await page.$("#file-input");
      if (!input) throw new Error("Log viewer file selector missing");
      await input.uploadFile(sessionJsonlPath(root, "sample"));
      await page.waitForSelector("#app", { visible: true });
      expect(await page.$$(".message")).toHaveLength(3);
      expect(await page.$eval("#timeline", (element) => element.textContent)).toContain(
        "Inspect the sample <b>literally</b>",
      );
      expect(await page.$eval(".tool-result", (element) => element.textContent)).toContain("Sample file unavailable");
      expect(await page.$$("#timeline img, #timeline b")).toHaveLength(0);
      expect(await page.$eval("#stats-bar", (element) => element.textContent)).toContain("3");
      expect(errors).toEqual([]);
    } finally {
      await browser?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
  30_000,
);

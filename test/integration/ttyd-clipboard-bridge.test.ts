import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";

const repoRoot = resolve(import.meta.dirname, "../..");
const patcher = resolve(repoRoot, "container/patch-ttyd-index.cjs");
const bridge = resolve(repoRoot, "container/ttyd-clipboard-bridge.js");
const tempDirs: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("ttyd clipboard bridge", () => {
  test("installs the bridge before ttyd starts and registers OSC-52 once", async () => {
    const dir = mkdtempSync(join(tmpdir(), "may-ttyd-clipboard-"));
    const index = join(dir, "index.html");
    tempDirs.push(dir);
    writeFileSync(index, "<html><head></head><body><script>s(e.onSelectionChange(()=>{}))</script></body></html>");

    await execFileAsync("node", [patcher, index, bridge], { encoding: "utf8", timeout: 5_000 });
    const patched = readFileSync(index, "utf8");
    expect(patched).toContain("registerOscHandler(52");
    expect(patched.match(/registerOscHandler\(52/g)).toHaveLength(1);
    expect(patched.indexOf("data-may-clipboard-bridge"))
      .toBeLessThan(patched.indexOf("registerOscHandler(52"));
  });

  test("fails closed when the pinned ttyd initialization anchor drifts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "may-ttyd-clipboard-"));
    const index = join(dir, "index.html");
    tempDirs.push(dir);
    writeFileSync(index, "<html><head></head><body>changed ttyd bundle</body></html>");

    await expect(execFileAsync("node", [patcher, index, bridge], { encoding: "utf8", timeout: 5_000 }))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("expected one ttyd terminal anchor") });
  });

  test("decodes UTF-8 strictly and removes terminal control characters", () => {
    const source = readFileSync(bridge, "utf8");
    expect(source).toContain('new TextDecoder("utf-8", { fatal: true })');
    expect(source).toContain("MAX_TEXT_BYTES = 1024 * 1024");
    expect(source).toContain("\\u0000-\\u0008");
    expect(source).toContain('showToast("Clipboard data rejected")');
  });

  test("copies Unicode while preserving layout and removing control bytes", async () => {
    const copied: string[] = [];
    const elements = new Map<string, Record<string, unknown>>();
    const document = {
      activeElement: null,
      addEventListener() {},
      getElementById(id: string) { return elements.get(id) || null; },
      createElement() {
        return {
          style: {}, hidden: false, id: "", textContent: "", value: "",
          setAttribute() {}, addEventListener() {}, focus() {}, select() {}, remove() {},
        };
      },
      body: {
        appendChild(element: { id?: string }) {
          if (element.id) elements.set(element.id, element);
        },
      },
      execCommand() { return false; },
    };
    const window: Record<string, unknown> = { isSecureContext: true };
    runInNewContext(readFileSync(bridge, "utf8"), {
      window,
      document,
      navigator: { clipboard: { writeText(text: string) { copied.push(text); return Promise.resolve(); } } },
      TextDecoder,
      Uint8Array,
      atob,
      setTimeout() { return 1; },
      clearTimeout() {},
    });

    const input = "first line\n世界 😀\tvalue\u0000\u0007";
    const encoded = Buffer.from(input, "utf8").toString("base64");
    const clipboard = window.__mayTerminalClipboard as { receive(data: string): void };
    clipboard.receive(`c;${encoded}`);
    await Promise.resolve();
    await Promise.resolve();

    expect(copied).toEqual(["first line\n世界 😀\tvalue"]);
  });

  test("requires a real click instead of claiming an insecure automatic copy", () => {
    let execCalls = 0;
    let copyClick: (() => void) | undefined;
    const elements = new Map<string, Record<string, unknown>>();
    const document = {
      activeElement: null,
      addEventListener() {},
      getElementById(id: string) { return elements.get(id) || null; },
      createElement(tag: string) {
        return {
          style: {}, hidden: false, id: "", textContent: "", value: "",
          setAttribute() {}, focus() {}, select() {}, remove() {},
          addEventListener(type: string, callback: () => void) {
            if (tag === "button" && type === "click") copyClick = callback;
          },
        };
      },
      body: {
        appendChild(element: { id?: string }) {
          if (element.id) elements.set(element.id, element);
        },
      },
      execCommand() { execCalls += 1; return true; },
    };
    const window: Record<string, unknown> = { isSecureContext: false };
    runInNewContext(readFileSync(bridge, "utf8"), {
      window,
      document,
      navigator: {},
      TextDecoder,
      Uint8Array,
      atob,
      setTimeout() { return 1; },
      clearTimeout() {},
    });

    const clipboard = window.__mayTerminalClipboard as { receive(data: string): void };
    clipboard.receive(`c;${Buffer.from("copy me").toString("base64")}`);

    expect(execCalls).toBe(0);
    expect(copyClick).toBeFunction();
    copyClick?.();
    expect(execCalls).toBe(1);
  });
});

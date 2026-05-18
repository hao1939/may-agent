/**
 * project-schema.test.ts
 *
 * Round-trip and edge-case coverage for parseProjectMeta / updateField.
 * Specifically protects against Bug E: multi-line `stop_reason` values
 * being silently truncated during YAML frontmatter write-back.
 */
import { describe, it, expect } from "bun:test";
import {
  parseProjectMeta,
  updateField,
  validateProjectFormat,
} from "./project-schema.js";

function wrap(frontmatter: string): string {
  return `---\n${frontmatter}\n---\n\n# Body\n\nbody text\n`;
}

describe("project-schema scalar round-trip (Bug E regression)", () => {
  it("preserves single-line stop_reason on round-trip via updateField", () => {
    const content = wrap("id: p\nowner: may\nstatus: blocked");
    const updated = updateField(content, "Stop Reason", "Waiting on standalone build");
    const meta = parseProjectMeta(updated);
    expect(meta.stop_reason).toBe("Waiting on standalone build");
  });

  it("preserves multi-line stop_reason on round-trip (the actual bug)", () => {
    const content = wrap("id: p\nowner: may\nstatus: blocked");
    const multiline = "Line one of blocker.\nLine two with more detail.\nLine three.";
    const updated = updateField(content, "Stop Reason", multiline);
    // The on-disk frontmatter must contain the encoded form somewhere…
    expect(updated).toContain('stop_reason: "Line one of blocker.\\nLine two with more detail.\\nLine three."');
    // …and a second parse must recover the original value exactly.
    const meta = parseProjectMeta(updated);
    expect(meta.stop_reason).toBe(multiline);
  });

  it("preserves values containing double-quotes and backslashes", () => {
    const content = wrap("id: p\nowner: may\nstatus: blocked");
    const tricky = String.raw`path "C:\Users\foo" not found`;
    const updated = updateField(content, "Stop Reason", tricky);
    const meta = parseProjectMeta(updated);
    expect(meta.stop_reason).toBe(tricky);
  });

  it("preserves values containing ': ' which would otherwise split into a new field", () => {
    const content = wrap("id: p\nowner: may\nstatus: blocked");
    const value = "build: failed at step 3";
    const updated = updateField(content, "Stop Reason", value);
    // Encoded form must be quoted to prevent ': ' from being parsed as another field.
    expect(updated).toContain(`stop_reason: "build: failed at step 3"`);
    const meta = parseProjectMeta(updated);
    expect(meta.stop_reason).toBe(value);
    // And no spurious `failed` field appeared.
    expect(meta.failed).toBeUndefined();
  });

  it("emits bare scalars for ordinary single-line values", () => {
    const content = wrap("id: p\nowner: may\nstatus: blocked");
    const updated = updateField(content, "Status", "active");
    expect(updated).toContain("status: active\n");
    expect(updated).not.toContain('status: "active"');
  });

  it("round-trips an empty stop_reason via empty-string clearing", () => {
    const content = wrap('id: p\nowner: may\nstatus: blocked\nstop_reason: "some old reason"');
    const updated = updateField(content, "Stop Reason", "");
    // Empty values get dropped from frontmatter entirely.
    expect(updated).not.toMatch(/^stop_reason:/m);
    const meta = parseProjectMeta(updated);
    expect(meta.stop_reason).toBeUndefined();
  });

  it("validateProjectFormat accepts a properly quoted multi-line stop_reason", () => {
    const content = wrap('id: p\nowner: bob\nstatus: blocked\nstop_reason: "line1\\nline2"');
    expect(validateProjectFormat(content, "p")).toEqual([]);
  });
});

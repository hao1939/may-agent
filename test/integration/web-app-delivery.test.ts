import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");

describe("Web App response delivery", () => {
  it("acknowledges only after the response is rendered with its exact delivery identity", () => {
    const source = readFileSync(resolve(repoRoot, "packages/webui/static/pages/chat.js"), "utf8");
    const handlerStart = source.indexOf("case 'app_response_delivery_requested'");
    const handlerEnd = source.indexOf("case 'text'", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(handler.indexOf("messages.appendChild(div)")).toBeGreaterThan(-1);
    expect(handler.indexOf("socket.send(JSON.stringify(")).toBeGreaterThan(handler.indexOf("messages.appendChild(div)"));
    expect(handler).toContain("type: 'channel.delivery.completed'");
    expect(handler).toContain("operationId: data.operationId");
    expect(handler).toContain("appInboxItemId: data.appInboxItemId");
    expect(handler).toContain("appInboxRequestId: data.appInboxRequestId");
    expect(handler).toContain("sessionId: data.sessionId");
    expect(handler).toContain("channel: data.channel");
    expect(handler).toContain("idempotencyKey: `web-ui-delivery:${data.operationId}`");
  });
});

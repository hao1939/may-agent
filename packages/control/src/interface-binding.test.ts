import { expect, test } from "bun:test";
import { interfaceBinding } from "./interface-binding.js";

test("an empty installation is headless and identities are independent", () => {
  expect(interfaceBinding({})).toEqual({ agent: "host" });
  expect(interfaceBinding({ AGENT: "helper", DAEMON_AGENT: "legacy" }).agent).toBe("helper");
  expect(interfaceBinding({ DAEMON_AGENT: "helper" }).agent).toBe("helper");
  expect(interfaceBinding({ AGENT: "helper", CONVERSATION_APP: "support" })).toEqual({
    agent: "helper",
    appId: "support",
    conversationId: "support:primary",
  });
  expect(
    interfaceBinding({ AGENT: "helper", CONVERSATION_APP: "support", CONVERSATION_ID: "retained" }).conversationId,
  ).toBe("retained");
  expect(() => interfaceBinding({ CONVERSATION_ID: "orphan" })).toThrow("requires CONVERSATION_APP");
});

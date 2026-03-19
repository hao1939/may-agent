import type { ToolContext } from "../../../src/lib/types.js";
import { Type } from "@sinclair/typebox";

export default function(context: ToolContext) {
  return {
    name: "test_dynamic",
    description: "Verifies dynamic tool loading works. Echo test.",
    schema: Type.Object({ echo: Type.String({ description: "Text to echo back" }) }),
    execute: async ({ echo }: { echo: string }) => `Dynamic tool loaded! agentRoot=${context.agentRoot}, echo=${echo}`,
  };
}

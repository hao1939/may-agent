import { describe, it, expect } from "vitest";
import { parseCodexStream, formatCodexEnvelope } from "../codex-stream-parser";

describe("parseCodexStream", () => {
  it("captures agent_message and command_execution items", () => {
    const stream = [
      JSON.stringify({type:"thread.started",thread_id:"t-1"}),
      JSON.stringify({type:"turn.started"}),
      JSON.stringify({type:"item.completed",item:{id:"i0",type:"agent_message",text:"Hello there"}}),
      JSON.stringify({type:"item.completed",item:{id:"i1",type:"command_execution",command:"ls /tmp",aggregated_output:"foo\nbar\n",exit_code:0,status:"completed"}}),
      JSON.stringify({type:"turn.completed",usage:{input_tokens:100,output_tokens:5}}),
    ].join("\n");
    const env = parseCodexStream(stream, "Reading additional input from stdin...\n", 0);
    expect(env.status).toBe("completed");
    expect(env.thread_id).toBe("t-1");
    expect(env.last_message).toBe("Hello there");
    expect(env.agent_messages.length).toBe(1);
    expect(env.tool_outputs.length).toBe(1);
    expect(env.tool_outputs[0].tool).toBe("command_execution");
    expect(env.tool_outputs[0].stdout_tail).toContain("foo");
    expect(env.tool_outputs[0].exit_code).toBe(0);
    expect(env.usage?.input_tokens).toBe(100);
  });

  it("flags command_execution non-zero exit as error", () => {
    const stream = JSON.stringify({type:"item.completed",item:{id:"i1",type:"command_execution",command:"false",aggregated_output:"",exit_code:1,status:"completed"}});
    const env = parseCodexStream(stream, "", 0);
    expect(env.tool_outputs[0].is_error).toBe(true);
    expect(env.tool_outputs[0].exit_code).toBe(1);
  });

  it("returns no_output when JSONL never arrived (the production codex_worker bug)", () => {
    // Reproduces the historical 48-byte stderr-only result
    const env = parseCodexStream("", "Reading additional input from stdin...\n", 0);
    expect(env.status).toBe("no_output");
    expect(env.tool_outputs.length).toBe(0);
    const out = formatCodexEnvelope(env);
    expect(out).toContain("status=no_output");
    expect(out).toContain("Codex produced NO JSONL output");
    expect(out).toContain("auth failure");
    // Critical: master must see actionable diagnosis, not just stderr noise
  });

  it("marks timed_out on SIGTERM with partial output", () => {
    const stream = [
      JSON.stringify({type:"thread.started",thread_id:"t-2"}),
      JSON.stringify({type:"item.completed",item:{id:"i0",type:"agent_message",text:"working on it"}}),
    ].join("\n");
    const env = parseCodexStream(stream, "", 143);
    expect(env.status).toBe("timed_out");
    expect(env.last_message).toBe("working on it");
  });

  it("preserves multiple agent messages in order", () => {
    const stream = [
      JSON.stringify({type:"item.completed",item:{id:"i0",type:"agent_message",text:"first"}}),
      JSON.stringify({type:"item.completed",item:{id:"i1",type:"agent_message",text:"second"}}),
      JSON.stringify({type:"item.completed",item:{id:"i2",type:"agent_message",text:"third"}}),
    ].join("\n");
    const env = parseCodexStream(stream, "", 0);
    expect(env.agent_messages).toEqual(["first","second","third"]);
    expect(env.last_message).toBe("third");
  });

  it("captures unknown item types defensively", () => {
    const stream = JSON.stringify({type:"item.completed",item:{id:"i0",type:"reasoning",content:"thinking..."}});
    const env = parseCodexStream(stream, "", 0);
    expect(env.tool_outputs.length).toBe(1);
    expect(env.tool_outputs[0].tool).toBe("item:reasoning");
  });

  it("formatCodexEnvelope produces readable status header", () => {
    const env = parseCodexStream(
      JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"ok"}}),
      "",
      0
    );
    const out = formatCodexEnvelope(env);
    expect(out).toContain("status=completed");
    expect(out).toContain("Last agent message");
    expect(out).toContain("ok");
  });
});

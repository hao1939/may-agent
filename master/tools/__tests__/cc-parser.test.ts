import { describe, it, expect } from "bun:test";
import { parseCCStream, formatEnvelope } from "../cc-stream-parser";

describe("parseCCStream", () => {
  it("captures tool_use_result from user message blocks", () => {
    const stream = [
      JSON.stringify({type:"system",session_id:"abc",subtype:"init"}),
      JSON.stringify({type:"assistant",message:{content:[
        {type:"text",text:"Let me cat the file"},
        {type:"tool_use",id:"t1",name:"Bash",input:{command:"cat foo.md"}}
      ]}}),
      JSON.stringify({type:"user",message:{content:[
        {type:"tool_result",tool_use_id:"t1",content:"hello world",is_error:false}
      ]}}),
      JSON.stringify({type:"result",result:"Done.",session_id:"abc"})
    ].join("\n");
    const env = parseCCStream(stream, "", 0);
    expect(env.status).toBe("completed");
    expect(env.session_id).toBe("abc");
    expect(env.tool_outputs.length).toBe(1);
    expect(env.tool_outputs[0].tool).toBe("Bash");
    expect(env.tool_outputs[0].stdout_tail).toContain("hello world");
    expect(env.result_text).toBe("Done.");
  });

  it("rescues stdout from truncated stream", () => {
    const truncated = `{"type":"system","subtype":"init","session_id":"abc"}
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"---\\nid: foo\\nstatus: active\\n---"`;
    const env = parseCCStream(truncated, "", 143);
    expect(env.status).toBe("timed_out");
    expect(env.tool_outputs.length).toBeGreaterThan(0);
    // either parsed cleanly or rescued
    const allText = env.tool_outputs.map(t => t.stdout_tail).join("");
    expect(allText).toContain("id: foo");
  });

  it("marks status timed_out on SIGTERM exit", () => {
    const env = parseCCStream("", "Warning: no stdin", 143);
    expect(env.status).toBe("timed_out");
  });

  it("does not duplicate same tool_result via both paths", () => {
    const stream = JSON.stringify({type:"user",message:{content:[
      {type:"tool_result",tool_use_id:"t1",content:"X",is_error:false}
    ]}});
    const env = parseCCStream(stream, "", 0);
    expect(env.tool_outputs.length).toBe(1);
  });

  it("formatEnvelope produces readable output with status header", () => {
    const stream = JSON.stringify({type:"user",message:{content:[
      {type:"tool_result",tool_use_id:"t1",content:"line1\nline2"}
    ]}});
    const env = parseCCStream(stream, "", 143);
    const out = formatEnvelope(env);
    expect(out).toContain("status=timed_out");
    expect(out).toContain("line1");
    expect(out).toContain("cut off mid-stream");
  });

  it("handles empty stream cleanly", () => {
    const env = parseCCStream("", "", 0);
    expect(env.status).toBe("completed");
    expect(env.tool_outputs.length).toBe(0);
  });
});

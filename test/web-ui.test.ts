import { describe, it, expect } from "vitest";

// Simulate the marked library
const marked = {
  parse: (text: string) => {
    // Simple mock — just wrap in <p> and handle bold
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(.+)$/gm, '<p>$1</p>');
  }
};

// Extract the core functions from the web UI
function renderAssistantMsg(el: { dataset: Record<string, string>; innerHTML: string; textContent: string; classList: { add: (c: string) => void; remove: (c: string) => void } }, text: string, renderMd: boolean) {
  el.dataset.raw = text;
  if (renderMd) {
    el.innerHTML = marked.parse(text);
    el.classList.add('md-rendered');
  } else {
    el.textContent = text;
    el.classList.remove('md-rendered');
  }
}

function toggleMarkdown(elements: any[], renderMd: boolean): boolean {
  const newMode = !renderMd;
  for (const el of elements) {
    const raw = el.dataset.raw;
    if (!raw) continue;
    if (newMode) {
      el.innerHTML = marked.parse(raw);
      el.classList.add('md-rendered');
    } else {
      el.textContent = raw;
      el.classList.remove('md-rendered');
    }
  }
  return newMode;
}

describe("Web UI markdown rendering", () => {
  function makeEl() {
    const classes = new Set<string>();
    return {
      dataset: {} as Record<string, string>,
      innerHTML: "",
      textContent: "",
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        has: (c: string) => classes.has(c),
      }
    };
  }

  it("renders markdown by default", () => {
    const el = makeEl();
    renderAssistantMsg(el, "**bold** text", true);
    expect(el.innerHTML).toContain("<strong>bold</strong>");
    expect(el.dataset.raw).toBe("**bold** text");
    expect(el.classList.has("md-rendered")).toBe(true);
  });

  it("renders raw text when markdown disabled", () => {
    const el = makeEl();
    renderAssistantMsg(el, "**bold** text", false);
    expect(el.textContent).toBe("**bold** text");
    expect(el.innerHTML).toBe(""); // textContent assignment doesn't set innerHTML
    expect(el.classList.has("md-rendered")).toBe(false);
  });

  it("stores raw text in dataset for toggle", () => {
    const el = makeEl();
    renderAssistantMsg(el, "# Hello\n\nworld", true);
    expect(el.dataset.raw).toBe("# Hello\n\nworld");
  });

  it("toggle switches from markdown to raw", () => {
    const el = makeEl();
    renderAssistantMsg(el, "**bold**", true);
    expect(el.innerHTML).toContain("<strong>");
    
    const newMode = toggleMarkdown([el], true); // was true, toggle to false
    expect(newMode).toBe(false);
    expect(el.textContent).toBe("**bold**");
    expect(el.classList.has("md-rendered")).toBe(false);
  });

  it("toggle switches from raw to markdown", () => {
    const el = makeEl();
    renderAssistantMsg(el, "**bold**", false);
    
    const newMode = toggleMarkdown([el], false); // was false, toggle to true
    expect(newMode).toBe(true);
    expect(el.innerHTML).toContain("<strong>");
    expect(el.classList.has("md-rendered")).toBe(true);
  });

  it("toggle re-renders all elements", () => {
    const el1 = makeEl();
    const el2 = makeEl();
    renderAssistantMsg(el1, "**first**", true);
    renderAssistantMsg(el2, "**second**", true);
    
    const newMode = toggleMarkdown([el1, el2], true);
    expect(newMode).toBe(false);
    expect(el1.textContent).toBe("**first**");
    expect(el2.textContent).toBe("**second**");
  });

  it("skips elements without raw data", () => {
    const el = makeEl();
    // No renderAssistantMsg called, so no dataset.raw
    const newMode = toggleMarkdown([el], true);
    expect(newMode).toBe(false);
    expect(el.innerHTML).toBe("");
    expect(el.textContent).toBe("");
  });

  it("streaming: accumulates text and re-renders", () => {
    const el = makeEl();
    let raw = "";
    
    // Simulate streaming: 3 text deltas
    raw += "Hello ";
    renderAssistantMsg(el, raw, true);
    expect(el.dataset.raw).toBe("Hello ");
    
    raw += "**world** ";
    renderAssistantMsg(el, raw, true);
    expect(el.innerHTML).toContain("<strong>world</strong>");
    
    raw += "done";
    renderAssistantMsg(el, raw, true);
    expect(el.dataset.raw).toBe("Hello **world** done");
    expect(el.innerHTML).toContain("<strong>world</strong>");
  });

  it("toggle during streaming preserves accumulated text", () => {
    const el = makeEl();
    let raw = "**partial** stream";
    renderAssistantMsg(el, raw, true);
    
    // Toggle to raw mid-stream
    toggleMarkdown([el], true);
    expect(el.textContent).toBe("**partial** stream");
    
    // More text arrives — renderAssistantMsg called with raw mode
    raw += " more";
    renderAssistantMsg(el, raw, false);
    expect(el.textContent).toBe("**partial** stream more");
  });
});

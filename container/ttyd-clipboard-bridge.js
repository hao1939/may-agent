(() => {
  "use strict";

  const MAX_TEXT_BYTES = 1024 * 1024;
  let pendingText = "";
  let actionButton = null;
  let toastTimer = null;

  function decodeOsc52(data) {
    const separator = data.indexOf(";");
    if (separator < 1) throw new Error("missing OSC-52 selection target");
    const payload = data.slice(separator + 1);
    if (!payload || payload === "?") return null;
    if (payload.length > Math.ceil(MAX_TEXT_BYTES * 4 / 3) + 4) {
      throw new Error("OSC-52 payload is too large");
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
      throw new Error("OSC-52 payload is not valid Base64");
    }

    const binary = atob(payload);
    if (binary.length > MAX_TEXT_BYTES) throw new Error("OSC-52 text is too large");
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Preserve tabs and line endings, but never put terminal control bytes on
    // the client clipboard. ANSI/OSC framing is consumed by xterm's parser.
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  }

  function showToast(message) {
    let toast = document.getElementById("may-terminal-clipboard-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "may-terminal-clipboard-toast";
      Object.assign(toast.style, {
        position: "fixed", right: "12px", bottom: "12px", zIndex: "2147483647",
        padding: "7px 10px", borderRadius: "6px", color: "#fff",
        background: "rgba(25,25,28,.92)", font: "12px system-ui,sans-serif",
        pointerEvents: "none",
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
  }

  function legacyCopy(text) {
    const active = document.activeElement;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    Object.assign(textarea.style, {
      position: "fixed", left: "-10000px", top: "0", opacity: "0",
    });
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch {}
    textarea.remove();
    try { active?.focus({ preventScroll: true }); } catch {}
    return copied;
  }

  function removeAction() {
    actionButton?.remove();
    actionButton = null;
  }

  function copyFromClick() {
    const text = pendingText;
    if (!text) return;
    const clipboard = navigator.clipboard;
    if (window.isSecureContext && clipboard?.writeText) {
      clipboard.writeText(text).then(() => {
        removeAction();
        showToast("Copied to system clipboard");
      }).catch(() => {
        if (legacyCopy(text)) {
          removeAction();
          showToast("Copied to system clipboard");
        }
      });
    } else if (legacyCopy(text)) {
      removeAction();
      showToast("Copied to system clipboard");
    }
  }

  function showCopyAction() {
    if (!actionButton) {
      actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.textContent = "Copy to system clipboard";
      actionButton.addEventListener("click", copyFromClick);
      Object.assign(actionButton.style, {
        position: "fixed", right: "12px", bottom: "12px", zIndex: "2147483647",
        padding: "8px 12px", border: "1px solid #777", borderRadius: "6px",
        color: "#fff", background: "#28282d", font: "12px system-ui,sans-serif",
        cursor: "pointer",
      });
      document.body.appendChild(actionButton);
    }
  }

  function receive(data) {
    let text;
    try { text = decodeOsc52(data); } catch {
      showToast("Clipboard data rejected");
      return;
    }
    if (text === null) return;
    pendingText = text;

    const clipboard = navigator.clipboard;
    if (window.isSecureContext && clipboard?.writeText) {
      clipboard.writeText(text).then(() => {
        removeAction();
        showToast("Copied to system clipboard");
      }).catch(() => {
        showCopyAction();
      });
    } else {
      // OSC-52 arrives asynchronously from the terminal. On an insecure HTTP
      // origin, execCommand may return true without updating the OS clipboard
      // because this callback is no longer a browser user gesture. Require a
      // real click instead of showing a false success toast.
      showCopyAction();
    }
  }

  // Keep right-click available to Herdr's pane/tab menus, without stopping
  // propagation to xterm's mouse protocol.
  document.addEventListener("contextmenu", event => event.preventDefault(), true);
  window.__mayTerminalClipboard = { receive };
})();

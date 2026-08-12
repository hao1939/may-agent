#!/usr/bin/env node
const fs = require("node:fs");

const [indexPath, bridgePath] = process.argv.slice(2);
if (!indexPath || !bridgePath) {
  throw new Error("usage: patch-ttyd-index.cjs <index.html> <clipboard-bridge.js>");
}

let index = fs.readFileSync(indexPath, "utf8");
const bridge = fs.readFileSync(bridgePath, "utf8");
const terminalAnchor = "s(e.onSelectionChange";
const terminalAnchorCount = index.split(terminalAnchor).length - 1;
if (terminalAnchorCount !== 1) {
  throw new Error(`expected one ttyd terminal anchor, found ${terminalAnchorCount}`);
}
if ((index.match(/<\/head>/g) || []).length !== 1) {
  throw new Error("expected exactly one </head> in ttyd index");
}
if (bridge.includes("</script>")) {
  throw new Error("clipboard bridge must not contain a closing script tag");
}

const osc52Hook =
  "s(e.parser.registerOscHandler(52,(e=>(window.__mayTerminalClipboard.receive(e),!0))))," +
  terminalAnchor;
index = index.replace(terminalAnchor, osc52Hook);
index = index.replace(
  "</head>",
  `<script data-may-clipboard-bridge>\n${bridge}\n</script>\n</head>`,
);
fs.writeFileSync(indexPath, index);

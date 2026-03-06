import http from 'node:http';

const CDP_PORT = 9222;
const CDP_HOST = 'localhost';

async function test() {
  console.log("Starting debug-ws-minimal.mjs...");
  try {
    const tab = await getTab();
    console.log("Tab found:", tab.webSocketDebuggerUrl);
    
    // Explicitly check if WebSocket exists in global scope
    if (typeof WebSocket === 'undefined') {
        console.error("CRITICAL: WebSocket is not defined in this environment!");
        process.exit(1);
    } else {
        console.log("WebSocket is available.");
    }

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    
    ws.onopen = () => {
        console.log("WS Open Success");
        ws.close();
        process.exit(0);
    };
    ws.onerror = (e) => {
        console.log("WS Error", e);
        process.exit(1);
    };
    ws.onclose = () => console.log("WS Close");
    
  } catch (e) {
    console.log("Error:", e);
    process.exit(1);
  }
}

async function getTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://${CDP_HOST}:${CDP_PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
            const tabs = JSON.parse(data);
            const xhsTab = tabs.find(t => t.url.includes('xiaohongshu.com') && t.type === 'page');
            resolve(xhsTab || tabs[0]);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

test();
